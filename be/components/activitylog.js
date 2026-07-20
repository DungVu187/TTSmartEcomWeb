const express = require('express');
const mongoose = require("mongoose");

const authenticateAdmin = (req, res, next) => {
    const userModule = require("./user");
    return userModule.authenticateAdmin(req, res, next);
};

const checkActivityLogPermission = (req, res, next) => {
    const userModule = require("./user");
    return userModule.checkPermission("activitylog.view")(req, res, next);
};

// Định nghĩa schema
const activityLogSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
    productName: {
        type: String
    },
    details: [
        {
            field: { type: String },
            oldValue: { type: String, default: "" },
            newValue: { type: String, default: "" }
        }
    ]
}, { timestamps: true });

// Tự động xóa log hoạt động sau 90 ngày (90 ngày * 24 giờ * 3600 giây = 7776000 giây)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);

const router = express.Router();

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Nhãn hiển thị tiếng Việt cho các action
const ACTION_LABELS = {
    create_product: 'Tạo sản phẩm',
    update_product: 'Sửa sản phẩm',
    delete_product: 'Xóa sản phẩm',
    update_variant: 'Sửa biến thể',
    update_earn: 'Sửa % lợi nhuận',
    update_import_price: 'Sửa giá nhập',
    toggle_display: 'Ẩn/Hiện sản phẩm',
    add_variant: 'Thêm biến thể',
    delete_variant: 'Xóa biến thể',
    
    // User management
    create_user: 'Tạo tài khoản',
    update_user: 'Sửa tài khoản',
    delete_user: 'Xóa tài khoản',
    update_user_permissions: 'Sửa quyền tài khoản',
    assign_user_stations: 'Phân trạm cho tài khoản',
    
    // Station management
    create_station: 'Tạo trạm trộn',
    update_station: 'Sửa trạm trộn',
    update_station_products: 'Cập nhật sản phẩm trạm',
    delete_station: 'Xóa trạm trộn',
    
    // Chips & attributes
    add_chip_attr: 'Thêm thuộc tính sản phẩm',
    remove_chip_attr: 'Xóa thuộc tính sản phẩm',
    create_brand: 'Thêm thương hiệu',
    delete_brand: 'Xóa thương hiệu',
    create_type: 'Thêm loại sản phẩm',
    update_type: 'Cập nhật loại sản phẩm',
    delete_type: 'Xóa loại sản phẩm',
    create_section: 'Thêm phân loại',
    update_section: 'Sửa phân loại',
    delete_section: 'Xóa phân loại',
    create_section_value: 'Thêm giá trị phân loại',
    update_section_value: 'Sửa giá trị phân loại',
    delete_section_value: 'Xóa giá trị phân loại',
    
    // Homepage & config updates
    update_settings: 'Cập nhật cấu hình chung',
    update_introduction: 'Sửa trang giới thiệu',
    update_policy: 'Sửa trang chính sách',
    update_homepage_section: 'Sửa phần trang chủ',
    
    // Zalo settings
    update_zalo_settings: 'Cập nhật cấu hình Zalo OA',

    // Telegram settings
    update_telegram_settings: 'Cập nhật cấu hình Telegram',
    create_telegram_recipient: 'Thêm người/nhóm nhận Telegram',
    update_telegram_recipient: 'Sửa người/nhóm nhận Telegram',
    delete_telegram_recipient: 'Xóa người/nhóm nhận Telegram',

    // Voice vocabulary (từ vựng tìm kiếm bằng giọng nói)
    create_voice_vocab: 'Thêm từ vựng voice',
    update_voice_vocab: 'Sửa từ vựng voice',
    delete_voice_vocab: 'Xóa từ vựng voice'
};

// API lấy danh sách lịch sử hoạt động
router.get("/", authenticateAdmin, checkActivityLogPermission, async (req, res) => {
    try {
        let { page = 1, limit = 20, startDate, endDate, userName, productName, action } = req.query;

        page = Math.max(1, parseInt(page));
        limit = [20, 50, 100].includes(parseInt(limit)) ? parseInt(limit) : 20;

        const skip = (page - 1) * limit;

        const filter = {};
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setUTCHours(0 - 7, 0, 0, 0);
                filter.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23 - 7, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (userName) {
            filter.userName = { $regex: escapeRegex(userName), $options: "i" };
        }

        if (productName) {
            filter.productName = { $regex: escapeRegex(productName), $options: "i" };
        }

        if (action) {
            filter.action = action;
        }

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            ActivityLog.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            logs,
            actionLabels: ACTION_LABELS
        });
    } catch (error) {
        console.error("Error fetching activity logs:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = { ActivityLog, router, ACTION_LABELS };
