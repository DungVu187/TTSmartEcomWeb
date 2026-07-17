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

const epOrderSchema = new mongoose.Schema(
  {
    orderName: { type: String, default: "" },
    note: { type: String, default: "" },
    userName: { type: String, required: true },
    productList: [
      {
        status: { type: Boolean, default: 0 },
        productId: { type: String },
        price: { type: String },
        unit: { type: String },
        quantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        quantityEx: {
          type: Number,
          default: 0,
          min: 0,
        },
        stockAppliedQuantity: { type: Number, min: 0, default: undefined },
        stockUpdateSkipped: { type: Boolean, default: false },
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

epOrderSchema.pre("save", function (next) {
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

const EpOrder = mongoose.model("EpOrder", epOrderSchema);

const toQuantity = (value) => Number(value) || 0;

const createRouteError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const adjustExportStock = async ({ productId, delta, req, order, note, isAIScan, source }) => {
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
    quantityInStorageDelta: -delta,
    quantityForSaleDelta: -delta,
  }]);

  return {
    appliedAdjustments,
    historyData: {
      productId,
      productName: product.name,
      quantity: -delta,
      userName: req.user?.name,
      orderId: order._id.toString(),
      orderName: order.orderName,
      note,
      isAIScan: !!isAIScan,
      source,
    },
  };
};

const EXPORT_LINE_EDITABLE_FIELDS = ["price", "unit", "quantity", "quantityEx", "note", "vat"];

const parseExportLineQuantities = (line) => {
  const quantity = Number(line?.quantity);
  const quantityEx = line?.quantityEx === undefined || line?.quantityEx === null
    ? 0
    : Number(line.quantityEx);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createRouteError(400, "Số lượng cần xuất phải là số nguyên lớn hơn 0");
  }
  if (!Number.isInteger(quantityEx) || quantityEx < 0 || quantityEx > quantity) {
    throw createRouteError(400, "Số lượng đã xuất phải nằm trong khoảng từ 0 đến số lượng cần xuất");
  }
  return { quantity, quantityEx };
};

const getStockAppliedQuantity = (line) => {
  const progress = toQuantity(line?.quantityEx);
  const hasExplicitValue = line?.stockAppliedQuantity !== undefined &&
    line?.stockAppliedQuantity !== null;
  const applied = hasExplicitValue
    ? Number(line.stockAppliedQuantity)
    : progress;
  if (!Number.isFinite(applied) || applied < 0 || applied > progress) {
    throw createRouteError(409, "Dữ liệu số lượng đã trừ kho của dòng xuất không hợp lệ");
  }
  return applied;
};

const isExportLineFullyApplied = (line) => {
  const quantity = toQuantity(line?.quantity);
  const progress = toQuantity(line?.quantityEx);
  if (progress !== quantity) return false;
  return getStockAppliedQuantity(line) === quantity || line?.stockUpdateSkipped === true;
};

const pickExportLineFields = (line) => EXPORT_LINE_EDITABLE_FIELDS.reduce(
  (picked, field) => {
    if (line?.[field] !== undefined) picked[field] = line[field];
    return picked;
  },
  {}
);

const buildNewExportLine = (line, stockAppliedQuantity, stockUpdateSkipped = false) => {
  const { quantity, quantityEx } = parseExportLineQuantities(line);
  if (!mongoose.Types.ObjectId.isValid(line?.productId)) {
    throw createRouteError(400, "Mã sản phẩm không hợp lệ");
  }
  return {
    productId: String(line.productId),
    ...pickExportLineFields(line),
    quantity,
    quantityEx,
    status: quantityEx === quantity,
    stockAppliedQuantity,
    stockUpdateSkipped,
  };
};

const assertSkippableAIScanExport = async (line) => {
  if (line?.skipStockUpdate !== true || line?.isAIScan !== true) {
    throw createRouteError(400, "Không được phép bỏ qua cập nhật tồn kho");
  }
  const product = await Product.findById(line.productId)
    .select("variant.quantityForSale variant.quantityInStorage");
  const variant = product?.variant?.[0];
  if (!product || !variant) {
    throw createRouteError(404, "Không tìm thấy sản phẩm hoặc phiên bản sản phẩm");
  }
  if (toQuantity(variant.quantityForSale) !== 0 || toQuantity(variant.quantityInStorage) !== 0) {
    throw createRouteError(
      400,
      "Chỉ được bỏ qua tồn kho cho sản phẩm mới do AI tạo và chưa có tồn"
    );
  }
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
      console.error("StorageHistory error (eporder stock adjustment):", logErr.message);
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
    return "Đơn xuất vừa được thay đổi bởi thao tác khác, vui lòng tải lại.";
  }
  return fallback;
};

router.get(
  "/orders",
  [authenticateAdmin, checkPermission("eporder.view")],
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

      const totalOrders = await EpOrder.countDocuments(query);
      const sortField = byCompletedDate === "true" ? "completedAt" : "createdAt";
      const orders = await EpOrder.find(query)
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
  [authenticateAdmin, checkPermission("eporder.create")],
  async (req, res) => {
    try {
      const userName = req.user.name;
      const { productList, orderName, note } = req.body;
      if (productList !== undefined && !Array.isArray(productList)) {
        throw createRouteError(400, "productList phải là một mảng");
      }
      const normalizedProductList = (productList || []).map((line) => {
        const { quantityEx } = parseExportLineQuantities(line);
        if (
          quantityEx !== 0 ||
          (Object.prototype.hasOwnProperty.call(line, "status") && line.status !== false)
        ) {
          throw createRouteError(
            400,
            "Đơn xuất mới chỉ được khởi tạo với số lượng đã xuất bằng 0"
          );
        }
        return buildNewExportLine(line, 0, false);
      });
      const newOrder = new EpOrder({
        orderName: orderName || "",
        note: typeof note === "string" ? note : "",
        userName,
        productList: normalizedProductList,
      });

      if (normalizedProductList.length > 0) {
        newOrder.total = normalizedProductList
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const newProduct = req.body;
      const { quantityEx } = parseExportLineQuantities(newProduct);
      const requestedSkip = newProduct.skipStockUpdate !== undefined;
      const shouldSkipStockUpdate = requestedSkip && newProduct.skipStockUpdate === true;
      if (requestedSkip && typeof newProduct.skipStockUpdate !== "boolean") {
        throw createRouteError(400, "skipStockUpdate phải là boolean");
      }
      if (shouldSkipStockUpdate) {
        await assertSkippableAIScanExport(newProduct);
      }
      const stockDelta = shouldSkipStockUpdate ? 0 : quantityEx;
      let stockResult = { appliedAdjustments: [], historyData: null };
      if (stockDelta > 0) {
        stockResult = await adjustExportStock({
          productId: newProduct.productId,
          delta: stockDelta,
          req,
          order,
          note: newProduct.isAIScan ? "Xuất kho (AI scan đơn xuất)" : "Xuất kho (thêm sản phẩm đơn xuất)",
          isAIScan: newProduct.isAIScan,
          source: newProduct.isAIScan ? undefined : "order_line_manual",
        });
      }

      order.productList.push(buildNewExportLine(
        newProduct,
        stockDelta,
        shouldSkipStockUpdate
      ));
      const updatedOrder = await saveWithStockRollback(
        order,
        stockResult.appliedAdjustments
      );
      await saveStockHistories([stockResult.historyData]);
      res.json(updatedOrder);
    } catch (error) {
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi khi thêm sản phẩm vào đơn xuất"),
      });
    }
  }
);

router.delete(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const index = parseInt(req.params.productIndex);
      if (!Number.isInteger(index) || index < 0 || index >= order.productList.length) {
        return res.status(400).json({ message: "Invalid product index" });
      }
      if (
        toQuantity(order.productList[index].quantityEx) > 0 ||
        getStockAppliedQuantity(order.productList[index]) > 0
      ) {
        return res.status(400).json({
          message: "Không thể xóa sản phẩm đã phát sinh xuất kho. Hãy hoàn số lượng xuất về 0 trước.",
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      // Whitelist fields to prevent Mass Assignment
      if (
        Object.prototype.hasOwnProperty.call(req.body, "productList") ||
        Object.prototype.hasOwnProperty.call(req.body, "status")
      ) {
        return res.status(400).json({
          message: "Hãy dùng API sản phẩm hoặc trạng thái chuyên biệt để cập nhật đơn xuất",
        });
      }
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
  [authenticateAdmin, checkPermission("eporder.delete")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (order.productList.some(
        (item) => toQuantity(item.quantityEx) > 0 || getStockAppliedQuantity(item) > 0
      )) {
        return res.status(400).json({
          message: "Không thể xóa đơn đã phát sinh xuất kho. Hãy hoàn tác các dòng xuất trước.",
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean" });
      }
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (
        status === true &&
        !order.productList.every((item) => isExportLineFullyApplied(item))
      ) {
        return res.status(400).json({
          message: "Chỉ có thể hoàn tất đơn khi tất cả sản phẩm đã xuất đủ.",
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean" });
      }
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      let appliedAdjustments = [];
      const historyEntries = [];
      if (status === true) {
        const adjustments = [];
        for (let i = 0; i < order.productList.length; i++) {
          const productItem = order.productList[i];
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
          const { quantity, quantityEx } = parseExportLineQuantities(productItem);
          const currentApplied = getStockAppliedQuantity(productItem);
          const untrackedQuantity = Math.max(0, quantityEx - currentApplied);
          const targetApplied = Math.max(0, quantity - untrackedQuantity);
          const requiredQty = targetApplied - currentApplied;

          if (!Number.isFinite(requiredQty) || requiredQty < 0) {
            throw new InventoryError("Số lượng xuất còn lại không hợp lệ.", {
              statusCode: 400,
              code: "INVALID_EXPORT_QUANTITY",
            });
          }

          if (requiredQty > 0) {
            adjustments.push({
              productId: product._id,
              variantIndex: 0,
              expectedVariantId: variant._id,
              quantityInStorageDelta: -requiredQty,
              quantityForSaleDelta: -requiredQty,
            });
            historyEntries.push({
              productId: productItem.productId,
              productName: product.name,
              quantity: -requiredQty,
              userName: req.user?.name,
              orderId: order._id.toString(),
              orderName: order.orderName,
              note: "Xuất kho (đơn xuất hoàn thành)",
              source: "order_bulk_complete",
            });
          }

          // Cập nhật trạng thái sản phẩm trong đơn
          productItem.status = true;
          productItem.quantityEx = quantity;
          productItem.stockAppliedQuantity = targetApplied;
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
      console.error(error);
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi khi hoàn tất đơn xuất"),
      });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/status",
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean" });
      }
      const order = await EpOrder.findById(req.params.id);
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
      const isQuantityComplete = isExportLineFullyApplied(productItem);
      if (status === true && !isQuantityComplete) {
        return res.status(400).json({
          message: "Hãy dùng thao tác xuất kho để hoàn tất sản phẩm.",
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const { status } = req.body;
      if (typeof status !== "boolean") {
        return res.status(400).json({ message: "status phải là boolean" });
      }
      const order = await EpOrder.findById(req.params.id);
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

      const { quantity, quantityEx } = parseExportLineQuantities(productItem);
      const currentApplied = getStockAppliedQuantity(productItem);
      const untrackedQuantity = Math.max(0, quantityEx - currentApplied);
      const targetApplied = Math.max(0, quantity - untrackedQuantity);
      const requiredQty = targetApplied - currentApplied;

      if (!Number.isFinite(requiredQty) || requiredQty < 0) {
        return res.status(400).json({ message: "Số lượng xuất còn lại không hợp lệ" });
      }

      const appliedAdjustments = requiredQty > 0
        ? await applyStockAdjustments([{
          productId: product._id,
          variantIndex: 0,
          expectedVariantId: variant._id,
          quantityInStorageDelta: -requiredQty,
          quantityForSaleDelta: -requiredQty,
        }])
        : [];
      productItem.quantityEx = quantity;
      productItem.status = true;
      productItem.stockAppliedQuantity = targetApplied;

      const updatedOrder = await saveWithStockRollback(order, appliedAdjustments);
      if (requiredQty > 0) {
        await saveStockHistories([{
          productId: productItem.productId,
          productName: product.name,
          quantity: -requiredQty,
          userName: req.user?.name,
          orderId: order._id.toString(),
          orderName: order.orderName,
          note: "Xuất kho (đơn xuất hoàn thành)",
          source: "order_line_complete",
        }]);
      }
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating export order item status:", error);
      res.status(getRouteErrorStatus(error)).json({
        message: getRouteErrorMessage(error, "Lỗi server khi cập nhật trạng thái sản phẩm"),
      });
    }
  }
);

router.get(
  "/orders/:id",
  [authenticateAdmin, checkPermission("eporder.view")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id).lean();
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
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
      if (
        req.body.productId !== undefined &&
        String(req.body.productId) !== String(currentProduct.productId)
      ) {
        return res.status(400).json({
          message: "Không được đổi sản phẩm của dòng đã tạo; hãy xóa dòng cũ và thêm dòng mới",
        });
      }

      const editableFields = pickExportLineFields(req.body);
      const candidateLine = {
        ...currentProduct.toObject(),
        ...editableFields,
      };
      const { quantity, quantityEx } = parseExportLineQuantities(candidateLine);
      const currentProgress = toQuantity(currentProduct.quantityEx);
      const currentApplied = getStockAppliedQuantity(currentProduct);
      const untrackedQuantity = Math.max(0, currentProgress - currentApplied);
      const targetApplied = Math.max(0, quantityEx - untrackedQuantity);
      const stockDelta = targetApplied - currentApplied;
      let stockResult = { appliedAdjustments: [], historyData: null };
      if (stockDelta !== 0) {
        stockResult = await adjustExportStock({
          productId: currentProduct.productId,
          delta: stockDelta,
          req,
          order,
          note: stockDelta > 0 ? "Xuất kho (cập nhật đơn xuất)" : "Hoàn kho (cập nhật đơn xuất)",
          isAIScan: req.body.isAIScan,
          source: req.body.isAIScan ? undefined : "order_line_manual",
        });
      }

      order.productList[productIndex] = {
        ...order.productList[productIndex].toObject(),
        ...editableFields,
        productId: currentProduct.productId,
        quantity,
        quantityEx,
        status: quantityEx === quantity,
        stockAppliedQuantity: targetApplied,
      };

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
        message: getRouteErrorMessage(error, "Lỗi khi cập nhật đơn xuất"),
      });
    }
  }
);

router.put(
  "/orders/:id/name",
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const { orderName, note } = req.body;
      const order = await EpOrder.findById(req.params.id);
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
  [authenticateAdmin, checkPermission("eporder.edit")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
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
          typeof item.quantity === "number" &&
          typeof item.quantityEx === "number" &&
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
        quantityEx: Number(item.quantityEx),
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
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item.toObject());
        return buckets;
      }, new Map());
      order.productList = productList.map((item) => {
        const key = toLineKey(item);
        return currentLineBuckets.get(key).shift();
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
  [authenticateAdmin, checkPermission("eporder.view")],
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

      const products = await EpOrder.aggregate(pipeline);
      const totalProducts = await EpOrder.aggregate([
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
  [authenticateAdmin, checkPermission("eporder.edit"), uploadInvoice.single("invoice")],
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
  [authenticateAdmin, checkPermission("eporder.edit")],
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
        console.log(`[eporder] Đã xóa thành công tệp ảnh hóa đơn vật lý: ${filename}`);
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
  EpOrder,
  router,
};
