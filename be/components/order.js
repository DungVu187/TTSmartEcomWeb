const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateUser, authenticateAdmin, checkPermission, User } = require("./user");
require("dotenv").config();
const { Product } = require('./product');
const { sendNewOrderNotification } = require('../mailer');
const { sendZaloOrderNotification } = require('../zaloService');
const { sendTelegramOrderNotification } = require('../telegramService');
const { Station } = require('./station');
const { StorageHistory } = require("./storagehistory");
const {
  InventoryError,
  applyStockAdjustments,
  isVersionConflict,
  rollbackOrThrow,
} = require('../services/inventory');
const { getCustomerStationProductIds } = require('../services/productAccess');
const { isContactOnlyVariant } = require('../services/productPricing');

const router = express.Router();

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getUpdatedImgUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;
  const address = process.env.ADDRESS;
  if (!address) return originalUrl;

  const paths = ['/images/', '/station/', '/section-images/'];
  for (const p of paths) {
    const idx = originalUrl.indexOf(p);
    if (idx !== -1) {
      return address.replace(/\/$/, '') + originalUrl.substring(idx);
    }
  }
  return originalUrl;
};

const privilegedOrderRoles = ["admin", "superadmin", "staff"];

const canAccessOrder = (order, user) => {
  return order.userPhone === user?.phone || privilegedOrderRoles.includes(user?.role);
};

const counterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true
    },
    // Draft admin co the tao truoc thong tin khach; route nhap that van validate phone.
    userPhone: {
      type: String,
      default: "",
    },
    userName: {
      type: String,
    },
    cartItems: [
      {
        productId: { type: String, require: true },
        variantIndex: { type: Number, require: true },
        quantity: { type: Number, require: true },
      },
    ],
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "Processing",
      enum: ["Processing", "Delivering", "Completed"]
    },
    payment: {
      type: Boolean,
      default: false
    },
    state: {
      type: String,
      required: true,
      default: "Processing",
      enum: ["Processing", "Cancelled"]
    },
    completedAt: {
      type: Date,
      default: null
    },
    images: [{ type: String }]
  },
  { timestamps: true, optimisticConcurrency: true }
);

const Order = mongoose.model("Order", orderSchema);

const isLockedOrder = (order) => {
  return order.status === "Completed" || order.state === "Cancelled";
};

const parseOrderPrice = (price) => {
  if (typeof price === "number") return price;
  return Number(String(price || "0").replace(/\./g, "").replace(",", ".")) || 0;
};

async function computeOrderTotal(cartItems) {
  let total = 0;
  for (const it of cartItems || []) {
    const p = await Product.findById(it.productId);
    const v = p?.variant?.[it.variantIndex];
    if (v) total += parseOrderPrice(v.price) * (it.quantity || 0);
  }
  return total;
}

async function prepareOrderItemsForCreation(items, {
  enforcePublicProducts = false,
  allowedProductIds = null,
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: { status: 400, message: "Danh sách sản phẩm không hợp lệ" } };
  }

  const preparedItems = [];
  const productCache = new Map();
  const reservedStock = new Map();
  let total = 0;

  for (const rawItem of items) {
    const parsed = validateOrderItemInput(rawItem);
    if (parsed.message) {
      return { error: { status: 400, message: parsed.message } };
    }

    const item = parsed.value;
    let product = productCache.get(item.productId);
    if (!product) {
      product = await Product.findById(item.productId);
      if (product) {
        productCache.set(item.productId, product);
      }
    }
    if (!product) {
      return { error: { status: 404, message: `Sản phẩm với ID ${item.productId} không tồn tại.` } };
    }
    if (enforcePublicProducts && product.display !== true) {
      return { error: { status: 403, message: "Sản phẩm hiện không được phép bán." } };
    }
    if (allowedProductIds instanceof Set && !allowedProductIds.has(String(product._id))) {
      return {
        error: {
          status: 403,
          message: "Sản phẩm không thuộc phạm vi trạm được gán cho tài khoản.",
        },
      };
    }

    const variant = product.variant[item.variantIndex];
    if (!variant) {
      return { error: { status: 400, message: `Phiên bản sản phẩm không hợp lệ cho sản phẩm ${item.productId}.` } };
    }
    if (enforcePublicProducts && isContactOnlyVariant(variant)) {
      return {
        error: {
          status: 409,
          message: `Sản phẩm ${product.name} hiện chỉ nhận liên hệ.`,
        },
      };
    }

    const stockKey = `${product._id.toString()}:${item.variantIndex}`;
    const reservedQuantity = reservedStock.get(stockKey) || 0;
    if (variant.quantityForSale - reservedQuantity < item.quantity) {
      return {
        error: {
          status: 400,
          message: `Không đủ hàng cho sản phẩm ${product.name}, variant ${variant.color || 'default'}.`
        }
      };
    }
    reservedStock.set(stockKey, reservedQuantity + item.quantity);

    total += parseOrderPrice(variant.price) * item.quantity;
    preparedItems.push({
      product,
      variant,
      cartItem: item,
    });
  }

  return {
    preparedItems,
    cartItems: preparedItems.map((item) => item.cartItem),
    total,
  };
}

const createReservationAdjustments = (preparedItems) => preparedItems.map((item) => ({
  productId: item.product._id,
  variantIndex: item.cartItem.variantIndex,
  expectedVariantId: item.variant._id,
  quantityForSaleDelta: -item.cartItem.quantity,
}));

async function buildOrderStockAdjustments(cartItems, createDeltas, { skipMissing = false } = {}) {
  const adjustments = [];
  const entries = [];

  for (const item of cartItems) {
    const product = await Product.findById(item.productId)
      .select('name variant._id variant.quantityForSale variant.quantityInStorage purchaseCount');
    const variant = product?.variant?.[item.variantIndex];
    if (!product || !variant) {
      if (skipMissing) continue;
      throw new InventoryError(
        !product
          ? "Không tìm thấy sản phẩm trong đơn hàng."
          : "Không tìm thấy phiên bản sản phẩm trong đơn hàng.",
        {
          statusCode: 404,
          code: !product ? "PRODUCT_NOT_FOUND" : "VARIANT_NOT_FOUND",
        }
      );
    }

    adjustments.push({
      productId: product._id,
      variantIndex: item.variantIndex,
      expectedVariantId: variant._id,
      ...createDeltas(item),
    });
    entries.push({ item, product });
  }

  return { adjustments, entries };
}

async function saveWithStockRollback(document, appliedAdjustments) {
  try {
    return await document.save();
  } catch (error) {
    await rollbackOrThrow(appliedAdjustments, error);
  }
}

const getRouteErrorStatus = (error) => {
  if (error?.statusCode) return error.statusCode;
  if (isVersionConflict(error)) return 409;
  return 500;
};

const getRouteErrorMessage = (error, fallback) => {
  if (error?.statusCode) return error.message;
  if (isVersionConflict(error)) {
    return "Đơn hàng vừa được thay đổi bởi thao tác khác, vui lòng tải lại.";
  }
  return fallback;
};

async function enrichCartItems(cartItems) {
  return Promise.all((cartItems || []).map(async (it) => {
    const p = await Product.findById(it.productId);
    const v = p?.variant?.[it.variantIndex] || {};
    return {
      productId: it.productId,
      variantIndex: it.variantIndex,
      quantity: it.quantity,
      name: p?.name || "",
      code: p?.code || "",
      brand: p?.brand || "",
      imgUrl: getUpdatedImgUrl(v.imgUrl) || "",
      price: v.price || "0",
    };
  }));
}

const formatAdminOrderDetail = async (order) => ({
  _id: order._id,
  orderCode: order.orderCode,
  userName: order.userName,
  userPhone: order.userPhone,
  status: order.status,
  payment: order.payment,
  state: order.state,
  total: order.total,
  completedAt: order.completedAt,
  images: order.images || [],
  cartItems: await enrichCartItems(order.cartItems),
});

const formatAdminOrderWithItems = async (order) => ({
  ...order.toObject(),
  cartItems: await enrichCartItems(order.cartItems),
});

const validateOrderItemInput = (item) => {
  const quantity = Number(item.quantity);
  const variantIndex = Number(item.variantIndex);

  if (!mongoose.Types.ObjectId.isValid(item.productId)) {
    return { message: "Sản phẩm không hợp lệ" };
  }

  if (!Number.isInteger(variantIndex) || variantIndex < 0) {
    return { message: "Phiên bản sản phẩm không hợp lệ" };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { message: "Số lượng không hợp lệ" };
  }

  return {
    value: {
      productId: String(item.productId),
      variantIndex,
      quantity,
    },
  };
};

const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../upload/invoices");
    fs.mkdir(uploadDir, { recursive: true }, (error) => cb(error, uploadDir));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".webp";
    cb(null, `invoice-sale-${uniqueSuffix}${ext}`);
  },
});

const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, webp)."));
    }
  },
});

const handleInvoiceUpload = (req, res, next) => {
  uploadInvoice.single("invoice")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: 0,
        message: error.message || "File ảnh không hợp lệ",
      });
    }
    next();
  });
};

// API lấy danh sách đơn hàng với phân trang
router.get("/", [authenticateAdmin, checkPermission('order.view')], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      payment, 
      state, 
      phone,
      name,
      startDate, 
      endDate, 
      id,
      byCompletedDate,
    } = req.query;
    const filter = {};

    if (id) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter._id = id;
      } else {
        filter.orderCode = new RegExp(escapeRegex(id), "i");
      }
    }

    if (byCompletedDate === "true") {
      filter.status = "Completed";
    } else if (status) {
      filter.status = status;
    }

    if (payment) filter.payment = payment === "true";
    if (state) filter.state = state;
    if (phone) filter.userPhone = new RegExp(escapeRegex(phone), "i");
    if (name) filter.userName = new RegExp(escapeRegex(name), "i");

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0 - 7, 0, 0, 0);
        dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23 - 7, 59, 59, 999);
        dateFilter.$lte = end;
      }

      if (byCompletedDate === "true") {
        filter.$or = [
          { completedAt: dateFilter },
          { completedAt: { $exists: false }, createdAt: dateFilter },
          { completedAt: null, createdAt: dateFilter }
        ];
      } else {
        filter.createdAt = dateFilter;
      }
    }

    const sortField = byCompletedDate === "true" ? "completedAt" : "createdAt";

    const orders = await Order.find(filter)
      .sort({ [sortField]: -1 })
      .skip((page - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10));

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      total,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// API cập nhật trạng thái hoặc thanh toán của đơn hàng
router.get("/customer-suggestions", [authenticateAdmin, checkPermission('order.view')], async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name phone");
    res.json({
      success: true,
      customers: customers.map((customer) => ({
        name: customer.name,
        phone: customer.phone,
      })),
    });
  } catch (error) {
    console.error("Error fetching customer suggestions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.put('/update-order/:_id', [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  const { _id } = req.params;
  const { field, value } = req.body;
  const io = req.app.get('io'); // 👈

  if (!['status', 'payment'].includes(field)) {
    return res.status(400).json({ success: false, message: 'Invalid field' });
  }

  try {
    const order = await Order.findById(_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let appliedAdjustments = [];
    let stockHistoryEntries = [];

    if (field === 'status') {
      if (!["Processing", "Delivering", "Completed"].includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }

      // Không cho hoàn thành đơn đã bị hủy (state = 'Cancelled')
      if (value === "Completed" && order.state === "Cancelled") {
        return res.status(400).json({ success: false, message: 'Không thể hoàn thành đơn hàng đã bị hủy.' });
      }

      // Không cho hoàn thành đơn nháp thiếu số điện thoại người đặt
      if (value === "Completed" && !/^\d{10,11}$/.test(String(order.userPhone || ""))) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại hợp lệ trước khi hoàn thành đơn.' });
      }

      if (value === "Completed") {
        order.completedAt = new Date();
      } else {
        order.completedAt = null;
      }

      if (order.status !== value && value === "Completed") {
        const { adjustments, entries } = await buildOrderStockAdjustments(
          order.cartItems,
          (item) => ({
            quantityInStorageDelta: -item.quantity,
            purchaseCountDelta: item.quantity,
          })
        );
        appliedAdjustments = await applyStockAdjustments(adjustments);
        stockHistoryEntries = entries.map(({ item, product }) => ({
          productId: item.productId,
          productName: product.name,
          quantity: -item.quantity,
          note: "Đơn hàng bán online",
          source: "online_sale",
        }));
      } else if (order.status === "Completed" && value !== "Completed") {
        const { adjustments, entries } = await buildOrderStockAdjustments(
          order.cartItems,
          (item) => ({
            quantityInStorageDelta: item.quantity,
            purchaseCountDelta: -item.quantity,
          })
        );
        appliedAdjustments = await applyStockAdjustments(adjustments);
        stockHistoryEntries = entries.map(({ item, product }) => ({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          note: "Hoàn tác đơn bán online",
          source: "online_sale_revert",
        }));
      }
    }

    order[field] = value;
    try {
      await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    for (const historyEntry of stockHistoryEntries) {
      try {
        await new StorageHistory({
          ...historyEntry,
          userName: req.user?.name || "Hệ thống",
          orderId: order.orderCode,
          orderName: order.orderCode,
        }).save();
      } catch (logErr) {
        console.error("StorageHistory error (order status stock adjustment):", logErr.message);
      }
    }

    // Emit khi đơn hàng được cập nhật
    io.to('admins').emit("order_updated", {
      orderId: order._id,
      updatedField: field,
      newValue: value,
    });

    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error(error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, 'Server error'),
    });
  }
});

// API tạo đơn hàng
router.post("/admin-create-order", [authenticateAdmin, checkPermission('order.create')], async (req, res) => {
  const { userPhone, userName, items } = req.body;
  const io = req.app.get('io');

  if (!userPhone || !/^\d{10,11}$/.test(String(userPhone))) {
    return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Danh sách sản phẩm không hợp lệ" });
  }

  try {
    const preparedOrder = await prepareOrderItemsForCreation(items);
    if (preparedOrder.error) {
      return res.status(preparedOrder.error.status).json({ success: false, message: preparedOrder.error.message });
    }

    const appliedAdjustments = await applyStockAdjustments(
      createReservationAdjustments(preparedOrder.preparedItems)
    );

    let savedOrder;
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: "orderCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const orderCode = `TTSM-${String(counter.seq).padStart(2, '0')}`;

      savedOrder = await new Order({
        orderCode,
        userPhone: String(userPhone),
        userName,
        cartItems: preparedOrder.cartItems,
        total: preparedOrder.total,
      }).save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    // Đơn tạo nội bộ bở qua email/Zalo để không gửi thông báo như luồng khách tự đặt.
    io.to('admins').emit("order_created", {
      orderId: savedOrder._id,
      orderCode: savedOrder.orderCode,
      userPhone,
      total: preparedOrder.total,
      createdAt: savedOrder.createdAt,
    });

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error creating admin order:", error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, "Lỗi khi tạo đơn hàng"),
    });
  }
});

router.post("/admin-draft", [authenticateAdmin, checkPermission('order.create')], async (req, res) => {
  try {
    const counter = await Counter.findOneAndUpdate(
      { id: "orderCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderCode = `TTSM-${String(counter.seq).padStart(2, '0')}`;

    const savedOrder = await new Order({
      orderCode,
      userPhone: "",
      userName: "",
      cartItems: [],
      total: 0,
      status: "Processing",
    }).save();

    res.status(201).json({ success: true, order: savedOrder });
  } catch (error) {
    console.error("Error creating admin draft order:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tạo đơn nháp" });
  }
});

router.get("/admin-detail/:id", [authenticateAdmin, checkPermission('order.view')], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    res.json({ success: true, order: await formatAdminOrderDetail(order) });
  } catch (error) {
    console.error("Error fetching admin order detail:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy chi tiết đơn hàng" });
  }
});

router.post("/:id/items", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const parsed = validateOrderItemInput(req.body);
    if (parsed.message) {
      return res.status(400).json({ success: false, message: parsed.message });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    const { productId, variantIndex, quantity } = parsed.value;
    const { adjustments } = await buildOrderStockAdjustments(
      [{ productId, variantIndex, quantity }],
      (item) => ({ quantityForSaleDelta: -item.quantity })
    );
    const appliedAdjustments = await applyStockAdjustments(adjustments);

    try {
      order.cartItems.push({ productId, variantIndex, quantity });
      order.total = await computeOrderTotal(order.cartItems);
      await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error adding order item:", error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, "Lỗi khi thêm sản phẩm vào đơn hàng"),
    });
  }
});

router.put("/:id/items/:index", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const newQty = Number(req.body.quantity);
    if (!Number.isInteger(newQty) || newQty <= 0) {
      return res.status(400).json({ success: false, message: "Số lượng không hợp lệ" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= order.cartItems.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng sản phẩm" });
    }

    const line = order.cartItems[index];
    const delta = newQty - line.quantity;
    let appliedAdjustments = [];
    if (delta !== 0) {
      const { adjustments } = await buildOrderStockAdjustments(
        [line],
        () => ({ quantityForSaleDelta: -delta })
      );
      appliedAdjustments = await applyStockAdjustments(adjustments);
    }

    try {
      line.quantity = newQty;
      order.markModified("cartItems");
      order.total = await computeOrderTotal(order.cartItems);
      await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error updating order item:", error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, "Lỗi khi cập nhật sản phẩm trong đơn hàng"),
    });
  }
});

router.delete("/:id/items/:index", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= order.cartItems.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy dòng sản phẩm" });
    }

    const [line] = order.cartItems.splice(index, 1);
    const { adjustments } = await buildOrderStockAdjustments(
      [line],
      (item) => ({ quantityForSaleDelta: item.quantity }),
      { skipMissing: true }
    );
    const appliedAdjustments = await applyStockAdjustments(adjustments);

    try {
      order.markModified("cartItems");
      order.total = await computeOrderTotal(order.cartItems);
      await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error deleting order item:", error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, "Lỗi khi xóa sản phẩm khỏi đơn hàng"),
    });
  }
});

router.put("/:id/reorder", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    if (!Array.isArray(req.body.cartItems)) {
      return res.status(400).json({ success: false, message: "Danh sách sản phẩm không hợp lệ" });
    }

    const parsedItems = [];
    for (const item of req.body.cartItems) {
      const parsed = validateOrderItemInput(item);
      if (parsed.message) {
        return res.status(400).json({ success: false, message: parsed.message });
      }
      parsedItems.push(parsed.value);
    }

    const toLineKey = (item) => `${String(item.productId)}:${Number(item.variantIndex)}:${Number(item.quantity)}`;
    const countLines = (items) => items.reduce((counts, item) => {
      const key = toLineKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
    const currentLineCounts = countLines(order.cartItems);
    const reorderedLineCounts = countLines(parsedItems);
    const isSameLines = currentLineCounts.size === reorderedLineCounts.size &&
      [...currentLineCounts.entries()].every(
        ([key, count]) => reorderedLineCounts.get(key) === count
      );
    if (!isSameLines) {
      return res.status(400).json({
        success: false,
        message: "API sắp xếp chỉ được thay đổi thứ tự, không được đổi sản phẩm hoặc số lượng.",
      });
    }

    order.cartItems = parsedItems;
    order.total = await computeOrderTotal(order.cartItems);
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error reordering order items:", error);
    res.status(getRouteErrorStatus(error)).json({
      success: false,
      message: getRouteErrorMessage(error, "Lỗi khi lưu thứ tự sản phẩm"),
    });
  }
});

router.put("/:id/customer", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const { userName, userPhone } = req.body;
    if (userPhone && !/^\d{10,11}$/.test(String(userPhone))) {
      return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    order.userName = userName ?? order.userName;
    order.userPhone = userPhone ?? order.userPhone;
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error updating order customer:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lưu thông tin khách hàng" });
  }
});

router.put("/:id/images", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images) || images.some((imageUrl) => typeof imageUrl !== "string")) {
      return res.status(400).json({ success: false, message: "Danh sách ảnh không hợp lệ" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (isLockedOrder(order)) {
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa đơn đã hoàn thành hoặc đã hủy." });
    }

    order.images = images;
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error updating order images:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lưu danh sách ảnh" });
  }
});

router.post(
  "/upload-image",
  [authenticateAdmin, checkPermission('order.edit'), handleInvoiceUpload],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: 0, message: "Không có file được tải lên" });
      }

      res.json({ success: 1, imageUrl: `/invoice-images/${req.file.filename}` });
    } catch (error) {
      console.error("Error uploading sale order image:", error);
      res.status(500).json({ success: 0, message: "Lỗi khi tải ảnh lên" });
    }
  }
);

router.delete("/delete-image", [authenticateAdmin, checkPermission('order.edit')], async (req, res) => {
  try {
    const { imageUrl } = req.query;
    if (!imageUrl) {
      return res.status(400).json({ success: 0, message: "Thiếu thông tin imageUrl." });
    }

    const filename = path.basename(String(imageUrl));
    const filePath = path.join(__dirname, "../upload/invoices", filename);

    try {
      await fs.promises.unlink(filePath);
    } catch (fileError) {
      if (fileError.code !== "ENOENT") {
        throw fileError;
      }
    }

    res.json({ success: 1, message: "Đã xóa ảnh nếu file tồn tại." });
  } catch (error) {
    console.error("Error deleting sale order image:", error);
    res.status(500).json({ success: 0, message: "Lỗi khi xóa ảnh" });
  }
});

router.post("/create-order", authenticateUser, async (req, res) => {
  const { cartItems, stationCode } = req.body;

  const io = req.app.get('io'); // 👈 lấy socket io từ app

  try {
    const orderingUser = await User.findById(req.user.userId);
    if (!orderingUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const normalizedStationCode = String(stationCode || "").trim();
    const selectedStation = normalizedStationCode
      ? await Station.findOne({ stationCode: normalizedStationCode })
      : null;
    if (normalizedStationCode && !selectedStation) {
      return res.status(404).json({ message: "Không tìm thấy trạm được chọn." });
    }

    const allowedProductIds = await getCustomerStationProductIds(orderingUser, {
      stationId: selectedStation?._id,
    });
    const preparedOrder = await prepareOrderItemsForCreation(cartItems, {
      enforcePublicProducts: orderingUser.role === "customer",
      allowedProductIds,
    });
    if (preparedOrder.error) {
      return res.status(preparedOrder.error.status).json({ message: preparedOrder.error.message });
    }

    const userPhone = orderingUser.phone;
    const userName = orderingUser.name;

    const appliedAdjustments = await applyStockAdjustments(
      createReservationAdjustments(preparedOrder.preparedItems)
    );

    let savedOrder;
    try {
      // Tự tăng số thứ tự và tạo mã dạng TTSM-01
      const counter = await Counter.findOneAndUpdate(
        { id: "orderCode" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const orderCode = `TTSM-${String(counter.seq).padStart(2, '0')}`;

      savedOrder = await new Order({
        orderCode,
        userPhone,
        userName,
        cartItems: preparedOrder.cartItems,
        total: preparedOrder.total,
      }).save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }
    
    try {
      if (preparedOrder.cartItems.length > 0) {
        orderingUser.cart = orderingUser.cart.filter((cartItem) => {
          return !preparedOrder.cartItems.some(
            (orderedItem) =>
              orderedItem.productId.toString() === cartItem.productId.toString() &&
              orderedItem.variantIndex === cartItem.variantIndex
          );
        });

        // Tự động gán trạm cho user nếu trạm đó chưa được liên kết với user
        if (selectedStation) {
          const stationIdStr = selectedStation._id.toString();
          if (!orderingUser.station.includes(stationIdStr)) {
            orderingUser.station.push(stationIdStr);
          }
        }

        await orderingUser.save();
      }
    } catch (postSaveError) {
      console.error("Order created but cart/station cleanup failed:", postSaveError);
    }

    // Lấy thông tin trạm dựa trên mã trạm đang mua hàng hoặc danh sách trạm của user
    let stationNamesStr = "Không có";
    let stationCodesStr = "Không có";

    try {
      if (selectedStation) {
        stationNamesStr = selectedStation.stationName || "Không có";
        stationCodesStr = selectedStation.stationCode || "Không có";
      } else if (orderingUser.station && orderingUser.station.length > 0) {
        const stations = await Station.find({ _id: { $in: orderingUser.station } });
        if (stations && stations.length > 0) {
          stationNamesStr = stations.map(s => s.stationName).filter(Boolean).join(", ");
          stationCodesStr = stations.map(s => s.stationCode).filter(Boolean).join(", ");
        }
      }
    } catch (postSaveError) {
      console.error("Order created but station notification metadata failed:", postSaveError);
    }

    // Gửi email thông báo đến admin (Sử dụng orderCode thay cho ObjectId)
    sendNewOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total: preparedOrder.total,
      createdAt: savedOrder.createdAt,
      stationNames: stationNamesStr,
      stationCodes: stationCodesStr,
    }).catch(err => console.error("Lỗi gửi email thông báo đơn hàng:", err.message));

    // Gửi tin nhắn thông báo Zalo OA đến admin (không làm gián đoạn luồng đặt hàng nếu lỗi)
    sendZaloOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total: preparedOrder.total,
      createdAt: savedOrder.createdAt,
    }).catch(err => console.error("Lỗi gửi thông báo Zalo:", err));

    sendTelegramOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total: preparedOrder.total,
      createdAt: savedOrder.createdAt,
      stationNames: stationNamesStr,
      stationCodes: stationCodesStr,
    }).catch(err => console.error("Lỗi gửi thông báo Telegram:", err.message));

    // Emit khi tạo đơn hàng
    io.to('admins').emit("order_created", {
      orderId: savedOrder._id,
      orderCode: savedOrder.orderCode,
      userPhone,
      total: preparedOrder.total,
      createdAt: savedOrder.createdAt,
    });
    
    res.status(201).json({
      message: "Đặt hàng thành công",
      order: savedOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(getRouteErrorStatus(error)).json({
      message: getRouteErrorMessage(error, "Lỗi khi tạo đơn hàng"),
    });
  }
});

// API lọc đơn hàng theo phone người dùng
router.get("/userOrders", authenticateUser, async (req, res) => {
  const userPhone = req.user.phone;
  const { state } = req.query;

  if (typeof userPhone !== "string" || !userPhone.trim()) {
    return res.status(400).json({ message: "Số điện thoại người dùng không được cung cấp" });
  }

  try {
    const filter = {
      userPhone: userPhone,
    };

    if (state) {
      if (state === "Cancelled") {
        filter.state = "Cancelled";
      } else {
        filter.state = "Processing";
        filter.status = state;
      }
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    if (orders.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng cho số điện thoại này",
      });
    }

    res.status(200).json({
      message: "Danh sách đơn hàng",
      orders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi tìm kiếm đơn hàng" });
  }
});

router.get("/processing-count", async (req, res) => {
  try {
    const count = await Order.countDocuments({
      state: "Processing",
      status: "Processing",
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error("Error counting processing orders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// API lấy thông tin chi tiết đơn hàng
router.get('/:_id', authenticateUser, async (req, res) => {
  try {
    const order = await Order.findById(req.params._id); // Sửa req.params.id thành req.params._id
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({ message: "Bạn không có quyền xem đơn hàng này." });
    }

    const cartDetails = await Promise.all(
      order.cartItems.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) return null;

        const variant = product.variant[item.variantIndex] || {};
        return {
          name: product.name,
          brand: product.brand,
          variant: {
            color: variant.color,
            shape: variant.shape,
            price: variant.price,
            imgUrl: getUpdatedImgUrl(variant.imgUrl),
          },
          quantity: item.quantity,
        };
      })
    );

    res.json({
      userPhone: order.userPhone,
      total: order.total,
      cartItems: cartDetails.filter(Boolean),
      status: order.status, // Trả về chuỗi "Processing", "Delivering", hoặc "Completed"
      payment: order.payment,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// API xóa đơn hàng
router.delete("/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const io = req.app.get('io');

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({ message: "Bạn không có quyền xóa đơn hàng này." });
    }

    // Chặn xóa đơn hàng đã hoàn tất
    if (order.status === "Completed") {
      return res.status(400).json({ message: "Không thể xóa đơn hàng đã hoàn thành." });
    }

    // Chỉ hoàn lại số lượng bán nếu đơn chưa từng bị hủy
    let appliedAdjustments = [];
    if (order.state !== "Cancelled") {
      const { adjustments } = await buildOrderStockAdjustments(
        order.cartItems,
        (item) => ({ quantityForSaleDelta: item.quantity }),
        { skipMissing: true }
      );
      appliedAdjustments = await applyStockAdjustments(adjustments);
    }

    try {
      const deleteResult = await Order.deleteOne({
        _id: order._id,
        __v: order.__v,
        status: { $ne: "Completed" },
      });
      if (deleteResult.deletedCount !== 1) {
        throw new InventoryError(
          "Đơn hàng vừa được thay đổi bởi thao tác khác, vui lòng tải lại.",
          { statusCode: 409, code: "ORDER_CONFLICT" }
        );
      }
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    // Emit khi xóa đơn hàng
    io.to('admins').emit("order_deleted", { orderId: id });

    res.status(200).json({ message: "Order deleted and quantities restored if necessary." });
  } catch (error) {
    console.error(error);
    res.status(getRouteErrorStatus(error)).json({
      message: getRouteErrorMessage(error, "Server error"),
    });
  }
});

// API hủy đơn hàng
router.put("/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const io = req.app.get('io');

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!canAccessOrder(order, req.user)) {
      return res.status(403).json({ message: "Bạn không có quyền hủy đơn hàng này." });
    }

    // Chặn hủy đơn hàng đã hoàn tất
    if (order.status === "Completed") {
      return res.status(400).json({ message: "Không thể hủy đơn hàng đã hoàn thành." });
    }

    if (order.state === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled." });
    }

    const { adjustments } = await buildOrderStockAdjustments(
      order.cartItems,
      (item) => ({ quantityForSaleDelta: item.quantity }),
      { skipMissing: true }
    );
    const appliedAdjustments = await applyStockAdjustments(adjustments);

    order.state = "Cancelled";
    try {
      await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    // Emit khi hủy đơn hàng
    io.to('admins').emit("order_cancelled", {
      orderId: order._id,
      userPhone: order.userPhone,
    });

    res.status(200).json({ message: "Order cancelled successfully.", order });
  } catch (error) {
    console.error(error);
    res.status(getRouteErrorStatus(error)).json({
      message: getRouteErrorMessage(error, "Server error"),
    });
  }
});

module.exports = {
  Order,
  router,
};
