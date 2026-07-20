const express = require('express');
const mongoose = require("mongoose");
const { authenticateAdmin, checkPermission } = require("./user");
const { ActivityLog } = require("./activitylog");
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
    displayPartners: {
        type: Boolean,
        default: true
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
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section3: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section4: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section5: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section6: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section7: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section8: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section9: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section10: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
    },
    section11: {
        name: { type: String, default: '' },
        productId: { type: [String], default: [] },
        display: { type: Boolean, default: true },
        image: { type: String, default: '' },
        link: { type: String, default: '' }
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi lấy dữ liệu",
            error: "Lỗi server"
        });
    }
});

const logManageRoute = (action, targetName) => {
    return (req, res, next) => {
        const oldJson = res.json;
        res.json = function (data) {
            res.json = oldJson;
            if (res.statusCode >= 200 && res.statusCode < 300) {
                let details = [];
                if (req.body) {
                    const keys = Object.keys(req.body).filter(k => k !== 'password');
                    if (keys.length > 0) {
                        details.push({
                            field: "Thay đổi",
                            oldValue: "",
                            newValue: `Cập nhật các trường: ${keys.join(", ")}`
                        });
                    }
                }
                new ActivityLog({
                    userName: req.user ? req.user.name : "Admin",
                    action: action,
                    productName: targetName,
                    details: details.length > 0 ? details : [{ field: "Cập nhật", oldValue: "", newValue: "Thành công" }]
                }).save().catch(err => console.error("ActivityLog error in route:", err.message));
            }
            return oldJson.apply(res, arguments);
        };
        next();
    };
};

// PUT: Cập nhật ảnh cho topPurchaseUrl, highestRatingUrl, hoặc newProductUrl
router.put("/update", [authenticateAdmin, checkPermission('storefront.manage')], logManageRoute("update_settings", "Cấu hình chung"), upload.array('manage', 1), async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật",
            error: "Lỗi server"
        });
    }
});

// POST: Thêm ảnh vào overViewImg
router.post("/update-images", [authenticateAdmin, checkPermission('storefront.manage')], upload.array('manage', 10), async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật mảng ảnh",
            error: "Lỗi server"
        });
    }
});

// POST: Thêm ảnh vào partners
router.post("/update-partners", [authenticateAdmin, checkPermission('storefront.manage')], upload.array('manage', 10), async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật ảnh đối tác",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật cấu hình đối tác dạng text và ẩn/hiện
router.put("/update-partners-text", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
    try {
        const { partners, displayPartners } = req.body;

        if (partners && !Array.isArray(partners)) {
            return res.status(400).json({
                success: 0,
                message: "partners phải là một mảng chuỗi text"
            });
        }
        if (displayPartners !== undefined && typeof displayPartners !== 'boolean') {
            return res.status(400).json({
                success: 0,
                message: "displayPartners phải là giá trị boolean"
            });
        }

        let manage = await Manage.findOne();
        let updatedManage;

        const updateData = {};
        if (partners !== undefined) updateData.partners = partners;
        if (displayPartners !== undefined) updateData.displayPartners = displayPartners;

        if (manage) {
            updatedManage = await Manage.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true }
            );
        } else {
            updatedManage = await new Manage({
                partners: partners || [],
                displayPartners: displayPartners !== undefined ? displayPartners : true
            }).save();
        }

        res.json({
            success: 1,
            message: "Cập nhật cấu hình đối tác thành công",
            data: updatedManage
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật cấu hình đối tác",
            error: "Lỗi server"
        });
    }
});

// POST: Tải lên ảnh highlight cho section
router.post("/upload-section-image", [authenticateAdmin, checkPermission('storefront.manage')], upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: 0,
                message: "Vui lòng tải lên một file ảnh"
            });
        }
        const imgUrl = `${process.env.ADDRESS}/images/${req.file.filename}`;
        res.json({
            success: 1,
            message: "Tải ảnh lên thành công",
            imgUrl
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi tải ảnh lên"
        });
    }
});

// PUT: Cập nhật section bất kỳ động theo sectionId (section1 -> section11)
router.put("/update-section/:sectionId", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { name, productId, display, image, link } = req.body;

        const match = /^section(1[0-1]|[1-9])$/.test(sectionId); // section1 to section11
        if (!match) {
            return res.status(400).json({
                success: 0,
                message: "sectionId không hợp lệ"
            });
        }

        if (name !== undefined && typeof name !== 'string') {
            return res.status(400).json({ success: 0, message: "Tên section phải là chuỗi" });
        }
        if (productId !== undefined && !Array.isArray(productId)) {
            return res.status(400).json({ success: 0, message: "productId phải là một mảng" });
        }
        if (display !== undefined && typeof display !== 'boolean') {
            return res.status(400).json({ success: 0, message: "display phải là giá trị boolean" });
        }
        if (image !== undefined && typeof image !== 'string') {
            return res.status(400).json({ success: 0, message: "image phải là chuỗi" });
        }
        if (link !== undefined && typeof link !== 'string') {
            return res.status(400).json({ success: 0, message: "link phải là chuỗi" });
        }

        let manage = await Manage.findOne();
        if (!manage) {
            manage = new Manage();
        }

        const updateData = {};
        if (name !== undefined) updateData[`${sectionId}.name`] = name;
        if (productId !== undefined) updateData[`${sectionId}.productId`] = productId;
        if (display !== undefined) updateData[`${sectionId}.display`] = display;
        if (image !== undefined) updateData[`${sectionId}.image`] = image;
        if (link !== undefined) updateData[`${sectionId}.link`] = link;

        const updatedManage = await Manage.findOneAndUpdate(
            {},
            { $set: updateData },
            { new: true, upsert: true }
        );

        res.json({
            success: 1,
            message: `Cập nhật ${sectionId} thành công`,
            data: updatedManage
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section",
            error: "Lỗi server"
        });
    }
});

// DELETE: Xóa ảnh
router.delete("/delete-image", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi xóa ảnh",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật introduction
router.put("/update-introduction", [authenticateAdmin, checkPermission('storefront.manage')], logManageRoute("update_introduction", "Trang Giới thiệu"), async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật introduction",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật mainPolicy
router.put("/update-policy", [authenticateAdmin, checkPermission('storefront.manage')], logManageRoute("update_policy", "Trang Chính sách"), async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật mainPolicy",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section1
router.put("/update-section1", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section1",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section2
router.put("/update-section2", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section2",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section3
router.put("/update-section3", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section3",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section4
router.put("/update-section4", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section4",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section5
router.put("/update-section5", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section5",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section6
router.put("/update-section6", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section6",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section7
router.put("/update-section7", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section7",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section8
router.put("/update-section8", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section8",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section9
router.put("/update-section9", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section9",
            error: "Lỗi server"
        });
    }
});

// PUT: Cập nhật section10
router.put("/update-section10", [authenticateAdmin, checkPermission('storefront.manage')], async (req, res) => {
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
        console.error("Server error:", error);
        res.status(500).json({
            success: 0,
            message: "Lỗi server khi cập nhật section10",
            error: "Lỗi server"
        });
    }
});

module.exports = {
    Manage,
    router,
};
