const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const rateLimit = require("express-rate-limit");
const { authenticateUser, authenticateAdmin, checkPermission, checkAnyPermission, User } = require('./user');
const { Station } = require('./station');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const fs = require('fs').promises;
const { StorageHistory } = require("./storagehistory");
const { ActivityLog } = require("./activitylog");
const voiceVocabDefaults = require('../config/voiceVocab.defaults');
const { PRODUCT_IMAGE_UPLOAD_SETTINGS } = require('../config/imageUpload');
const {
    applyStockAdjustments,
    rollbackOrThrow,
} = require('../services/inventory');

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

function normalizeBrandKey(brand) {
    return removeVietnameseTones(String(brand || ''))
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim();
}

function resolveBrand(scannedBrand, brandDocs) {
    const brand = String(scannedBrand || '').trim();
    if (!brand) {
        return { brand: '', brandIsNew: false };
    }

    const brandKey = normalizeBrandKey(brand);
    const canonicalBrand = (Array.isArray(brandDocs) ? brandDocs : []).find(
        (doc) => normalizeBrandKey(doc && doc.Brand) === brandKey
    );

    if (canonicalBrand) {
        return { brand: canonicalBrand.Brand, brandIsNew: false };
    }

    return { brand, brandIsNew: true };
}

function normalizeProductCodeForCompare(code) {
    return String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function limitRegexInput(value) {
    return String(value || '').slice(0, 100);
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sinh Regex tự động chấp nhận các ký tự ngăn cách trong mã sản phẩm
function generateFuzzyCodeRegex(rawCode) {
    if (!rawCode) return null;
    const cleanCode = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanCode) return null;
    const regexPattern = cleanCode.split('').join('[\\s\\-\\/\\.]*');
    return new RegExp(regexPattern, 'i');
}

// Dựng khối $or fuzzy cho MỘT token tìm kiếm (name/nameUnsigned/code/brand).
// Tách ra hàm riêng để phễu "thu hẹp dần" tái dùng đúng logic với AND gốc.
function buildTokenQuery(token) {
    const limitedToken = limitRegexInput(token);
    const tokenUnsigned = removeVietnameseTones(limitedToken);
    const safeToken = escapeRegex(limitedToken);
    const safeTokenUnsigned = escapeRegex(tokenUnsigned);
    // Hỗ trợ tìm kiếm song song "relay"/"rơ le", "xi"/"xy" (xi lanh/xy lanh), "ki"/"ky" cho từng từ khóa đơn lẻ
    const fuzzyToken = /^(relay|rơ\s+le)$/i.test(limitedToken)
        ? '(relay|rơ\\s+le)'
        : /^(xi|xy)$/i.test(limitedToken)
            ? '(xi|xy)'
            : /^(ki|ky)$/i.test(limitedToken)
                ? '(ki|ky)'
                : safeToken;
    const fuzzyTokenUnsigned = /^(relay|ro\s+le)$/i.test(tokenUnsigned)
        ? '(relay|ro\\s+le)'
        : /^(xi|xy)$/i.test(tokenUnsigned)
            ? '(xi|xy)'
            : /^(ki|ky)$/i.test(tokenUnsigned)
                ? '(ki|ky)'
                : safeTokenUnsigned;

    const fuzzyCodeRegex = generateFuzzyCodeRegex(limitedToken);
    return {
        $or: [
            { name: { $regex: fuzzyToken, $options: "i" } },
            { nameUnsigned: { $regex: fuzzyTokenUnsigned, $options: "i" } },
            { code: fuzzyCodeRegex || { $regex: safeToken, $options: "i" } },
            { brand: { $regex: safeToken, $options: "i" } }
        ]
    };
}

// Các từ dẫn/nghi vấn thường đứng đầu hoặc cuối câu nói, không phải thực thể sản phẩm.
// Chỉ bóc khi nằm ở BIÊN (đầu/cuối) để không cắt nhầm từ giữa cụm mô tả.
// Khởi tạo từ nguồn chung (voiceVocab.defaults). refreshVoiceVocab() có thể nạp
// lại từ DB khi admin sửa qua trang quản trị mà không cần restart.
let SEARCH_STOPWORDS = new Set(voiceVocabDefaults.stopwords);

// Bóc stopword ở đầu và cuối chuỗi tìm kiếm, trả về mảng token thực thể còn lại.
function stripSearchStopwords(search) {
    const raw = String(search || '').split(/\s+/).filter(Boolean);
    let start = 0;
    while (start < raw.length && SEARCH_STOPWORDS.has(removeVietnameseTones(raw[start]).toLowerCase())) {
        start++;
    }
    let tokens = raw.slice(start);
    while (tokens.length > 0 && SEARCH_STOPWORDS.has(removeVietnameseTones(tokens[tokens.length - 1]).toLowerCase())) {
        tokens = tokens.slice(0, -1);
    }
    return tokens;
}

// Thuật toán thu hẹp dần tham lam: cộng dồn từng token trái->phải, giữ token nào
// vẫn còn kết quả, bỏ qua token làm rớt về 0. Trả về tập token thắng + kết quả cuối.
// runFn(subsetTokens) là hàm async trả [products, total]; tách thuần để test không cần DB.
async function greedyNarrowTokens(tokens, runFn) {
    let kept = [];
    let bestProducts = [];
    let bestTotal = 0;
    for (const tk of tokens) {
        const trial = [...kept, tk];
        const [products, total] = await runFn(trial);
        if (total > 0) {
            kept = trial;
            bestProducts = products;
            bestTotal = total;
        }
    }
    return { tokens: kept, products: bestProducts, total: bestTotal };
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

// Khởi tạo từ nguồn chung (voiceVocab.defaults). Dùng `let` để refreshVoiceVocab()
// nạp lại được từ DB khi admin sửa qua trang quản trị mà không cần restart server.
let VOICE_BRANDS = voiceVocabDefaults.brands.slice();
let VOICE_TYPES = voiceVocabDefaults.types.slice();
let VOICE_BRAND_ALIASES = voiceVocabDefaults.brandAliases.map(([b, a]) => [b, a.slice()]);
let VOICE_TYPE_ALIASES = voiceVocabDefaults.typeAliases.map(([t, k, a]) => [t, k, a.slice()]);
let VOICE_CODE_MAP = voiceVocabDefaults.codeMap.map(c => ({ ...c, patterns: (c.patterns || []).slice() }));
let VOICE_INTENT_ALIASES = voiceVocabDefaults.intentAliases.map(([id, label, a]) => [id, label, (a || []).slice()]);
const VALID_INTENTS = ['search_product', 'add_to_cart', 'update_item', 'delete_item'];

// Nạp lại toàn bộ từ vựng voice lúc runtime (Giai đoạn 2 gọi khi admin sửa qua DB).
// Chỉ ghi đè nhóm nào được truyền vào; nhóm thiếu giữ nguyên giá trị hiện tại.
// Nhờ vậy cả nhánh regex fallback lẫn prompt Gemini (sinh động từ các biến này)
// đều dùng vocab mới ngay, không cần restart server.
function refreshVoiceVocab(vocab = {}) {
    if (Array.isArray(vocab.stopwords)) {
        SEARCH_STOPWORDS = new Set(vocab.stopwords);
    }
    if (Array.isArray(vocab.brands)) {
        VOICE_BRANDS = vocab.brands.slice();
    }
    if (Array.isArray(vocab.types)) {
        VOICE_TYPES = vocab.types.slice();
    }
    if (Array.isArray(vocab.brandAliases)) {
        VOICE_BRAND_ALIASES = vocab.brandAliases.map(([b, a]) => [b, (a || []).slice()]);
    }
    if (Array.isArray(vocab.typeAliases)) {
        VOICE_TYPE_ALIASES = vocab.typeAliases.map(([t, k, a]) => [t, k, (a || []).slice()]);
    }
    if (Array.isArray(vocab.codeMap)) {
        VOICE_CODE_MAP = vocab.codeMap.map(c => ({ ...c, patterns: (c.patterns || []).slice() }));
    }
    if (Array.isArray(vocab.intentAliases)) {
        VOICE_INTENT_ALIASES = vocab.intentAliases.map(([id, label, a]) => [id, label, (a || []).slice()]);
    }
}

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

    // Duyệt danh sách mã model (VOICE_CODE_MAP) theo thứ tự: khớp nếu bất kỳ
    // pattern nào (test trên chuỗi đã bỏ dấu) khớp, hoặc compact chứa chuỗi con.
    for (const entry of VOICE_CODE_MAP) {
        const patternHit = (entry.patterns || []).some(p => new RegExp(p, 'i').test(normalized));
        const compactHit = entry.compact ? compact.includes(entry.compact) : false;
        if (patternHit || compactHit) {
            return {
                code: entry.code,
                keyword: entry.keyword,
                brand: entry.brand ?? null,
                type: entry.type ?? null
            };
        }
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

function detectVoiceIntent(text) {
    const normalized = normalizeVoiceText(text);

    for (const [intentId, , aliases] of VOICE_INTENT_ALIASES) {
        if (!VALID_INTENTS.includes(intentId)) continue;
        if ((aliases || []).some(alias => phraseRegex(alias).test(normalized))) {
            return intentId;
        }
    }

    return 'search_product';
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

    // Ưu tiên brand suy ra từ mã máy rồi tới regex quét trên transcript; chỉ dùng brand
    // do Gemini đưa (filters.brand) khi không có transcript, tránh brand "ảo" AI tự thêm
    const rawBrand = VOICE_BRANDS.includes(filters.brand) ? filters.brand : null;
    const detectedBrand = findVoiceBrand(brandProbeText);
    const brand = codeInfo?.brand || detectedBrand || (!transcript ? rawBrand : null);

    // Ưu tiên Type từ Gemini AI, nếu không có mới dùng Regex
    const typeInfo = findVoiceType(probeText);
    const rawType = VOICE_TYPES.includes(filters.type) ? filters.type : null;
    const type = rawType || codeInfo?.type || typeInfo.type;

    const code = codeInfo?.code || (typeof filters.code === 'string' && filters.code.trim() ? filters.code.trim().toUpperCase() : null);

    // Ưu tiên mã máy nhận diện được (S7-1200, FX3U,...) để ánh xạ tìm kiếm chính
    // xác; nếu không có mã mới dùng keyword do Gemini đưa, cuối cùng mới tới regex type
    let keyword = '';
    if (codeInfo?.keyword) {
        keyword = codeInfo.keyword;
    } else if (typeof raw.keyword === 'string' && raw.keyword.trim() !== '') {
        keyword = raw.keyword.trim();
    } else if (typeInfo.keyword !== null) {
        keyword = typeInfo.keyword;
    }

    return {
        transcript,
        keyword: cleanVoiceKeyword(keyword, brand || rawBrand),
        intent: VALID_INTENTS.includes(raw.intent) ? raw.intent : detectVoiceIntent(transcript),
        filters: {
            brand,
            type,
            code
        }
    };
}


const DEFAULT_PRODUCT_EARN = 25;

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
        set: value => {
            if (value === undefined || value === null) return undefined;
            const normalized = String(value).trim();
            return normalized || undefined;
        },
        sparse: true,  // Sản phẩm chưa có mã sẽ không được đưa vào unique index.
        unique: true   // Nếu có mã thì không được trùng nhau.
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
                importPrice: { type: String, default: "" },
                earn: { type: Number, default: DEFAULT_PRODUCT_EARN },
                imgUrl: { type: String, default: "" },
                color: { type: String, default: "" },
                shape: { type: String, default: "" },
                buttonCount: { type: String, default: "" },
                frame: { type: String, default: "" },
                quantityForSale: { type: Number, default: 0, min: 0 },
                quantityInStorage: { type: Number, default: 0, min: 0 },
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
        }],
        validate: {
            validator: (variants) => {
                const ids = (variants || []).map((item) => String(item?._id || ''));
                return ids.length === new Set(ids).size;
            },
            message: 'Mỗi phiên bản sản phẩm phải có định danh riêng biệt',
        },
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
        min: 0,
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

productSchema.pre('save', function (next) {
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

const stripPrivateVariantFields = (product) => {
    const productObj = product?.toJSON ? product.toJSON() : { ...(product || {}) };
    if (Array.isArray(productObj.variant)) {
        productObj.variant = productObj.variant.map((variant) => {
            const variantObj = variant?.toJSON ? variant.toJSON() : { ...variant };
            delete variantObj.importPrice;
            delete variantObj.earn;
            return variantObj;
        });
    }
    return productObj;
};

const PRODUCT_UPDATE_ALLOWED_FIELDS = [
    'type',
    'name',
    'code',
    'brand',
    'section',
    'value',
    'warranty',
    'waranty',
    'vat',
    'solution',
    'description',
    'features',
    'operatingMethod',
    'advantages',
    'specifications',
    'infoDoc',
    'adjusted',
    'display',
    'nameUnsigned',
];

const VARIANT_METADATA_FIELDS = [
    'price',
    'importPrice',
    'earn',
    'imgUrl',
    'note',
    'color',
    'shape',
    'buttonCount',
    'frame',
];

function pickAllowedProductUpdateFields(body) {
    return PRODUCT_UPDATE_ALLOWED_FIELDS.reduce((update, field) => {
        if (body[field] !== undefined) {
            update[field] = body[field];
        }
        return update;
    }, {});
}

function pickVariantMetadata(body) {
    return VARIANT_METADATA_FIELDS.reduce((update, field) => {
        if (body && body[field] !== undefined) {
            update[field] = body[field];
        }
        return update;
    }, {});
}

async function updateExistingVariantMetadata(productId, incomingVariants, currentProduct) {
    if (!Array.isArray(incomingVariants)) return;

    for (let index = 0; index < incomingVariants.length; index += 1) {
        const incomingVariant = incomingVariants[index];
        const currentVariant = incomingVariant?._id
            ? currentProduct.variant.id(incomingVariant._id)
            : currentProduct.variant[index];
        if (!currentVariant) continue;

        const metadata = pickVariantMetadata(incomingVariant);
        const setUpdate = Object.entries(metadata).reduce((update, [field, value]) => {
            update[`variant.$[target].${field}`] = value;
            return update;
        }, {});
        if (Object.keys(setUpdate).length === 0) continue;

        await Product.updateOne(
            { _id: productId, "variant._id": currentVariant._id },
            { $set: setUpdate },
            { arrayFilters: [{ "target._id": currentVariant._id }], runValidators: true }
        );
    }
}

productSchema.post('init', function (doc) {
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

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: PRODUCT_IMAGE_UPLOAD_SETTINGS.maxSizeBytes },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        const isAllowedMime = PRODUCT_IMAGE_UPLOAD_SETTINGS.allowedMimeTypes.includes(file.mimetype);
        const isAllowedExtension = PRODUCT_IMAGE_UPLOAD_SETTINGS.allowedExtensions.includes(extension);

        if (!isAllowedMime || !isAllowedExtension) {
            return cb(new Error(`Chỉ cho phép upload ảnh: ${PRODUCT_IMAGE_UPLOAD_SETTINGS.allowedExtensions.join(", ")}`));
        }
        cb(null, true);
    }
});

const handleProductImageUpload = (req, res, next) => {
    uploadImage.single('product')(req, res, (error) => {
        if (error) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? `Dung lượng ảnh tối đa ${PRODUCT_IMAGE_UPLOAD_SETTINGS.maxSizeLabel}`
                : error.message || "File ảnh không hợp lệ";

            return res.status(400).json({ success: 0, message });
        }
        next();
    });
};

router.post("/upload/image", [authenticateAdmin, checkAnyPermission(['product.create', 'product.edit']), handleProductImageUpload], (req, res) => {
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
router.delete('/:id/:variantIndex/image', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
router.post('/create', [authenticateAdmin, checkPermission('product.create')], async (req, res) => {
    try {
        const { type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant, section, value, infoDoc, adjusted, vat } = req.body;

        // Kiểm tra trùng lặp mã sản phẩm trước khi tạo mới để tránh trùng lặp
        if (code && code.trim()) {
            const existing = await findProductByEquivalentCode(code);
            if (existing) {
                return res.status(409).json({
                    message: `Mã sản phẩm "${code.trim()}" đã tồn tại (${existing.name}). Vui lòng dùng mã khác.`
                });
            }
        }

        const normalizedVariant = Array.isArray(variant) && variant.length > 0
            ? variant.map((item) => {
                if (!item || typeof item !== 'object') return item;
                const { _id: ignoredVariantId, ...safeItem } = item;
                return safeItem.earn === undefined || safeItem.earn === null || safeItem.earn === ''
                    ? { ...safeItem, earn: DEFAULT_PRODUCT_EARN }
                    : safeItem;
            })
            : undefined;

        const newProduct = new Product({
            type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant: normalizedVariant, section, value, infoDoc, adjusted, vat
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
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Lỗi server" });
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
        let requesterRole = null;
        // Tách riêng phần AND của "search" và của "code" để phễu thu hẹp dần chỉ
        // thay phần search, giữ nguyên các ràng buộc code/type/brand/trạm.
        const searchAndQueries = [];
        const codeAndQueries = [];

        const boundedSearch = limitRegexInput(search);
        const boundedCode = limitRegexInput(code);

        if (boundedSearch && boundedSearch.trim() !== "") {
            // Tách từ khóa tìm kiếm thành các từ đơn để so khớp AND tự do thứ tự
            const tokens = boundedSearch.split(/\s+/).filter(t => t.length > 0);
            tokens.forEach(token => {
                searchAndQueries.push(buildTokenQuery(token));
            });
        }

        if (boundedCode && boundedCode !== "") {
            const fuzzyCodeRegex = generateFuzzyCodeRegex(boundedCode);
            const safeCode = escapeRegex(boundedCode);
            const codeQuery = [
                { code: fuzzyCodeRegex || { $regex: safeCode, $options: "i" } },
                { name: { $regex: safeCode, $options: "i" } }
            ];
            codeAndQueries.push({ $or: codeQuery });
        }

        const andQueries = [...searchAndQueries, ...codeAndQueries];
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
                requesterRole = user?.role || null;
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
        }

        // Phễu thu hẹp dần: nếu AND đầy đủ vẫn ra 0 và câu tìm có >=2 từ thực thể
        // (vd "Tìm van điện khí TTSM1"), cộng dồn từng từ trái->phải, bỏ từ nào
        // làm rớt về 0. Chỉ thay phần search trong $and, giữ nguyên code/type/brand/trạm.
        if (total === 0 && search && search.trim() !== "") {
            const entityTokens = stripSearchStopwords(search);
            if (entityTokens.length >= 2) {
                const runWithTokens = async (subsetTokens) => {
                    const subFilter = { ...filter };
                    const combined = [...subsetTokens.map(buildTokenQuery), ...codeAndQueries];
                    if (combined.length > 0) {
                        subFilter.$and = combined;
                    } else {
                        delete subFilter.$and;
                    }
                    return runQuery(subFilter);
                };
                const narrowed = await greedyNarrowTokens(entityTokens, runWithTokens);
                if (narrowed.total > 0) {
                    products = narrowed.products;
                    total = narrowed.total;
                }
            }
        }

        const processedProducts = products.map(product => {
            const productObj = requesterRole === "customer"
                ? stripPrivateVariantFields(product)
                : product.toJSON();
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

        res.json(products.map(stripPrivateVariantFields));
    } catch (error) {
        console.error("Error fetching top purchased products:", error);
        res.status(500).json({ message: "Lỗi server khi lấy sản phẩm mua nhiều" });
    }
});

router.get('/:_id/admin-detail', [authenticateUser, checkPermission('product.edit')], async (req, res) => {
    try {
        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API lấy thông tin sản phẩm theo ID (Public)
router.get('/:_id', async (req, res) => {
    try {
        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(stripPrivateVariantFields(product));
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API lấy thông tin nhiều sản phẩm qua mảng id
router.post('/fetch-by-ids', async (req, res) => {
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
            const productObj = stripPrivateVariantFields(product);
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
            error: "Lỗi server"
        });
    }
});

router.put('/update-display-field', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
            error: "Lỗi server"
        });
    }
});

// API sửa thông tin sản phẩm
router.put('/:_id', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
    try {
        // Lấy dữ liệu cũ trước khi cập nhật để so sánh
        const oldProduct = await Product.findById(req.params._id);
        if (!oldProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const oldData = oldProduct.toJSON();
        const updateData = pickAllowedProductUpdateFields(req.body);
        const incomingVariants = req.body.variant;

        if (updateData.name !== undefined) {
            updateData.nameUnsigned = removeVietnameseTones(updateData.name);
        }

        if (updateData.code && updateData.code.trim()) {
            const existing = await findProductByEquivalentCode(updateData.code, req.params._id);
            if (existing) {
                return res.status(409).json({
                    message: `Mã sản phẩm "${updateData.code.trim()}" đã tồn tại (${existing.name}). Vui lòng dùng mã khác.`
                });
            }
        }

        let updatedProduct = await Product.findByIdAndUpdate(
            req.params._id,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        await updateExistingVariantMetadata(
            req.params._id,
            incomingVariants,
            oldProduct
        );
        updatedProduct = await Product.findById(req.params._id);

        // So sánh và ghi log các trường thay đổi
        try {
            const fieldsToTrack = ['name', 'code', 'brand', 'type', 'section', 'value', 'warranty', 'vat', 'solution', 'description', 'features', 'operatingMethod', 'advantages', 'specifications'];
            const details = [];
            const newData = updatedProduct.toJSON();

            for (const field of fieldsToTrack) {
                if (updateData[field] !== undefined) {
                    const oldVal = (oldData[field] || '').toString();
                    const newVal = (newData[field] || '').toString();
                    if (oldVal !== newVal) {
                        details.push({ field, oldValue: oldVal, newValue: newVal });
                    }
                }
            }

            // So sánh variant nếu có trong body
            if (Array.isArray(incomingVariants)) {
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
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API tăng hoặc giảm số lượng sản phẩm đã mua
router.put("/purchase/:_id", [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
    try {
        const { action, amount } = req.body; // action: "increase" hoặc "decrease", amount: số lượng thay đổi
        const numericAmount = parseInt(amount, 10);

        if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
            return res.status(400).json({ message: "Mã sản phẩm không hợp lệ" });
        }
        if (!["increase", "decrease"].includes(action) || isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
        }

        const delta = action === "increase" ? numericAmount : -numericAmount;
        const filter = { _id: req.params._id };
        if (delta < 0) {
            filter.purchaseCount = { $gte: numericAmount };
        }
        const product = await Product.findOneAndUpdate(
            filter,
            { $inc: { purchaseCount: delta } },
            { new: true, runValidators: true }
        );
        if (!product) {
            const exists = await Product.exists({ _id: req.params._id });
            return res.status(exists ? 400 : 404).json({
                message: exists
                    ? "Số lượng đã mua không đủ để giảm"
                    : "Sản phẩm không tồn tại",
            });
        }

        res.json({ message: "Cập nhật thành công", purchaseCount: product.purchaseCount });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API xóa ảnh tạm quét AI để tránh rác ổ cứng (Đặt trước API xóa sản phẩm có param /:_id)
router.delete('/clean-temp-image', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
        res.status(500).json({ success: 0, message: "Lỗi server khi xóa ảnh tạm." });
    }
});

// API xóa nhiều sản phẩm hàng loạt (bulk delete)
router.post('/bulk-delete', [authenticateAdmin, checkPermission('product.delete')], async (req, res) => {
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
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API xóa sản phẩm
router.delete('/:_id', [authenticateAdmin, checkPermission('product.delete')], async (req, res) => {
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
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API thêm mới variant 
router.post('/:id/variant', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
    const { id } = req.params;
    const { _id: ignoredVariantId, ...newVariant } = req.body || {};
    try {
        const product = await Product.findByIdAndUpdate(
            id,
            { $push: { variant: newVariant } },
            { new: true, runValidators: true }
        );
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

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
        return res.status(err.name === 'ValidationError' ? 400 : 500).json({
            message: err.name === 'ValidationError' ? err.message : 'Server error',
        });
    }
});

// API thay đổi thuộc tính display của sản phẩm
router.put('/:_id/toggle-display', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
            error: "Lỗi server"
        });
    }
});

// API để cập nhật số lượng bằng variantIndex
router.post("/:id/:variantIndex", [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { quantity, orderId, orderName, isAIScan } = req.body;
    const userName = req.user.name;

    try {
        const product = await Product.findById(id)
            .select('name variant._id variant.quantityForSale variant.quantityInStorage');
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: "Invalid variant index" });
        }

        const change = Number(quantity);
        if (isNaN(change)) {
            return res.status(400).json({ message: "Quantity must be a number" });
        }
        if (change === 0) {
            return res.status(400).json({ message: "Số lượng thay đổi phải khác 0" });
        }

        const appliedAdjustments = await applyStockAdjustments([{
            productId: id,
            variantIndex: index,
            expectedVariantId: product.variant[index]._id,
            quantityForSaleDelta: change,
            quantityInStorageDelta: change,
        }]);

        let history;
        try {
            history = await new StorageHistory({
                productId: id,
                productName: product.name,
                quantity: change,
                userName: userName,
                orderId: orderId,
                orderName: orderName,
                isAIScan: !!isAIScan,
                source: "product_manual"
            }).save();
        } catch (error) {
            await rollbackOrThrow(appliedAdjustments, error);
        }

        const updatedProduct = await Product.findById(id);

        return res.status(200).json({
            message: "Quantity updated & history saved",
            product: updatedProduct,
            history
        });
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json({
            message: error.statusCode ? error.message : "Server error"
        });
    }
});

// API chỉnh sửa variant đang tồn tại
router.put('/:id/:variantIndex', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const variantData = pickVariantMetadata(req.body);
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
        const variantId = product.variant[index]._id;
        const setUpdate = Object.entries(variantData).reduce((update, [field, value]) => {
            update[`variant.$[target].${field}`] = value;
            return update;
        }, {});

        let updatedProduct = product;
        if (Object.keys(setUpdate).length > 0) {
            updatedProduct = await Product.findOneAndUpdate(
                { _id: id, "variant._id": variantId },
                { $set: setUpdate },
                {
                    new: true,
                    runValidators: true,
                    arrayFilters: [{ "target._id": variantId }],
                }
            );
        }

        if (!updatedProduct) {
            return res.status(409).json({
                message: 'Phiên bản sản phẩm đã thay đổi, vui lòng tải lại dữ liệu.'
            });
        }

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
                    productId: updatedProduct._id,
                    productName: updatedProduct.name,
                    details
                }).save();
            }
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Variant updated successfully',
            product: updatedProduct,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API xóa variant
router.delete('/:id/:variantIndex', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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

        if (product.variant.length === 1) {
            return res.status(400).json({
                message: 'Sản phẩm phải còn ít nhất một phiên bản.'
            });
        }
        if (index !== product.variant.length - 1) {
            return res.status(400).json({
                message: 'Chỉ được xóa phiên bản cuối cùng để không làm lệch phiên bản trong các đơn hàng cũ.'
            });
        }

        const deletedVariant = product.variant[index];
        if (
            Number(deletedVariant.quantityForSale || 0) !== 0 ||
            Number(deletedVariant.quantityInStorage || 0) !== 0
        ) {
            return res.status(400).json({
                message: 'Không thể xóa phiên bản vẫn còn tồn kho hoặc tồn khả dụng.'
            });
        }
        const updatedProduct = await Product.findOneAndUpdate(
            {
                _id: id,
                variant: {
                    $elemMatch: {
                        _id: deletedVariant._id,
                        quantityForSale: 0,
                        quantityInStorage: 0,
                    },
                },
            },
            { $pull: { variant: { _id: deletedVariant._id } } },
            { new: true, runValidators: true }
        );
        if (!updatedProduct) {
            return res.status(409).json({
                message: 'Phiên bản vừa được thay đổi bởi thao tác khác, vui lòng tải lại dữ liệu.'
            });
        }

        // Ghi log hoạt động
        try {
            await new ActivityLog({
                userName: req.user.name,
                action: 'delete_variant',
                productId: updatedProduct._id,
                productName: updatedProduct.name,
                details: [{ field: `variant[${index}]`, oldValue: `Giá: ${deletedVariant.price || '0'}, Giá nhập: ${deletedVariant.importPrice || '0'}`, newValue: '' }]
            }).save();
        } catch (logErr) { console.error('ActivityLog error:', logErr.message); }

        return res.status(200).json({
            message: 'Variant deleted successfully',
            product: updatedProduct,
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
        console.error("Error fetching product reviews:", error);
        res.status(500).json({ message: "Lỗi server khi lấy đánh giá sản phẩm" });
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
        res.status(500).json({ message: 'Internal server error' });
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

        const isOwner = review.email === req.user.email;
        const isModerator = req.user.role === "admin" || req.user.role === "superadmin" || req.user.role === "staff";
        if (!isOwner && !isModerator) {
            return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa đánh giá này." });
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
        res.status(500).json({ message: 'Internal server error' });
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

        const isOwner = review.email === req.user.email;
        const isModerator = req.user.role === "admin" || req.user.role === "superadmin" || req.user.role === "staff";
        if (!isOwner && !isModerator) {
            return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa đánh giá này." });
        }

        // Remove the review
        product.totalRating -= review.rating;
        product.reviews.pull(reviewId);
        product.reviewCount = product.reviews.length;
        product.averageReviews = product.reviewCount > 0 ? product.totalRating / product.reviewCount : 0;

        await product.save();

        res.status(200).json({ message: 'Review deleted successfully', product });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// API thay đổi earn và cập nhật price (làm tròn lên hàng nghìn)
router.put('/:id/:variantIndex/update-earn', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
        return res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id/:variantIndex/update-import-price', [authenticateAdmin, checkPermission('product.edit')], async (req, res) => {
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
        return res.status(500).json({ message: 'Server error' });
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
        res.status(500).json({ message: 'Server error' });
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
router.post('/scan-invoice', [
    authenticateAdmin,
    checkAnyPermission(['order.scan_ai', 'iporder.scan_ai', 'eporder.scan_ai']),
    uploadMemory.single('invoice')
], async (req, res) => {
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
        const systemPrompt = `Bạn là một AI phân tích hình ảnh hóa đơn/phiếu xuất kho chuyên nghiệp, xử lý được nhiều định dạng khác nhau: hóa đơn bán lẻ viết tay, hóa đơn in từ máy tính tiền, phiếu xuất kho có mã PO, và hóa đơn in kim (dot-matrix).
Nhiệm vụ của bạn là đọc hình ảnh hóa đơn được gửi lên và trích xuất danh sách các mặt hàng (sản phẩm), bao gồm các thông tin: số thứ tự (stt), tên sản phẩm đọc được (rawScannedName), mã sản phẩm nếu có (code), hãng/nhà sản xuất nếu có (brand), số lượng (quantity), đơn giá (price), đơn vị tính (unit), thuế suất VAT (vat), tiền thuế của dòng (taxAmount) và ghi chú (note).

Hướng dẫn trích xuất:
- NHIỀU HÓA ĐƠN TRONG 1 ẢNH: Một ảnh có thể chứa NHIỀU hóa đơn độc lập đặt cạnh nhau (ví dụ 2 tờ "Đơn 1", "Đơn 2" chụp chung 1 khung hình — mỗi tờ có bảng "Tên hàng/Số lượng/Đơn giá/Thành tiền" và dòng "Cộng" riêng). Khi đó, hãy trích xuất TẤT CẢ sản phẩm của mọi hóa đơn vào cùng một mảng JSON, theo thứ tự từ trái sang phải, trên xuống dưới. Đối chiếu tổng tiền (xem mục dưới) phải thực hiện RIÊNG cho từng hóa đơn, không cộng gộp các hóa đơn với nhau.
- Trường \`stt\` phải lấy chính xác số thứ tự hoặc số dòng được ghi trực tiếp trên hóa đơn cho mặt hàng đó (giữ nguyên định dạng gốc như "01", "1", "A" trên hóa đơn). Nếu cột số thứ tự trên hóa đơn bị để trống hoặc không được ghi số thứ tự cụ thể (chỉ ghi dấu * hoặc bỏ trống), bạn BẮT BUỘC phải tự động đánh số thứ tự tuần tự tăng dần từ 1 cho đến hết (1, 2, 3, 4...) cho các dòng mặt hàng. Ngược lại, nếu hóa đơn CÓ ghi STT nhưng KHÔNG liên tục (ví dụ 1, 6, 7, 12...), hãy GIỮ NGUYÊN số gốc, không tự "sửa" lại cho liền mạch.
- Trường \`code\` chỉ lấy mã sản phẩm, mã hàng, hoặc model thực tế của sản phẩm (ví dụ: "GW1S-3E20", "NFO-40 500/5A"). Tuyệt đối KHÔNG gộp hoặc điền mã PO (Purchase Order - ví dụ: "SOHL2606183B1D4B"), mã đơn mua hàng, số hóa đơn, số lô (Lot number), hoặc các mã quản lý kho riêng của nhà cung cấp vào trường này. Nếu phát hiện một mã PO/mã quản lý giống hệt nhau lặp đi lặp lại ở tất cả các dòng của hóa đơn, bạn phải LOẠI BỎ hoàn toàn phần mã lặp lại đó ra khỏi trường \`code\`, chỉ giữ lại phần model thực của sản phẩm ở phía sau.
- Trường \`brand\` là tên hãng/nhà sản xuất được ghi trên hóa đơn cho sản phẩm đó (ví dụ: Siemens, Mitsubishi, LS, Schneider). Nếu hóa đơn không ghi hãng hoặc không đọc chắc chắn được thì đặt là null. TUYỆT ĐỐI không suy đoán hoặc bịa hãng.
- BẮT BUỘC ĐỌC ĐỦ MÃ HÀNG TỪNG DÒNG (CỰC KỲ QUAN TRỌNG): Hóa đơn thường có một cột "Mã hàng"/"Mã SP"/"Model" riêng biệt (tách rời với cột "Mã số PO"). Gần như MỌI dòng sản phẩm đều có mã hàng thực ở cột này. Bạn phải quét kỹ cột đó cho TỪNG dòng và điền vào trường \`code\`. TUYỆT ĐỐI KHÔNG để trống \`code\` khi trong dòng đó có bất kỳ chuỗi nào trông giống mã model (có chứa cả chữ và số, hoặc có dấu gạch nối "-", dấu gạch chéo "/", ví dụ: "NFO-40 500/5A", "GW1S-3E20", "RN2S-NL-D24", "S-T10 AC200V"). Nếu nét chữ ở cột mã hàng bị mờ/khó đọc, hãy cố suy luận và đọc gần đúng nhất chứ KHÔNG được bỏ trống trường \`code\`. Chỉ để \`code\` là chuỗi rỗng khi dòng đó thật sự không có cột mã hàng hoặc là dòng tiêu đề phân loại.
- LƯU Ý PHÂN BIỆT CỘT: Đừng vì cột "Mã số PO" (mã dài lặp lại như "SOHL260618A52FC4") nằm sát bên trái mà bỏ qua hoặc nhầm lẫn cột "Mã hàng" thực nằm ngay cạnh nó. Hai cột này độc lập: cột PO thì loại bỏ, cột mã hàng thì phải đọc và giữ lại.
- Trường \`vat\` là thuế suất VAT đọc được từ hóa đơn cho mặt hàng đó (ví dụ: "10%", "8%", "0%", hoặc null nếu không có/không đọc được). Nếu hóa đơn không có cột thuế riêng từng dòng mà chỉ ghi MỘT mức thuế suất chung ở cuối (ví dụ "Thuế suất GTGT: 8%"), hãy áp mức đó cho \`vat\` của TẤT CẢ các dòng thuộc hóa đơn.
- Trường \`taxAmount\` là SỐ TIỀN THUẾ GTGT của riêng dòng sản phẩm đó (cột "Tiền thuế"/"Tiền thuế GTGT" trên hóa đơn), là một số nguyên (đơn vị VND), ví dụ cột ghi "57,754" -> 57754. Nếu hóa đơn có sẵn cột "Tiền thuế" cho từng dòng thì lấy đúng con số đó. Nếu hóa đơn CHỈ có cột \`% Thuế\`/thuế suất mà KHÔNG có cột tiền thuế riêng, hãy tự tính: \`taxAmount = round([Thành tiền] x [thuế suất %] / 100)\` (ví dụ Thành tiền 721.920, thuế 8% -> taxAmount = 57754). Nếu dòng không chịu thuế hoặc không đọc được thuế suất, để \`taxAmount\` là 0. Hãy đối chiếu tổng các \`taxAmount\` của mọi dòng với dòng "Tiền thuế GTGT" tổng ở cuối hóa đơn (nếu có) để tự kiểm tra và sửa các dòng đọc sai trước khi xuất JSON.
- Trường \`price\` là đơn giá thực tế của sản phẩm. Nếu hóa đơn không có cột Đơn giá (hoặc các giá trị tương đương), bạn phải để trống hoặc gán null cho trường \`price\`. Tuyệt đối KHÔNG tự ý suy đoán đơn giá hoặc lấy các con số khác (ví dụ: số mét đầu/cuối của cuộn dây cáp ở cột Ghi chú như "1050 - 750", số thứ tự, số lượng, hoặc số điện thoại) để điền vào trường \`price\`.
- Trường \`quantity\` là số dương, KHÔNG bắt buộc phải nguyên: với đơn vị đo lường (kg, mét, lít, m2...) có thể là số thập phân (ví dụ "2,2kg" -> 2.2); với đơn vị đếm (cái, bộ, đôi, chiếc...) phải là số nguyên. Hãy loại bỏ dấu chấm phân cách hàng nghìn và đơn vị VND, nhưng GIỮ ĐÚNG dấu phẩy/chấm thập phân theo ngữ cảnh (tuyệt đối không nhầm "2,2" thành "22").
- Trường \`unit\` là đơn vị tính đọc được trên hóa đơn (ví dụ: cái, bộ, mét...). Một số hóa đơn KHÔNG có cột đơn vị riêng mà viết chung số lượng với đơn vị trong 1 ô (ví dụ "1kg", "5 đôi", "2,2kg", "40"): khi đó hãy TÁCH phần số vào \`quantity\` và phần chữ vào \`unit\`. Nếu ô chỉ có số thì để \`unit\` rỗng.
- NGUYÊN TẮC DÒNG ĐỐI DÒNG VÀ PHÂN TÍCH KÝ TỰ ĐẦU DÒNG (CỰC KỲ QUAN TRỌNG):
  + NHẬN DIỆN KÝ TỰ ĐẦU DÒNG (DẤU SAO * HOẶC MŨI TÊN ↓): Hãy chú ý các ký tự viết tay ở đầu cột tên hàng (ví dụ dấu sao "*", hoặc ký hiệu mũi tên đi xuống "↓"). Đây là ký hiệu bắt đầu một dòng sản phẩm độc lập. 
  + KHÔNG GỘP TIÊU ĐỀ NHÓM: Các dòng ghi tiêu đề nhóm hoặc thông tin phụ (Ví dụ: "8.8 Đen" ở hóa đơn 1, "8.8 Mạ" ở hóa đơn 2) không có ký tự "*" ở đầu và dòng đó trống trơn số liệu (số lượng/giá). Đây là dòng tiêu đề phân loại hoặc ghi chú chứ không phải tên dài xuống dòng (vì chữ viết còn rất ngắn chưa chạm mép lề). Bạn BẮT BUỘC phải xuất dòng tiêu đề này thành một phần tử riêng trong JSON với "quantity" là 0 và "price" là 0. TUYỆT ĐỐI KHÔNG gộp dòng này với sản phẩm có dấu "*" ở phía dưới (như "* 30x120+ê VP"), vì sẽ làm đẩy lệch toàn bộ cột số lượng và đơn giá của các sản phẩm bên dưới lên 1 hàng.
  + ĐỐI VỚI CÁC SẢN PHẨM ĐỘC LẬP: Xuất kết quả nghiêm ngặt theo từng dòng vật lý (line-by-line). Nếu một sản phẩm bị trống số lượng hoặc giá tiền, bạn vẫn phải xuất dòng đó thành một sản phẩm riêng biệt và gán giá trị 0 cho "quantity" và "price". Tuyệt đối KHÔNG lấy số liệu của các dòng phía dưới để điền bù lên dòng trống này.
  + TÊN SẢN PHẨM TRÀN XUỐNG DÒNG DƯỚI: Nếu một dòng phía dưới KHÔNG có ký tự "*" ở đầu, KHÔNG có số liệu riêng (số lượng/giá trống), mà chữ ở dòng trên đã chạm sát lề phải → đây là phần tên bị xuống dòng của sản phẩm phía trên. Hãy GỘP phần chữ đó vào cuối "rawScannedName" của dòng trên, KHÔNG tách thành sản phẩm mới.
- BỎ QUA DÒNG KHÔNG PHẢI SẢN PHẨM: Không xuất các dòng tổng kết hoặc phụ phí thành mặt hàng, ví dụ: "Cộng", "Tổng cộng", "Tổng cộng tiền thanh toán", "Thành tiền", "V.chuyển"/"Vận chuyển"/phí ship, "Mang sang"/"Chuyển sang", dòng thuế GTGT tổng. Các dòng này chỉ dùng để đối chiếu tổng tiền (xem mục dưới), KHÔNG đưa vào danh sách items. (NGOẠI LỆ QUAN TRỌNG: xem quy tắc ngay bên dưới về sản phẩm viết chen vào ô/dòng "Cộng" — không được vì thấy chữ "Cộng" mà bỏ luôn sản phẩm thật viết cạnh nó.)
- SẢN PHẨM VIẾT CHEN VÀO Ô/DÒNG "CỘNG" (LỖI RẤT THƯỜNG GẶP Ở HÓA ĐƠN VIẾT TAY - CỰC KỲ QUAN TRỌNG): Khi người viết dùng hết các dòng trống của bảng, họ thường viết chèn thêm 1-2 sản phẩm cuối cùng vào CHÍNH ô "Cộng" hoặc khoảng trống ngay cạnh/phía trên dòng "Cộng" (ví dụ các mặt hàng ngắn như "ecu", "ren", "long đen" kèm số lượng/đơn giá). Do đó, dòng có chữ "Cộng" KHÔNG mặc nhiên là dòng cuối cùng và KHÔNG phải toàn bộ dòng đó đều là dòng tổng kết. Bạn BẮT BUỘC phải quét thật kỹ vùng bên trong và xung quanh ô "Cộng": nếu ở đó có tên hàng viết tay đi kèm số lượng và/hoặc đơn giá, thì đó là SẢN PHẨM THẬT, phải tách thành (các) phần tử riêng trong JSON, TUYỆT ĐỐI KHÔNG được bỏ qua. Chỉ được bỏ đúng chữ "Cộng" và con số tổng tiền tương ứng của nó mà thôi. Đồng thời, việc có chữ "Cộng" ở khu vực này TUYỆT ĐỐI KHÔNG được làm bạn cắt mất hoặc đọc lệch (dịch lên/xuống 1 hàng) cột số lượng và đơn giá của các dòng sản phẩm cuối cùng nằm sát dòng "Cộng"; hãy neo từng con số theo đúng hàng vật lý của nó rồi mới xét dòng "Cộng".
- BỎ QUA KÝ HIỆU KIỂM TRA NỘI BỘ: Các dấu tick/check (✓, √) hoặc dấu gạch chéo (×) xuất hiện lặp lại bên cạnh cột số lượng/đơn giá là ký hiệu nhân viên đã đối chiếu — KHÔNG phải dữ liệu, bỏ qua hoàn toàn, không đưa vào bất kỳ trường nào. LƯU Ý PHÂN BIỆT với con số viết tay trong ngoặc đơn cạnh 1 dòng cụ thể (ví dụ "(2)", "(10)") — đây thường là chú thích số lượng thực giao/thiếu, hãy xử lý theo mục "Ghi chú tay" bên dưới.
- GHI CHÚ TAY GẮN VỚI DÒNG CỤ THỂ: Nếu hóa đơn có ghi chú viết tay ở lề hoặc cuối trang đề cập một STT/mục cụ thể (ví dụ "Giao thiếu mục 5: 2 cái"), hãy gắn nội dung đó vào trường "note" của ĐÚNG dòng có STT tương ứng (note của dòng STT=5 → "Giao thiếu 2 cái so với hóa đơn"). TUYỆT ĐỐI KHÔNG thay đổi "quantity" gốc của dòng đó — quantity giữ nguyên theo số hóa đơn ghi, ghi chú chỉ bổ sung thông tin. Trường "note" CHỈ dùng cho: (a) ghi chú tay có thật trên hóa đơn gắn với dòng đó, hoặc (b) diễn giải điều chỉnh do phép nhân toán học (xem mục dưới). Không tự bịa thêm diễn giải.
- KIỂM TRA PHÉP NHÂN TOÁN HỌC (CỰC KỲ QUAN TRỌNG): Đối với hóa đơn viết tay, các nét chữ số lượng và đơn giá rất dễ bị nhận diện nhầm (ví dụ: số 42 trông giống số 12, hoặc số 4.000 bị nhầm với số 40.000). Bạn BẮT BUỘC phải thực hiện phép nhân nhẩm: [Số lượng (quantity)] x [Đơn giá (price)] và đối chiếu xem kết quả có trùng khớp với con số ở cột [Thành tiền] được ghi trên hóa đơn cho dòng sản phẩm đó hay không. Nếu không khớp, hãy dùng phép tính toán học để suy ngược lại và tự điều chỉnh số lượng hoặc đơn giá cho chính xác trước khi xuất kết quả JSON (Ví dụ: nếu đơn giá là 12.500 và thành tiền ghi là 525.000, thì số lượng bắt buộc phải là 42 chứ không thể là 12). Khi tự điều chỉnh như vậy, hãy ghi lại vào "note" của dòng đó (ví dụ: "Đã tự điều chỉnh số lượng từ 12 thành 42 theo thành tiền 525.000"). Nếu cả 3 giá trị đều mờ/khó đọc, ưu tiên giữ con số [Thành tiền] rõ/đậm nhất làm chuẩn để suy ngược.
- ĐỐI CHIẾU TỔNG TIỀN TOÀN HÓA ĐƠN (bước suy luận nội bộ, KHÔNG xuất ra JSON): Sau khi trích xuất hết các dòng, hãy tự cộng [Thành tiền] của tất cả sản phẩm và so với số ghi ở dòng "Cộng"/"Tổng cộng tiền thanh toán" (đối chiếu thêm dòng "viết bằng chữ" nếu có, vì chữ ít bị nhầm nét hơn số). Nếu tổng tự tính KHÁC tổng ghi trên hóa đơn, đây là tín hiệu ít nhất một dòng đã đọc sai — hãy rà lại các dòng có số liệu mờ nhất và ưu tiên sửa theo hướng khớp với tổng đã ghi, trước khi xuất kết quả cuối cùng.
- ẢNH KHÔNG PHẢI HÓA ĐƠN / KHÔNG ĐỌC ĐƯỢC: Nếu ảnh không chứa hóa đơn nào hoặc quá mờ để đọc bất kỳ dòng nào, hãy trả về một mảng rỗng [] — TUYỆT ĐỐI KHÔNG bịa dữ liệu.

Định dạng phản hồi BẮT BUỘC là một mảng JSON trực tiếp (không nằm trong thẻ markdown \`\`\`json và không có văn bản giải thích đi kèm):
[
  {
    "stt": "1",
    "rawScannedName": "Tên sản phẩm đọc được từ ảnh hóa đơn",
    "code": "Mã sản phẩm đọc được từ ảnh hóa đơn (nếu có)",
    "brand": "Siemens",
    "quantity": 10,
    "price": 150000,
    "unit": "cái",
    "vat": "10%",
    "taxAmount": 150000,
    "note": "Ghi chú nếu có"
  }
]`;

        // 4. Gọi API Gemini bằng fetch có hỗ trợ Fallback tự động khi quá tải (503) hoặc hết quota ngày
        const modelsToTry = [
            'gemini-3.5-flash',       // Ưu tiên 1: Bản 3.5 ổn định, tốt nhất
            'gemini-2.5-flash',       // Ưu tiên 2: Bản 2.5 ổn định, phổ biến
            'gemini-3.1-flash-lite',  // Ưu tiên 3: Bản 3.1 Lite ổn định, quota 500 RPD
            'gemini-2.5-flash-lite',  // Ưu tiên 4: Bản 2.5 Lite ổn định
            'gemini-3-flash-preview'  // Ưu tiên 5: Bản Preview dòng 3
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

        const BrandModel = mongoose.models.Brand;
        const brandDocs = BrandModel
            ? await BrandModel.find().select('Brand').lean()
            : [];

        // 5. Tự động so khớp sản phẩm trong Database bằng Javascript (Nhanh và chính xác)
        const matchedItems = items.map(item => {
            const resolvedBrand = resolveBrand(item.brand, brandDocs);
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
                brand: resolvedBrand.brand,
                brandIsNew: resolvedBrand.brandIsNew,
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
            message: `Đã xảy ra lỗi khi phân tích hóa đơn bằng AI: ${"Lỗi server"}`,
            error: "Lỗi server"
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
router.post('/voice-query', [authenticateUser, uploadAudio.single('audio')], async (req, res) => {
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

        const systemPrompt = `Bạn là trợ lý ảo thông minh phụ trách quản lý kho hàng của công ty thiết bị điện/thiết bị tự động hóa TTSmart.
Hãy nghe file âm thanh được cung cấp (giọng nói tiếng Việt của người dùng) và thực hiện 2 nhiệm vụ:
1. Ghi lại chính xác (transcribe) những gì người dùng đã nói (giữ nguyên tiếng Việt có dấu, viết hoa các từ cần thiết như Siemens, Mitsubishi, GPC1202, S7-1200, FX3U,...).
2. Phân tích ý định (intent) của người dùng để trích xuất ra từ khóa tìm kiếm chính (keyword) và các bộ lọc (filters) thích hợp, tối ưu hóa cho tất cả các cách gọi khác nhau của người dùng.

CƠ SỞ DỮ LIỆU ĐANG CÓ SẴN CÁC THƯƠNG HIỆU (BRANDS) VÀ LOẠI SẢN PHẨM (TYPES) SAU:
- Thương hiệu khả dụng: ${VOICE_BRANDS.map(b => `'${b}'`).join(', ')}
- Loại sản phẩm khả dụng: ${VOICE_TYPES.map(t => `'${t}'`).join(', ')}

BẢNG ÁNH XẠ CÁCH ĐỌC LÓNG (tự động cập nhật khi admin thêm từ mới; cách đọc đã bỏ dấu):
- Thương hiệu: ${VOICE_BRAND_ALIASES.map(([b, a]) => `${a.map(x => `"${x}"`).join('/')} -> ${b}`).join('; ')}
- Loại sản phẩm: ${VOICE_TYPE_ALIASES.map(([t, , a]) => `${a.map(x => `"${x}"`).join('/')} -> ${t}`).join('; ')}
- Ý định: ${VOICE_INTENT_ALIASES.map(([id, , a]) => `${a.map(x => `"${x}"`).join('/')} -> ${id}`).join('; ')}

Quy tắc phân tách và xử lý từ khóa:
- Intent chỉ được là một trong các giá trị: ${VALID_INTENTS.map(i => `"${i}"`).join(', ')}. Nếu người dùng chỉ hỏi/xem/tra cứu sản phẩm thì dùng "search_product". Nếu câu là lệnh thêm vào giỏ thì dùng "add_to_cart"; lệnh sửa/cập nhật thì dùng "update_item"; lệnh xóa/bỏ/hủy thì dùng "delete_item". Dù intent là thêm/sửa/xóa, vẫn phải trích xuất keyword và filters như bình thường; không tự thực hiện thao tác giỏ hàng hay đơn hàng.
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

10. Người dùng nói: "thêm biến tần omron"
-> transcript: "thêm biến tần omron", keyword: "biến tần", intent: "add_to_cart", filters: { brand: "Omron", type: "Biến tần", code: null }

11. Người dùng nói: "cập nhật plc siemens"
-> transcript: "cập nhật plc siemens", keyword: "PLC", intent: "update_item", filters: { brand: "Siemens", type: "PLC", code: null }

12. Người dùng nói: "xóa fx3u"
-> transcript: "xóa fx3u", keyword: "FX3U", intent: "delete_item", filters: { brand: "Mitsubishi", type: "PLC", code: "FX3U" }

Định dạng phản hồi BẮT BUỘC là một đối tượng JSON trực tiếp (không nằm trong thẻ markdown và không có văn bản giải thích đi kèm):
{
  "transcript": "...",
  "keyword": "...",
  "intent": "search_product | add_to_cart | update_item | delete_item",
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
                filters: { brand: null, type: null, code: null }
            });
            return res.json({
                success: 1,
                ...fallbackResult
            });
        }

        const normalizedResult = normalizeVoiceQueryResult(resultObj);
        res.json({
            success: 1,
            ...normalizedResult
        });

    } catch (error) {
        console.error('Lỗi khi phân tích giọng nói bằng AI:', error);
        res.status(500).json({
            success: 0,
            message: `Đã xảy ra lỗi khi phân tích giọng nói bằng AI: ${"Lỗi server"}`,
            error: "Lỗi server"
        });
    }
});

// API Tìm kiếm bằng "giọng nói dạng chữ" để test khi máy không có micro.
// Nhận { text } coi như transcript đã nghe được, chạy đúng pipeline chuẩn hóa
// (normalizeVoiceQueryResult) như voice-query nhưng bỏ qua bước gọi Gemini.
router.post('/voice-query-text', authenticateUser, async (req, res) => {
    try {
        const text = String(req.body?.text || '').trim();
        if (!text) {
            return res.status(400).json({ success: 0, message: 'Vui lòng nhập câu tìm kiếm.' });
        }

        // Bản text không qua Gemini nên phải tự bóc động từ/stopword ("tìm", "cho tôi xem"...)
        // để keyword không dính chữ dẫn. Voice thật thì Gemini đã bóc sẵn.
        const strippedTokens = stripSearchStopwords(text);
        const cleanedKeyword = strippedTokens.length > 0 ? strippedTokens.join(' ') : text;

        const normalizedResult = normalizeVoiceQueryResult({
            transcript: text,
            keyword: cleanedKeyword,
            filters: { brand: null, type: null, code: null }
        });

        res.json({
            success: 1,
            ...normalizedResult
        });
    } catch (error) {
        console.error('Lỗi khi phân tích câu tìm kiếm dạng chữ:', error);
        res.status(500).json({
            success: 0,
            message: `Đã xảy ra lỗi khi phân tích câu tìm kiếm: ${"Lỗi server"}`
        });
    }
});

// Export router
module.exports = {
    Product,
    router,
    uploadImage,
    normalizeVoiceQueryResult,
    stripSearchStopwords,
    buildTokenQuery,
    greedyNarrowTokens,
    refreshVoiceVocab,
    normalizeBrandKey,
    resolveBrand
};
