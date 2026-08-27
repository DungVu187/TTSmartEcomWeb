const mongoose = require('mongoose');
const { normalizeWheelCount } = require('../config/tireSlots');

class VehicleValidationError extends Error { constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; } }
const ensureId = (value, field = 'Mã xe') => { if (!mongoose.Types.ObjectId.isValid(value)) throw new VehicleValidationError(`${field} không hợp lệ.`); return String(value); };
const text = (value, field, max, required = false) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new VehicleValidationError(`${field} không hợp lệ.`);
  const result = value.trim();
  if (required && !result) throw new VehicleValidationError(`${field} là bắt buộc.`);
  if (result.length > max) throw new VehicleValidationError(`${field} quá dài.`);
  return result;
};
const expectedVersion = (value) => { const version = Number(value); if (!Number.isInteger(version) || version < 0) throw new VehicleValidationError('Phiên bản dữ liệu không hợp lệ.'); return version; };
const wheelCount = (value, required = false) => {
  if (value === undefined && !required) return undefined;
  const result = normalizeWheelCount(value);
  if (!result) throw new VehicleValidationError('Loại xe chỉ hỗ trợ 10 hoặc 12 bánh.');
  return result;
};
const createVehiclePayload = (body = {}) => ({ licensePlate: text(body.licensePlate, 'Biển số xe', 64, true), name: text(body.name, 'Tên xe', 160) || '', wheelCount: wheelCount(body.wheelCount) || 10, note: text(body.note, 'Ghi chú', 2000) || '' });
const updateVehiclePayload = (body = {}) => ({ licensePlate: body.licensePlate === undefined ? undefined : text(body.licensePlate, 'Biển số xe', 64, true), name: body.name === undefined ? undefined : text(body.name, 'Tên xe', 160), wheelCount: wheelCount(body.wheelCount), note: body.note === undefined ? undefined : text(body.note, 'Ghi chú', 2000), expectedVersion: expectedVersion(body.expectedVersion) });
module.exports = { VehicleValidationError, ensureId, expectedVersion, createVehiclePayload, updateVehiclePayload };
