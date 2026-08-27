const mongoose = require("mongoose");

// Định nghĩa schema
const storageHistorySchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    userName: {
        type: String
    },
    orderId: {
        type: String
    },
    orderName: {
        type: String
    },
    note: {
        type: String,
        default: ""
    },
    isAIScan: {
        type: Boolean,
        default: false
    },
    source: {
        type: String,
        enum: [
            "order_line_manual",
            "order_line_complete",
            "order_bulk_complete",
            "product_manual",
            "online_sale",
            "online_sale_revert",
            "import_quantity_adjustment",
            "tire_order_complete",
            "tire_order_revert",
            "tire_order_delete_revert",
        ],
        default: undefined,
    },
    transactionDate: {
        type: Date,
        default: Date.now,
    },
    quantityBefore: { type: Number },
    quantityAfter: { type: Number },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    variantIndex: { type: Number, min: 0 },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    vehicleEntryId: { type: mongoose.Schema.Types.ObjectId },
    vehiclePlate: { type: String, default: '' },
    orderType: { type: String, default: '' },
    inventoryOperationId: { type: String, default: '' },
}, { timestamps: true });

storageHistorySchema.index({ inventoryOperationId: 1, source: 1, vehicleEntryId: 1, productId: 1, variantId: 1 });

const StorageHistory = mongoose.models.StorageHistory || mongoose.model("StorageHistory", storageHistorySchema);

module.exports = {
    StorageHistory,
    storageHistorySchema,
};
