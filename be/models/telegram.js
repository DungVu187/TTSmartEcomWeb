const mongoose = require("mongoose");

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

module.exports = {
  TelegramConfig,
  telegramConfigSchema,
};
