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
const { Station } = require('./station');
const { StorageHistory } = require("./storagehistory");

const router = express.Router();

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
  { timestamps: true }
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
router.get("/", [authenticateAdmin, checkPermission('read_order')], async (req, res) => {
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
        filter.orderCode = new RegExp(id, "i");
      }
    }

    if (byCompletedDate === "true") {
      filter.status = "Completed";
    } else if (status) {
      filter.status = status;
    }

    if (payment) filter.payment = payment === "true";
    if (state) filter.state = state;
    if (phone) filter.userPhone = new RegExp(phone, "i");
    if (name) filter.userName = new RegExp(name, "i");

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
router.get("/customer-suggestions", [authenticateAdmin, checkPermission('read_order')], async (req, res) => {
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

router.put('/update-order/:_id', [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
        await Promise.all(
          order.cartItems.map(async (item) => {
            const product = await Product.findById(item.productId);
            if (!product) throw new Error('Product not found');
            const variant = product.variant[item.variantIndex];
            if (!variant) throw new Error('Variant not found');

            variant.quantityInStorage -= item.quantity;
            if (variant.quantityInStorage < 0) {
              throw new Error(`Not enough stock for product: ${product.name}`);
            }
            product.purchaseCount = (product.purchaseCount || 0) + item.quantity;
            await product.save();

            // Ghi lịch sử kho: xuất kho do đơn hàng bán online hoàn thành
            try {
              await new StorageHistory({
                productId: item.productId,
                productName: product.name,
                quantity: -item.quantity,
                userName: req.user?.name || "Hệ thống",
                orderId: order.orderCode,
                orderName: order.orderCode,
                note: "Đơn hàng bán online",
              }).save();
            } catch (logErr) {
              console.error("StorageHistory error (complete order):", logErr.message);
            }
          })
        );
      } else if (order.status === "Completed" && value !== "Completed") {
        await Promise.all(
          order.cartItems.map(async (item) => {
            const product = await Product.findById(item.productId);
            if (!product) throw new Error('Product not found');
            const variant = product.variant[item.variantIndex];
            if (!variant) throw new Error('Variant not found');

            variant.quantityInStorage += item.quantity;
            product.purchaseCount = Math.max(0, (product.purchaseCount || 0) - item.quantity);
            await product.save();

            // Ghi lịch sử kho: nhập lại do hoàn tác đơn bán online
            try {
              await new StorageHistory({
                productId: item.productId,
                productName: product.name,
                quantity: item.quantity,
                userName: req.user?.name || "Hệ thống",
                orderId: order.orderCode,
                orderName: order.orderCode,
                note: "Hoàn tác đơn bán online",
              }).save();
            } catch (logErr) {
              console.error("StorageHistory error (revert order):", logErr.message);
            }
          })
        );
      }
    }

    order[field] = value;
    await order.save();

    // Emit khi đơn hàng được cập nhật
    io.emit("order_updated", {
      orderId: order._id,
      updatedField: field,
      newValue: value,
    });

    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API tạo đơn hàng
router.post("/admin-create-order", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
  const { userPhone, userName, items } = req.body;
  const io = req.app.get('io');

  if (!userPhone || !/^\d{10,11}$/.test(String(userPhone))) {
    return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Danh sách sản phẩm không hợp lệ" });
  }

  try {
    const preparedItems = [];
    const productCache = new Map();
    const reservedStock = new Map();
    let total = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      const variantIndex = Number(item.variantIndex);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Số lượng sản phẩm không hợp lệ" });
      }

      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ success: false, message: "Sản phẩm không hợp lệ" });
      }

      if (!Number.isInteger(variantIndex) || variantIndex < 0) {
        return res.status(400).json({ success: false, message: "Phiên bản sản phẩm không hợp lệ" });
      }

      const productId = String(item.productId);
      let product = productCache.get(productId);
      if (!product) {
        product = await Product.findById(productId);
        if (product) {
          productCache.set(productId, product);
        }
      }
      if (!product) {
        return res.status(404).json({ success: false, message: `Sản phẩm với ID ${item.productId} không tồn tại.` });
      }

      const variant = product.variant[variantIndex];
      if (!variant) {
        return res.status(404).json({ success: false, message: `Variant không tồn tại cho sản phẩm ${item.productId}.` });
      }

      const stockKey = `${product._id.toString()}:${variantIndex}`;
      const reservedQuantity = reservedStock.get(stockKey) || 0;
      if (variant.quantityForSale - reservedQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Không đủ hàng cho sản phẩm ${product.name}, variant ${variant.color || 'default'}.`
        });
      }
      reservedStock.set(stockKey, reservedQuantity + quantity);

      const price = parseOrderPrice(variant.price);
      total += price * quantity;
      preparedItems.push({
        product,
        variant,
        cartItem: {
          productId: product._id.toString(),
          variantIndex,
          quantity,
        },
      });
    }

    for (const item of preparedItems) {
      item.variant.quantityForSale -= item.cartItem.quantity;
      await item.product.save();
    }

    const counter = await Counter.findOneAndUpdate(
      { id: "orderCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderCode = `TTSM-${String(counter.seq).padStart(2, '0')}`;

    const newOrder = new Order({
      orderCode,
      userPhone: String(userPhone),
      userName,
      cartItems: preparedItems.map((item) => item.cartItem),
      total,
    });
    const savedOrder = await newOrder.save();

    // Đơn tạo nội bộ bở qua email/Zalo để không gửi thông báo như luồng khách tự đặt.
    io.emit("order_created", {
      orderId: savedOrder._id,
      orderCode: savedOrder.orderCode,
      userPhone,
      total,
      createdAt: savedOrder.createdAt,
    });

    res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công",
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error creating admin order:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tạo đơn hàng" });
  }
});

router.post("/admin-draft", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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

router.get("/admin-detail/:id", [authenticateAdmin, checkPermission('read_order')], async (req, res) => {
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

router.post("/:id/items", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
    const product = await Product.findById(productId);
    const variant = product?.variant?.[variantIndex];
    if (!product || !variant) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm hoặc phiên bản sản phẩm" });
    }

    if (variant.quantityForSale < quantity) {
      return res.status(400).json({
        success: false,
        message: `Không đủ hàng. Tồn khả dụng hiện có: ${variant.quantityForSale}`,
      });
    }

    variant.quantityForSale -= quantity;
    await product.save();

    order.cartItems.push({ productId, variantIndex, quantity });
    order.total = await computeOrderTotal(order.cartItems);
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error adding order item:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm sản phẩm vào đơn hàng" });
  }
});

router.put("/:id/items/:index", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
    const product = await Product.findById(line.productId);
    const variant = product?.variant?.[line.variantIndex];
    if (!product || !variant) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm hoặc phiên bản sản phẩm" });
    }

    if (delta > 0) {
      if (variant.quantityForSale < delta) {
        return res.status(400).json({
          success: false,
          message: `Không đủ hàng. Tồn khả dụng hiện có: ${variant.quantityForSale}`,
        });
      }
      variant.quantityForSale -= delta;
    } else if (delta < 0) {
      variant.quantityForSale += Math.abs(delta);
    }

    await product.save();
    line.quantity = newQty;
    order.markModified("cartItems");
    order.total = await computeOrderTotal(order.cartItems);
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error updating order item:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật sản phẩm trong đơn hàng" });
  }
});

router.delete("/:id/items/:index", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
    const product = await Product.findById(line.productId);
    const variant = product?.variant?.[line.variantIndex];
    if (product && variant) {
      variant.quantityForSale += line.quantity;
      await product.save();
    }

    order.markModified("cartItems");
    order.total = await computeOrderTotal(order.cartItems);
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error deleting order item:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa sản phẩm khỏi đơn hàng" });
  }
});

router.put("/:id/reorder", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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

    order.cartItems = parsedItems;
    order.total = await computeOrderTotal(order.cartItems);
    await order.save();

    res.json({ success: true, order: await formatAdminOrderWithItems(order) });
  } catch (error) {
    console.error("Error reordering order items:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lưu thứ tự sản phẩm" });
  }
});

router.put("/:id/customer", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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

router.put("/:id/images", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
  [authenticateAdmin, checkPermission('update_order'), handleInvoiceUpload],
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

router.delete("/delete-image", [authenticateAdmin, checkPermission('update_order')], async (req, res) => {
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
  const { cartItems, total, stationCode } = req.body;
  const userPhone = req.user.phone;
  const userName = req.user.name;

  const io = req.app.get('io'); // 👈 lấy socket io từ app

  try {
    for (let item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Sản phẩm với ID ${item.productId} không tồn tại.` });
      }

      const variant = product.variant[item.variantIndex];
      if (!variant) {
        return res.status(404).json({ message: `Variant không tồn tại cho sản phẩm ${item.productId}.` });
      }

      if (variant.quantityForSale < item.quantity) {
        return res.status(400).json({
          message: `Không đủ hàng cho sản phẩm ${product.name}, variant ${variant.color || 'default'}.`
        });
      }

      variant.quantityForSale -= item.quantity;
      await product.save();
    }

    // Tự tăng số thứ tự và tạo mã dạng TTSM-01
    const counter = await Counter.findOneAndUpdate(
      { id: "orderCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderCode = `TTSM-${String(counter.seq).padStart(2, '0')}`;

    const newOrder = new Order({
      orderCode,
      userPhone,
      userName,
      cartItems,
      total,
    });
    const savedOrder = await newOrder.save();
    
    if (cartItems && cartItems.length > 0) {
      const user = await User.findById(req.user.userId);
      if (user) {
        user.cart = user.cart.filter((cartItem) => {
          return !cartItems.some(
            (orderedItem) =>
              orderedItem.productId.toString() === cartItem.productId.toString() &&
              orderedItem.variantIndex === cartItem.variantIndex
          );
        });

        // Tự động gán trạm cho user nếu trạm đó chưa được liên kết với user
        if (stationCode) {
          const station = await Station.findOne({ stationCode: String(stationCode).trim() });
          if (station) {
            const stationIdStr = station._id.toString();
            if (!user.station.includes(stationIdStr)) {
              user.station.push(stationIdStr);
            }
          }
        }

        await user.save();
      }
    }

    // Lấy thông tin trạm dựa trên mã trạm đang mua hàng hoặc danh sách trạm của user
    let stationNamesStr = "Không có";
    let stationCodesStr = "Không có";

    if (stationCode) {
      const station = await Station.findOne({ stationCode: String(stationCode).trim() });
      if (station) {
        stationNamesStr = station.stationName || "Không có";
        stationCodesStr = station.stationCode || "Không có";
      }
    } else {
      const user = await User.findById(req.user.userId);
      if (user && user.station && user.station.length > 0) {
        const stations = await Station.find({ _id: { $in: user.station } });
        if (stations && stations.length > 0) {
          stationNamesStr = stations.map(s => s.stationName).filter(Boolean).join(", ");
          stationCodesStr = stations.map(s => s.stationCode).filter(Boolean).join(", ");
        }
      }
    }

    // Gửi email thông báo đến admin (Sử dụng orderCode thay cho ObjectId)
    sendNewOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total,
      createdAt: savedOrder.createdAt,
      stationNames: stationNamesStr,
      stationCodes: stationCodesStr,
    });

    // Gửi tin nhắn thông báo Zalo OA đến admin (không làm gián đoạn luồng đặt hàng nếu lỗi)
    sendZaloOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total,
      createdAt: savedOrder.createdAt,
    }).catch(err => console.error("Lỗi gửi thông báo Zalo:", err));

    // Emit khi tạo đơn hàng
    io.emit("order_created", {
      orderId: savedOrder._id,
      orderCode: savedOrder.orderCode,
      userPhone,
      total,
      createdAt: savedOrder.createdAt,
    });
    
    res.status(201).json({
      message: "Đặt hàng thành công",
      order: savedOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi tạo đơn hàng" });
  }
});

// API lọc đơn hàng theo phone người dùng
router.get("/userOrders", authenticateUser, async (req, res) => {
  const userPhone = req.user.phone;
  const { state } = req.query;

  if (!userPhone) {
    return res.status(400).json({ message: "Số điện thoại người dùng không được cung cấp" });
  }

  try {
    const filter = {
      userPhone: { $regex: userPhone, $options: "i" },
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
    res.status(500).json({ message: error.message });
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
    if (order.state !== "Cancelled") {
      for (const item of order.cartItems) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const variant = product.variant[item.variantIndex];
        if (!variant) continue;

        variant.quantityForSale += item.quantity;
        await product.save();
      }
    }

    await order.deleteOne();

    // Emit khi xóa đơn hàng
    io.emit("order_deleted", { orderId: id });

    res.status(200).json({ message: "Order deleted and quantities restored if necessary." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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

    // Hoàn lại số lượng bán cho tất cả các đơn hàng khi hủy
    for (const item of order.cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const variant = product.variant[item.variantIndex];
      if (!variant) continue;

      variant.quantityForSale += item.quantity;
      await product.save();
    }

    order.state = "Cancelled";
    await order.save();

    // Emit khi hủy đơn hàng
    io.emit("order_cancelled", {
      orderId: order._id,
      userPhone: order.userPhone,
    });

    res.status(200).json({ message: "Order cancelled successfully.", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = {
  Order,
  router,
};
