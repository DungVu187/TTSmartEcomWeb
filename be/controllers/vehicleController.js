const { Vehicle, normalizePlateKey } = require('../models/vehicle');
const { ActivityLog } = require('../models/activitylog');
const { VehicleValidationError, ensureId, expectedVersion, createVehiclePayload, updateVehiclePayload } = require('../validators/vehicle');
const { escapeRegex } = require('../utils/productSearch');

async function writeCreateVehicleActivity(vehicle, userName) {
  try {
    await new ActivityLog({
      userName: userName || 'Hệ thống',
      action: 'create_vehicle',
      entityType: 'vehicle',
      entityId: vehicle._id,
      targetName: vehicle.licensePlate,
      productName: `Xe: ${vehicle.licensePlate}`,
      details: [
        { field: 'licensePlate', newValue: vehicle.licensePlate },
        { field: 'wheelCount', newValue: String(vehicle.wheelCount) },
        ...(vehicle.name ? [{ field: 'name', newValue: vehicle.name }] : []),
      ],
    }).save();
  } catch (error) {
    console.error('ActivityLog error (create vehicle):', error.message);
  }
}

const sendError = (res, error) => {
  if (error?.name === 'VersionError') return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã thay đổi, vui lòng tải lại.' });
  return res.status(error.statusCode || (error?.code === 11000 ? 409 : 500)).json({ success: false, code: error?.code === 11000 ? 'VEHICLE_LICENSE_PLATE_EXISTS' : undefined, message: error?.code === 11000 ? 'Biển số xe đã tồn tại.' : error.message || 'Lỗi server.' });
};
const serialize = (vehicle) => { const value = vehicle.toObject ? vehicle.toObject() : vehicle; return { ...value, version: value.__v }; };
async function listVehicles(req, res) { try { const page = Math.max(1, parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)); const filter = {}; if (req.query.isActive === 'true') filter.isActive = true; if (req.query.isActive === 'false') filter.isActive = false; if (req.query.search) { const safe = escapeRegex(String(req.query.search).slice(0, 100)); filter.$or = [{ licensePlate: { $regex: safe, $options: 'i' } }, { name: { $regex: safe, $options: 'i' } }]; } const [items, totalItems] = await Promise.all([Vehicle.find(filter).sort({ isActive: -1, licensePlate: 1 }).skip((page - 1) * limit).limit(limit), Vehicle.countDocuments(filter)]); res.json({ success: true, data: { items: items.map(serialize), pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems } } }); } catch (error) { sendError(res, error); } }
async function createVehicle(req, res) {
  try {
    const payload = createVehiclePayload(req.body);
    const plateKey = normalizePlateKey(payload.licensePlate);
    const staleInactiveVehicles = await Vehicle.find({ isActive: false, licensePlateKey: plateKey });
    await Promise.all(staleInactiveVehicles.map((vehicle) => vehicle.save()));
    const vehicle = await new Vehicle(payload).save();
    await writeCreateVehicleActivity(vehicle, req.user?.name);
    res.status(201).json({ success: true, data: { vehicle: serialize(vehicle) } });
  } catch (error) { sendError(res, error); }
}
async function updateVehicle(req, res) { try { const vehicle = await Vehicle.findById(ensureId(req.params.id)); if (!vehicle) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' }); const payload = updateVehiclePayload(req.body); if (vehicle.__v !== payload.expectedVersion) return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã thay đổi, vui lòng tải lại.' }); ['licensePlate', 'name', 'wheelCount', 'note'].forEach((field) => { if (payload[field] !== undefined) vehicle[field] = payload[field]; }); await vehicle.save(); res.json({ success: true, data: { vehicle: serialize(vehicle) } }); } catch (error) { sendError(res, error); } }
async function updateVehicleStatus(req, res) { try { const vehicle = await Vehicle.findById(ensureId(req.params.id)); if (!vehicle) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' }); const payload = updateVehiclePayload({ expectedVersion: req.body?.expectedVersion }); if (typeof req.body?.isActive !== 'boolean') throw new VehicleValidationError('Trạng thái xe không hợp lệ.'); if (vehicle.__v !== payload.expectedVersion) return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã thay đổi, vui lòng tải lại.' }); vehicle.isActive = req.body.isActive; await vehicle.save(); res.json({ success: true, data: { vehicle: serialize(vehicle) } }); } catch (error) { sendError(res, error); } }
async function deleteVehicle(req, res) {
  try {
    const vehicleId = ensureId(req.params.id);
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' });
    const version = expectedVersion(req.body?.expectedVersion);
    if (vehicle.__v !== version) return res.status(409).json({ success: false, code: 'VERSION_CONFLICT', message: 'Dữ liệu đã thay đổi, vui lòng tải lại.' });
    vehicle.isActive = false;
    await vehicle.save();
    return res.json({ success: true, data: { vehicle: serialize(vehicle) } });
  } catch (error) { return sendError(res, error); }
}
module.exports = { listVehicles, createVehicle, updateVehicle, updateVehicleStatus, deleteVehicle };
