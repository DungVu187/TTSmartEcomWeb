const express = require("express");
const mongoose = require("mongoose");
const { authenticateUser, authenticateAdmin, checkPermission, User } = require("./user");
require("dotenv").config();
const { Product } = require('./product');
const { sendNewOrderNotification } = require('../mailer');
const { sendZaloOrderNotification } = require('../zaloService');
const { Station } = require('./station');

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
    },
    completedAt: {
      type: Date,
      default: null
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

    // 👉 Gửi email thông báo đến admin (Sử dụng orderCode thay cho ObjectId)
    sendNewOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total,
      createdAt: savedOrder.createdAt,
      stationNames: stationNamesStr,
      stationCodes: stationCodesStr,
    });

    // 👉 Gửi tin nhắn thông báo Zalo OA đến admin (không làm gián đoạn luồng đặt hàng nếu lỗi)
    sendZaloOrderNotification({
      orderId: savedOrder.orderCode || savedOrder._id,
      userPhone,
      userName,
      total,
      createdAt: savedOrder.createdAt,
    }).catch(err => console.error("Lỗi gửi thông báo Zalo:", err));

    // 👉 Emit khi tạo đơn hàng
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