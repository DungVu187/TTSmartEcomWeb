const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");

const router = express.Router();

// Schema cho ChatMessage
const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    senderPhone: {
      type: String,
    },
    senderName: {
      type: String,
    },
    senderRole: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
    },
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

// GET /chat/sessions: Lấy danh sách các phiên chat của khách hàng (dành cho Admin)
router.get("/sessions", [authenticateAdmin, checkPermission("read_order")], async (req, res) => {
  try {
    const sessions = await ChatMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sessionId",
          lastMessage: { $first: "$message" },
          lastMessageTime: { $first: "$createdAt" },
          lastSenderRole: { $first: "$senderRole" },
          names: { $push: "$senderName" },
          phones: { $push: "$senderPhone" },
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    const result = sessions.map((s) => {
      const senderName = s.names.find((n) => n && n !== "Admin") || s._id;
      const senderPhone = s.phones.find((p) => p) || "";
      return {
        sessionId: s._id,
        lastMessage: s.lastMessage,
        lastMessageTime: s.lastMessageTime,
        lastSenderRole: s.lastSenderRole,
        senderName,
        senderPhone,
      };
    });

    res.json({ success: true, sessions: result });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phiên chat:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// GET /chat/history/:sessionId: Lấy lịch sử hội thoại của một phiên chat
router.get("/history/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử chat:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = {
  router,
  ChatMessage,
};
