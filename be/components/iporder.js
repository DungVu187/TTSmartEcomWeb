const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const router = express.Router();
const { Product } = require("./product");

const ipOrderSchema = new mongoose.Schema(
  {
    orderName: { type: String, default: "" },
    userName: { type: String, required: true },
    productList: [
      {
        status: { type: Boolean, default: 0 },
        productId: { type: String },
        price: { type: String },
        unit: { type: String },
        quantity: { type: Number },
        quantityRe: { type: Number, default: 0 },
        note: { type: String },
      },
    ],
    total: { type: String, default: "0" },
    status: { type: Boolean, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
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

router.get(
  "/orders",
  [authenticateAdmin, checkPermission("read_iporder")],
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
      const limit = 10;
      const skip = (page - 1) * limit;

      let query = {};
      if (orderName) query.orderName = { $regex: orderName, $options: "i" };
      if (userName) query.userName = { $regex: userName, $options: "i" };
      
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
      res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/orders",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const userName = req.user.name;
      const { productList, orderName } = req.body;
      const newOrder = new IpOrder({
        orderName: orderName || "",
        userName,
        productList: productList || [],
      });

      if (productList && productList.length > 0) {
        newOrder.total = productList
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
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const newProduct = req.body;
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

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.delete(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const index = parseInt(req.params.productIndex);
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
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      Object.assign(order, req.body);
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
  [authenticateAdmin, checkPermission("delete_iporder")],
  async (req, res) => {
    try {
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      await order.deleteOne();
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/status",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

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
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      // Cập nhật status của order
      order.status = status;
      order.completedAt = status ? new Date() : null;

      // Nếu status = true thì set quantityRe = quantity cho tất cả sản phẩm
      if (status === true) {
        order.productList = order.productList.map((product) => ({
          ...product.toObject(),
          quantityRe: product.quantity,
          status: true,
        }));
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/status",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const productIndex = req.params.productIndex;
      if (productIndex >= order.productList.length) {
        return res.status(400).json({ message: "Invalid product index" });
      }

      order.productList[productIndex].status = status;
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/setStatusAndQuantity",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
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

      order.productList[productIndex].status = status;

      if (status === true) {
        order.productList[productIndex].quantityRe =
          order.productList[productIndex].quantity;
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get(
  "/orders/:id",
  [authenticateAdmin, checkPermission("read_iporder")],
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
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("update_iporder")],
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

      order.productList[productIndex] = {
        ...order.productList[productIndex],
        ...req.body,
      };

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
  "/orders/:id/name",
  [authenticateAdmin, checkPermission("update_iporder")],
  async (req, res) => {
    try {
      const { orderName } = req.body;
      const order = await IpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      order.orderName = orderName || "";
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/reorder",
  [authenticateAdmin, checkPermission("update_iporder")],
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
          typeof item.quantity === "number" &&
          typeof item.quantityRe === "number" &&
          typeof item.status === "boolean"
      );

      if (!isValid) {
        return res.status(400).json({ message: "Invalid productList format" });
      }

      order.productList = productList;

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
  [authenticateAdmin, checkPermission("read_iporder")],
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
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = {
  IpOrder,
  router,
};
