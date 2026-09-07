const mongoose = require("mongoose");

// Mô hình chỉ dùng một tài liệu, giống `ZaloConfig`: toàn bộ từ vựng giọng nói nằm trong tài liệu này.
// Lưu dưới dạng đối tượng để giao diện dễ sử dụng, rồi chuyển sang dạng bộ giá trị mà `product.js` cần khi
// gọi refreshVoiceVocab. Dùng Mixed cho các mảng có cấu trúc lồng nhau.
const voiceVocabSchema = new mongoose.Schema({
  stopwords: { type: [String], default: [] },
  brands: { type: [String], default: [] },
  types: { type: [String], default: [] },
  brandAliases: {
    type: [
      {
        _id: false,
        name: { type: String, required: true },
        aliases: { type: [String], default: [] }
      }
    ],
    default: []
  },
  typeAliases: {
    type: [
      {
        _id: false,
        type: { type: String, required: true },
        keyword: { type: String, default: "" },
        aliases: { type: [String], default: [] }
      }
    ],
    default: []
  },
  intentAliases: {
    type: [
      {
        _id: false,
        intent: { type: String, required: true },
        label: { type: String, default: "" },
        aliases: { type: [String], default: [] }
      }
    ],
    default: []
  },
  codeMap: {
    type: [
      {
        _id: false,
        code: { type: String, required: true },
        keyword: { type: String, default: "" },
        brand: { type: String, default: null },
        type: { type: String, default: null },
        patterns: { type: [String], default: [] },
        compact: { type: String, default: "" }
      }
    ],
    default: []
  }
}, { timestamps: true });

const VoiceVocab = mongoose.models.VoiceVocab || mongoose.model("VoiceVocab", voiceVocabSchema);

module.exports = {
  VoiceVocab,
  voiceVocabSchema,
};
