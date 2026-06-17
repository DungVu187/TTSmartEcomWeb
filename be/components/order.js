const express = require("express");
const mongoose = require("mongoose");
const { authenticateUser, authenticateAdmin, checkPermission, User } = require("./user");
require("dotenv").config();
const { Product } = require('./product');
const { sendNewOrderNotification } = require('../mailer');

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

const orderSchema = new mongoose.Schema(
  {
    userPhone: {
      type: String,
      required: true,
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
    }
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

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
      id
    } = req.query;
    const filter = {};

    if (id) {
      filter._id = id;
    }

    if (status) filter.status = status;
    if (payment) filter.payment = payment === "true";
    if (state) filter.state = state;
    if (phone) filter.userPhone = new RegExp(phone, "i");
    if (name) filter.userName = new RegExp(name, "i");

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
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
          })
        );
      }
    }

    order[field] = value;
    await order.save();

    // 👉 Emit khi đơn hàng được cập nhật
    io.emit("order_updated", {
      orderId: order._id,
      updatedField: field,
      newValue: value,
    });

    res.json({ success: true, message: 'Order updated successfully', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
});

// API tạo đơn hàng
router.post("/create-order", authenticateUser, async (req, res) => {
  const { cartItems, total } = req.body;
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

    const newOrder = new Order({
      userPhone,
      userName,
      cartItems,
      total,
    });
    const savedOrder = await newOrder.save();
    
    await User.findOneAndUpdate(
      { phone: userPhone },
      { name: userName },
      {
        $pull: {
          cart: {
            productId: { $in: cartItems.map((item) => item.productId) }
          }
        }
      }
    );

    // 👉 Gửi email thông báo đến admin
    sendNewOrderNotification({
      orderId: savedOrder._id,
      userPhone,
      userName,
      total,
      createdAt: savedOrder.createdAt,
    });

    // 👉 Emit khi tạo đơn hàng
    io.emit("order_created", {
      orderId: savedOrder._id,
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
router.get('/:_id', async (req, res) => {
  try {
    const order = await Order.findById(req.params._id); // Sửa req.params.id thành req.params._id
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
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

    if (!order.payment) {
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

    // 👉 Emit khi xóa đơn hàng
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

    if (order.state === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled." });
    }

    if (!order.payment) {
      for (const item of order.cartItems) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const variant = product.variant[item.variantIndex];
        if (!variant) continue;

        variant.quantityForSale += item.quantity;
        await product.save();
      }
    }

    order.state = "Cancelled";
    await order.save();

    // 👉 Emit khi hủy đơn hàng
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