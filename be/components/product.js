const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const rateLimit = require("express-rate-limit");
const { authenticateUser, authenticateAdmin, checkPermission, User } = require('./user');
const { Station } = require('./station');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const fs = require('fs').promises;
const { StorageHistory } = require("./storagehistory");
const { ActivityLog } = require("./activitylog");

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

function normalizeProductCodeForCompare(code) {
    return String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Sinh Regex tự động chấp nhận các ký tự ngăn cách trong mã sản phẩm
function generateFuzzyCodeRegex(rawCode) {
    if (!rawCode) return null;
    const cleanCode = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanCode) return null;
    const regexPattern = cleanCode.split('').join('[\\s\\-\\/\\.]*');
    return new RegExp(regexPattern, 'i');
}

function hasAdjustedRequiredValue(value) {
    const normalized = removeVietnameseTones(String(value ?? ''))
        .toLowerCase()
        .trim();

    return ![
        '',
        'n/a',
        'na',
        'chua ro',
        'chua co',
        'chua phan loai'
    ].includes(normalized);
}

function calculateProductAdjustedStatus(product) {
    return ['type', 'brand', 'section'].every(field =>
        hasAdjustedRequiredValue(product?.[field])
    );
}

const VOICE_BRANDS = [
    'Airtac', 'Autonics', 'Chaofan', 'Delta', 'Frecon', 'Giga', 'Goldcup',
    'Haitima', 'Hanyoung', 'Idec', 'Keli', 'Kinco', 'Mitsubishi', 'Nass',
    'Omron', 'Parker', 'STNC', 'SangA', 'Sangjin', 'Schneider', 'Selec',
    'Siemens', 'Taiwan', 'VEICHI'
];

const VOICE_TYPES = [
    'Aptomat', 'Biến tần', 'Biến áp cách ly', 'Bảo Vệ Mất, Ngược Pha',
    'Bộ lọc khí', 'Contactor', 'Cảm biến', 'Cầu Đấu', 'Dây điện', 'Loadcell',
    'Lọc bụi', 'Nguồn', 'Nút Nhấn', 'PLC', 'Phụ kiện khí nén', 'Relay Nhiệt',
    'Relay Thời Gian', 'Relay Trung Gian', 'TI', 'Van khí nén', 'Van điện từ',
    'Xy lanh khí nén', 'Đèn', 'Đồng Hồ'
];

const VOICE_BRAND_ALIASES = [
    ['Siemens', ['siemens', 'simens', 'xi men', 'si men']],
    ['Mitsubishi', ['mitsubishi', 'mit su bi shi', 'mit subishi', 'mit su']],
    ['Omron', ['omron', 'om ron', 'om rong']],
    ['VEICHI', ['veichi', 've chi', 'v e i c h i']],
    ['Autonics', ['autonics', 'au tonics', 'en to net']],
    ['Schneider', ['schneider', 'schnider', 's nai der']],
    ['Delta', ['delta', 'den ta']],
    ['Idec', ['idec', 'i dec']],
    ['Kinco', ['kinco', 'kin co']],
    ['Airtac', ['airtac', 'air tac']],
    ['Parker', ['parker', 'pa ker']],
    ['Selec', ['selec', 'se leck']],
    ['Hanyoung', ['hanyoung', 'han young']],
    ['Haitima', ['haitima', 'hai ti ma']],
    ['Frecon', ['frecon', 'fre con']],
    ['STNC', ['stnc', 's t n c']],
    ['SangA', ['sanga', 'sang a']],
    ['Sangjin', ['sangjin', 'sang jin']],
    ['Goldcup', ['goldcup', 'gold cup']],
    ['Chaofan', ['chaofan', 'chao fan']],
    ['Giga', ['giga', 'gi ga']],
    ['Keli', ['keli', 'ke li']],
    ['Nass', ['nass', 'nas']],
    ['Taiwan', ['taiwan', 'dai loan']]
];

const VOICE_TYPE_ALIASES = [
    ['Aptomat', 'Aptomat', ['at', 'at to mat', 'ap to mat', 'aptomat', 'cau dao tu dong']],
    ['Contactor', 'Contactor', ['khoi', 'khoi dong tu', 'cong tac to', 'contactor']],
    ['Biến tần', 'biến tần', ['bien tan', 'inverter', 'bo bien tan']],
    ['Cảm biến', 'cảm biến', ['cam bien', 'sensor', 'thiet bi cam bien']],
    ['Nút Nhấn', 'nút nhấn', ['nut nhan', 'nut bam']],
    ['Nguồn', 'nguồn', ['nguon', 'nguon to ong', 'nguon xung']],
    ['PLC', 'PLC', ['plc', 'bo dieu khien', 'bo lap trinh']],
    ['Relay Trung Gian', 'relay trung gian', ['ro le trung gian', 'relay trung gian']],
    ['Relay Thời Gian', 'relay thời gian', ['ro le thoi gian', 'relay thoi gian', 'timer']],
    ['Relay Nhiệt', 'relay nhiệt', ['ro le nhiet', 'relay nhiet']],
    ['TI', 'TI', ['ti']],
    ['Đèn', 'đèn', ['den bao', 'den chi thi', 'den']],
    ['Xy lanh khí nén', 'xy lanh', ['xi lanh khi nen', 'xy lanh khi nen', 'ty ben']]
];

function normalizeVoiceText(str) {
    return removeVietnameseTones(String(str || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function phraseRegex(phrase) {
    const escaped = normalizeVoiceText(phrase)
        .split(' ')
        .filter(Boolean)
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+');
    return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, 'i');
}

function detectVoiceCode(text) {
    const normalized = normalizeVoiceText(text);
    const compact = normalized.replace(/\s+/g, '');

    if (/\bfx\s*3\s*u\b/.test(normalized) || compact.includes('fx3u')) {
        return { code: 'FX3U', keyword: 'FX3U', brand: 'Mitsubishi', type: 'PLC' };
    }
    if (/\bfx\s*5\s*u\b/.test(normalized) || compact.includes('fx5u')) {
        return { code: 'FX5U', keyword: 'FX5U', brand: 'Mitsubishi', type: 'PLC' };
    }
    if (/\bs\s*7\s*[- ]?\s*1200\b/.test(normalized) || /\bs7\s*muoi\s*hai\s*tram\b/.test(normalized) || compact.includes('s71200')) {
        return { code: 'S7-1200', keyword: 'S7-1200', brand: 'Siemens', type: 'PLC' };
    }
    if (/\bs\s*7\s*[- ]?\s*1500\b/.test(normalized) || /\bs7\s*muoi\s*lam\s*tram\b/.test(normalized) || compact.includes('s71500')) {
        return { code: 'S7-1500', keyword: 'S7-1500', brand: 'Siemens', type: 'PLC' };
    }
    if (/\bg\s*p\s*c\s*[- ]?\s*1202\b/.test(normalized) || /\bgpc\s*muoi\s*hai\s*khong\s*hai\b/.test(normalized) || compact.includes('gpc1202')) {
        return { code: 'GPC1202', keyword: 'khớp nối GPC1202', brand: null, type: null };
    }

    const rawMatch = String(text || '').match(/\b([A-Za-z]{1,5})[-\s]?(\d{2,5})([A-Za-z]{0,3})\b/);
    if (rawMatch) {
        const code = `${rawMatch[1]}${rawMatch[2]}${rawMatch[3] || ''}`.toUpperCase();
        if (!VOICE_BRANDS.some(brand => brand.toUpperCase() === code)) {
            return { code, keyword: code, brand: null, type: null };
        }
    }

    return null;
}

function findVoiceBrand(text) {
    const normalized = normalizeVoiceText(text);

    for (const brand of VOICE_BRANDS) {
        if (phraseRegex(brand).test(normalized)) {
            return brand;
        }
    }

    for (const [brand, aliases] of VOICE_BRAND_ALIASES) {
        if (aliases.some(alias => phraseRegex(alias).test(normalized))) {
            return brand;
        }
    }

    return null;
}

function findVoiceType(text) {
    const normalized = normalizeVoiceText(text);

    if (/\bh\s*m\s*i\b/.test(normalized) || phraseRegex('man hinh hmi').test(normalized) || phraseRegex('man hinh cam ung').test(normalized)) {
        return { type: null, keyword: /\bh\s*m\s*i\b/.test(normalized) ? 'HMI' : 'màn hình' };
    }

    for (const [type, keyword, aliases] of VOICE_TYPE_ALIASES) {
        if (aliases.some(alias => phraseRegex(alias).test(normalized))) {
            return { type, keyword };
        }
    }

    return { type: null, keyword: null };
}

function cleanVoiceKeyword(keyword, brand) {
    let cleaned = String(keyword || '').trim();
    if (!cleaned || !brand) return cleaned;

    const aliases = [brand, ...(VOICE_BRAND_ALIASES.find(([name]) => name === brand)?.[1] || [])];
    for (const alias of aliases) {
        cleaned = cleaned.replace(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
}

function normalizeVoiceQueryResult(raw = {}) {
    const filters = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
    const transcript = String(raw.transcript || '').trim();
    const probeText = [transcript, raw.keyword, filters.code].filter(Boolean).join(' ');

    const codeInfo = detectVoiceCode(probeText);
    const brandProbeText = transcript || String(raw.keyword || '');
    
    // Ưu tiên Brand từ Gemini AI, nếu không có mới dùng Regex
    const rawBrand = VOICE_BRANDS.includes(filters.brand) ? filters.brand : null;
    const brand = rawBrand || codeInfo?.brand || findVoiceBrand(brandProbeText);

    // Ưu tiên Type từ Gemini AI, nếu không có mới dùng Regex
    const typeInfo = findVoiceType(probeText);
    const rawType = VOICE_TYPES.includes(filters.type) ? filters.type : null;
    const type = rawType || codeInfo?.type || typeInfo.type;

    const code = codeInfo?.code || (typeof filters.code === 'string' && filters.code.trim() ? filters.code.trim().toUpperCase() : null);

    // Ưu tiên Keyword từ Gemini AI trước, tránh bị bộ lọc Regex đè lên
    let keyword = '';
    if (typeof raw.keyword === 'string' && raw.keyword.trim() !== '') {
        keyword = raw.keyword.trim();
    } else if (codeInfo?.keyword) {
        keyword = codeInfo.keyword;
    } else if (typeInfo.keyword !== null) {
        keyword = typeInfo.keyword;
    }

    return {
        transcript,
        keyword: cleanVoiceKeyword(keyword, brand),
        intent: 'search_product',
        filters: {
            brand,
            type,
            code
        }
    };
}


const productSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    nameUnsigned: {
        type: String,
        trim: true,
        index: true
    },
    display: {
        type: Boolean,
        default: 1
    },
    code: {
        type: String,
        trim: true,
        sparse: true,  // Cho phép nhiều sản phẩm không có mã (null/"") cùng tồn tại
        unique: true   // Nhưng nếu có mã thì không được trùng nhau
    },
    vat: {
        type: String,
        trim: true,
        default: ""
    },
    adjusted: {
        type: Boolean,
        default: true
    },
    brand: {
        type: String,
        required: true,
        trim: true,
    },
    section: {
        type: String,
        required: true,
    },
    value: {
        type: String,
        required: true,
    },
    variant: {
        type: [
            {
                price: { type: String, default: "" },
                importPrice: { type: String, default: ""},
                earn: { type: Number, default: 0},
                imgUrl: { type: String, default: "" },
                color: { type: String, default: "" },
                shape: { type: String, default: "" },
                buttonCount: { type: String, default: "" },
                frame: { type: String, default: "" },
                quantityForSale: { type: Number, default: 0 },
                quantityInStorage: { type: Number, default: 0 },
                note: { type: String, default: "" }
            }
        ],
        default: [{
            price: "",
            imgUrl: "",
            color: "",
            shape: "",
            buttonCount: "",
            frame: "",
            quantityForSale: 0,
            quantityInStorage: 0,
            note: ""
        }]
    },
    infoDoc: {
        type: {
            manual: { type: String, default: "" },
            dataSheet: { type: String, default: "" },
            catalog: { type: String, default: "" },
            others: { type: String, default: "" }
        },
    },
    purchaseCount: {
        type: Number,
        required: true,
        default: 0,
    },
    reviews: [
        {
            email: { type: String, required: true },
            comment: { type: String, default: "" },
            rating: { type: Number, min: 1, max: 5, required: true },
            createdAt: { type: Date, default: Date.now },
        }
    ],
    totalRating: {
        type: Number,
        default: 0,
    },
    reviewCount: {
        type: Number,
        default: 0,
    },
    averageReviews: {
        type: Number,
        default: 0,
    },
    warranty: {
        type: String,
        required: true,
    },
    solution: {
        type: String,
        default: "",
    },
    description: {
        type: String,
        default: "",
    },
    features: {
        type: String,
        default: "",
    },
    operatingMethod: {
        type: String,
        default: "",
    },
    advantages: {
        type: String,
        default: "",
    },
    specifications: {
        type: String,
        default: "",
    }
}, { timestamps: true });

productSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.nameUnsigned = removeVietnameseTones(this.name);
    }
    next();
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

productSchema.post('init', function(doc) {
  if (doc.variant && Array.isArray(doc.variant)) {
    doc.variant.forEach(v => {
      if (v.imgUrl) {
        v.imgUrl = getUpdatedImgUrl(v.imgUrl);
      }
    });
  }
});

productSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.variant && Array.isArray(ret.variant)) {
      ret.variant.forEach(v => {
        if (v.imgUrl) {
          v.imgUrl = getUpdatedImgUrl(v.imgUrl);
        }
      });
    }
    return ret;
  }
});

productSchema.set('toObject', {
  transform: (doc, ret) => {
    if (ret.variant && Array.isArray(ret.variant)) {
      ret.variant.forEach(v => {
        if (v.imgUrl) {
          v.imgUrl = getUpdatedImgUrl(v.imgUrl);
        }
      });
    }
    return ret;
  }
});

const Product = mongoose.model('Product', productSchema);

async function findProductByEquivalentCode(code, excludeId = null) {
    const normalizedCode = normalizeProductCodeForCompare(code);
    if (!normalizedCode) {
        return null;
    }

    const products = await Product.find({
        code: { $exists: true, $nin: [null, ""] }
    }).select('_id name code').lean();

    return products.find(product => {
        if (excludeId && product._id.toString() === excludeId.toString()) {
            return false;
        }
        return normalizeProductCodeForCompare(product.code) === normalizedCode;
    }) || null;
}

// Tạo router cho các API sản phẩm
const router = express.Router();

// Cấu hình multer để lưu ảnh vào thư mục 'upload'
const imageStorage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadImage = multer({ storage: imageStorage });

router.post("/upload/image", [authenticateAdmin, checkPermission('update_product')], uploadImage.single('product'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: 0, message: "Không có file được upload" });
    }
    const imgUrl = `${process.env.ADDRESS}/images/${req.file.filename}`;
    res.json({
        success: 1,
        imgUrl: imgUrl
    });
});

// API xóa ảnh
router.delete('/:id/:variantIndex/image', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }
        const imgUrl = product.variant[index].imgUrl;
        if (imgUrl) {
            const filename = imgUrl.split('/images/')[1];
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
            product.variant[index].imgUrl = "";
            await product.save();
            return res.status(200).json({ message: 'Image deleted successfully', product });
        }
        return res.status(400).json({ message: 'No image to delete' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API tạo sản phẩm mới
router.post('/create', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant, section, value, infoDoc, adjusted } = req.body;
        
        // Kiểm tra trùng lặp mã sản phẩm trước khi tạo mới để tránh trùng lặp
        if (code && code.trim()) {
            const existing = await findProductByEquivalentCode(code);
            if (existing) {
                console.log(`[create-product] Từ chối tạo: Mã sản phẩm "${code.trim()}" đã tồn tại (SP: ${existing.name}).`);
                return res.status(409).json({
                    message: `Mã sản phẩm "${code.trim()}" đã tồn tại (${existing.name}). Vui lòng dùng mã khác.`
                });
            }
        }

        const newProduct = new Product({
            type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant, section, value, infoDoc, adjusted
        });
        await newProduct.save();

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: 'create_product',
                productId: newProduct._id,
                productName: newProduct.name,
                details: [{ field: 'Tạo mới', oldValue: '', newValue: newProduct.name }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        res.status(201).json({ message: 'Product created successfully', product: newProduct });
    } catch (error) {
        // Bắt lỗi trùng unique index từ MongoDB (E11000)
        if (error.code === 11000 && error.keyPattern?.code) {
            const dupCode = error.keyValue?.code || '';
            return res.status(409).json({
                message: `Mã sản phẩm "${dupCode}" đã tồn tại trong hệ thống. Vui lòng dùng mã khác.`
            });
        }
        res.status(500).json({ message: error.message });
    }
});

// API lấy tất cả sản phẩm
router.get("/", async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 100,
            search = "",
            code = "",
            type, 
            brand, 
            section,
            value,
            sortBy = "purchaseCount",
            sortOrder = "desc",
            display,
            stationId,
            adjusted
        } = req.query;

        // Chuyển đổi và đảm bảo page, limit hợp lệ
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 100);
        const skip = (pageNum - 1) * limitNum;
        const adjustedFilter =
            adjusted !== undefined && adjusted !== "" ? adjusted === "true" : null;

        // Tạo bộ lọc
        const filter = {};
        const andQueries = [];

        if (search && search.trim() !== "") {
            // Tách từ khóa tìm kiếm thành các từ đơn để so khớp AND tự do thứ tự
            const tokens = search.split(/\s+/).filter(t => t.length > 0);
            if (tokens.length > 0) {
                tokens.forEach(token => {
                    const tokenUnsigned = removeVietnameseTones(token);
                    // Hỗ trợ tìm kiếm song song "relay"/"rơ le", "xi"/"xy" (xi lanh/xy lanh), "ki"/"ky" cho từng từ khóa đơn lẻ
                    const fuzzyToken = token
                        .replace(/relay|rơ\s+le/gi, '(relay|rơ le)')
                        .replace(/^(xi|xy)$/gi, '(xi|xy)')
                        .replace(/^(ki|ky)$/gi, '(ki|ky)');
                    const fuzzyTokenUnsigned = tokenUnsigned
                        .replace(/relay|ro\s+le/gi, '(relay|ro le)')
                        .replace(/^(xi|xy)$/gi, '(xi|xy)')
                        .replace(/^(ki|ky)$/gi, '(ki|ky)');
                    
                    const fuzzyCodeRegex = generateFuzzyCodeRegex(token);
                    andQueries.push({
                        $or: [
                            { name: { $regex: fuzzyToken, $options: "i" } },
                            { nameUnsigned: { $regex: fuzzyTokenUnsigned, $options: "i" } },
                            { code: fuzzyCodeRegex || { $regex: token, $options: "i" } },
                            { brand: { $regex: token, $options: "i" } }
                        ]
                    });
                });
            }
        }

        if (code && code !== "") {
            const fuzzyCodeRegex = generateFuzzyCodeRegex(code);
            const codeQuery = [
                { code: fuzzyCodeRegex || { $regex: code, $options: "i" } },
                { name: { $regex: code, $options: "i" } }
            ];
            andQueries.push({ $or: codeQuery });
        }

        if (andQueries.length > 0) {
            filter.$and = andQueries;
        }
        if (type && type !== "") filter.type = type;
        if (brand && brand !== "") filter.brand = brand;
        if (section && section !== "") filter.section = section;
        if (value && value !== "") filter.value = value;
        if (display !== undefined) filter.display = display === "true"; 

        // Kiểm tra cookie authToken để thực hiện lọc theo trạm trộn của khách hàng
        const token = req.cookies?.authToken;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user && user.role === "customer") {
                    const userStations = user.station || [];
                    
                    if (userStations.length === 0) {
                        // Khách hàng không có trạm trộn nào -> Không hiển thị sản phẩm nào
                        return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
                    }

                    let allowedProductIds = [];
                    
                    // Nếu khách hàng chọn lọc một trạm cụ thể từ dropdown
                    if (stationId && stationId !== "Tất cả") {
                        // Kiểm tra xem trạm này có thuộc sở hữu của khách hàng không
                        if (!userStations.includes(stationId)) {
                            return res.status(403).json({ message: "Bạn không có quyền truy cập trạm trộn này." });
                        }
                        const stationObj = await Station.findById(stationId);
                        if (stationObj && Array.isArray(stationObj.productId)) {
                            allowedProductIds = stationObj.productId;
                        }
                    } else {
                        // Nếu chọn "Tất cả" hoặc không truyền stationId -> Lấy sản phẩm của tất cả trạm của user
                        const stations = await Station.find({ _id: { $in: userStations } });
                        stations.forEach(s => {
                            if (Array.isArray(s.productId)) {
                                allowedProductIds.push(...s.productId);
                            }
                        });
                    }

                    // Loại bỏ trùng lặp và lọc
                    const uniqueProductIds = [...new Set(allowedProductIds)];
                    filter._id = { $in: uniqueProductIds };
                }
            } catch (err) {
                console.error("Lỗi xác thực token/trạm của khách hàng:", err.message);
                return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
            }
        } else {
            // Khách vãng lai chưa đăng nhập -> Trả về danh sách trống
            return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
        }

        // Xử lý sắp xếp
        const validSortFields = ["purchaseCount", "averageReviews", "createdAt"];
        const sortField = validSortFields.includes(sortBy) ? sortBy : "purchaseCount";
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        const sortCriteria = { 
            [sortField]: sortDirection, 
            createdAt: -1 
        };

        // Truy vấn MongoDB. adjusted được tính động để áp dụng cả sản phẩm cũ.
        let products;
        let total;

        const runQuery = async (queryFilter) => {
            let localProducts;
            let localTotal;
            if (adjustedFilter === null) {
                if (search && search.trim() !== "") {
                    const allMatched = await Product.find(queryFilter).sort(sortCriteria);
                    const tokens = removeVietnameseTones(search)
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(t => t.length > 0);
                    
                    if (tokens.length > 0) {
                        allMatched.sort((a, b) => {
                            const score = (product) => {
                                const nameLower = removeVietnameseTones(product.name || '').toLowerCase();
                                const codeLower = removeVietnameseTones(product.code || '').toLowerCase();
                                let matchCount = 0;
                                tokens.forEach(t => {
                                    if (nameLower.includes(t) || codeLower.includes(t)) {
                                        matchCount++;
                                    }
                                });
                                const fullSearch = removeVietnameseTones(search).toLowerCase();
                                if (nameLower.includes(fullSearch) || codeLower.includes(fullSearch)) {
                                    matchCount += 10;
                                }
                                return matchCount;
                            };
                            return score(b) - score(a);
                        });
                    }
                    localTotal = allMatched.length;
                    localProducts = allMatched.slice(skip, skip + limitNum);
                } else {
                    [localProducts, localTotal] = await Promise.all([
                        Product.find(queryFilter)
                            .sort(sortCriteria)
                            .skip(skip)
                            .limit(limitNum),
                        Product.countDocuments(queryFilter)
                    ]);
                }
            } else {
                const matchedProducts = await Product.find(queryFilter).sort(sortCriteria);
                let adjustedProducts = matchedProducts.filter(product =>
                    calculateProductAdjustedStatus(product) === adjustedFilter
                );
                
                if (search && search.trim() !== "") {
                    const tokens = removeVietnameseTones(search)
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(t => t.length > 0);
                    
                    if (tokens.length > 0) {
                        adjustedProducts.sort((a, b) => {
                            const score = (product) => {
                                const nameLower = removeVietnameseTones(product.name || '').toLowerCase();
                                const codeLower = removeVietnameseTones(product.code || '').toLowerCase();
                                let matchCount = 0;
                                tokens.forEach(t => {
                                    if (nameLower.includes(t) || codeLower.includes(t)) {
                                        matchCount++;
                                    }
                                });
                                const fullSearch = removeVietnameseTones(search).toLowerCase();
                                if (nameLower.includes(fullSearch) || codeLower.includes(fullSearch)) {
                                    matchCount += 10;
                                }
                                return matchCount;
                            };
                            return score(b) - score(a);
                        });
                    }
                }
                localTotal = adjustedProducts.length;
                localProducts = adjustedProducts.slice(skip, skip + limitNum);
            }
            return [localProducts, localTotal];
        };

        // Chạy truy vấn chính thức
        [products, total] = await runQuery(filter);

        // Hỗ trợ dự phòng nới lỏng bộ lọc: Nếu kết quả bằng 0 và có dùng lọc hãng/loại, ta tự động bỏ qua loại/hãng để tìm rộng
        if (total === 0 && ((type && type !== "") || (brand && brand !== ""))) {
            const relaxedFilter = { ...filter };
            delete relaxedFilter.type;
            delete relaxedFilter.brand;
            [products, total] = await runQuery(relaxedFilter);
            console.log(`[SEARCH FALLBACK] Nới lỏng bộ lọc bỏ type/brand. Tìm thấy ${total} kết quả.`);
        }

        const processedProducts = products.map(product => {
            const productObj = product.toJSON();
            return {
                ...productObj,
                adjusted: calculateProductAdjustedStatus(productObj),
                purchaseCount: productObj.purchaseCount || 0,
                averageReviews: productObj.averageReviews || 0
            };
        });

        res.json({ 
            total, 
            page: pageNum, 
            limit: limitNum, 
            products: processedProducts 
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// API lấy 10 sản phẩm có purchaseCount cao nhất
router.get('/top-purchased', async (req, res) => {
    try {
        const products = await Product.find()
            .sort({ purchaseCount: -1 }) // Sắp xếp giảm dần theo purchaseCount
            .limit(10);
        
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error });
    }
});

// API lấy thông tin sản phẩm theo ID (Public)
router.get('/:_id', async (req, res) => {
    try {
        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API lấy thông tin nhiều sản phẩm qua mảng id
router.post('/fetch-by-ids', async (req, res) => {
    console.log('📨 API /fetch-by-ids body:', req.body);
    try {
        const { ids } = req.body;

        // Kiểm tra xem ids có phải là mảng không
        if (!Array.isArray(ids)) {
            return res.status(400).json({
                success: 0,
                message: 'Vui lòng cung cấp một mảng ids hợp lệ'
            });
        }

        // Nếu mảng rỗng, trả về kết quả rỗng luôn mà không cần query DB
        if (ids.length === 0) {
            return res.json({
                success: 1,
                total: 0,
                products: []
            });
        }

        // Chuyển đổi tất cả ids thành ObjectId và loại bỏ các giá trị không hợp lệ
        const validIds = ids
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validIds.length === 0) {
            return res.status(400).json({
                success: 0,
                message: 'Không có id nào hợp lệ trong mảng'
            });
        }

        // Tìm các sản phẩm theo mảng ids
        const products = await Product.find({ _id: { $in: validIds } });

        // Xử lý kết quả để đảm bảo dữ liệu đầy đủ
        const processedProducts = products.map(product => {
            const productObj = product.toJSON();
            return {
                ...productObj,
                purchaseCount: productObj.purchaseCount || 0,
                averageReviews: productObj.averageReviews || 0,
                reviewCount: productObj.reviewCount || 0,
                totalRating: productObj.totalRating || 0
            };
        });

        res.json({
            success: 1,
            total: processedProducts.length,
            products: processedProducts
        });
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        res.status(500).json({
            success: 0,
            message: 'Lỗi server khi lấy thông tin sản phẩm',
            error: error.message
        });
    }
});

router.put('/update-display-field', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const result = await Product.updateMany(
            { display: { $exists: false } },
            { $set: { display: true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(200).json({ 
                message: 'Không có sản phẩm nào cần cập nhật hoặc tất cả sản phẩm đã có trường display' 
            });
        }

        res.status(200).json({ 
            message: 'Cập nhật trường display thành công', 
            updatedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error('Error updating display field:', error);
        res.status(500).json({ 
            message: 'Lỗi server khi cập nhật trường display', 
            error: error.message 
        });
    }
});

// API sửa thông tin sản phẩm
router.put('/:_id', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        console.log('[PUT /products/:_id] id =', req.params._id);
        console.log('[PUT /products/:_id] name in body =', req.body.name);

        // Lấy dữ liệu cũ trước khi cập nhật để so sánh
        const oldProduct = await Product.findById(req.params._id);
        if (!oldProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const oldData = oldProduct.toJSON();

        if (req.body.name !== undefined) {
            req.body.nameUnsigned = removeVietnameseTones(req.body.name);
        }

        if (req.body.code && req.body.code.trim()) {
            const existing = await findProductByEquivalentCode(req.body.code, req.params._id);
            if (existing) {
                console.log(`[update-product] Duplicate equivalent code "${req.body.code.trim()}" with product "${existing.name}".`);
                return res.status(409).json({
                    message: `MÃ£ sáº£n pháº©m "${req.body.code.trim()}" Ä‘Ã£ tá»“n táº¡i (${existing.name}). Vui lÃ²ng dÃ¹ng mÃ£ khÃ¡c.`
                });
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params._id,
            { $set: req.body },
            { new: true, runValidators: false }
        );
        console.log('[PUT /products/:_id] name saved =', updatedProduct?.name);
        console.log('[PUT /products/:_id] result =', updatedProduct ? 'found & updated' : 'NOT FOUND');
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // So sánh và ghi log các trường thay đổi
        try {
            const fieldsToTrack = ['name', 'code', 'brand', 'type', 'section', 'value', 'warranty', 'vat', 'solution', 'description', 'features', 'operatingMethod', 'advantages', 'specifications'];
            const details = [];
            const newData = updatedProduct.toJSON();

            for (const field of fieldsToTrack) {
                if (req.body[field] !== undefined) {
                    const oldVal = (oldData[field] || '').toString();
                    const newVal = (newData[field] || '').toString();
                    if (oldVal !== newVal) {
                        details.push({ field, oldValue: oldVal, newValue: newVal });
                    }
                }
            }

            // So sánh variant nếu có trong body
            if (req.body.variant && Array.isArray(req.body.variant)) {
                const oldVariants = oldData.variant || [];
                const newVariants = newData.variant || [];
                const variantFields = ['price', 'importPrice', 'earn', 'note', 'color', 'shape', 'buttonCount', 'frame'];
                const maxLen = Math.max(oldVariants.length, newVariants.length);
                for (let i = 0; i < maxLen; i++) {
                    const ov = oldVariants[i] || {};
                    const nv = newVariants[i] || {};
                    for (const vf of variantFields) {
                        const oldVal = (ov[vf] !== undefined ? ov[vf] : '').toString();
                        const newVal = (nv[vf] !== undefined ? nv[vf] : '').toString();
                        if (oldVal !== newVal) {
                            details.push({ field: `variant[${i}].${vf}`, oldValue: oldVal, newValue: newVal });
                        }
                    }
                }
            }

            if (details.length > 0) {
                await new ActivityLog({
                    userName: req.user.name,
                    action: 'update_product',
                    productId: updatedProduct._id,
                    productName: updatedProduct.name,
                    details
                }).save();
            }
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        res.json(updatedProduct);
    } catch (error) {
        console.error('[PUT /products/:_id] error =', error.message);
        res.status(500).json({ message: error.message });
    }
});

// API tăng hoặc giảm số lượng sản phẩm đã mua
router.put("/purchase/:_id", async (req, res) => {
    try {
        const { action, amount } = req.body; // action: "increase" hoặc "decrease", amount: số lượng thay đổi
        const numericAmount = parseInt(amount, 10);

        if (!["increase", "decrease"].includes(action) || isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
        }

        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        // Cập nhật purchaseCount theo amount
        if (action === "increase") {
            product.purchaseCount += numericAmount;
        } else if (action === "decrease") {
            product.purchaseCount = Math.max(0, product.purchaseCount - numericAmount); // Đảm bảo không âm
        }

        await product.save();
        res.json({ message: "Cập nhật thành công", purchaseCount: product.purchaseCount });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

// API xóa ảnh tạm quét AI để tránh rác ổ cứng (Đặt trước API xóa sản phẩm có param /:_id)
router.delete('/clean-temp-image', authenticateAdmin, async (req, res) => {
    try {
        const { imageUrl } = req.query;
        if (!imageUrl) {
            return res.status(400).json({ success: 0, message: "Thiếu thông tin imageUrl." });
        }

        // Đảm bảo chỉ được xóa file trong thư mục upload/invoices để bảo mật
        const filename = path.basename(imageUrl);
        const filePath = path.join(__dirname, '../upload/invoices', filename);

        // Kiểm tra xem file có thực sự tồn tại trước khi xóa
        try {
            await fs.stat(filePath);
            await fs.unlink(filePath);
            console.log(`[scan-invoice] Đã xóa thành công tệp ảnh tạm: ${filename}`);
            return res.json({ success: 1, message: "Đã xóa ảnh tạm thành công." });
        } catch (statErr) {
            // File không tồn tại hoặc đã bị xóa
            return res.json({ success: 1, message: "File không tồn tại hoặc đã được xóa." });
        }
    } catch (error) {
        console.error('Lỗi khi xóa ảnh tạm:', error);
        res.status(500).json({ success: 0, message: "Lỗi server khi xóa ảnh tạm.", error: error.message });
    }
});

// API xóa nhiều sản phẩm hàng loạt (bulk delete)
router.post('/bulk-delete', [authenticateAdmin, checkPermission('delete_product')], async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Danh sách ID không hợp lệ.' });
        }

        // Tìm tất cả sản phẩm sắp xóa để lấy thông tin ghi log
        const productsToDelete = await Product.find({ _id: { $in: ids } });
        
        // Thực hiện xóa hàng loạt
        const deleteResult = await Product.deleteMany({ _id: { $in: ids } });
        
        // Ghi log hoạt động cho từng sản phẩm bị xóa
        try {
            const logs = productsToDelete.map(product => ({
                userName: req.user.name,
                action: 'delete_product',
                productId: product._id,
                productName: product.name,
                details: [{ field: 'Xóa sản phẩm hàng loạt', oldValue: product.name, newValue: '' }]
            }));
            await ActivityLog.insertMany(logs);
        } catch (logErr) { console.error('Bulk ActivityLog error:', logErr.message); }

        res.json({ message: `Đã xóa thành công ${deleteResult.deletedCount} sản phẩm.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API xóa sản phẩm
router.delete('/:_id', [authenticateAdmin, checkPermission('delete_product')], async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: 'delete_product',
                productId: product._id,
                productName: product.name,
                details: [{ field: 'Xóa sản phẩm', oldValue: product.name, newValue: '' }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API thêm mới variant 
router.post('/:id/variant', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id } = req.params;
    const newVariant = req.body;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        product.variant.push(newVariant);
        await product.save();

        // Ghi log hoạt động
        try {
            const idx = product.variant.length - 1;
            await new ActivityLog({
                userName: req.user.name,
                action: 'add_variant',
                productId: product._id,
                productName: product.name,
                details: [{ field: `variant[${idx}]`, oldValue: '', newValue: `Giá: ${newVariant.price || '0'}, Giá nhập: ${newVariant.importPrice || '0'}` }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(201).json({
            message: 'Variant added successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API thay đổi thuộc tính display của sản phẩm
router.put('/:_id/toggle-display', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { _id } = req.params;
        const product = await Product.findById(_id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const oldDisplay = product.display;
        product.display = !product.display;
        await product.save();

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: 'toggle_display',
                productId: product._id,
                productName: product.name,
                details: [{ field: 'display', oldValue: oldDisplay ? 'Hiển thị' : 'Ẩn', newValue: product.display ? 'Hiển thị' : 'Ẩn' }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        res.status(200).json({ 
            message: `Thay đổi hiển thị thành công`, 
            product 
        });
    } catch (error) {
        console.error('Error toggling display:', error);
        res.status(500).json({ 
            message: 'Lỗi server khi thay đổi display', 
            error: error.message 
        });
    }
});

// API để cập nhật số lượng bằng variantIndex
router.post("/:id/:variantIndex", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { quantity, orderId, orderName, isAIScan } = req.body;
    const userName = req.user.name;

    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: "Invalid variant index" });
        }

        const variant = product.variant[index];

        const change = Number(quantity);
        if (isNaN(change)) {
            return res.status(400).json({ message: "Quantity must be a number" });
        }

        const newQuantityForSale = variant.quantityForSale + change;
        const newQuantityInStorage = variant.quantityInStorage + change;

        if (newQuantityForSale < 0 || newQuantityInStorage < 0) {
            return res.status(400).json({
                message: `Không còn đủ số lượng trong kho cho sản phẩm: ${product.name}`
            });
        }

        variant.quantityForSale = newQuantityForSale;
        variant.quantityInStorage = newQuantityInStorage;
        await product.save();

        const history = new StorageHistory({
            productId: id,
            productName: product.name,
            quantity: change,
            userName: userName,
            orderId: orderId,
            orderName: orderName,
            isAIScan: !!isAIScan
        });
        await history.save();

        return res.status(200).json({
            message: "Quantity updated & history saved",
            product,
            history
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
});

// API chỉnh sửa variant đang tồn tại
router.put('/:id/:variantIndex', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const variantData = req.body;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        // Lưu dữ liệu cũ để so sánh
        const oldVariant = { ...product.variant[index].toJSON() };

        product.variant[index] = {
            ...product.variant[index],
            ...variantData,
        };
        await product.save();

        // Ghi log hoạt động
        try {
            const variantFields = ['price', 'importPrice', 'earn', 'note', 'color', 'shape', 'buttonCount', 'frame'];
            const details = [];
            for (const vf of variantFields) {
                if (variantData[vf] !== undefined) {
                    const oldVal = (oldVariant[vf] !== undefined ? oldVariant[vf] : '').toString();
                    const newVal = (variantData[vf] !== undefined ? variantData[vf] : '').toString();
                    if (oldVal !== newVal) {
                        details.push({ field: `variant[${index}].${vf}`, oldValue: oldVal, newValue: newVal });
                    }
                }
            }
            if (details.length > 0) {
                await new ActivityLog({
                    userName: req.user.name,
                    action: 'update_variant',
                    productId: product._id,
                    productName: product.name,
                    details
                }).save();
            }
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Variant updated successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API xóa variant
router.delete('/:id/:variantIndex', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        const deletedVariant = product.variant[index];
        product.variant.splice(index, 1);
        await product.save();

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: 'delete_variant',
                productId: product._id,
                productName: product.name,
                details: [{ field: `variant[${index}]`, oldValue: `Giá: ${deletedVariant.price || '0'}, Giá nhập: ${deletedVariant.importPrice || '0'}`, newValue: '' }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Variant deleted successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Lấy đánh giá của một sản phẩm
router.get('/:_id/review', async (req, res) => {
    try {
      const product = await Product.findById(req.params._id).select('reviews');
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product.reviews);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching reviews', error });
    }
  });

// Thêm review
router.post('/:_id/review/create', authenticateUser, async (req, res) => {
    try {
        const email = req.user.email;
        const { comment, rating } = req.body;
        const productId = req.params._id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Tạo review với _id
        const newReview = {
            _id: new mongoose.Types.ObjectId(), // Tạo _id tự động
            email,
            comment,
            rating,
        };

        // Cập nhật thông tin sản phẩm
        product.reviews.push(newReview);
        product.reviewCount = product.reviews.length;
        product.totalRating += rating;
        product.averageReviews = product.totalRating / product.reviewCount;

        await product.save();

        // Trả về review mới
        res.status(201).json({ message: 'Review added successfully', review: newReview });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Sửa review
router.put('/:_id/review/:reviewId', authenticateUser, async (req, res) => {
    try {
        const { comment, rating } = req.body;
        const { _id: productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Update the review
        if (comment) review.comment = comment;
        if (rating) {
            product.totalRating = product.totalRating - review.rating + rating;
            review.rating = rating;
            product.averageReviews = product.totalRating / product.reviews.length;
        }

        await product.save();

        res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Xóa review
router.delete('/:_id/review/:reviewId', authenticateUser, async (req, res) => {
    try {
        const { _id: productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Remove the review
        product.totalRating -= review.rating;
        product.reviews.pull(reviewId);
        product.reviewCount = product.reviews.length;
        product.averageReviews = product.reviewCount > 0 ? product.totalRating / product.reviewCount : 0;

        await product.save();

        res.status(200).json({ message: 'Review deleted successfully', product });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// API thay đổi earn và cập nhật price (làm tròn lên hàng nghìn)
router.put('/:id/:variantIndex/update-earn', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { earn } = req.body;

    try {
        if (typeof earn !== 'number' || isNaN(earn) || earn < 0) {
            return res.status(400).json({ message: 'Earn phải là một số không âm' });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: 'Invalid variant index' });
        }

        const variant = product.variant[index];
        const oldEarn = variant.earn;
        const oldPrice = variant.price;
        const importPriceStr = variant.importPrice || "0";
        const importPriceNum = parseFloat(importPriceStr.replace(/\./g, '').replace(',', '.')) || 0;

        if (importPriceNum < 0) {
            return res.status(400).json({ message: 'ImportPrice không hợp lệ để tính toán price' });
        }

        variant.earn = earn;
        const rawPrice = importPriceNum * (1 + variant.earn / 100);
        const roundedPrice = Math.ceil(rawPrice / 1000) * 1000;
        variant.price = roundedPrice.toString();
        product.adjusted = true;
        await product.save();

        // Ghi log hoạt động
        try {
            const details = [];
            if (oldEarn.toString() !== earn.toString()) {
                details.push({ field: `variant[${index}].earn`, oldValue: oldEarn.toString() + '%', newValue: earn.toString() + '%' });
            }
            if (oldPrice !== variant.price) {
                details.push({ field: `variant[${index}].price`, oldValue: oldPrice, newValue: variant.price });
            }
            if (details.length > 0) {
                await new ActivityLog({
                    userName: req.user.name,
                    action: 'update_earn',
                    productId: product._id,
                    productName: product.name,
                    details
                }).save();
            }
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Earn and price updated successfully',
            variant: {
                ...variant.toJSON(),
                price: variant.price,
                earn: variant.earn,
                importPrice: variant.importPrice
            }
        });
    } catch (error) {
        console.error('Error updating earn and price:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.put('/:id/:variantIndex/update-import-price', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { importPrice } = req.body;

    try {
        // Kiểm tra dữ liệu đầu vào
        if (!importPrice || isNaN(importPrice.replace(/\./g, ''))) {
            return res.status(400).json({ message: 'ImportPrice phải là một chuỗi số hợp lệ' });
        }

        // Tìm sản phẩm theo ID
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Chuyển variantIndex thành số và kiểm tra hợp lệ
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: 'Invalid variant index' });
        }

        // Lấy variant cần cập nhật
        const variant = product.variant[index];
        const oldImportPrice = variant.importPrice;
        const oldPrice = variant.price;

        // Lưu importPrice dưới dạng chuỗi thô
        variant.importPrice = importPrice;

        // Chuyển importPrice từ String sang Number để tính toán
        const importPriceNum = parseFloat(importPrice.replace(/\./g, '').replace(',', '.')) || 0;
        if (importPriceNum < 0) {
            return res.status(400).json({ message: 'ImportPrice không hợp lệ để tính toán price' });
        }

        // Tính lại price dựa trên importPrice mới và earn hiện tại
        const rawPrice = importPriceNum * (1 + (variant.earn || 0) / 100);
        const roundedPrice = Math.ceil(rawPrice / 1000) * 1000;
        variant.price = roundedPrice.toString(); // Lưu dưới dạng chuỗi thô

        product.adjusted = true;
        // Lưu thay đổi vào database
        await product.save();

        // Ghi log hoạt động
        try {
            const details = [];
            if (oldImportPrice !== importPrice) {
                details.push({ field: `variant[${index}].importPrice`, oldValue: oldImportPrice || '0', newValue: importPrice });
            }
            if (oldPrice !== variant.price) {
                details.push({ field: `variant[${index}].price`, oldValue: oldPrice, newValue: variant.price });
            }
            if (details.length > 0) {
                await new ActivityLog({
                    userName: req.user.name,
                    action: 'update_import_price',
                    productId: product._id,
                    productName: product.name,
                    details
                }).save();
            }
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Import price and price updated successfully',
            variant: {
                ...variant.toJSON(),
                price: variant.price,
                earn: variant.earn,
                importPrice: variant.importPrice
            }
        });
    } catch (error) {
        console.error('Error updating import price:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// API lấy danh sách _id dựa trên mảng product.code
router.post('/by-codes', async (req, res) => {
    try {
        const { codes } = req.body;

        // Kiểm tra xem codes có phải là mảng và không rỗng
        if (!Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp một mảng codes hợp lệ' });
        }

        // Tìm các sản phẩm theo mảng codes
        const products = await Product.find({ code: { $in: codes } }).select('_id code');

        // Tạo danh sách kết quả với _id tương ứng
        const result = products.map(product => ({
            code: product.code,
            _id: product._id
        }));

        // Kiểm tra nếu không tìm thấy sản phẩm nào
        if (result.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào với các code được cung cấp' });
        }

        res.json({
            success: 1,
            total: result.length,
            products: result
        });
    } catch (error) {
        console.error('Error fetching products by codes:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Khởi tạo multer memory storage cho việc upload ảnh quét hóa đơn tạm thời có giới hạn bảo mật
const uploadMemory = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5MB
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, webp)."));
        }
    }
});

// API quét ảnh hóa đơn bằng AI
router.post('/scan-invoice', [authenticateAdmin, uploadMemory.single('invoice')], async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.status(400).json({ 
                success: 0, 
                message: 'Vui lòng cấu hình GEMINI_API_KEY hợp lệ trong file be/.env trước khi sử dụng tính năng này.' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: 0, message: 'Không có file ảnh được tải lên.' });
        }

        // 1. Lấy toàn bộ sản phẩm hiển thị trong DB để tự động đối khớp ở Backend
        const activeProducts = await Product.find({ display: true }).select('_id name code brand variant vat');
        
        // 2. Chuyển ảnh sang base64 và lưu file xuống đĩa
        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileName = `invoice-scan-${uniqueSuffix}.webp`;
        const uploadDir = path.join(__dirname, '../upload/invoices');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(path.join(uploadDir, fileName), req.file.buffer);
        } catch (fsErr) {
            console.error('Lỗi khi lưu ảnh hóa đơn quét xuống đĩa:', fsErr);
        }
        const imageUrl = `/invoice-images/${fileName}`;

        // 3. Chuẩn bị prompt trích xuất thông tin từ ảnh (Cực kỳ ngắn gọn để giảm thiểu token và tăng tốc độ)
        const systemPrompt = `Bạn là một AI phân tích hình ảnh hóa đơn chuyên nghiệp.
Nhiệm vụ của bạn là đọc hình ảnh hóa đơn được gửi lên và trích xuất danh sách các mặt hàng (sản phẩm), bao gồm các thông tin: số thứ tự (stt), tên sản phẩm đọc được (rawScannedName), mã sản phẩm nếu có (code), số lượng (quantity), đơn giá (price), đơn vị tính (unit), thuế suất VAT (vat) và ghi chú (note).

Hướng dẫn trích xuất:
- Trường \`stt\` phải lấy chính xác số thứ tự hoặc số dòng được ghi trực tiếp trên hóa đơn cho mặt hàng đó (giữ nguyên định dạng gốc như "01", "1", "A" trên hóa đơn). Nếu cột số thứ tự trên hóa đơn bị để trống hoặc không được ghi số thứ tự cụ thể (chỉ ghi dấu * hoặc bỏ trống), bạn BẮT BUỘC phải tự động đánh số thứ tự tuần tự tăng dần từ 1 cho đến hết (1, 2, 3, 4...) cho các dòng mặt hàng.
- Trường \`code\` chỉ lấy mã sản phẩm, mã hàng, hoặc model thực tế của sản phẩm (ví dụ: "GW1S-3E20", "NFO-40 500/5A"). Tuyệt đối KHÔNG gộp hoặc điền mã PO (Purchase Order - ví dụ: "SOHL2606183B1D4B"), mã đơn mua hàng, số hóa đơn, số lô (Lot number), hoặc các mã quản lý kho riêng của nhà cung cấp vào trường này. Nếu phát hiện một mã PO/mã quản lý giống hệt nhau lặp đi lặp lại ở tất cả các dòng của hóa đơn, bạn phải LOẠI BỎ hoàn toàn phần mã lặp lại đó ra khỏi trường \`code\`, chỉ giữ lại phần model thực của sản phẩm ở phía sau.
- Trường \`vat\` là thuế suất VAT đọc được từ hóa đơn cho mặt hàng đó (ví dụ: "10%", "8%", "0%", hoặc null nếu không có/không đọc được).
- Trường \`price\` là đơn giá thực tế của sản phẩm. Nếu hóa đơn không có cột Đơn giá (hoặc các giá trị tương đương), bạn phải để trống hoặc gán null cho trường \`price\`. Tuyệt đối KHÔNG tự ý suy đoán đơn giá hoặc lấy các con số khác (ví dụ: số mét đầu/cuối của cuộn dây cáp ở cột Ghi chú như "1050 - 750", số thứ tự, số lượng, hoặc số điện thoại) để điền vào trường \`price\`.
- Trường \`quantity\` phải là kiểu số nguyên dương (hãy loại bỏ các ký tự dấu chấm, dấu phẩy hoặc đơn vị VND).
- Trường \`unit\` là đơn vị tính đọc được trên hóa đơn (ví dụ: cái, bộ, mét...).
- NGUYÊN TẮC DÒNG ĐỐI DÒNG VÀ PHÂN TÍCH KÝ TỰ ĐẦU DÒNG (CỰC KỲ QUAN TRỌNG):
  + NHẬN DIỆN KÝ TỰ ĐẦU DÒNG (DẤU SAO * HOẶC MŨI TÊN ↓): Hãy chú ý các ký tự viết tay ở đầu cột tên hàng (ví dụ dấu sao "*", hoặc ký hiệu mũi tên đi xuống "↓"). Đây là ký hiệu bắt đầu một dòng sản phẩm độc lập. 
  + KHÔNG GỘP TIÊU ĐỀ NHÓM: Các dòng ghi tiêu đề nhóm hoặc thông tin phụ (Ví dụ: "8.8 Đen" ở hóa đơn 1, "8.8 Mạ" ở hóa đơn 2) không có ký tự "*" ở đầu và dòng đó trống trơn số liệu (số lượng/giá). Đây là dòng tiêu đề phân loại hoặc ghi chú chứ không phải tên dài xuống dòng (vì chữ viết còn rất ngắn chưa chạm mép lề). Bạn BẮT BUỘC phải xuất dòng tiêu đề này thành một phần tử riêng trong JSON với "quantity" là 0 và "price" là 0. TUYỆT ĐỐI KHÔNG gộp dòng này với sản phẩm có dấu "*" ở phía dưới (như "* 30x120+ê VP"), vì sẽ làm đẩy lệch toàn bộ cột số lượng và đơn giá của các sản phẩm bên dưới lên 1 hàng.
  + ĐỐI VỚI CÁC SẢN PHẨM ĐỘC LẬP: Xuất kết quả nghiêm ngặt theo từng dòng vật lý (line-by-line). Nếu một sản phẩm bị trống số lượng hoặc giá tiền, bạn vẫn phải xuất dòng đó thành một sản phẩm riêng biệt và gán giá trị 0 cho "quantity" và "price". Tuyệt đối KHÔNG lấy số liệu của các dòng phía dưới để điền bù lên dòng trống này.
- KIỂM TRA PHÉP NHÂN TOÁN HỌC (CỰC KỲ QUAN TRỌNG): Đối với hóa đơn viết tay, các nét chữ số lượng và đơn giá rất dễ bị nhận diện nhầm (ví dụ: số 42 trông giống số 12, hoặc số 4.000 bị nhầm với số 40.000). Bạn BẮT BUỘC phải thực hiện phép nhân nhẩm: [Số lượng (quantity)] x [Đơn giá (price)] và đối chiếu xem kết quả có trùng khớp với con số ở cột [Thành tiền] được ghi trên hóa đơn cho dòng sản phẩm đó hay không. Nếu không khớp, hãy dùng phép tính toán học để suy ngược lại và tự điều chỉnh số lượng hoặc đơn giá cho chính xác trước khi xuất kết quả JSON (Ví dụ: nếu đơn giá là 12.500 và thành tiền ghi là 525.000, thì số lượng bắt buộc phải là 42 chứ không thể là 12).

Định dạng phản hồi BẮT BUỘC là một mảng JSON trực tiếp (không nằm trong thẻ markdown \`\`\`json và không có văn bản giải thích đi kèm):
[
  {
    "stt": "1",
    "rawScannedName": "Tên sản phẩm đọc được từ ảnh hóa đơn",
    "code": "Mã sản phẩm đọc được từ ảnh hóa đơn (nếu có)",
    "quantity": 10,
    "price": 150000,
    "unit": "cái",
    "vat": "10%",
    "note": "Ghi chú nếu có"
  }
]`;

        // 4. Gọi API Gemini bằng fetch có hỗ trợ Fallback tự động khi quá tải (503)
        const modelsToTry = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-flash-latest',
            'gemini-flash-lite-latest'
        ];

        const callGeminiWithModel = async (modelName) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const startGemini = Date.now();
            console.log(`[scan-invoice] Bắt đầu gọi Gemini API (${modelName}) để trích xuất chữ từ ảnh...`);

            try {
                const res = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: systemPrompt },
                                    {
                                        inlineData: {
                                            mimeType: mimeType,
                                            data: base64Image
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });

                const duration = ((Date.now() - startGemini) / 1000).toFixed(2);
                console.log(`[scan-invoice] Gemini API (${modelName}) đã phản hồi sau ${duration} giây.`);
                return res;
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error(`Kết nối tới Gemini API (${modelName}) bị quá thời gian (Timeout 25s).`);
                }
                throw fetchErr;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let geminiRes = null;
        let lastError = null;

        for (const model of modelsToTry) {
            try {
                const res = await callGeminiWithModel(model);
                if (res.ok) {
                    geminiRes = res;
                    break; // Thành công thì dừng lại và dùng kết quả này
                } else {
                    const errText = await res.text();
                    console.warn(`[scan-invoice] Model ${model} trả về mã lỗi HTTP ${res.status}:`, errText);
                    lastError = new Error(`Lỗi từ Gemini API (${model}): ${errText}`);
                }
            } catch (err) {
                console.warn(`[scan-invoice] Lỗi khi thực hiện cuộc gọi bằng model ${model}:`, err.message);
                lastError = err;
            }
        }

        if (!geminiRes) {
            throw lastError || new Error("Không thể kết nối đến bất kỳ model Gemini nào.");
        }

        const geminiData = await geminiRes.json();
        
        // Lấy text phản hồi và parse sang JSON
        let textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) {
            throw new Error('Không nhận được dữ liệu phân tích từ Gemini.');
        }

        // Đảm bảo không bị bọc bởi markdown block ```json ... ``` hoặc ``` ... ```
        textResult = textResult.trim();
        textResult = textResult.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        const items = JSON.parse(textResult);

        // Hậu xử lý (Post-processing): Loại bỏ tiền tố mã PO lặp đi lặp lại ở đầu trường 'code' của mọi dòng nếu có
        if (Array.isArray(items) && items.length > 1) {
            const validCodes = items.map(item => item.code ? String(item.code).trim() : '').filter(Boolean);
            if (validCodes.length > 1) {
                // Lấy từ đầu tiên (phân tách bằng khoảng trắng) của các mã
                const firstWords = validCodes.map(c => c.split(/\s+/)[0]);
                const firstWord = firstWords[0];
                // Nếu từ đầu tiên có độ dài từ 6 ký tự trở lên và xuất hiện ở TẤT CẢ các mã hàng
                if (firstWord && firstWord.length >= 6 && firstWords.every(w => w === firstWord)) {
                    console.log(`[scan-invoice] Phát hiện tiền tố chung lặp lại (Mã PO): "${firstWord}". Đang tiến hành loại bỏ...`);
                    items.forEach(item => {
                        if (item.code) {
                            let cleanCode = String(item.code).substring(firstWord.length).trim();
                            cleanCode = cleanCode.replace(/^[\s_-]+/, '');
                            item.code = cleanCode;
                        }
                    });
                }
            }
        }

        // ===== Helpers =====
        const tokenizeSpec = (text) => {
            if (!text) return new Set();
            const regexModel = /(?=\d+[a-zA-Z]|[a-zA-Z]+\d)[a-zA-Z0-9\-\/]+/gi;
            const regexPureNum = /\b\d{3,}\b/g;

            const tokens = new Set();
            let match;

            regexModel.lastIndex = 0;
            while ((match = regexModel.exec(text)) !== null) {
                tokens.add(match[0].toLowerCase());
            }

            regexPureNum.lastIndex = 0;
            while ((match = regexPureNum.exec(text)) !== null) {
                tokens.add(match[0].toLowerCase());
            }

            return tokens;
        };

        const tokenizeTypeWords = (text) => {
            if (!text) return new Set();
            const out = new Set();
            const words = removeVietnameseTones(text).toLowerCase().split(/[\s,.\-\/()]+/);
            for (const w of words) {
                // từ chữ: có chữ cái, KHÔNG chứa số, độ dài > 1 (lớn hơn hoặc bằng 2)
                if (w.length > 1 && /[a-z]/.test(w) && !/\d/.test(w)) {
                    out.add(w);
                }
            }

            // Đồng bộ nhóm từ đồng nghĩa tiếng Anh <-> tiếng Việt cho thiết bị điện
            // 1. Contactor / Công tắc tơ / Khởi động từ
            if (
                (out.has('cong') && out.has('to')) || 
                (out.has('cong') && out.has('tac') && out.has('to')) || 
                (out.has('cong') && out.has('tac') && out.has('tor')) || 
                (out.has('khoi') && out.has('dong') && out.has('tu'))
            ) {
                out.add('contactor');
            }
            if (out.has('contactor')) {
                out.add('cong');
                out.add('tac');
                out.add('to');
                out.add('contactor');
            }

            // 2. Rơ le / Rơle <-> Relay
            if (out.has('ro') && out.has('le')) {
                out.add('role');
                out.add('relay');
            }
            if (out.has('role') || out.has('relay')) {
                out.add('ro');
                out.add('le');
                out.add('role');
                out.add('relay');
            }

            // 3. Aptomat / Cầu dao / CB <-> Breaker / MCB / MCCB
            if (out.has('aptomat') || (out.has('cau') && out.has('dao'))) {
                out.add('cb');
                out.add('mcb');
                out.add('mccb');
            }
            if (out.has('cb') || out.has('mcb') || out.has('mccb')) {
                out.add('cau');
                out.add('dao');
                out.add('aptomat');
            }

            return out;
        };

        const codeKind = (code) => {
            if (!code || !code.trim()) return 'none';
            return /^\d+$/.test(code.trim()) ? 'supplier' : 'model';
        };

        const cleanCode = (code) => {
            return code ? code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        };

        // Gate chung: code không xung đột + spec subset (Set) + type-word hit
        const passGates = (p, ctx, item) => {
            // R: code conflict - cả 2 là model mà khác mã -> reject
            if (ctx.scanCodeKind === 'model' && codeKind(p.code) === 'model'
                && cleanCode(item.code) !== cleanCode(p.code)) {
                return false;
            }
            // R4: spec subset bằng SET membership (không dùng includes để tránh trượt 100/1000)
            if (ctx.hasScanSpec) {
                const pSpec = tokenizeSpec(`${p.name || ''} ${p.code || ''}`);
                for (const t of ctx.scanSpec) {
                    if (!pSpec.has(t)) {
                        return false; // thiếu 1 spec -> reject (R2)
                    }
                }
            }
            // R5: bắt buộc trùng >= 1 từ loại sản phẩm (chặn Van vs Xy lanh)
            const pType = tokenizeTypeWords(p.name || '');
            let typeHit = false;
            for (const t of ctx.scanType) {
                if (pType.has(t)) {
                    typeHit = true;
                    break;
                }
            }
            if (!typeHit) {
                return false;
            }
            return true;
        };

        const fuzzyScore = (p, scanName) => {
            const a = removeVietnameseTones(scanName).toLowerCase().split(/[\s,.\-\/]+/).filter(w => w.length > 1);
            const b = removeVietnameseTones(p.name).toLowerCase().split(/[\s,.\-\/]+/).filter(w => w.length > 1);
            return a.reduce((n, w) => n + (b.includes(w) ? 1 : 0), 0);
        };

        // 5. Tự động so khớp sản phẩm trong Database bằng Javascript (Nhanh và chính xác)
        const matchedItems = items.map(item => {
            const scanName = item.rawScannedName || '';
            const scanCodeKind = codeKind(item.code);
            const scanSpec = tokenizeSpec(`${scanName} ${scanCodeKind === 'model' ? item.code : ''}`);
            const scanType = tokenizeTypeWords(scanName);
            const hasScanSpec = scanSpec.size > 0;

            const ctx = {
                scanCodeKind,
                scanSpec,
                scanType,
                hasScanSpec
            };

            let matchedProductId = null;
            let confidence = 'high';

            // Bước 5.1: Đối khớp theo mã model (filter tất cả, không find)
            if (item.code && scanCodeKind === 'model') {
                const cc = cleanCode(item.code);
                const byCode = activeProducts.filter(p => codeKind(p.code) === 'model' && cleanCode(p.code) === cc);
                const passed = byCode.filter(p => passGates(p, ctx, item)); // R3: lọc spec/type giữa các biến thể trùng mã
                
                if (passed.length === 1) {
                    matchedProductId = passed[0]._id.toString();
                    confidence = ctx.hasScanSpec ? 'high' : 'low';
                    if (!item.vat && passed[0].vat) {
                        item.vat = passed[0].vat;
                    }
                } else if (passed.length > 1) { // nhiều biến thể trùng mã -> fuzzy tie-breaker, medium
                    const best = passed.reduce((x, p) => fuzzyScore(p, scanName) > fuzzyScore(x, scanName) ? p : x);
                    matchedProductId = best._id.toString();
                    confidence = 'medium';
                    if (!item.vat && best.vat) {
                        item.vat = best.vat;
                    }
                } else if (byCode.length > 0) {
                    // Fallback: Nếu trùng khớp hoàn toàn mã model trong DB nhưng không vượt qua được passGates
                    // (ví dụ: lệch từ đồng nghĩa của loại hoặc thông số do ngôn ngữ)
                    // Ta vẫn khớp với sản phẩm này để tránh việc tạo sản phẩm trùng lặp mã trong kho
                    const best = byCode.reduce((x, p) => fuzzyScore(p, scanName) > fuzzyScore(x, scanName) ? p : x);
                    matchedProductId = best._id.toString();
                    confidence = 'low';
                    if (!item.vat && best.vat) {
                        item.vat = best.vat;
                    }
                }
            }

            // Bước 5.2: Fuzzy tên toàn DB
            if (!matchedProductId) {
                const candidates = activeProducts.filter(p => passGates(p, ctx, item));
                if (candidates.length > 0) {
                    const best = candidates.reduce((x, p) => fuzzyScore(p, scanName) > fuzzyScore(x, scanName) ? p : x);
                    matchedProductId = best._id.toString();
                    const pSpec = tokenizeSpec(`${best.name || ''} ${best.code || ''}`);
                    
                    confidence = !ctx.hasScanSpec ? 'low'                      // R6: không spec -> low
                               : pSpec.size === ctx.scanSpec.size ? 'high'      // spec bằng nhau -> high
                               : 'medium';                                      // R7: candidate dư thừa spec -> medium
                    if (!item.vat && best.vat) {
                        item.vat = best.vat;
                    }
                }
            }

            return {
                ...item,
                matchedProductId: matchedProductId || "NEW_PRODUCT",
                confidence: matchedProductId ? confidence : 'high'
            };
        });

        res.json({
            success: 1,
            imageUrl: imageUrl,
            total: matchedItems.length,
            items: matchedItems
        });

    } catch (error) {
        console.error('Lỗi khi quét hóa đơn bằng AI:', error);
        res.status(500).json({ 
            success: 0, 
            message: `Đã xảy ra lỗi khi phân tích hóa đơn bằng AI: ${error.message}`, 
            error: error.message 
        });
    }
});

// Khởi tạo rate limiter riêng cho voice query
const voiceLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 5, // 5 req/phút/user
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    message: { success: 0, message: "Quá nhiều yêu cầu giọng nói, vui lòng thử lại sau." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Khởi tạo multer cho file âm thanh đầu vào
const uploadAudio = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
    fileFilter: (req, file, cb) => {
        if (/^(audio\/|application\/octet-stream)/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file âm thanh."));
        }
    }
});

// API Tìm kiếm bằng giọng nói tiếng Việt sử dụng Gemini Multimodal Audio Input
router.post('/voice-query', [uploadAudio.single('audio')], async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.status(400).json({ 
                success: 0, 
                message: 'Vui lòng cấu hình GEMINI_API_KEY hợp lệ trong file be/.env trước khi sử dụng tính năng này.' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: 0, message: 'Không nhận được file âm thanh nào.' });
        }

        const base64Audio = req.file.buffer.toString('base64');
        let mimeType = req.file.mimetype || 'audio/webm';
        if (mimeType === 'application/octet-stream') {
            mimeType = 'audio/mp4'; // Safari fallback
        }

        console.log(`\n📥 [VOICE INCOMING] Nhận file âm thanh từ điện thoại: ${req.file.size} bytes | Định dạng: ${mimeType}`);

        const systemPrompt = `Bạn là trợ lý ảo thông minh phụ trách quản lý kho hàng của công ty thiết bị điện/thiết bị tự động hóa TTSmart.
Hãy nghe file âm thanh được cung cấp (giọng nói tiếng Việt của người dùng) và thực hiện 2 nhiệm vụ:
1. Ghi lại chính xác (transcribe) những gì người dùng đã nói (giữ nguyên tiếng Việt có dấu, viết hoa các từ cần thiết như Siemens, Mitsubishi, GPC1202, S7-1200, FX3U,...).
2. Phân tích ý định (intent) của người dùng để trích xuất ra từ khóa tìm kiếm chính (keyword) và các bộ lọc (filters) thích hợp, tối ưu hóa cho tất cả các cách gọi khác nhau của người dùng.

CƠ SỞ DỮ LIỆU ĐANG CÓ SẴN CÁC THƯƠNG HIỆU (BRANDS) VÀ LOẠI SẢN PHẨM (TYPES) SAU:
- Thương hiệu khả dụng: 'Airtac', 'Autonics', 'Chaofan', 'Delta', 'Frecon', 'Giga', 'Goldcup', 'Haitima', 'Hanyoung', 'Idec', 'Keli', 'Kinco', 'Mitsubishi', 'Nass', 'Omron', 'Parker', 'STNC', 'SangA', 'Sangjin', 'Schneider', 'Selec', 'Siemens', 'Taiwan', 'VEICHI'
- Loại sản phẩm khả dụng: 'Aptomat', 'Biến tần', 'Biến áp cách ly', 'Bảo Vệ Mất, Ngược Pha', 'Bộ lọc khí', 'Contactor', 'Cảm biến', 'Cầu Đấu', 'Dây điện', 'Loadcell', 'Lọc bụi', 'Nguồn', 'Nút Nhấn', 'PLC', 'Phụ kiện khí nén', 'Relay Nhiệt', 'Relay Thời Gian', 'Relay Trung Gian', 'TI', 'Van khí nén', 'Van điện từ', 'Xy lanh khí nén', 'Đèn', 'Đồng Hồ'

Quy tắc phân tách và xử lý từ khóa:
- Khớp đúng Thương hiệu (filters.brand): Nếu người dùng nhắc tới tên thương hiệu, bạn PHẢI ánh xạ chính xác về một trong những thương hiệu khả dụng ở trên (Ví dụ: "siemens" -> "Siemens", "mit su bi shi" -> "Mitsubishi", "ôm ron" -> "Omron", "vê chi" -> "VEICHI", "en tơ nét" -> "Autonics"). Nếu câu nói không chứa tên thương hiệu, "filters.brand" bắt buộc phải là null (Tuyệt đối KHÔNG tự ý gán bừa thương hiệu mặc định).
- Khớp đúng Loại sản phẩm (filters.type): Ánh xạ từ khóa về một trong các loại sản phẩm khả dụng ở danh sách trên.
  + Nếu nhắc đến: "át", "át tô mát", "áp tô mát", "aptomat", "cầu dao tự động" -> filters.type: "Aptomat", keyword: "Aptomat".
  + Nếu nhắc đến: "khởi", "khởi động từ", "công tắc tơ", "contactor" -> filters.type: "Contactor", keyword: "Contactor".
  + Nếu nhắc đến: "biến tần", "inverter", "bộ biến tần" -> filters.type: "Biến tần", keyword: "biến tần".
  + Nếu nhắc đến: "cảm biến", "sensor", "thiết bị cảm biến" -> filters.type: "Cảm biến", keyword: "cảm biến".
  + Nếu nhắc đến: "nút nhấn", "nút bấm" -> filters.type: "Nút Nhấn", keyword: "nút nhấn".
  + Nếu nhắc đến: "nguồn", "nguồn tổ ong", "nguồn xung" -> filters.type: "Nguồn", keyword: "nguồn".
  + Nếu nhắc đến: "bộ điều khiển", "bộ lập trình", "plc" -> filters.type: "PLC", keyword: "PLC".
  + Nếu nhắc đến: "rơ le trung gian", "relay trung gian" -> filters.type: "Relay Trung Gian", keyword: "relay trung gian".
  + Nếu nhắc đến: "rơ le thời gian", "relay thời gian", "timer" -> filters.type: "Relay Thời Gian", keyword: "relay thời gian".
  + Nếu nhắc đến: "rơ le nhiệt", "relay nhiệt" -> filters.type: "Relay Nhiệt", keyword: "relay nhiệt".
  + Nếu nhắc đến: "ti" -> filters.type: "TI", keyword: "TI".
  + Nếu nhắc đến: "đèn báo", "đèn chỉ thị", "đèn" -> filters.type: "Đèn", keyword: "đèn".
  + Nếu nhắc đến: "xi lanh khí nén", "ty ben" -> filters.type: "Xy lanh khí nén", keyword: "xy lanh".
- Trường hợp Đặc biệt:
  + Màn hình / HMI: Vì trong danh mục sản phẩm của hệ thống KHÔNG có loại "HMI" (các màn hình HMI đang được xếp vào loại "PLC" hoặc loại khác), nên nếu người dùng nói "HMI", "màn hình HMI", "màn hình cảm ứng", bạn phải đặt "filters.type" là null và đặt "keyword" là "HMI" hoặc "màn hình" để tìm kiếm theo tên chuỗi văn bản.
- Tách biệt tên thương hiệu: Nếu người dùng nhắc cả loại và hãng (ví dụ: "tìm plc siemens"), bạn PHẢI tách thương hiệu ra đưa vào "filters.brand" (ví dụ: "Siemens"), và đưa loại sản phẩm vào "keyword" (ví dụ: "PLC") đồng thời loại bỏ tên hãng khỏi "keyword" để tránh việc tìm kiếm chuỗi trong cơ sở dữ liệu bị lỗi.
- Chỉ gán "filters.brand" tự động khi người dùng đọc mã/model thiết bị đặc thù thuộc về duy nhất một hãng (ví dụ: "S7-1200" hoặc "S7-1500" -> hãng "Siemens"; "FX3U" hoặc "FX5U" -> hãng "Mitsubishi").
- Giữ lại thông số kỹ thuật chi tiết: Nếu câu nói chứa tên model và các thông số chi tiết (ví dụ: "SM1231 8 AI RTD", "S7-1200 1214C", "FX3U 16MR"), bạn PHẢI trích xuất mã dòng sản phẩm chính vào "filters.code" (ví dụ: "SM1231", "S7-1200", "FX3U"), nhưng đối với trường "keyword", bạn bắt buộc PHẢI giữ nguyên toàn bộ tên model kèm thông số chi tiết đó (ví dụ: "SM1231 8 AI RTD") để backend có thể đối sánh chính xác.
- Giữ lại thuộc tính mô tả chi tiết: Nếu người dùng đọc kèm mô tả cụ thể (ví dụ: "nút đỏ", "nút đỏ không đèn", "nút nhấn màu xanh", "relay nhiệt mười tám a", "rơ le nhiệt 18A"), bạn PHẢI giữ nguyên cụm từ mô tả chi tiết đó làm "keyword" (ví dụ: "nút đỏ", "nút đỏ không đèn", "nút nhấn màu xanh", "relay nhiệt 18A"), TUYỆT ĐỐI không được rút ngắn keyword thành tên loại sản phẩm chung chung (như "nút nhấn" hoặc "relay nhiệt") vì hệ thống cần từ khóa chi tiết để lọc sản phẩm theo màu sắc/dòng điện.


Ví dụ cụ thể:
1. Người dùng nói: "tìm plc siemens"
-> transcript: "tìm plc siemens", keyword: "PLC", intent: "search_product", filters: { brand: "Siemens", type: "PLC", code: null }

2. Người dùng nói: "tìm bộ lập trình mitsubishi"
-> transcript: "tìm bộ lập trình mitsubishi", keyword: "PLC", intent: "search_product", filters: { brand: "Mitsubishi", type: "PLC", code: null }

3. Người dùng nói: "giá màn hình hmi delta"
-> transcript: "giá màn hình hmi delta", keyword: "HMI", intent: "search_product", filters: { brand: "Delta", type: null, code: null }

4. Người dùng nói: "tìm plc"
-> transcript: "tìm plc", keyword: "PLC", intent: "search_product", filters: { brand: null, type: "PLC", code: null }

5. Người dùng nói: "tìm cảm biến omron"
-> transcript: "tìm cảm biến omron", keyword: "cảm biến", intent: "search_product", filters: { brand: "Omron", type: "Cảm biến", code: null }

6. Người dùng nói: "khớp nối gpc mười hai không hai còn hàng không"
-> transcript: "khớp nối gpc mười hai không hai còn hàng không", keyword: "khớp nối GPC1202", intent: "search_product", filters: { brand: null, type: null, code: "GPC1202" }

7. Người dùng nói: "cho tôi xem sản phẩm của hãng siemens"
-> transcript: "cho tôi xem sản phẩm của hãng siemens", keyword: "", intent: "search_product", filters: { brand: "Siemens", type: null, code: null }

8. Người dùng nói: "tìm thiết bị s7 mười hai trăm"
-> transcript: "tìm thiết bị s7 mười hai trăm", keyword: "S7-1200", intent: "search_product", filters: { brand: "Siemens", type: "PLC", code: "S7-1200" }

9. Người dùng nói: "fx3u còn hàng không"
-> transcript: "fx3u còn hàng không", keyword: "FX3U", intent: "search_product", filters: { brand: "Mitsubishi", type: "PLC", code: "FX3U" }

Định dạng phản hồi BẮT BUỘC là một đối tượng JSON trực tiếp (không nằm trong thẻ markdown và không có văn bản giải thích đi kèm):
{
  "transcript": "...",
  "keyword": "...",
  "intent": "search_product",
  "filters": {
    "brand": null,
    "type": null,
    "code": null
  }
}
`;

        const modelsToTry = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-flash-latest',
            'gemini-flash-lite-latest'
        ];

        const callGeminiWithModel = async (modelName) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            try {
                const res = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: systemPrompt },
                                    {
                                        inlineData: {
                                            mimeType: mimeType,
                                            data: base64Audio
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });
                return res;
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error(`Kết nối tới Gemini API (${modelName}) bị quá thời gian (Timeout 25s).`);
                }
                throw fetchErr;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let geminiRes = null;
        let lastError = null;

        for (const model of modelsToTry) {
            try {
                const res = await callGeminiWithModel(model);
                if (res.ok) {
                    geminiRes = res;
                    break;
                } else {
                    const errText = await res.text();
                    console.warn(`[voice-query] Model ${model} lỗi:`, errText);
                    lastError = new Error(`Lỗi từ Gemini API (${model}): ${errText}`);
                }
            } catch (err) {
                console.warn(`[voice-query] Lỗi model ${model}:`, err.message);
                lastError = err;
            }
        }

        if (!geminiRes) {
            throw lastError || new Error("Không thể kết nối đến bất kỳ model Gemini nào.");
        }

        const geminiData = await geminiRes.json();
        let textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) {
            throw new Error('Không nhận được dữ liệu phân tích từ Gemini.');
        }

        textResult = textResult.trim();
        textResult = textResult.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        let resultObj;
        try {
            const match = textResult.match(/\{[\s\S]*\}/);
            resultObj = match ? JSON.parse(match[0]) : JSON.parse(textResult);
        } catch (parseErr) {
            console.warn("[voice-query] Không parse được JSON phản hồi từ Gemini:", textResult);
            // Fallback: dùng toàn bộ transcript/text làm keyword
            const fallbackResult = normalizeVoiceQueryResult({
                transcript: textResult,
                keyword: textResult.replace(/^(tìm|cho tôi hỏi|là bao nhiêu)\s*/gi, '').trim(),
                intent: "search_product",
                filters: { brand: null, type: null, code: null }
            });
            console.log("\n🎙️ [VOICE SEARCH - FALLBACK] -----------------------");
            console.log(`🗣️ Người dùng nói: "${fallbackResult.transcript}"`);
            console.log(`🔍 Từ khóa trích xuất: "${fallbackResult.keyword}"`);
            console.log("---------------------------------------------------\n");
            return res.json({
                success: 1,
                ...fallbackResult
            });
        }

        const normalizedResult = normalizeVoiceQueryResult(resultObj);
        console.log("\n🎙️ [VOICE SEARCH] ----------------------------------");
        console.log(`🗣️ Người dùng nói: "${normalizedResult.transcript}"`);
        console.log(`🔍 Từ khóa trích xuất: "${normalizedResult.keyword}"`);
        console.log(`🎛️ Bộ lọc trích xuất:`, JSON.stringify(normalizedResult.filters));
        console.log("---------------------------------------------------\n");
        res.json({
            success: 1,
            ...normalizedResult
        });

    } catch (error) {
        console.error('Lỗi khi phân tích giọng nói bằng AI:', error);
        res.status(500).json({ 
            success: 0, 
            message: `Đã xảy ra lỗi khi phân tích giọng nói bằng AI: ${error.message}`, 
            error: error.message 
        });
    }
});

// Export router
module.exports = {
    Product,
    router,
    uploadImage,
    normalizeVoiceQueryResult
};
