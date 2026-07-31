const mongoose = require("mongoose");

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

module.exports = {
  ZaloConfig,
  zaloConfigSchema,
};
