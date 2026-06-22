const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const { User, getCookieOptions } = require("./user"); 
const router = express.Router();

const autoLoginTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsedAt: {
    type: Date,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

const AutoLoginToken = mongoose.model("AutoLoginToken", autoLoginTokenSchema);

// 📌 Tạo token vĩnh viễn để auto-login
router.post("/autologin-token", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Thiếu số điện thoại" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const token = uuidv4();
    await AutoLoginToken.create({
      token,
      userId: user._id,
    });

    const loginUrl = `https://yourdomain.com/autologin?token=${token}`;
    res.json({ token, url: loginUrl });
  } catch (err) {
    console.error("Lỗi tạo token:", err.message);
    res.status(500).json({ message: "Không tạo được token" });
  }
});

// 📌 Đăng nhập tự động từ token
router.get("/autologin", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Thiếu token" });

    const tokenDoc = await AutoLoginToken.findOne({ token, active: true });
    if (!tokenDoc) return res.status(403).json({ message: "Token không hợp lệ hoặc đã bị vô hiệu hóa" });

    const user = await User.findById(tokenDoc.userId);
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

    // Cập nhật lần dùng cuối
    tokenDoc.lastUsedAt = new Date();
    await tokenDoc.save();

    // Tạo JWT đăng nhập bình thường
    const sessionToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        functions: user.functions || [],
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.cookie("authToken", sessionToken, getCookieOptions(req, 12 * 60 * 60 * 1000));

    res.redirect("/"); // hoặc dashboard
  } catch (err) {
    console.error("Lỗi auto-login:", err.message);
    res.status(500).json({ message: "Auto-login thất bại" });
  }
});

// 📌 Thu hồi token
router.post("/autologin-token/revoke", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Thiếu token" });

    const updated = await AutoLoginToken.findOneAndUpdate({ token }, { active: false });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy token" });

    res.json({ message: "Đã thu hồi token thành công" });
  } catch (err) {
    res.status(500).json({ message: "Không thể thu hồi token" });
  }
});

module.exports = router;
