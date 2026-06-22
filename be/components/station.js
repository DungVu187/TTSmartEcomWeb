const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const router = express.Router();
const { authenticateAdmin } = require('./user');
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

const toPublicStation = (station) => {
    const obj = station.toObject ? station.toObject({ virtuals: false }) : { ...station };
    delete obj.inviteCode;
    return obj;
};

router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const stations = await Station.find({});
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy danh sách trạm", details: error.message });
  }
});

// Cấu hình thư mục và tên file
const stationStorage = multer.diskStorage({
  destination: "./upload/stations",
  filename: (req, file, cb) => {
    cb(null, `station_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadStationImage = multer({ storage: stationStorage });

router.post("/:id/upload-image", authenticateAdmin, uploadStationImage.single("station"), async (req, res) => {
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
    res.status(500).json({ message: "Không thể upload ảnh", error: error.message });
  }
});

router.delete("/:id/remove-image", authenticateAdmin, async (req, res) => {
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
    res.status(500).json({ message: "Không thể xoá ảnh", error: error.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { name, code } = req.query;
    const filter = {};

    if (name) {
      filter.stationName = { $regex: name, $options: "i" };
    }

    if (code) {
      filter.stationCode = { $regex: code, $options: "i" };
    }

    const stations = await Station.find(filter);
    res.json({ stations: stations.map(toPublicStation) });
  } catch (error) {
    res.status(500).json({ error: "Không thể tìm kiếm trạm", details: error.message });
  }
});

// Tạo một station mới
router.post("/", authenticateAdmin, async (req, res) => {
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
        res.status(201).json(savedStation);
    } catch (error) {
        res.status(500).json({ error: "Không thể tạo station", details: error.message });
    }
});

// Cập nhật mảng productId
router.put("/:id/products", authenticateAdmin, async (req, res) => {
    try {
        const { productId } = req.body;
        const stationId = req.params.id;

        // Kiểm tra productId
        if (!Array.isArray(productId)) {
            return res.status(400).json({ error: "productId phải là một mảng" });
        }

        const station = await Station.findByIdAndUpdate(
            stationId,
            { $set: { productId } },
            { new: true }
        );

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể cập nhật products", details: error.message });
    }
});

// Cập nhật thông tin station
router.put("/:id", authenticateAdmin, async (req, res) => {
    try {
        const { stationName, stationCode, location, allowPublicSignup } = req.body;
        const stationId = req.params.id;
        const update = { stationName, stationCode, location };
        if (allowPublicSignup !== undefined) {
            update.allowPublicSignup = allowPublicSignup;
        }

        const station = await Station.findByIdAndUpdate(
            stationId,
            update,
            { new: true }
        );

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể cập nhật station", details: error.message });
    }
});

// Xóa một station
router.delete("/:id", authenticateAdmin, async (req, res) => {
    try {
        const stationId = req.params.id;
        const station = await Station.findByIdAndDelete(stationId);

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }

        res.json({ message: "Xóa station thành công" });
    } catch (error) {
        res.status(500).json({ error: "Không thể xóa station", details: error.message });
    }
});

router.post("/:id/rotate-invite", authenticateAdmin, async (req, res) => {
    try {
        const station = await Station.findById(req.params.id);
        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station" });
        }
        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể đổi mã link", details: error.message });
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
        res.status(500).json({ error: "Không thể lấy thông tin station", details: error.message });
    }
});

// Lấy thông tin station theo mã
router.get("/code/:code", async (req, res, next) => {
    try {
        const code = req.params.code;
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
                    return res.status(500).json({ error: "Không thể lấy thông tin station", details: error.message });
                }
            });
        }

        if (!station) {
            return res.status(404).json({ error: "Không tìm thấy station với mã này" });
        }

        res.json(station);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy thông tin station", details: error.message });
    }
});

router.get('/by-codes', async (req, res) => {
  try {
    const codes = req.query.codes?.split(',') || [];
    if (!codes.length) return res.status(400).json({ error: 'Thiếu danh sách mã trạm' });

    const stations = await Station.find({ stationCode: { $in: codes } });
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy danh sách trạm', details: error.message });
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
    res.status(500).json({ error: "Không thể lấy danh sách trạm", details: error.message });
  }
});


module.exports = {
    Station,
    router,
    findStationByInviteCode
};