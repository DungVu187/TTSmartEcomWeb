const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdminOnly } = require("./user");
const { ActivityLog } = require("./activitylog");
const { sendTelegramMessage } = require("../telegramService");

const router = express.Router();

const telegramConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  recipients: [{
    label: { type: String, default: "" },
    chatId: { type: String, required: true },
    type: { type: String, enum: ["personal", "group"], default: "personal" },
    enabled: { type: Boolean, default: true },
    notifyTypes: { type: [String], default: ["new_order"] },
  }],
}, { timestamps: true });

const TelegramConfig = mongoose.models.TelegramConfig || mongoose.model("TelegramConfig", telegramConfigSchema);

const getConfig = async () => {
  let config = await TelegramConfig.findOne();
  if (!config) {
    config = await TelegramConfig.create({});
  }
  return config;
};

const logActivity = async (req, action, details) => {
  try {
    await new ActivityLog({
      userName: req.user?.name || "Quản trị viên",
      action,
      productName: "Cấu hình Telegram",
      details: [{ field: "Telegram", oldValue: "", newValue: details }],
    }).save();
  } catch (logErr) {
    console.error("ActivityLog error in telegram settings:", logErr.message);
  }
};

const validateRecipientInput = ({ chatId, type, notifyTypes }, isUpdate = false) => {
  if (!isUpdate || chatId !== undefined) {
    if (!String(chatId || "").trim()) return "Chat ID không được để trống";
  }
  if (type !== undefined && !["personal", "group"].includes(type)) {
    return "Loại người nhận không hợp lệ";
  }
  if (notifyTypes !== undefined && !Array.isArray(notifyTypes)) {
    return "Loại thông báo không hợp lệ";
  }
  return null;
};

router.get("/settings", authenticateAdminOnly, async (req, res) => {
  try {
    const config = await getConfig();
    res.json({
      success: true,
      data: {
        enabled: config.enabled,
        recipients: config.recipients,
        botConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      },
    });
  } catch (error) {
    console.error("Telegram: lỗi lấy cấu hình", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy cấu hình Telegram" });
  }
});

router.put("/settings", authenticateAdminOnly, async (req, res) => {
  try {
    const config = await getConfig();
    if (typeof req.body.enabled !== "boolean") {
      return res.status(400).json({ success: false, message: "Trạng thái bật/tắt không hợp lệ" });
    }

    config.enabled = req.body.enabled;
    await config.save();
    await logActivity(req, "update_telegram_settings", `Đã ${config.enabled ? "bật" : "tắt"} thông báo Telegram`);

    res.json({ success: true, data: { enabled: config.enabled } });
  } catch (error) {
    console.error("Telegram: lỗi cập nhật cấu hình", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật cấu hình Telegram" });
  }
});

router.post("/recipients", authenticateAdminOnly, async (req, res) => {
  try {
    const validationMessage = validateRecipientInput(req.body);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const config = await getConfig();
    const recipient = {
      label: String(req.body.label || "").trim(),
      chatId: String(req.body.chatId).trim(),
      type: req.body.type || "personal",
      enabled: req.body.enabled !== false,
      notifyTypes: req.body.notifyTypes || ["new_order"],
    };
    config.recipients.push(recipient);
    await config.save();

    const savedRecipient = config.recipients[config.recipients.length - 1];
    await logActivity(req, "create_telegram_recipient", `Đã thêm người/nhóm nhận ${savedRecipient.label || savedRecipient.chatId}`);
    res.status(201).json({ success: true, data: savedRecipient });
  } catch (error) {
    console.error("Telegram: lỗi thêm người nhận", error);
    res.status(500).json({ success: false, message: "Lỗi server khi thêm người nhận Telegram" });
  }
});

router.put("/recipients/:recipientId", authenticateAdminOnly, async (req, res) => {
  try {
    const validationMessage = validateRecipientInput(req.body, true);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const config = await getConfig();
    const recipient = config.recipients.id(req.params.recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người nhận Telegram" });
    }

    if (req.body.label !== undefined) recipient.label = String(req.body.label).trim();
    if (req.body.chatId !== undefined) recipient.chatId = String(req.body.chatId).trim();
    if (req.body.type !== undefined) recipient.type = req.body.type;
    if (req.body.enabled !== undefined) recipient.enabled = req.body.enabled === true;
    if (req.body.notifyTypes !== undefined) recipient.notifyTypes = req.body.notifyTypes;
    await config.save();

    await logActivity(req, "update_telegram_recipient", `Đã cập nhật người/nhóm nhận ${recipient.label || recipient.chatId}`);
    res.json({ success: true, data: recipient });
  } catch (error) {
    console.error("Telegram: lỗi cập nhật người nhận", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật người nhận Telegram" });
  }
});

router.delete("/recipients/:recipientId", authenticateAdminOnly, async (req, res) => {
  try {
    const config = await getConfig();
    const recipient = config.recipients.id(req.params.recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người nhận Telegram" });
    }

    const recipientLabel = recipient.label || recipient.chatId;
    recipient.deleteOne();
    await config.save();
    await logActivity(req, "delete_telegram_recipient", `Đã xóa người/nhóm nhận ${recipientLabel}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Telegram: lỗi xóa người nhận", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xóa người nhận Telegram" });
  }
});

router.post("/test", authenticateAdminOnly, async (req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(400).json({ success: false, message: "Chưa cấu hình TELEGRAM_BOT_TOKEN trên máy chủ" });
    }

    const config = await getConfig();
    const chatId = String(req.body.chatId || "").trim();
    const recipients = chatId
      ? [{ chatId }]
      : config.recipients.filter((recipient) => recipient.enabled === true);
    const message = "<b>Kiểm tra thông báo Telegram</b>\nHệ thống đã kết nối thành công.";
    const results = await Promise.all(recipients.map((recipient) => sendTelegramMessage(recipient.chatId, message)));
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;

    res.json({ success: failed === 0, sent, failed });
  } catch (error) {
    console.error("Telegram: lỗi gửi tin thử", error);
    res.status(500).json({ success: false, message: "Lỗi server khi gửi tin thử Telegram" });
  }
});

module.exports = { TelegramConfig, router };
