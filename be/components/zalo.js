const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin } = require("./user");
require("dotenv").config();

const router = express.Router();

const zaloConfigSchema = new mongoose.Schema({
  appId: { type: String, default: "" },
  secretKey: { type: String, default: "" },
  oaId: { type: String, default: "" },
  recipientUserId: { type: String, default: "" },
  accessToken: { type: String, default: "" },
  refreshToken: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

const ZaloConfig = mongoose.model("ZaloConfig", zaloConfigSchema);

// GET /api/zalo/settings - Lấy cấu hình hiện tại (đã ẩn các trường nhạy cảm)
router.get("/settings", authenticateAdmin, async (req, res) => {
  try {
    let config = await ZaloConfig.findOne();
    if (!config) {
      config = await ZaloConfig.create({});
    }

    const isLinked = !!(config.accessToken && config.expiresAt && config.expiresAt > new Date());

    res.json({
      success: true,
      data: {
        appId: config.appId,
        oaId: config.oaId,
        recipientUserId: config.recipientUserId,
        isLinked,
        expiresAt: config.expiresAt,
        secretKeyConfigured: !!config.secretKey,
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy cấu hình Zalo:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy cấu hình Zalo" });
  }
});

// POST /api/zalo/settings - Lưu cấu hình từ Admin Panel
router.post("/settings", authenticateAdmin, async (req, res) => {
  try {
    const { appId, secretKey, oaId, recipientUserId } = req.body;

    let config = await ZaloConfig.findOne();
    if (!config) {
      config = new ZaloConfig();
    }

    if (appId !== undefined) config.appId = appId;
    if (secretKey !== undefined) config.secretKey = secretKey;
    if (oaId !== undefined) config.oaId = oaId;
    if (recipientUserId !== undefined) config.recipientUserId = recipientUserId;

    await config.save();

    res.json({
      success: true,
      message: "Cập nhật cấu hình Zalo thành công",
      data: {
        appId: config.appId,
        oaId: config.oaId,
        recipientUserId: config.recipientUserId,
        secretKeyConfigured: !!config.secretKey,
      }
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật cấu hình Zalo:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật cấu hình" });
  }
});

// GET /api/zalo/auth-url - Sinh URL OAuth Zalo
router.get("/auth-url", authenticateAdmin, async (req, res) => {
  try {
    const config = await ZaloConfig.findOne();
    if (!config || !config.appId) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập và lưu App ID trước khi liên kết." });
    }

    const serverUrl = process.env.ADDRESS || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${serverUrl.replace(/\/$/, "")}/api/zalo/callback`;
    const encodedRedirectUri = encodeURIComponent(redirectUri);

    const authUrl = `https://oauth.zalo.me/v4/oa/permission?app_id=${config.appId}&redirect_uri=${encodedRedirectUri}&state=zalo_link`;

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Lỗi khi sinh link OAuth Zalo:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi tạo link xác thực" });
  }
});

// GET /api/zalo/callback - Tiếp nhận callback từ Zalo và đổi lấy Token
router.get("/callback", async (req, res) => {
  const { code, oa_id } = req.query;

  if (!code) {
    return res.status(400).send("Không nhận được authorization code từ Zalo. Vui lòng thử lại.");
  }

  try {
    const config = await ZaloConfig.findOne();
    if (!config || !config.appId || !config.secretKey) {
      return res.status(400).send("Thiếu thông tin App ID hoặc Secret Key trong Database. Cần lưu cấu hình trước.");
    }

    const tokenUrl = "https://oauth.zalo.me/v4/oa/access_token";
    const body = new URLSearchParams({
      code,
      app_id: config.appId,
      grant_type: "authorization_code"
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
      console.error("Lỗi OAuth Zalo trả về:", data);
      return res.status(400).send(`Lỗi lấy token từ Zalo: ${data.message || data.error_description || JSON.stringify(data)}`);
    }

    config.accessToken = data.access_token;
    config.refreshToken = data.refresh_token;

    const expiresInSec = parseInt(data.expires_in || 86400, 10);
    config.expiresAt = new Date(Date.now() + expiresInSec * 1000);

    if (oa_id) {
      config.oaId = oa_id;
    }

    await config.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl.replace(/\/$/, "")}/admin/zalo?link=success`);
  } catch (error) {
    console.error("Lỗi khi xử lý Callback OAuth Zalo:", error);
    res.status(500).send(`Lỗi hệ thống khi liên kết Zalo: ${error.message}`);
  }
});

module.exports = {
  ZaloConfig,
  router,
};
