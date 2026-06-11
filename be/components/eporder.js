const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const router = express.Router();
const { Product } = require("./product");

const epOrderSchema = new mongoose.Schema(
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
        quantityEx: { type: Number, default: 0 },
        note: { type: String },
      },
    ],
    total: { type: String, default: "0" },
    status: { type: Boolean, default: 0 },
  },
  { timestamps: true }
);

const EpOrder = mongoose.model("EpOrder", epOrderSchema);

router.get(
  "/orders",
  [authenticateAdmin, checkPermission("read_eporder")],
  async (req, res) => {
    try {
      const {
        page = 1,
        orderName,
        userName,
        status,
        startDate,
        endDate,
      } = req.query;
      const limit = 10;
      const skip = (page - 1) * limit;

      let query = {};
      if (orderName) query.orderName = { $regex: orderName, $options: "i" };
      if (userName) query.userName = { $regex: userName, $options: "i" };
      if (status) query.status = status === "true";
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const totalOrders = await EpOrder.countDocuments(query);
      const orders = await EpOrder.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

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
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const userName = req.user.name;
      const { productList, orderName } = req.body;
      const newOrder = new EpOrder({
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
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const newProduct = req.body;
      order.productList.push(newProduct);
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.delete(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const index = parseInt(req.params.productIndex);
      order.productList.splice(index, 1);

      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum =
            parseFloat(item.price.replace(/\./g, "").replace(",", ".")) || 0;
          return sum + priceNum * item.quantity;
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
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      Object.assign(order, req.body);
      order.total = order.productList
        .reduce((sum, item) => {
          const priceNum =
            parseFloat(item.price.replace(/\./g, "").replace(",", ".")) || 0;
          return sum + priceNum * item.quantity;
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
  [authenticateAdmin, checkPermission("delete_eporder")],
  async (req, res) => {
    try {
      const order = await EpOrder.findById(req.params.id);
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
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      order.status = status;
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/setStatusAndQuantity",
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await EpOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      // Nếu set status = true thì kiểm tra tồn kho trước
      if (status === true) {
        for (let i = 0; i < order.productList.length; i++) {
          const productItem = order.productList[i];
          const product = await Product.findById(productItem.productId);
          if (!product) {
            return res
              .status(404)
              .json({ message: `Product ${productItem.productId} not found` });
          }

          const variant = product.variant[0];
          const requiredQty = productItem.quantity - productItem.quantityEx;

          // Kiểm tra tồn kho
          if (variant.quantityInStorage < requiredQty) {
            return res.status(400).json({
              message: `Không còn đủ số lượng trong kho cho sản phẩm: ${product.name}`,
            });
          }
        }

        // Nếu tất cả sản phẩm đủ tồn kho thì trừ kho và set status
        for (let i = 0; i < order.productList.length; i++) {
          const productItem = order.productList[i];
          const product = await Product.findById(productItem.productId);
          const variant = product.variant[0];
          const requiredQty = productItem.quantity - productItem.quantityEx;

          // Trừ kho
          variant.quantityInStorage -= requiredQty;
          variant.quantityForSale -= requiredQty;

          // Cập nhật trạng thái sản phẩm trong đơn
          productItem.status = true;
          productItem.quantityEx = productItem.quantity;

          await product.save();
        }

        // Cập nhật trạng thái đơn
        order.status = true;
      } else {
        order.status = false;
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex/status",
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const { status } = req.body;
      const order = await EpOrder.findById(req.params.id);
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

      order.productList[productIndex].status = status;

      if (status === true) {
        order.productList[productIndex].quantityEx =
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
  [authenticateAdmin, checkPermission("read_eporder")],
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
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

router.put(
  "/orders/:id/products/:productIndex",
  [authenticateAdmin, checkPermission("update_eporder")],
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
  [authenticateAdmin, checkPermission("update_eporder")],
  async (req, res) => {
    try {
      const { orderName } = req.body;
      const order = await EpOrder.findById(req.params.id);
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
  [authenticateAdmin, checkPermission("update_eporder")],
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
  [authenticateAdmin, checkPermission("read_eporder")],
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
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = {
  EpOrder,
  router,
};