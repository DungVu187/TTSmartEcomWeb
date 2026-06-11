const express = require('express');
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const fs = require('fs').promises;
const multer = require('multer');
const path = require('path');
require("dotenv").config();
const router = express.Router();

// Schema cho Manage
const manageSchema = new mongoose.Schema({
    overViewImg: {
        type: [String],
        default: []
    },
    partners: {
        type: [String],
        default: []
    },
    newProductUrl: {
        type: String,
        default: ''
    },
    topPurchaseUrl: {
        type: String,
        default: ''
    },
    highestRatingUrl: {
        type: String,
        default: ''
    },
    introduction: {
        type: String,
        default: ''
    },
    mainPolicy: {
        type: String,
        default: ''
    },
    section1: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section2: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section3: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section4: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section5: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section6: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section7: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section8: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section9: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
    section10: {
        name: {
            type: String,
            default: ''
        },
        productId: {
            type: [String],
            default: []
        },
        display: {
            type: Boolean,
            default: true
        }
    },
});

const Manage = mongoose.model("Manage", manageSchema);

// Cấu hình multer với giới hạn file và kiểm tra loại file
const storage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Chỉ cho phép upload file ảnh!'));
        }
        cb(null, true);
    }
});

// GET: Lấy dữ liệu Manage
router.get("/", async (req, res) => {
    try {
        const manageData = await Manage.findOne();
        if (!manageData) {
            return res.status(404).json({
                success: 0,
                message: "Chưa có dữ liệu Manage"
            });
        }
        res.json({
            success: 1,
            data: manageData
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi lấy dữ liệu",
            error: error.message
        });
    }
});

// PUT: Cập nhật ảnh cho topPurchaseUrl, highestRatingUrl, hoặc newProductUrl
router.put("/update", [authenticateAdmin, checkPermission('update_product')], upload.array('manage', 1), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng upload một file ảnh"
            });
        }

        let manage = await Manage.findOne();
        const updateData = {};
        const imgUrl = `${process.env.ADDRESS}/images/${req.files[0].filename}`;

        if (req.body.topPurchaseUrl && req.body.highestRatingUrl) {
            return res.status(400).json({
                success: 0,
                message: "Chỉ được cập nhật một trường: topPurchaseUrl hoặc highestRatingUrl"
            });
        }

        // Xóa ảnh cũ nếu có
        if (manage) {
            if (req.body.topPurchaseUrl && manage.topPurchaseUrl) {
                const oldFilePath = path.join(__dirname, '../upload/images', path.basename(manage.topPurchaseUrl));
                try {
                    await fs.unlink(oldFilePath);
                } catch (e) {
                    console.log('Không xóa được ảnh cũ:', e);
                }
                updateData.topPurchaseUrl = imgUrl;
            } else if (req.body.highestRatingUrl && manage.highestRatingUrl) {
                const oldFilePath = path.join(__dirname, '../upload/images', path.basename(manage.highestRatingUrl));
                try {
                    await fs.unlink(oldFilePath);
                } catch (e) {
                    console.log('Không xóa được ảnh cũ:', e);
                }
                updateData.highestRatingUrl = imgUrl;
            }
        } else {
            if (req.body.topPurchaseUrl) updateData.topPurchaseUrl = imgUrl;
            if (req.body.highestRatingUrl) updateData.highestRatingUrl = imgUrl;
        }

        let updatedManage;
        if (manage) {
            updatedManage = await Manage.findOneAndUpdate({}, { $set: updateData }, { new: true });
        } else {
            updatedManage = await new Manage(updateData).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật",
            error: error.message
        });
    }
});

// POST: Thêm ảnh vào overViewImg
router.post("/update-images", [authenticateAdmin, checkPermission('update_product')], upload.array('manage', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng upload ít nhất một file ảnh"
            });
        }

        let manage = await Manage.findOne();
        if (!manage) {
            manage = new Manage({ overViewImg: [] });
        }

        const newImgUrls = req.files.map(file => `${process.env.ADDRESS}/images/${file.filename}`);
        manage.overViewImg = [...manage.overViewImg, ...newImgUrls];

        await manage.save();
        res.json({
            success: 1,
            message: "Cập nhật mảng ảnh thành công",
            data: manage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật mảng ảnh",
            error: error.message
        });
    }
});

// POST: Thêm ảnh vào partners
router.post("/update-partners", [authenticateAdmin, checkPermission('update_product')], upload.array('manage', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng upload ít nhất một file ảnh"
            });
        }

        let manage = await Manage.findOne();
        if (!manage) {
            manage = new Manage({ partners: [] });
        }

        const newImgUrls = req.files.map(file => `${process.env.ADDRESS}/images/${file.filename}`);
        manage.partners = [...manage.partners, ...newImgUrls];

        await manage.save();
        res.json({
            success: 1,
            message: "Cập nhật ảnh đối tác thành công",
            data: manage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật ảnh đối tác",
            error: error.message
        });
    }
});

// DELETE: Xóa ảnh
router.delete("/delete-image", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { imgUrl } = req.body;

        if (!imgUrl || typeof imgUrl !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng cung cấp imgUrl hợp lệ để xóa ảnh"
            });
        }

        const manage = await Manage.findOne();
        if (!manage) {
            return res.status(404).json({
                success: 0,
                message: "Không tìm thấy dữ liệu Manage"
            });
        }

        let updated = false;

        // Xóa ảnh khỏi overViewImg nếu có
        if (manage.overViewImg.includes(imgUrl)) {
            const filename = path.basename(imgUrl);
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.log('Không xóa được file:', e);
            }
            manage.overViewImg = manage.overViewImg.filter(url => url !== imgUrl);
            updated = true;
        }
        // Xóa ảnh khỏi partners nếu có
        else if (manage.partners.includes(imgUrl)) {
            const filename = path.basename(imgUrl);
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.log('Không xóa được file:', e);
            }
            manage.partners = manage.partners.filter(url => url !== imgUrl);
            updated = true;
        }
        // Xóa ảnh khỏi các trường khác nếu trùng
        else if (manage.topPurchaseUrl === imgUrl) {
            const filename = path.basename(imgUrl);
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.log('Không xóa được file:', e);
            }
            manage.topPurchaseUrl = '';
            updated = true;
        } else if (manage.highestRatingUrl === imgUrl) {
            const filename = path.basename(imgUrl);
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.log('Không xóa được file:', e);
            }
            manage.highestRatingUrl = '';
            updated = true;
        } else if (manage.newProductUrl === imgUrl) {
            const filename = path.basename(imgUrl);
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.log('Không xóa được file:', e);
            }
            manage.newProductUrl = '';
            updated = true;
        }

        if (!updated) {
            return res.status(404).json({
                success: 0,
                message: "Ảnh không tồn tại trong dữ liệu"
            });
        }

        await manage.save();
        res.json({
            success: 1,
            message: "Xóa ảnh thành công",
            data: manage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi xóa ảnh",
            error: error.message
        });
    }
});

// PUT: Cập nhật introduction
router.put("/update-introduction", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { introduction } = req.body;

        if (typeof introduction !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng cung cấp giá trị hợp lệ cho introduction"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: { introduction } },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({ introduction }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật introduction thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật introduction",
            error: error.message
        });
    }
});

// PUT: Cập nhật mainPolicy
router.put("/update-policy", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { mainPolicy } = req.body;

        if (typeof mainPolicy !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng cung cấp giá trị hợp lệ cho mainPolicy"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: { mainPolicy } },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({ mainPolicy }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật mainPolicy thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật mainPolicy",
            error: error.message
        });
    }
});

// PUT: Cập nhật section1
router.put("/update-section1", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section1 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section1.name'] = name;
        if (productId) updateData['section1.productId'] = productId;
        if (display !== undefined) updateData['section1.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section1: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section1 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section1",
            error: error.message
        });
    }
});

// PUT: Cập nhật section2
router.put("/update-section2", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section2 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section2.name'] = name;
        if (productId) updateData['section2.productId'] = productId;
        if (display !== undefined) updateData['section2.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section2: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section2 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section2",
            error: error.message
        });
    }
});

// PUT: Cập nhật section3
router.put("/update-section3", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section3 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section3.name'] = name;
        if (productId) updateData['section3.productId'] = productId;
        if (display !== undefined) updateData['section3.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section3: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section3 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section3",
            error: error.message
        });
    }
});

// PUT: Cập nhật section4
router.put("/update-section4", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section4 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section4.name'] = name;
        if (productId) updateData['section4.productId'] = productId;
        if (display !== undefined) updateData['section4.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section4: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section4 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section4",
            error: error.message
        });
    }
});

// PUT: Cập nhật section5
router.put("/update-section5", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section5 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section5.name'] = name;
        if (productId) updateData['section5.productId'] = productId;
        if (display !== undefined) updateData['section5.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section5: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section5 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section5",
            error: error.message
        });
    }
});

// PUT: Cập nhật section6
router.put("/update-section6", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section6 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section6.name'] = name;
        if (productId) updateData['section6.productId'] = productId;
        if (display !== undefined) updateData['section6.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section6: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section6 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section6",
            error: error.message
        });
    }
});

// PUT: Cập nhật section7
router.put("/update-section7", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section7 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section7.name'] = name;
        if (productId) updateData['section7.productId'] = productId;
        if (display !== undefined) updateData['section7.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section7: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section7 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section7",
            error: error.message
        });
    }
});

// PUT: Cập nhật section8
router.put("/update-section8", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section8 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section8.name'] = name;
        if (productId) updateData['section8.productId'] = productId;
        if (display !== undefined) updateData['section8.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section8: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section8 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section8",
            error: error.message
        });
    }
});

// PUT: Cập nhật section9
router.put("/update-section9", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section9 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section9.name'] = name;
        if (productId) updateData['section9.productId'] = productId;
        if (display !== undefined) updateData['section9.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section9: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section9 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section9",
            error: error.message
        });
    }
});

// PUT: Cập nhật section10
router.put("/update-section10", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { name, productId, display } = req.body;

        // Validate input
        if (name && typeof name !== 'string') {
            return res.status(400).json({
                success: 0,
                message: "Tên section10 phải là chuỗi"
            });
        }
        if (productId && !Array.isArray(productId)) {
            return res.status(400).json({
                success: 0,
                message: "productId phải là một mảng"
            });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "display phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {};
        if (name) updateData['section10.name'] = name;
        if (productId) updateData['section10.productId'] = productId;
        if (display !== undefined) updateData['section10.display'] = display;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                section10: {
                    name: name || '',
                    productId: productId || [],
                    display: display !== undefined ? display : true
                }
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật section10 thành công",
            data: updatedManage
        });
    } catch (error) {
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section10",
            error: error.message
        });
    }
});

module.exports = {
    Manage,
    router,
};