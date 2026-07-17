const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const router = express.Router();
const { Product } = require("./product");
const { StorageHistory } = require("./storagehistory");
const path = require("path");
const multer = require("multer");
const {
  InventoryError,
  applyStockAdjustments,
  isVersionConflict,
  rollbackOrThrow,
} = require("../services/inventory");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ipOrderSchema = new mongoose.Schema(
  {
    orderName: { type: String, default: "" },
    note: { type: String, default: "" },
    userName: { type: String, required: true },
    productList: [
      {
        status: { type: Boolean, default: false },
        productId: { type: String },
        price: { type: String },
        unit: { type: String },
        quantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        quantityRe: {
          type: Number,
          default: 0,
          min: 0,
        },
        stockAppliedQuantity: { type: Number, min: 0, default: undefined },
        note: { type: String },
        vat: { type: String, default: "" },
      },
    ],
    images: [{ type: String }],
    total: { type: String, default: "0" },
    status: { type: Boolean, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

ipOrderSchema.pre("save", function (next) {
  if (this.productList && this.productList.length > 0) {
    this.total = this.productList
      .reduce((sum, item) => {
        const priceNum = parseFloat(
          item.price?.replace(/\./g, "").replace(",", ".") || 0
        );
        return sum + priceNum * (item.quantity || 0);
      }, 0)
      .toString();
  } else {
    this.total = "0";
  }
  next();
});

const IpOrder = mongoose.model("IpOrder", ipOrderSchema);

const toQuantity = (value) => Number(value) || 0;

const createRouteError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hasOwn = (object, field) =>
  Object.prototype.hasOwnProperty.call(object || {}, field);

const validateLineQuantities = ({ quantity, quantityRe }) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createRouteError(400, "Số lượng đặt phải là số nguyên lớn hơn 0.");
  }
  if (
    typeof quantityRe !== "number" ||
    !Number.isFinite(quantityRe) ||
    quantityRe < 0 ||
    quantityRe > quantity
  ) {
    throw createRouteError(
      400,
      "Số lượng đã nhập phải nằm trong khoảng từ 0 đến số lượng đặt."
    );
  }
};

const sanitizeLineForCreate = (rawLine, { forceZeroProgress = false } = {}) => {
  if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) {
    throw createRouteError(400, "Dữ liệu sản phẩm trong đơn nhập không hợp lệ.");
  }
  const quantityRe = forceZeroProgress ? 0 : (rawLine.quantityRe ?? 0);
  validateLineQuantities({ quantity: rawLine.quantity, quantityRe });
  if (!mongoose.Types.ObjectId.isValid(rawLine.productId)) {
    throw createRouteError(400, "Mã sản phẩm không hợp lệ.");
  }

  return {
    productId: String(rawLine.productId),
    price: typeof rawLine.price === "string" ? rawLine.price : "",
    unit: typeof rawLine.unit === "string" ? rawLine.unit : "",
    quantity: rawLine.quantity,
    quantityRe,
    stockAppliedQuantity: forceZeroProgress ? 0 : quantityRe,
    status: forceZeroProgress ? false : quantityRe === rawLine.quantity,
    note: typeof rawLine.note === "string" ? rawLine.note : "",
    vat: typeof rawLine.vat === "string" ? rawLine.vat : "",
  };
};

const getAppliedQuantity = (productItem) => {
  const progress = toQuantity(productItem.quantityRe);
  if (
    productItem.stockAppliedQuantity === undefined ||
    productItem.stockAppliedQuantity === null
  ) {
    return progress;
  }
  const applied = Number(productItem.stockAppliedQuantity);
  if (!Number.isFinite(applied) || applied < 0 || applied > progress) {
    throw createRouteError(409, "Dữ liệu số lượng đã cộng kho của dòng nhập không hợp lệ.");
  }
  return applied;
};

const isLineFullyApplied = (productItem) =>
  toQuantity(productItem.quantityRe) === toQuantity(productItem.quantity) &&
  getAppliedQuantity(productItem) === toQuantity(productItem.quantity);

const adjustImportStock = async ({ productId, delta, req, order, note, isAIScan, source }) => {
  if (!delta) return { appliedAdjustments: [], historyData: null };

  const product = await Product.findById(productId)
    .select("name variant._id variant.quantityForSale variant.quantityInStorage");
  if (!product) {
    throw createRouteError(404, `Product ${productId} not found`);
  }

  const variant = product.variant[0];
  if (!variant) {
    throw createRouteError(400, "Sản phẩm không có biến thể");
  }

  const appliedAdjustments = await applyStockAdjustments([{
    productId,
    variantIndex: 0,
    expectedVariantId: variant._id,
    quantityInStorageDelta: delta,
    quantityForSaleDelta: delta,
  }]);

  return {
    appliedAdjustments,
    historyData: {
      productId,
      productName: product.name,
      quantity: delta,
      userName: req.user?.name,
      orderId: order._id.toString(),
      orderName: order.orderName,
      note,
      isAIScan: !!isAIScan,
      source,
    },
  };
};

const saveWithStockRollback = async (order, appliedAdjustments) => {
  try {
    return await order.save();
  } catch (error) {
    await rollbackOrThrow(appliedAdjustments, error);
  }
};

const saveStockHistories = async (historyEntries) => {
  for (const historyEntry of historyEntries.filter(Boolean)) {
    try {
      await new StorageHistory(historyEntry).save();
    } catch (logErr) {
      console.error("StorageHistory error (iporder stock adjustment):", logErr.message);
    }
  }
};

const getRouteErrorStatus = (error) => {
  if (error?.statusCode) return error.statusCode;
  if (isVersionConflict(error)) return 409;
  return 500;
};

const getRouteErrorMessage = (error, fallback) => {
  if (error?.statusCode) return error.message;
  if (isVersionConflict(error)) {
    return "Đơn nhập vừa được thay đổi bởi thao tác khác, vui lòng tải lại.";
  }
  return fallback;
};

router.get(
  "/orders",
  [authenticateAdmin, checkPermission("iporder.view")],
  async (req, res) => {
    try {
      const {
        page = 1,
        orderName,
        userName,
        status,
        startDate,
        endDate,
        byCompletedDate,
      } = req.query;
      const limit = 20;
      const skip = (page - 1) * limit;

      let query = {};
      if (orderName) query.orderName = { $regex: escapeRegex(orderName), $options: "i" };
      if (userName) query.userName = { $regex: escapeRegex(userName), $options: "i" };
      
      if (byCompletedDate === "true") {
        query.status = true;
      } else if (status) {
        query.status = status === "true";
      }

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
          query.$or = [
            { completedAt: dateFilter },
            { completedAt: { $exists: false }, createdAt: dateFilter },
            { completedAt: null, createdAt: dateFilter }
          ];
        } else {
          query.createdAt = dateFilter;
        }
      }

      const totalOrders = await IpOrder.countDocuments(query);
      const sortField = byCompletedDate === "true" ? "completedAt" : "createdAt";
      const orders = await IpOrder.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ [sortField]: -1 });

      res.json({
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / limit),
          totalItems: totalOrders,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

router.post(
  "/orders",
  [authenticateAdmin, checkPermission("iporder.create")],
  async (req, res) => {
    try {
      const userName = req.user.name;
      const { productList, orderName, note } = req.body;
      if (productList !== undefined && !Array.isArray(productList)) {
        throw createRouteError(400, "productList phải là một mảng.");
      }

      const sanitizedProductList = (productList || []).map((rawLine) => {
        if (
          (hasOwn(rawLine, "quantityRe") && rawLine.quantityRe !== 0) ||
          (hasOwn(rawLine, "status") && rawLine.status !== false)
        ) {
          throw createRouteError(
            400,
            "Đơn nhập mới chỉ được chứa sản phẩm chưa phát sinh nhập kho."
          );
        }
        return sanitizeLineForCreate(rawLine, { forceZeroProgress: true });
      });
      const newOrder = new IpOrder({
        orderName: orderName || "",
        note: typeof note === "string" ? note : "",
        userName,
        productList: sanitizedProductList,
      });

      if (sanitizedProductList.length > 0) {
        newOrder.total = sanitizedProductList
          .reduce((sum, item) => {
            const priceNum = parseFloat(
              item.price?.replace(/\./g, "").replace(",", ".") || 0
            );
            return sum + priceNum * (item.quantity || 0);
          }, 0)
          .toString();
      }

      const savedOrder = await newOrder.save();
      res.status(201).json(savedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  "/orders/:id/products",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const rawProduct = req.body || {};
      const isAIScan = rawProduct.isAIScan === true;
      const newProduct = sanitizeLineForCreate(rawProduct);
      const stockDelta = newProduct.quantityRe;
      let stockResult = { appliedAdjustments: [], historyData: null };
      if (stockDelta > 0) {
        stockResult = await adjustImportStock({
          productId: newProduct.productId,
          delta: stockDelta,
          req,
          order,
          note: isAIScan ? "Nhập kho (AI scan đơn nhập)" : "Nhập kho (thêm sản phẩm đơn nhập)",
          isAIScan,
          source: isAIScan ? undefined : "order_line_manual",
        });
      }
      order.productList.push(newProduct);

      // Tính toán lại tổng tiền của đơn hàng
      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum = parseFloat(
            item.price?.replace(/\./g, "").replace(",", ".") || 0
          );
          return sum + priceNum * (item.quantity || 0);
        }, 0)
        .toString();

      const updatedOrder = await saveWithStockRollback(
        order,
        stockResult.appliedAdjustments
      );
      await saveStockHistories([stockResult.historyData]);
      res.json(updatedOrder);
    } catch (error) {
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi khi thêm sản phẩm vào đơn nhập"),
      });
    }
  }
);

router.delete(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const index = parseInt(req.params.productIndex);
      if (!Number.isInteger(index) || index < 0 || index >= order.productList.length) {
        return res.status(400).json({ message: "Invalid product index" });
      }
      if (
        toQuantity(order.productList[index].quantityRe) > 0 ||
        getAppliedQuantity(order.productList[index]) > 0
      ) {
        return res.status(400).json({
          message: "Không thể xóa sản phẩm đã phát sinh nhập kho. Hãy điều chỉnh số lượng nhập về 0 trước.",
        });
      }
      order.productList.splice(index, 1);

      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum = parseFloat(
            item.price?.replace(/\./g, "").replace(",", ".") || 0
          );
          return sum + priceNum * (item.quantity || 0);
        }, 0)
        .toString();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      if (hasOwn(req.body, "productList") || hasOwn(req.body, "status")) {
        return res.status(400).json({
          message: "Hãy dùng API chuyên dụng để thay đổi sản phẩm hoặc trạng thái đơn nhập.",
        });
      }
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      // Whitelist fields to prevent Mass Assignment
      const { orderName, note, images } = req.body;
      if (orderName !== undefined) order.orderName = orderName;
      if (note !== undefined) order.note = typeof note === "string" ? note : "";
      if (images !== undefined) order.images = images;

      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum = parseFloat(
            item.price?.replace(/\./g, "").replace(",", ".") || 0
          );
          return sum + priceNum * (item.quantity || 0);
        }, 0)
        .toString();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.delete(
  "/orders/:id",
  [authenticateAdmin, checkPermission("iporder.delete")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (
        order.productList.some(
          (item) => toQuantity(item.quantityRe) > 0 || getAppliedQuantity(item) > 0
        )
      ) {
        return res.status(400).json({
          message: "Không thể xóa đơn đã phát sinh nhập kho. Hãy hoàn tác các dòng nhập trước.",
        });
      }

      await order.deleteOne();
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

router.put(
  "/orders/:id/status",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean." });
      }
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (
        status === true &&
        !order.productList.every(
          (item) => item.status === true && isLineFullyApplied(item)
        )
      ) {
        return res.status(400).json({
          message: "Chỉ có thể hoàn tất đơn khi tất cả sản phẩm đã nhập đủ.",
        });
      }

      order.status = status;
      order.completedAt = status ? new Date() : null;
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/setStatusAndQuantity",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean." });
      }
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      let appliedAdjustments = [];
      const historyEntries = [];
      if (status === true) {
        const adjustments = [];
        for (const productItem of order.productList) {
          const product = await Product.findById(productItem.productId)
            .select("name variant._id variant.quantityForSale variant.quantityInStorage");
          if (!product) {
            throw new InventoryError(`Product ${productItem.productId} not found`, {
              statusCode: 404,
              code: "PRODUCT_NOT_FOUND",
            });
          }

          const variant = product.variant[0];
          if (!variant) {
            throw new InventoryError("Sản phẩm không có biến thể", {
              statusCode: 400,
              code: "VARIANT_NOT_FOUND",
            });
          }

          const addQty = productItem.quantity - getAppliedQuantity(productItem);
          if (!Number.isFinite(addQty) || addQty < 0) {
            throw new InventoryError("Số lượng nhập còn lại không hợp lệ.", {
              statusCode: 400,
              code: "INVALID_IMPORT_QUANTITY",
            });
          }
          if (addQty > 0) {
            adjustments.push({
              productId: product._id,
              variantIndex: 0,
              expectedVariantId: variant._id,
              quantityInStorageDelta: addQty,
              quantityForSaleDelta: addQty,
            });
            historyEntries.push({
              productId: productItem.productId,
              productName: product.name,
              quantity: addQty,
              userName: req.user?.name,
              orderId: order._id.toString(),
              orderName: order.orderName,
              note: "Nhập kho (đơn nhập hoàn thành)",
              source: "order_bulk_complete",
            });
          }
          productItem.quantityRe = productItem.quantity;
          productItem.stockAppliedQuantity = productItem.quantity;
          productItem.status = true;
        }

        appliedAdjustments = await applyStockAdjustments(adjustments);

        order.status = true;
        order.completedAt = new Date();
      } else {
        order.status = false;
        order.completedAt = null;
      }

      const updatedOrder = await saveWithStockRollback(order, appliedAdjustments);
      await saveStockHistories(historyEntries);
      res.json(updatedOrder);
    } catch (error) {
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi khi hoàn tất đơn nhập"),
      });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/status",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean." });
      }
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const productIndex = Number(req.params.productIndex);
      if (
        !Number.isInteger(productIndex) ||
        productIndex < 0 ||
        productIndex >= order.productList.length
      ) {
        return res.status(400).json({ message: "Invalid product index" });
      }

      const productItem = order.productList[productIndex];
      if (status === true && !isLineFullyApplied(productItem)) {
        return res.status(400).json({
          message: "Hãy dùng thao tác nhập kho để hoàn tất sản phẩm.",
        });
      }

      productItem.status = status;
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/setStatusAndQuantity",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean." });
      }
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const productIndex = parseInt(req.params.productIndex);
      if (
        isNaN(productIndex) ||
        productIndex < 0 ||
        productIndex >= order.productList.length
      ) {
        return res.status(400).json({ message: "Invalid product index" });
      }

      const productItem = order.productList[productIndex];
      if (status !== true || productItem.status === true) {
        return res.json(order);
      }

      const product = await Product.findById(productItem.productId)
        .select("name variant._id variant.quantityForSale variant.quantityInStorage");
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${productItem.productId} not found` });
      }

      const variant = product.variant[0];
      if (!variant) {
        return res.status(400).json({ message: "Sản phẩm không có biến thể" });
      }

      const addQty = productItem.quantity - getAppliedQuantity(productItem);
      if (!Number.isFinite(addQty) || addQty < 0) {
        return res.status(400).json({ message: "Số lượng nhập còn lại không hợp lệ" });
      }
      const appliedAdjustments = addQty > 0
        ? await applyStockAdjustments([{
          productId: product._id,
          variantIndex: 0,
          expectedVariantId: variant._id,
          quantityInStorageDelta: addQty,
          quantityForSaleDelta: addQty,
        }])
        : [];
      productItem.quantityRe = productItem.quantity;
      productItem.stockAppliedQuantity = productItem.quantity;
      productItem.status = true;

      const updatedOrder = await saveWithStockRollback(order, appliedAdjustments);
      if (addQty > 0) {
        await saveStockHistories([{
          productId: productItem.productId,
          productName: product.name,
          quantity: addQty,
          userName: req.user?.name,
          orderId: order._id.toString(),
          orderName: order.orderName,
          note: "Nhập kho (đơn nhập hoàn thành)",
          source: "order_line_complete",
        }]);
      }
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating import order item status:", error);
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi server khi cập nhật trạng thái sản phẩm"),
      });
    }
  }
);

router.get(
  "/orders/:id",
  [authenticateAdmin, checkPermission("iporder.view")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ message: "Order not found" });

      const productList = await Promise.all(
        (order.productList || []).map(async (item) => {
          const product = await Product.findById(item.productId).lean();

          return {
            ...item,
            name: product?.name || "",
            brand: product?.brand || "",
            image: product?.variant?.[0]?.imgUrl || "",
          };
        })
      );

      res.json({
        ...order,
        productList,
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const productIndex = parseInt(req.params.productIndex);
      if (
        isNaN(productIndex) ||
        productIndex < 0 ||
        productIndex >= order.productList.length
      ) {
        return res.status(404).json({ message: "Product index not found" });
      }

      const currentProduct = order.productList[productIndex];
      const rawUpdate = req.body || {};
      if (
        hasOwn(rawUpdate, "productId") &&
        String(rawUpdate.productId) !== String(currentProduct.productId)
      ) {
        return res.status(400).json({
          message: "Không thể thay đổi sản phẩm của một dòng đơn nhập hiện có.",
        });
      }

      const targetQuantity = hasOwn(rawUpdate, "quantity")
        ? rawUpdate.quantity
        : currentProduct.quantity;
      const targetProgress = hasOwn(rawUpdate, "quantityRe")
        ? rawUpdate.quantityRe
        : toQuantity(currentProduct.quantityRe);
      validateLineQuantities({
        quantity: targetQuantity,
        quantityRe: targetProgress,
      });

      const currentProgress = toQuantity(currentProduct.quantityRe);
      const currentApplied = getAppliedQuantity(currentProduct);
      const untrackedQuantity = currentProgress - currentApplied;
      const targetApplied = Math.max(0, targetProgress - untrackedQuantity);
      const stockDelta = targetApplied - currentApplied;
      const isAIScan = rawUpdate.isAIScan === true;
      const updatedProduct = {
        ...currentProduct.toObject(),
        quantity: targetQuantity,
        quantityRe: targetProgress,
        stockAppliedQuantity: targetApplied,
        status: targetProgress === targetQuantity,
      };
      for (const field of ["price", "unit", "note", "vat"]) {
        if (!hasOwn(rawUpdate, field)) continue;
        if (typeof rawUpdate[field] !== "string") {
          throw createRouteError(400, `${field} phải là chuỗi.`);
        }
        updatedProduct[field] = rawUpdate[field];
      }
      order.productList[productIndex] = updatedProduct;

      let stockResult = { appliedAdjustments: [], historyData: null };
      if (stockDelta !== 0) {
        stockResult = await adjustImportStock({
          productId: currentProduct.productId,
          delta: stockDelta,
          req,
          order,
          note: stockDelta > 0 ? "Nhập kho (cập nhật đơn nhập)" : "Điều chỉnh giảm nhập kho",
          isAIScan,
          source: isAIScan ? undefined : "order_line_manual",
        });
      }

      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum = parseFloat(
            item.price?.replace(/\./g, "").replace(",", ".") || 0
          );
          return sum + priceNum * (item.quantity || 0);
        }, 0)
        .toString();

      const updatedOrder = await saveWithStockRollback(
        order,
        stockResult.appliedAdjustments
      );
      await saveStockHistories([stockResult.historyData]);
      res.json(updatedOrder);
    } catch (error) {
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi khi cập nhật đơn nhập"),
      });
    }
  }
);

router.put(
  "/orders/:id/name",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { orderName, note } = req.body;
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (orderName !== undefined) order.orderName = orderName || "";
      if (note !== undefined) order.note = typeof note === "string" ? note : "";
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/reorder",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const { productList } = req.body;
      if (!Array.isArray(productList)) {
        return res
          .status(400)
          .json({ message: "productList must be an array" });
      }

      const isValid = productList.every(
        (item) =>
          item.productId &&
          typeof item.price === "string" &&
          typeof item.unit === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          typeof item.quantityRe === "number" &&
          Number.isFinite(item.quantityRe) &&
          item.quantityRe >= 0 &&
          item.quantityRe <= item.quantity &&
          typeof item.status === "boolean"
      );

      if (!isValid) {
        return res.status(400).json({ message: "Invalid productList format" });
      }

      const toLineKey = (item) => JSON.stringify({
        productId: String(item.productId),
        price: item.price || "",
        unit: item.unit || "",
        quantity: Number(item.quantity),
        quantityRe: Number(item.quantityRe),
        status: Boolean(item.status),
        note: item.note || "",
        vat: item.vat || "",
      });
      const countLines = (items) => items.reduce((counts, item) => {
        const key = toLineKey(item);
        counts.set(key, (counts.get(key) || 0) + 1);
        return counts;
      }, new Map());
      const currentCounts = countLines(order.productList);
      const reorderedCounts = countLines(productList);
      const isSameLines = currentCounts.size === reorderedCounts.size &&
        [...currentCounts.entries()].every(
          ([key, count]) => reorderedCounts.get(key) === count
        );
      if (!isSameLines) {
        return res.status(400).json({
          message: "API sắp xếp chỉ được thay đổi thứ tự sản phẩm.",
        });
      }

      const currentLineBuckets = order.productList.reduce((buckets, item) => {
        const key = toLineKey(item);
        const bucket = buckets.get(key) || [];
        bucket.push(item);
        buckets.set(key, bucket);
        return buckets;
      }, new Map());
      order.productList = productList.map((item) => {
        const currentLine = currentLineBuckets.get(toLineKey(item)).shift();
        return currentLine.toObject();
      });

      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum = parseFloat(
            item.price?.replace(/\./g, "").replace(",", ".") || 0
          );
          return sum + priceNum * (item.quantity || 0);
        }, 0)
        .toString();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get(
  "/products",
  [authenticateAdmin, checkPermission("iporder.view")],
  async (req, res) => {
    try {
      const { page = 1 } = req.query;
      const limit = 10;
      const skip = (page - 1) * limit;

      const pipeline = [
        { $unwind: "$productList" },
        {
          $group: {
            _id: "$productList.productId",
            totalOrdered: { $sum: "$productList.quantity" },
            productDetails: { $first: "$productList" },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productInfo",
          },
        },
        { $unwind: "$productInfo" },
        {
          $project: {
            _id: 1,
            name: "$productInfo.name",
            brand: "$productInfo.brand",
            variant: "$productInfo.variant",
            totalOrdered: 1,
          },
        },
        { $sort: { name: 1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      const products = await IpOrder.aggregate(pipeline);
      const totalProducts = await IpOrder.aggregate([
        { $unwind: "$productList" },
        { $group: { _id: "$productList.productId" } },
        { $count: "total" },
      ]);

      const totalItems = totalProducts.length > 0 ? totalProducts[0].total : 0;

      res.json({
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalItems / limit),
          totalItems,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

const invoiceStorage = multer.diskStorage({
  destination: "./upload/invoices",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".webp";
    cb(null, `invoice-manual-${uniqueSuffix}${ext}`);
  }
});
const uploadInvoice = multer({ 
  storage: invoiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, webp)."));
    }
  }
});

router.post(
  "/upload-image",
  [authenticateAdmin, checkPermission("iporder.edit"), uploadInvoice.single("invoice")],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: 0, message: "Không có file được tải lên" });
      }
      const imageUrl = `/invoice-images/${req.file.filename}`;
      res.json({ success: 1, imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Lỗi upload ảnh" });
    }
  }
);

router.delete(
  "/delete-image",
  [authenticateAdmin, checkPermission("iporder.edit")],
  async (req, res) => {
    try {
      const { imageUrl } = req.query;
      if (!imageUrl) {
        return res.status(400).json({ success: 0, message: "Thiếu thông tin imageUrl." });
      }

      // Tránh lỗi Path Traversal
      const filename = path.basename(imageUrl);
      const filePath = path.join(__dirname, "../upload/invoices", filename);

      try {
        const fs = require("fs").promises;
        await fs.stat(filePath);
        await fs.unlink(filePath);
        console.log(`[iporder] Đã xóa thành công tệp ảnh hóa đơn vật lý: ${filename}`);
        return res.json({ success: 1, message: "Đã xóa ảnh vật lý thành công." });
      } catch (statErr) {
        return res.json({ success: 1, message: "File không tồn tại trên ổ cứng hoặc đã được xóa." });
      }
    } catch (error) {
      res.status(500).json({ success: 0, message: "Lỗi server khi xóa ảnh vật lý" });
    }
  }
);

module.exports = {
  IpOrder,
  router,
};
