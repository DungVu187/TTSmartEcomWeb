const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const router = express.Router();
const { authenticateAdmin, checkPermission } = require('./user');
const { ActivityLog } = require("./activitylog");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const stationSchema = new mongoose.Schema({
    stationName: {
        type: String
    },
    imgUrl: {
        type: String
    },
    stationCode: {
        type: String,
        trim: true,
        required: true
    },
    allowPublicSignup: {
        type: Boolean,
        default: true
    },
    location: {
        type: String
    },
    productId: [
        { type: String }
    ]
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

stationSchema.virtual("inviteCode").get(function () {
    return this.stationCode || "";
});

const findStationByInviteCode = async (inviteCode) => {
    const trimmed = String(inviteCode).trim();
    return Station.findOne({ stationCode: trimmed });
};

const Station = mongoose.model("Station", stationSchema);

const limitRegexInput = (value) => String(value || "").trim().slice(0, 100);
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPublicStation = (station) => {
    const obj = station.toObject ? station.toObject({ virtuals: false }) : { ...station };
    delete obj.inviteCode;
    return obj;
};

router.get("/", authenticateAdmin, checkPermission("station.view"), async (req, res) => {
  try {
    const stations = await Station.find({});
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy danh sách trạm" });
  }
});

// Cấu hình thư mục và tên file
const stationStorage = multer.diskStorage({
  destination: "./upload/stations",
  filename: (req, file, cb) => {
    cb(null, `station_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadStationImage = multer({
  storage: stationStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ cho phép upload file ảnh!"));
    }
    cb(null, true);
  },
});

router.post("/:id/upload-image", authenticateAdmin, checkPermission("station.edit"), uploadStationImage.single("station"), async (req, res) => {
  try {
    const stationId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const imgUrl = `${process.env.ADDRESS}/station/${req.file.filename}`;

    const station = await Station.findByIdAndUpdate(
      stationId,
      { imgUrl },
      { new: true }
    );

    if (!station) {
      return res.status(404).json({ message: "Không tìm thấy station" });
    }

    res.json({ message: "Upload ảnh thành công", imgUrl, station });
  } catch (error) {
    res.status(500).json({ message: "Không thể upload ảnh" });
  }
});

router.delete("/:id/remove-image", authenticateAdmin, checkPermission("station.edit"), async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);

    if (!station || !station.imgUrl) {
      return res.status(404).json({ message: "Không tìm thấy ảnh hoặc station" });
    }

    const filename = station.imgUrl.split("/station/")[1];
    const filepath = path.join(__dirname, "../upload/stations", filename);

    try {
      await fs.unlink(filepath);
    } catch (err) {
      console.warn("Không thể xoá file trên ổ đĩa:", err.message);
    }

    station.imgUrl = "";
    await station.save();

    res.json({ message: "Xoá ảnh thành công", station });
  } catch (error) {
    res.status(500).json({ message: "Không thể xoá ảnh" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { name, code } = req.query;
    const filter = {};

    if (!name && !code) {
      return res.status(400).json({ error: "Thiếu tên hoặc mã trạm để tìm kiếm" });
    }

    if (name) {
      const safeName = escapeRegex(limitRegexInput(name));
      filter.stationName = { $regex: `^${safeName}$`, $options: "i" };
    }

    if (code) {
      const safeCode = escapeRegex(limitRegexInput(code));
      filter.stationCode = { $regex: `^${safeCode}$`, $options: "i" };
    }

    const stations = await Station.find(filter);
    res.json({ stations: stations.map(toPublicStation) });
  } catch (error) {
    res.status(500).json({ error: "Không thể tìm kiếm trạm" });
  }
});

// Tạo một station mới
router.post("/", authenticateAdmin, checkPermission("station.create"), async (req, res) => {
    try {
        const { stationName, stationCode, location, allowPublicSignup } = req.body;
        
        // Kiểm tra các trường bắt buộc
        if (!stationName || !stationCode) {
            return res.status(400).json({ error: "Tên và mã station là bắt buộc" });
        }

        const newStation = new Station({
            stationName,
            stationCode,
            allowPublicSignup: allowPublicSignup !== undefined ? allowPublicSignup : true,
            location,
            productId: []
        });

        const savedStation = await newStation.save();

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: "create_station",
                productName: savedStation.stationName,
                details: [{ field: "Tạo trạm", oldValue: "", newValue: `Mã trạm: ${savedStation.stationCode}, Địa điểm: ${savedStation.location || ""}` }]
            }).save();
        } catch (logErr) { console.error("ActivityLog error in create_station:", logErr.message); }

        res.status(201).json(savedStation);
    } catch (error) {
        res.status(500).json({ error: "Không thể tạo station" });
    }
});

// Cập nhật mảng productId
router.put("/:id/products", authenticateAdmin, checkPermission("station.edit"), async (req, res) => {
    try {
        const { productId } = req.body;
        const stationId = req.params.id;

        // Kiểm tra productId
        if (!Array.isArray(productId)) {
            return res.status(400).json({ error: "productId phải là một mảng" });
        }

        const oldStation = await Station.findById(stationId);
        if (!oldStation) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }
        const oldProducts = [...(oldStation.productId || [])];

        const station = await Station.findByIdAndUpdate(
            stationId,
            { $set: { productId } },
            { new: true }
        );

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: "update_station_products",
                productName: station.stationName,
                details: [{ field: "productId", oldValue: oldProducts.join(", "), newValue: productId.join(", ") }]
            }).save();
        } catch (logErr) { console.error("ActivityLog error in update_station_products:", logErr.message); }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể cập nhật products" });
    }
});

// Cập nhật thông tin station
router.put("/:id", authenticateAdmin, checkPermission("station.edit"), async (req, res) => {
    try {
        const { stationName, stationCode, location, allowPublicSignup } = req.body;
        const stationId = req.params.id;

        const oldStation = await Station.findById(stationId);
        if (!oldStation) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }
        const oldData = {
            stationName: oldStation.stationName,
            stationCode: oldStation.stationCode,
            location: oldStation.location,
            allowPublicSignup: oldStation.allowPublicSignup
        };

        const update = { stationName, stationCode, location };
        if (allowPublicSignup !== undefined) {
            update.allowPublicSignup = allowPublicSignup;
        }

        const station = await Station.findByIdAndUpdate(
            stationId,
            update,
            { new: true }
        );

        // Ghi log hoạt động
        try {
            const details = [];
            if (oldData.stationName !== station.stationName) details.push({ field: "stationName", oldValue: oldData.stationName || "", newValue: station.stationName || "" });
            if (oldData.stationCode !== station.stationCode) details.push({ field: "stationCode", oldValue: oldData.stationCode || "", newValue: station.stationCode || "" });
            if (oldData.location !== station.location) details.push({ field: "location", oldValue: oldData.location || "", newValue: station.location || "" });
            if (oldData.allowPublicSignup !== station.allowPublicSignup) {
                details.push({ field: "allowPublicSignup", oldValue: oldData.allowPublicSignup ? "Cho phép" : "Không", newValue: station.allowPublicSignup ? "Cho phép" : "Không" });
            }

            if (details.length > 0) {
                await new ActivityLog({
                    userName: req.user.name,
                    action: "update_station",
                    productName: station.stationName,
                    details
                }).save();
            }
        } catch (logErr) { console.error("ActivityLog error in update_station:", logErr.message); }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể cập nhật station" });
    }
});

// Xóa một station
router.delete("/:id", authenticateAdmin, checkPermission("station.delete"), async (req, res) => {
    try {
        const stationId = req.params.id;
        const station = await Station.findByIdAndDelete(stationId);

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: "delete_station",
                productName: station.stationName,
                details: [{ field: "Xóa trạm", oldValue: `Mã trạm: ${station.stationCode}`, newValue: "" }]
            }).save();
        } catch (logErr) { console.error("ActivityLog error in delete_station:", logErr.message); }

        res.json({ message: "Xóa station thành công" });
    } catch (error) {
        res.status(500).json({ error: "Không thể xóa station" });
    }
});


router.get("/public/:inviteCode", async (req, res) => {
    try {
        const station = await findStationByInviteCode(req.params.inviteCode);
        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station với mã link này" });
        }
        res.json(toPublicStation(station));
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy thông tin station" });
    }
});

// Lấy thông tin station theo mã
router.get("/code/:code", async (req, res, next) => {
    try {
        const code = limitRegexInput(req.params.code);
        let station = await findStationByInviteCode(code);

        if (!station) {
            return authenticateAdmin(req, res, async () => {
                try {
                    station = await Station.findOne({ stationCode: code });
                    if (!station) {
                        return res.status(404).json({ error: "Không tìm thấy station với mã này" });
                    }
                    return res.json(station);
                } catch (error) {
                    return res.status(500).json({ error: "Không thể lấy thông tin station" });
                }
            });
        }

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station với mã này" });
        }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy thông tin station" });
    }
});

router.get('/by-codes', async (req, res) => {
  try {
    const codes = (req.query.codes?.split(',') || [])
      .map((code) => limitRegexInput(code))
      .filter(Boolean)
      .slice(0, 50);
    if (!codes.length) return res.status(400).json({ error: 'Thiếu danh sách mã trạm' });

    const stations = await Station.find({ stationCode: { $in: codes } });
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy danh sách trạm' });
  }
});

router.post("/by-ids", async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Thiếu hoặc sai định dạng danh sách _id" });
    }

    const stations = await Station.find({ _id: { $in: ids } });
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy danh sách trạm" });
  }
});


module.exports = {
    Station,
    router,
    findStationByInviteCode
};
