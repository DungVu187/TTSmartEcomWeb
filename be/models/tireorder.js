const mongoose = require('mongoose');
const { TIRE_SLOT_IDS, TIRE_WHEEL_COUNTS, slotsForWheelCount } = require('../config/tireSlots');

const parseExportPrice = (value) => {
  const normalized = String(value || '').replace(/[^0-9-]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const assignmentSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantIndex: { type: Number, required: true, min: 0 },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productCodeSnapshot: { type: String, default: '' },
  productNameSnapshot: { type: String, required: true },
  brandSnapshot: { type: String, default: '' },
  exportPriceSnapshot: { type: String, default: '' },
  productValueSnapshot: { type: String, default: '' },
  productSpecificationsSnapshot: { type: String, default: '' },
  variantSnapshot: {
    color: { type: String, default: '' }, shape: { type: String, default: '' },
    buttonCount: { type: String, default: '' }, frame: { type: String, default: '' }, note: { type: String, default: '' },
  },
  slotId: { type: String, required: true, enum: TIRE_SLOT_IDS },
  performedAt: { type: Date, default: null },
  note: { type: String, default: '', maxlength: 2000 },
  stockAppliedQuantity: { type: Number, default: 0, enum: [0, 1] },
}, { _id: true });

const orderVehicleSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  licensePlateSnapshot: { type: String, required: true },
  vehicleNameSnapshot: { type: String, default: '' },
  wheelCount: { type: Number, enum: TIRE_WHEEL_COUNTS, default: 10, required: true },
  note: { type: String, default: '', maxlength: 2000 },
  assignments: { type: [assignmentSchema], default: [] },
}, { _id: true });

const adjustmentSchema = new mongoose.Schema({
  vehicleEntryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, required: true },
  vehiclePlateSnapshot: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  variantIndex: { type: Number, required: true, min: 0 },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const tireOrderSchema = new mongoose.Schema({
  orderName: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  transactionDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['processing', 'completed'], default: 'processing', index: true },
  completedAt: { type: Date, default: null },
  note: { type: String, default: '', maxlength: 4000 },
  vehicles: { type: [orderVehicleSchema], default: [] },
  totalVehicles: { type: Number, default: 0, min: 0 },
  totalTires: { type: Number, default: 0, min: 0 },
  totalExportPrice: { type: Number, default: 0, min: 0 },
  stockAppliedTireCount: { type: Number, default: 0, min: 0 },
  inventory: {
    phase: { type: String, enum: ['idle', 'applying', 'applied', 'reverting', 'deleting'], default: 'idle' },
    operationId: { type: String, default: null },
    startedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
    adjustments: { type: [adjustmentSchema], default: [] },
  },
}, { timestamps: true, optimisticConcurrency: true });

tireOrderSchema.pre('validate', function deriveAndValidate(next) {
  const vehicleIds = this.vehicles.map((vehicle) => String(vehicle.vehicleId));
  if (vehicleIds.length !== new Set(vehicleIds).size) return next(new Error('Một xe chỉ được xuất hiện một lần trong đơn.'));
  for (const vehicle of this.vehicles) {
    const allowedSlots = slotsForWheelCount(vehicle.wheelCount);
    if (vehicle.assignments.length > allowedSlots.length) return next(new Error(`Xe ${vehicle.wheelCount} bánh chỉ có tối đa ${allowedSlots.length} lốp.`));
    const slots = vehicle.assignments.map((assignment) => assignment.slotId);
    if (slots.some((slot) => !allowedSlots.includes(slot))) return next(new Error(`Vị trí lốp không thuộc sơ đồ ${vehicle.wheelCount} bánh.`));
    if (slots.length !== new Set(slots).size) return next(new Error('Không được trùng vị trí lốp trong cùng xe.'));
  }
  this.totalVehicles = this.vehicles.length;
  this.totalTires = this.vehicles.reduce((sum, vehicle) => sum + vehicle.assignments.length, 0);
  this.totalExportPrice = this.vehicles.reduce((sum, vehicle) => sum + vehicle.assignments.reduce((vehicleTotal, assignment) => vehicleTotal + parseExportPrice(assignment.exportPriceSnapshot), 0), 0);
  this.stockAppliedTireCount = this.vehicles.reduce((sum, vehicle) => sum + vehicle.assignments.reduce((inner, assignment) => inner + Number(assignment.stockAppliedQuantity || 0), 0), 0);
  next();
});

tireOrderSchema.index({ createdAt: -1 });
tireOrderSchema.index({ status: 1, createdAt: -1 });
tireOrderSchema.index({ 'vehicles.assignments.productId': 1 });

const TireOrder = mongoose.models.TireOrder || mongoose.model('TireOrder', tireOrderSchema);

module.exports = { TireOrder, tireOrderSchema };
