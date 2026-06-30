const express = require("express");
const mongoose = require("mongoose");
const { authenticateAdmin } = require("./user");
const { ActivityLog } = require("./activitylog");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const chipSchema = new mongoose.Schema({
  Color: {
    type: [String],
    require: true,
  },
  Shapes: {
    type: [String],
    require: true,
  },
  Frames: {
    type: [String],
    require: true,
  },
  ButtonCount: {
    type: [String],
    require: true,
  },
});

const brandSchema = new mongoose.Schema({
  Brand: {
    type: String,
    require: true,
  },
});

const typeSchema = new mongoose.Schema({
  Type: {
    type: String,
    require: true,
  },
});

const sectionSchema = new mongoose.Schema({
  Section: [
    {
      name: {
        type: String,
        required: true,
      },
      value: {
        type: [String],
        default: [],
      },
      imgUrl: {
        type: String
      }
    },
  ],
});

const getUpdatedImgUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;

  const paths = ['/images/', '/station/', '/section-images/'];
  for (const p of paths) {
    const idx = originalUrl.indexOf(p);
    if (idx !== -1) {
      return originalUrl.substring(idx);
    }
  }
  return originalUrl;
};

sectionSchema.post('init', function(doc) {
  if (doc.Section && Array.isArray(doc.Section)) {
    doc.Section.forEach(sec => {
      if (sec.imgUrl) {
        sec.imgUrl = getUpdatedImgUrl(sec.imgUrl);
      }
    });
  }
});

sectionSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.Section && Array.isArray(ret.Section)) {
      ret.Section.forEach(sec => {
        if (sec.imgUrl) {
          sec.imgUrl = getUpdatedImgUrl(sec.imgUrl);
        }
      });
    }
    return ret;
  }
});

sectionSchema.set('toObject', {
  transform: (doc, ret) => {
    if (ret.Section && Array.isArray(ret.Section)) {
      ret.Section.forEach(sec => {
        if (sec.imgUrl) {
          sec.imgUrl = getUpdatedImgUrl(sec.imgUrl);
        }
      });
    }
    return ret;
  }
});

const Brand = mongoose.model("Brand", brandSchema);
const Type = mongoose.model("Type", typeSchema);
const Chip = mongoose.model("Chip", chipSchema);
const Section = mongoose.model("Section", sectionSchema);
const router = express.Router();

router.post("/addValue", authenticateAdmin, async (req, res) => {
  try {
    const { type, value } = req.body;
    const chip = await Chip.findOne({});
    if (chip) {
      if (!chip[type].includes(value)) {
        chip[type].push(value);
        await chip.save();
        res.status(200).json({ message: `${type} added successfully` });
      } else {
        res.status(400).json({ message: `${type} already exists` });
      }
    } else {
      const newChip = new Chip({
        Color: [],
        Shapes: [],
        Frames: [],
        ButtonCount: [],
      });
      newChip[type].push(value);
      await newChip.save();
      res.status(200).json({ message: `New chip created with ${type}` });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/removeValue", authenticateAdmin, async (req, res) => {
  const { type, value } = req.body;
  if (!type || !value) {
    return res.status(400).json({ message: "Cần có type và value để xóa." });
  }
  try {
    let update = {};
    update[type] = value;
    const result = await Chip.updateMany(
      { [type]: { $in: [value] } },
      { $pull: { [type]: value } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Xóa thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy chip phù hợp để xóa" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Có lỗi xảy ra khi xóa chip.", error: error.message });
  }
});

router.get("/getValues", async (req, res) => {
  try {
    const chip = await Chip.findOne({});
    if (chip) {
      res.status(200).json({
        Color: chip.Color,
        Shapes: chip.Shapes,
        Frames: chip.Frames,
        ButtonCount: chip.ButtonCount,
      });
    } else {
      res.status(400).json({ message: "No chip found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Routes cho Brand
router.get("/brands", async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/brands", authenticateAdmin, async (req, res) => {
  const brand = new Brand({
    Brand: req.body.Brand,
  });
  try {
    const newBrand = await brand.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "create_brand",
        productName: newBrand.Brand,
        details: [{ field: "Brand", oldValue: "", newValue: newBrand.Brand }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in create_brand:", logErr.message); }

    res.status(201).json(newBrand);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/brands/:id", authenticateAdmin, async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "delete_brand",
        productName: brand.Brand,
        details: [{ field: "Brand", oldValue: brand.Brand, newValue: "" }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in delete_brand:", logErr.message); }

    res.status(200).json({ message: "Brand deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Routes cho Type
router.get("/types", async (req, res) => {
  try {
    const types = await Type.find();
    res.status(200).json(types);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/types", authenticateAdmin, async (req, res) => {
  const type = new Type({
    Type: req.body.Type,
  });

  try {
    const newType = await type.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "create_type",
        productName: newType.Type,
        details: [{ field: "Type", oldValue: "", newValue: newType.Type }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in create_type:", logErr.message); }

    res.status(201).json(newType);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/types/:id", authenticateAdmin, async (req, res) => {
  try {
    const type = await Type.findByIdAndDelete(req.params.id);
    if (!type) return res.status(404).json({ message: "Type not found" });

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "delete_type",
        productName: type.Type,
        details: [{ field: "Type", oldValue: type.Type, newValue: "" }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in delete_type:", logErr.message); }

    res.status(200).json({ message: "Type deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// API cho section
const storage = multer.diskStorage({
  destination: "./upload/sections",
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.post("/upload-section-image", authenticateAdmin, upload.single("sectionImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const imgUrl = `${process.env.ADDRESS}/section-images/${req.file.filename}`;
  res.status(200).json({ imgUrl });
});

router.delete("/delete-section-image/:filename", authenticateAdmin, (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, "..", "upload", "sections", filename);

  fs.access(filepath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found" });
    }

    fs.unlink(filepath, (err) => {
      if (err) {
        return res.status(500).json({ message: "Error deleting file", error: err.message });
      }

      res.status(200).json({ message: "File deleted successfully" });
    });
  });
});

router.get("/section", async (req, res) => {
  try {
    const doc = await Section.findOne();
    if (!doc) return res.json([]);

    const sectionNames = doc.Section.map((sec) => sec.name);
    res.json(sectionNames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/section", authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    let doc = await Section.findOne();
    if (!doc) {
      doc = new Section({ Section: [{ name, value: [] }] });
    } else {
      const isExist = doc.Section.some((sec) => sec.name === name);
      if (isExist) {
        return res.status(400).json({ message: "Section đã tồn tại" });
      }
      doc.Section.push({ name, value: [] });
    }

    await doc.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "create_section",
        productName: name,
        details: [{ field: "Phân loại", oldValue: "", newValue: name }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in create_section:", logErr.message); }

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/section-doc", async (req, res) => {
  try {
    const doc = await Section.findOne();
    if (!doc) return res.json({});
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/section/:oldName", authenticateAdmin, async (req, res) => {
  try {
    const { oldName } = req.params;
    const { name } = req.body;

    const doc = await Section.findOne();
    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const section = doc.Section.find((sec) => sec.name === oldName);
    if (!section)
      return res.status(404).json({ message: "Không tìm thấy section" });

    section.name = name;
    await doc.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "update_section",
        productName: name,
        details: [{ field: "Phân loại", oldValue: oldName, newValue: name }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in update_section:", logErr.message); }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/section/:name", authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const doc = await Section.findOne();
    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    doc.Section = doc.Section.filter((sec) => sec.name !== name);
    await doc.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "delete_section",
        productName: name,
        details: [{ field: "Phân loại", oldValue: name, newValue: "" }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in delete_section:", logErr.message); }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API cho value

router.post("/sections/images", async (req, res) => {
  try {
    const { names } = req.body; // names: ["Color", "Size"]
    const doc = await Section.findOne();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const result = {};
    for (const name of names) {
      const section = doc.Section.find((sec) => sec.name === name);
      result[name] = section ? getUpdatedImgUrl(section.imgUrl) || null : null;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:name/value", async (req, res) => {
  try {
    const { name } = req.params;
    const doc = await Section.findOne();
    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const section = doc.Section.find((sec) => sec.name === name);
    if (!section)
      return res.status(404).json({ message: "Không tìm thấy section" });

    res.json(section.value);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:name/value", async (req, res) => {
  try {
    const { name } = req.params;
    const { value } = req.body;

    const doc = await Section.findOne();
    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const section = doc.Section.find((sec) => sec.name === name);
    if (!section)
      return res.status(404).json({ message: "Không tìm thấy section" });

    section.value.push(value);
    await doc.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user ? req.user.name : "Hệ thống / Admin",
        action: "create_section_value",
        productName: `${name}: ${value}`,
        details: [{ field: "Giá trị", oldValue: "", newValue: value }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in create_section_value:", logErr.message); }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:name/value", authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { oldValue, newValue, imgUrl } = req.body;

    const doc = await Section.findOne();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const section = doc.Section.find((sec) => sec.name === name);
    if (!section) return res.status(404).json({ message: "Không tìm thấy section" });

    const valueIndex = section.value.indexOf(oldValue);
    if (valueIndex === -1) return res.status(404).json({ message: "Không tìm thấy value" });

    const oldImg = section.imgUrl;
    section.value[valueIndex] = newValue;
    if (imgUrl) {
      section.imgUrl = imgUrl; // cập nhật imgUrl cho section
    }

    await doc.save();

    // Ghi log hoạt động
    try {
      const details = [{ field: "value", oldValue, newValue }];
      if (imgUrl && oldImg !== imgUrl) {
        details.push({ field: "imgUrl", oldValue: oldImg || "", newValue: imgUrl });
      }
      await new ActivityLog({
        userName: req.user.name,
        action: "update_section_value",
        productName: `${name}: ${newValue}`,
        details
      }).save();
    } catch (logErr) { console.error("ActivityLog error in update_section_value:", logErr.message); }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:name/value", authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { value } = req.body;

    const doc = await Section.findOne();
    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu" });

    const section = doc.Section.find((sec) => sec.name === name);
    if (!section)
      return res.status(404).json({ message: "Không tìm thấy section" });

    section.value = section.value.filter((val) => val !== value);
    await doc.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "delete_section_value",
        productName: `${name}: ${value}`,
        details: [{ field: "Giá trị", oldValue: value, newValue: "" }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in delete_section_value:", logErr.message); }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  Chip,
  router,
};
