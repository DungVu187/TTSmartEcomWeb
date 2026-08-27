const mongoose = require('mongoose');
const { TIRE_WHEEL_COUNTS } = require('../config/tireSlots');

const normalizePlateKey = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

const vehicleSchema = new mongoose.Schema({
  licensePlate: { type: String, required: true, trim: true, maxlength: 64 },
  licensePlateKey: { type: String, required: true, unique: true, index: true, select: false },
  name: { type: String, default: '', trim: true, maxlength: 160 },
  wheelCount: { type: Number, enum: TIRE_WHEEL_COUNTS, default: 10, required: true },
  note: { type: String, default: '', maxlength: 2000 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, optimisticConcurrency: true });

vehicleSchema.pre('validate', function normalizeVehiclePlate(next) {
  if (this.licensePlate !== undefined) {
    this.licensePlate = String(this.licensePlate).trim().toUpperCase().replace(/\s+/g, ' ');
    const plateKey = normalizePlateKey(this.licensePlate);
    this.licensePlateKey = this.isActive === false ? `${plateKey}__INACTIVE__${this._id}` : plateKey;
  }
  next();
});

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

module.exports = { Vehicle, vehicleSchema, normalizePlateKey };
