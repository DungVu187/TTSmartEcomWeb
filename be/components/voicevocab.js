const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const { ActivityLog } = require("./activitylog");
const { refreshVoiceVocab } = require("./product");
const voiceVocabDefaults = require("../config/voiceVocab.defaults");
require("dotenv").config();

const router = express.Router();

// Model single-document (giống ZaloConfig): toàn bộ từ vựng voice nằm trong 1 doc.
// Lưu dạng object (dễ cho UI) rồi convert sang shape tuple mà product.js cần khi
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

// Các nhóm hợp lệ và metadata phục vụ validate + nhãn.
const SIMPLE_GROUPS = ["stopwords", "brands", "types"];
const OBJECT_GROUPS = ["brandAliases", "typeAliases", "intentAliases", "codeMap"];
const ALL_GROUPS = [...SIMPLE_GROUPS, ...OBJECT_GROUPS];

// Chuyển defaults (dạng tuple) sang shape object để seed lần đầu vào DB.
function defaultsToDoc() {
  return {
    stopwords: voiceVocabDefaults.stopwords.slice(),
    brands: voiceVocabDefaults.brands.slice(),
    types: voiceVocabDefaults.types.slice(),
    brandAliases: voiceVocabDefaults.brandAliases.map(([name, aliases]) => ({
      name,
      aliases: (aliases || []).slice()
    })),
    typeAliases: voiceVocabDefaults.typeAliases.map(([type, keyword, aliases]) => ({
      type,
      keyword: keyword || "",
      aliases: (aliases || []).slice()
    })),
    intentAliases: voiceVocabDefaults.intentAliases.map(([intent, label, aliases]) => ({
      intent,
      label: label || "",
      aliases: (aliases || []).slice()
    })),
    codeMap: voiceVocabDefaults.codeMap.map(c => ({
      code: c.code,
      keyword: c.keyword || "",
      brand: c.brand ?? null,
      type: c.type ?? null,
      patterns: (c.patterns || []).slice(),
      compact: c.compact || ""
    }))
  };
}

// Chuyển doc DB (object) sang shape tuple mà refreshVoiceVocab của product.js cần.
function docToVocabPayload(doc) {
  return {
    stopwords: (doc.stopwords || []).slice(),
    brands: (doc.brands || []).slice(),
    types: (doc.types || []).slice(),
    brandAliases: (doc.brandAliases || []).map(b => [b.name, (b.aliases || []).slice()]),
    typeAliases: (doc.typeAliases || []).map(t => [t.type, t.keyword || "", (t.aliases || []).slice()]),
    intentAliases: (doc.intentAliases || []).map(i => [i.intent, i.label || "", (i.aliases || []).slice()]),
    codeMap: (doc.codeMap || []).map(c => ({
      code: c.code,
      keyword: c.keyword || "",
      brand: c.brand ?? null,
      type: c.type ?? null,
      patterns: (c.patterns || []).slice(),
      compact: c.compact || ""
    }))
  };
}

// Lấy doc hiện tại, seed từ defaults nếu chưa có.
// Backfill: doc tạo TRƯỚC khi có nhóm intentAliases sẽ thiếu 4 hành vi mặc định
// (xem/thêm/sửa/xóa). Nếu rỗng thì bơm lại từ defaults để tính năng intent không
// im lặng khi document đã tồn tại từ phiên cũ, và trang admin luôn hiển thị sẵn 4 hành vi.
async function getOrCreateVocab() {
  let doc = await VoiceVocab.findOne();
  if (!doc) {
    doc = await VoiceVocab.create(defaultsToDoc());
    return doc;
  }
  if (!Array.isArray(doc.intentAliases) || doc.intentAliases.length === 0) {
    doc.intentAliases = defaultsToDoc().intentAliases;
    doc.markModified("intentAliases");
    await doc.save();
  }
  return doc;
}

// Nạp vocab từ DB vào product.js. Gọi lúc server start và sau mỗi lần sửa.
async function initVoiceVocab() {
  try {
    const doc = await getOrCreateVocab();
    refreshVoiceVocab(docToVocabPayload(doc));
    return doc;
  } catch (err) {
    console.error("initVoiceVocab error:", err.message);
    return null;
  }
}

// Sau mỗi mutation: lưu doc + nạp lại cache runtime để voice/text dùng vocab mới ngay.
async function persistAndRefresh(doc) {
  await doc.save();
  refreshVoiceVocab(docToVocabPayload(doc));
}

function logVocab(req, action, group, detail) {
  try {
    new ActivityLog({
      userName: req.user?.name || "unknown",
      action,
      productName: `Từ vựng voice: ${group}`,
      details: [{ field: group, oldValue: "", newValue: detail }]
    }).save().catch(e => console.error("ActivityLog voicevocab:", e.message));
  } catch (logErr) {
    console.error("ActivityLog voicevocab error:", logErr.message);
  }
}

// Chuẩn hóa để so trùng không phân biệt hoa/thường + khoảng trắng thừa.
function norm(s) {
  return String(s || "").trim().toLowerCase();
}

// GET /voice-vocabs - trả toàn bộ vocab hiện tại để render bảng.
router.get("/", authenticateAdmin, checkPermission("voice.manage"), async (req, res) => {
  try {
    const doc = await getOrCreateVocab();
    res.json({
      success: true,
      data: {
        stopwords: doc.stopwords,
        brands: doc.brands,
        types: doc.types,
        brandAliases: doc.brandAliases,
        typeAliases: doc.typeAliases,
        intentAliases: doc.intentAliases,
        codeMap: doc.codeMap
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy từ vựng voice:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy từ vựng voice" });
  }
});

// POST /voice-vocabs/:group - thêm 1 mục vào nhóm.
router.post("/:group", authenticateAdmin, checkPermission("voice.manage"), async (req, res) => {
  const { group } = req.params;
  if (!ALL_GROUPS.includes(group)) {
    return res.status(400).json({ success: false, message: "Nhóm từ vựng không hợp lệ." });
  }

  try {
    const doc = await getOrCreateVocab();

    if (SIMPLE_GROUPS.includes(group)) {
      const value = String(req.body?.value || "").trim();
      if (!value) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập giá trị." });
      }
      const exists = doc[group].some(v => norm(v) === norm(value));
      if (exists) {
        return res.status(400).json({ success: false, message: "Giá trị đã tồn tại trong nhóm này." });
      }
      doc[group].push(value);
      await persistAndRefresh(doc);
      logVocab(req, "create_voice_vocab", group, `Thêm "${value}"`);
      return res.status(201).json({ success: true, message: "Thêm thành công.", data: doc[group] });
    }

    if (group === "brandAliases") {
      const name = String(req.body?.name || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      if (!name) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập tên thương hiệu." });
      }
      if (doc.brandAliases.some(b => norm(b.name) === norm(name))) {
        return res.status(400).json({ success: false, message: "Thương hiệu đã có trong bảng alias." });
      }
      doc.brandAliases.push({ name, aliases });
      await persistAndRefresh(doc);
      logVocab(req, "create_voice_vocab", group, `Thêm alias cho "${name}": ${aliases.join("/")}`);
      return res.status(201).json({ success: true, message: "Thêm thành công.", data: doc.brandAliases });
    }

    if (group === "typeAliases") {
      const type = String(req.body?.type || "").trim();
      const keyword = String(req.body?.keyword || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      if (!type) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập tên loại sản phẩm." });
      }
      if (doc.typeAliases.some(t => norm(t.type) === norm(type))) {
        return res.status(400).json({ success: false, message: "Loại sản phẩm đã có trong bảng alias." });
      }
      doc.typeAliases.push({ type, keyword: keyword || type, aliases });
      await persistAndRefresh(doc);
      logVocab(req, "create_voice_vocab", group, `Thêm alias cho "${type}": ${aliases.join("/")}`);
      return res.status(201).json({ success: true, message: "Thêm thành công.", data: doc.typeAliases });
    }

    if (group === "intentAliases") {
      const intent = String(req.body?.intent || "").trim();
      const label = String(req.body?.label || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      if (!intent) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập intent." });
      }
      if (doc.intentAliases.some(i => norm(i.intent) === norm(intent))) {
        return res.status(400).json({ success: false, message: "Intent đã có trong bảng alias." });
      }
      doc.intentAliases.push({ intent, label, aliases });
      await persistAndRefresh(doc);
      logVocab(req, "create_voice_vocab", group, `Thêm alias cho "${intent}": ${aliases.join("/")}`);
      return res.status(201).json({ success: true, message: "Thêm thành công.", data: doc.intentAliases });
    }

    if (group === "codeMap") {
      const code = String(req.body?.code || "").trim();
      const keyword = String(req.body?.keyword || "").trim();
      const brand = req.body?.brand ? String(req.body.brand).trim() : null;
      const type = req.body?.type ? String(req.body.type).trim() : null;
      const patterns = Array.isArray(req.body?.patterns)
        ? req.body.patterns.map(p => String(p).trim()).filter(Boolean)
        : String(req.body?.patterns || "").split(",").map(p => p.trim()).filter(Boolean);
      const compact = String(req.body?.compact || "").trim();
      if (!code) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập mã model." });
      }
      if (doc.codeMap.some(c => norm(c.code) === norm(code))) {
        return res.status(400).json({ success: false, message: "Mã model đã tồn tại." });
      }
      doc.codeMap.push({ code, keyword: keyword || code, brand, type, patterns, compact });
      await persistAndRefresh(doc);
      logVocab(req, "create_voice_vocab", group, `Thêm mã "${code}"`);
      return res.status(201).json({ success: true, message: "Thêm thành công.", data: doc.codeMap });
    }
  } catch (error) {
    console.error("Lỗi khi thêm từ vựng voice:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi thêm từ vựng." });
  }
});

// PUT /voice-vocabs/:group - sửa 1 mục (định danh bằng key/oldValue).
router.put("/:group", authenticateAdmin, checkPermission("voice.manage"), async (req, res) => {
  const { group } = req.params;
  if (!ALL_GROUPS.includes(group)) {
    return res.status(400).json({ success: false, message: "Nhóm từ vựng không hợp lệ." });
  }

  try {
    const doc = await getOrCreateVocab();

    if (SIMPLE_GROUPS.includes(group)) {
      const oldValue = String(req.body?.oldValue || "").trim();
      const newValue = String(req.body?.newValue || "").trim();
      if (!oldValue || !newValue) {
        return res.status(400).json({ success: false, message: "Thiếu giá trị cũ hoặc mới." });
      }
      const idx = doc[group].findIndex(v => norm(v) === norm(oldValue));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Không tìm thấy giá trị cần sửa." });
      }
      if (doc[group].some((v, i) => i !== idx && norm(v) === norm(newValue))) {
        return res.status(400).json({ success: false, message: "Giá trị mới đã tồn tại." });
      }
      doc[group][idx] = newValue;
      doc.markModified(group);
      await persistAndRefresh(doc);
      logVocab(req, "update_voice_vocab", group, `Sửa "${oldValue}" -> "${newValue}"`);
      return res.json({ success: true, message: "Cập nhật thành công.", data: doc[group] });
    }

    if (group === "brandAliases") {
      const name = String(req.body?.name || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      const idx = doc.brandAliases.findIndex(b => norm(b.name) === norm(name));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Không tìm thấy thương hiệu." });
      }
      doc.brandAliases[idx].aliases = aliases;
      doc.markModified("brandAliases");
      await persistAndRefresh(doc);
      logVocab(req, "update_voice_vocab", group, `Sửa alias "${name}": ${aliases.join("/")}`);
      return res.json({ success: true, message: "Cập nhật thành công.", data: doc.brandAliases });
    }

    if (group === "typeAliases") {
      const type = String(req.body?.type || "").trim();
      const keyword = String(req.body?.keyword || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      const idx = doc.typeAliases.findIndex(t => norm(t.type) === norm(type));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Không tìm thấy loại sản phẩm." });
      }
      doc.typeAliases[idx].keyword = keyword || type;
      doc.typeAliases[idx].aliases = aliases;
      doc.markModified("typeAliases");
      await persistAndRefresh(doc);
      logVocab(req, "update_voice_vocab", group, `Sửa alias "${type}": ${aliases.join("/")}`);
      return res.json({ success: true, message: "Cập nhật thành công.", data: doc.typeAliases });
    }

    if (group === "intentAliases") {
      const intent = String(req.body?.intent || "").trim();
      const label = String(req.body?.label || "").trim();
      const aliases = Array.isArray(req.body?.aliases)
        ? req.body.aliases.map(a => String(a).trim()).filter(Boolean)
        : String(req.body?.aliases || "").split(",").map(a => a.trim()).filter(Boolean);
      const idx = doc.intentAliases.findIndex(i => norm(i.intent) === norm(intent));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Không tìm thấy intent." });
      }
      doc.intentAliases[idx].label = label;
      doc.intentAliases[idx].aliases = aliases;
      doc.markModified("intentAliases");
      await persistAndRefresh(doc);
      logVocab(req, "update_voice_vocab", group, `Sửa alias "${intent}": ${aliases.join("/")}`);
      return res.json({ success: true, message: "Cập nhật thành công.", data: doc.intentAliases });
    }

    if (group === "codeMap") {
      const code = String(req.body?.code || "").trim();
      const keyword = String(req.body?.keyword || "").trim();
      const brand = req.body?.brand ? String(req.body.brand).trim() : null;
      const type = req.body?.type ? String(req.body.type).trim() : null;
      const patterns = Array.isArray(req.body?.patterns)
        ? req.body.patterns.map(p => String(p).trim()).filter(Boolean)
        : String(req.body?.patterns || "").split(",").map(p => p.trim()).filter(Boolean);
      const compact = String(req.body?.compact || "").trim();
      const idx = doc.codeMap.findIndex(c => norm(c.code) === norm(code));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Không tìm thấy mã model." });
      }
      doc.codeMap[idx].keyword = keyword || code;
      doc.codeMap[idx].brand = brand;
      doc.codeMap[idx].type = type;
      doc.codeMap[idx].patterns = patterns;
      doc.codeMap[idx].compact = compact;
      doc.markModified("codeMap");
      await persistAndRefresh(doc);
      logVocab(req, "update_voice_vocab", group, `Sửa mã "${code}"`);
      return res.json({ success: true, message: "Cập nhật thành công.", data: doc.codeMap });
    }
  } catch (error) {
    console.error("Lỗi khi sửa từ vựng voice:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi sửa từ vựng." });
  }
});

// DELETE /voice-vocabs/:group - xóa 1 mục (định danh bằng value/key trong body).
router.delete("/:group", authenticateAdmin, checkPermission("voice.manage"), async (req, res) => {
  const { group } = req.params;
  if (!ALL_GROUPS.includes(group)) {
    return res.status(400).json({ success: false, message: "Nhóm từ vựng không hợp lệ." });
  }

  try {
    const doc = await getOrCreateVocab();

    if (SIMPLE_GROUPS.includes(group)) {
      const value = String(req.body?.value || "").trim();
      const before = doc[group].length;
      doc[group] = doc[group].filter(v => norm(v) !== norm(value));
      if (doc[group].length === before) {
        return res.status(404).json({ success: false, message: "Không tìm thấy giá trị cần xóa." });
      }
      await persistAndRefresh(doc);
      logVocab(req, "delete_voice_vocab", group, `Xóa "${value}"`);
      return res.json({ success: true, message: "Xóa thành công.", data: doc[group] });
    }

    const keyField = group === "brandAliases" ? "name" : group === "typeAliases" ? "type" : group === "intentAliases" ? "intent" : "code";
    const key = String(req.body?.[keyField] || req.body?.value || "").trim();
    const before = doc[group].length;
    doc[group] = doc[group].filter(item => norm(item[keyField]) !== norm(key));
    if (doc[group].length === before) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mục cần xóa." });
    }
    doc.markModified(group);
    await persistAndRefresh(doc);
    logVocab(req, "delete_voice_vocab", group, `Xóa "${key}"`);
    return res.json({ success: true, message: "Xóa thành công.", data: doc[group] });
  } catch (error) {
    console.error("Lỗi khi xóa từ vựng voice:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi xóa từ vựng." });
  }
});

module.exports = {
  VoiceVocab,
  router,
  initVoiceVocab,
  defaultsToDoc,
  docToVocabPayload
};
