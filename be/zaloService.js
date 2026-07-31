const { ZaloConfig } = require("./models/zalo");

/**
 * Lấy Access Token hợp lệ. Nếu hết hạn, tự động dùng Refresh Token để làm mới.
 * @returns {Promise<string|null>} Access Token hợp lệ hoặc null nếu chưa liên kết
 */
async function getValidToken() {
  try {
    const config = await ZaloConfig.findOne();
    if (!config || !config.appId || !config.secretKey) {
      console.warn("Zalo Service: Chưa cấu hình App ID hoặc Secret Key.");
      return null;
    }

    if (!config.accessToken || !config.refreshToken) {
      console.warn("Zalo Service: Chưa liên kết OAuth với Zalo OA.");
      return null;
    }

    const isExpired = !config.expiresAt || (new Date(config.expiresAt).getTime() - Date.now() < 15 * 60 * 1000);

    if (!isExpired) {
      return config.accessToken;
    }

    console.log("Zalo Service: Access Token hết hạn, đang tự động làm mới bằng Refresh Token...");

    const tokenUrl = "https://oauth.zalo.me/v4/oa/access_token";
    const body = new URLSearchParams({
      refresh_token: config.refreshToken,
      app_id: config.appId,
      grant_type: "refresh_token"
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": config.secretKey
      },
      body: body.toString()
    });

    const data = await response.json();

    if (data.error) {
      console.error("Zalo Service: Lỗi khi làm mới token từ Zalo:", data);
      return null;
    }

    config.accessToken = data.access_token;
    config.refreshToken = data.refresh_token;
    const expiresInSec = parseInt(data.expires_in || 86400, 10);
    config.expiresAt = new Date(Date.now() + expiresInSec * 1000);

    await config.save();
    console.log("Zalo Service: Làm mới Access Token thành công.");

    return config.accessToken;
  } catch (error) {
    console.error("Zalo Service: Lỗi trong quá trình lấy/làm mới Token:", error);
    return null;
  }
}

/**
 * Gửi tin nhắn text tới người dùng Zalo thông qua Zalo OA
 * @param {string} recipientUserId - Zalo User ID của người nhận tin nhắn đối với OA này
 * @param {string} textContent - Nội dung tin nhắn
 * @returns {Promise<boolean>} Trả về true nếu gửi thành công, ngược lại là false
 */
async function sendZaloMessage(recipientUserId, textContent) {
  try {
    const accessToken = await getValidToken();
    if (!accessToken) {
      console.error("Zalo Service: Không thể gửi tin nhắn do thiếu Access Token hợp lệ.");
      return false;
    }

    const url = "https://openapi.zalo.me/v2.0/oa/message/cs";

    const payload = {
      recipient: {
        user_id: recipientUserId
      },
      message: {
        text: textContent
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": accessToken
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.error !== 0) {
      console.error("Zalo Service: Gửi tin nhắn thất bại. Chi tiết lỗi từ Zalo:", result);
      return false;
    }

    console.log(`Zalo Service: Đã gửi thông báo thành công tới user: ${recipientUserId}`);
    return true;
  } catch (error) {
    console.error("Zalo Service: Lỗi hệ thống khi gửi tin nhắn Zalo:", error);
    return false;
  }
}

async function sendZaloOrderNotification(orderInfo) {
  try {
    if (process.env.ZALO_DEMO_MODE === "true") {
      const { orderId, userPhone, userName, total, createdAt } = orderInfo;
      const orderTime = new Date(createdAt).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "medium",
        timeStyle: "short",
      });
      const totalFormatted = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(total);
      const messageText =
`CO DON HANG MOI!
----------------------
- Ma don: #${orderId}
- Khach hang: ${userName || "Chua cap nhat"}
- So dien thoai: ${userPhone}
- Tong tien: ${totalFormatted}
- Thoi gian dat: ${orderTime}
----------------------
Vui long kiem tra chi tiet trong bang quan tri Admin.`;

      console.log("[ZALO DEMO] Gia lap gui thong bao don hang:", {
        orderId,
        userPhone,
        userName: userName || "Chua cap nhat",
        total,
        totalFormatted,
        orderTime,
      });
      console.log("[ZALO DEMO] Noi dung tin nhan:\n" + messageText);
      return;
    }

    const config = await ZaloConfig.findOne();
    if (!config || !config.recipientUserId) {
      console.warn("Zalo Service: Chưa cấu hình Zalo User ID người nhận thông báo.");
      return;
    }

    const { orderId, userPhone, userName, total, createdAt } = orderInfo;

    const orderTime = new Date(createdAt).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const totalFormatted = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(total);

    const messageText =
`CO DON HANG MOI!
----------------------
- Ma don: #${orderId}
- Khach hang: ${userName || "Chưa cập nhật"}
- So dien thoai: ${userPhone}
- Tong tien: ${totalFormatted}
- Thoi gian dat: ${orderTime}
----------------------
Vui lòng kiểm tra chi tiết trong bảng quản trị Admin.`;

    await sendZaloMessage(config.recipientUserId, messageText);
  } catch (error) {
    console.error("Zalo Service: Gửi thông báo đơn hàng thất bại:", error);
  }
}

module.exports = {
  getValidToken,
  sendZaloMessage,
  sendZaloOrderNotification
};
