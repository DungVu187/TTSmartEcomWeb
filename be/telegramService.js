require("dotenv").config();
const { TelegramConfig } = require("./models/telegram");

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const sendTelegramMessage = async (chatId, text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("Telegram: chưa cấu hình TELEGRAM_BOT_TOKEN");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      let result = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        result = body?.description || result;
      } catch {
        // Phản hồi Telegram không phải JSON, chỉ ghi HTTP status.
      }
      console.error("Telegram: gửi thất bại", result);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Telegram: lỗi khi gửi tin nhắn", error.message);
    return false;
  }
};

const sendTelegramOrderNotification = async (orderInfo) => {
  try {
    const config = await TelegramConfig.findOne();
    if (!config?.enabled) return;

    const recipients = (config.recipients || []).filter(
      (recipient) => recipient.enabled === true && recipient.notifyTypes.includes("new_order")
    );
    if (recipients.length === 0) return;

    const amount = Number(orderInfo.total || 0).toLocaleString("vi-VN");
    const createdAt = new Date(orderInfo.createdAt || Date.now()).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const message = [
      "<b>Đơn hàng mới</b>",
      `<b>Mã đơn:</b> ${escapeHtml(orderInfo.orderId)}`,
      `<b>Khách hàng:</b> ${escapeHtml(orderInfo.userName || "Không có")}`,
      `<b>SĐT:</b> ${escapeHtml(orderInfo.userPhone || "Không có")}`,
      `<b>Mã trạm:</b> ${escapeHtml(orderInfo.stationCodes || "Không có")}`,
      `<b>Tên trạm:</b> ${escapeHtml(orderInfo.stationNames || "Không có")}`,
      `<b>Tổng tiền:</b> ${amount} ₫`,
      `<b>Thời gian đặt:</b> ${escapeHtml(createdAt)}`,
    ].join("\n");

    await Promise.all(recipients.map((recipient) => sendTelegramMessage(recipient.chatId, message)));
  } catch (error) {
    console.error("Telegram: lỗi khi gửi thông báo đơn hàng", error.message);
  }
};

module.exports = { sendTelegramMessage, sendTelegramOrderNotification };
