const mongoose = require('mongoose');
const { TireOrder } = require('../models/tireorder');
const { Vehicle } = require('../models/vehicle');
const { Product } = require('../models/product');
const { Type } = require('../models/producttype');
const { TIRE_PRODUCT_TYPE, normalizeWheelCount, slotsForWheelCount } = require('../config/tireSlots');
const { escapeRegex, limitRegexInput } = require('../utils/productSearch');

class TireOrderError extends Error {
  constructor(message, statusCode = 400, code = 'TIRE_ORDER_ERROR') { super(message); this.statusCode = statusCode; this.code = code; }
}

const objectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new TireOrderError(`${field} không hợp lệ.`, 400, 'INVALID_OBJECT_ID');
  return String(value);
};
const version = (value) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new TireOrderError('Phiên bản dữ liệu không hợp lệ.', 400, 'INVALID_VERSION');
  return result;
};
const text = (value, field, max = 2000, required = false) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TireOrderError(`${field} không hợp lệ.`);
  const result = value.trim();
  if (required && !result) throw new TireOrderError(`${field} là bắt buộc.`);
  if (result.length > max) throw new TireOrderError(`${field} quá dài.`);
  return result;
};
const date = (value, field = 'Ngày thực hiện') => {
  if (value === undefined) return undefined;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TireOrderError(`${field} không hợp lệ.`);
  return result;
};
const nullableDate = (value, field) => (value === null || value === '' ? null : date(value, field));
const validateStoppedAt = (stoppedAt, performedAt) => {
  if (stoppedAt && performedAt && stoppedAt > performedAt) {
    throw new TireOrderError('Thời điểm ngưng hoạt động không được sau ngày thay lốp.', 400, 'INVALID_TIRE_STOPPED_AT');
  }
};
const serialize = (order) => {
  const value = order.toObject ? order.toObject() : order;
  return { ...value, version: value.__v };
};
const ensureNotDeleted = (order) => {
  if (order.isDeleted) throw new TireOrderError('Đơn lốp đã bị xóa.', 404, 'ORDER_DELETED');
};
const ensureEditable = (order) => {
  ensureNotDeleted(order);
  if (order.status !== 'processing' || order.inventory?.phase !== 'idle') throw new TireOrderError('Đơn đã hoàn thành hoặc đang xử lý tồn kho. Hãy hủy hoàn thành trước khi sửa.', 409, 'ORDER_NOT_EDITABLE');
};
const findVehicleEntry = (order, vehicleEntryId) => {
  const entry = order.vehicles.id(vehicleEntryId);
  if (!entry) throw new TireOrderError('Không tìm thấy xe trong đơn.', 404, 'ORDER_VEHICLE_NOT_FOUND');
  return entry;
};
const findAssignment = (entry, assignmentId) => {
  const assignment = entry.assignments.id(assignmentId);
  if (!assignment) throw new TireOrderError('Không tìm thấy lốp trong đơn.', 404, 'ASSIGNMENT_NOT_FOUND');
  return assignment;
};
const saveExpected = async (order, expectedVersion) => {
  if (order.__v !== version(expectedVersion)) throw new TireOrderError('Dữ liệu đã thay đổi, vui lòng tải lại.', 409, 'VERSION_CONFLICT');
  try { await order.save(); return order; } catch (error) {
    if (error?.name === 'VersionError') throw new TireOrderError('Dữ liệu đã thay đổi, vui lòng tải lại.', 409, 'VERSION_CONFLICT');
    throw error;
  }
};
const requireTireType = async () => {
  if (!(await Type.exists({ Type: TIRE_PRODUCT_TYPE }))) throw new TireOrderError('Chưa có phân loại sản phẩm "Lốp xe". Vui lòng tạo phân loại trước.', 409, 'TIRE_PRODUCT_TYPE_NOT_CONFIGURED');
};
const snapshotProductVariant = (product, variantIndex, variantId) => {
  const index = Number(variantIndex);
  if (!Number.isInteger(index) || index < 0 || !product.variant[index]) throw new TireOrderError('Không tìm thấy phiên bản sản phẩm.', 404, 'VARIANT_NOT_FOUND');
  const variant = product.variant[index];
  if (!mongoose.Types.ObjectId.isValid(variantId) || String(variant._id) !== String(variantId)) throw new TireOrderError('Phiên bản sản phẩm đã thay đổi, vui lòng chọn lại.', 409, 'VARIANT_CHANGED');
  return {
    productId: product._id, variantIndex: index, variantId: variant._id,
    productCodeSnapshot: product.code || '', productNameSnapshot: product.name,
    brandSnapshot: product.brand || '', exportPriceSnapshot: variant.price || '', productValueSnapshot: product.value || '', productSpecificationsSnapshot: product.specifications || '',
    variantSnapshot: { color: variant.color || '', shape: variant.shape || '', buttonCount: variant.buttonCount || '', frame: variant.frame || '', note: variant.note || '' },
  };
};

async function listTireOrders(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const filter = { isDeleted: { $ne: true } };
  const search = text(query.search, 'Từ khóa', 100) || '';
  const creator = text(query.creator, 'Người tạo', 100) || '';
  if (search) filter.orderName = { $regex: escapeRegex(search), $options: 'i' };
  if (creator) filter.createdByName = { $regex: escapeRegex(creator), $options: 'i' };
  if (query.status) { if (!['processing', 'completed'].includes(query.status)) throw new TireOrderError('Trạng thái không hợp lệ.'); filter.status = query.status; }
  if (query.from || query.to) { const range = {}; if (query.from) range.$gte = date(query.from, 'Từ ngày'); if (query.to) range.$lte = date(query.to, 'Đến ngày'); filter.createdAt = range; }
  const [items, totalItems] = await Promise.all([TireOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('orderName createdByName totalVehicles totalTires totalExportPrice status transactionDate completedAt createdAt vehicles.assignments.productId vehicles.assignments.variantId vehicles.assignments.exportPriceSnapshot __v'), TireOrder.countDocuments(filter)]);
  const values = items.map(serialize);
  const assignments = values.flatMap((order) => order.vehicles?.flatMap((vehicle) => vehicle.assignments || []) || []);
  const missingPrice = assignments.filter((assignment) => !assignment.exportPriceSnapshot);
  const priceByVariant = new Map();
  if (missingPrice.length) {
    const products = await Product.find({ _id: { $in: missingPrice.map((assignment) => assignment.productId) } }).select('variant._id variant.price').lean();
    products.forEach((product) => product.variant?.forEach((variant) => priceByVariant.set(`${product._id}:${variant._id}`, variant.price || '')));
  }
  const summaries = values.map(({ vehicles = [], ...order }) => {
    const totalExportPrice = vehicles.reduce((total, vehicle) => total + (vehicle.assignments || []).reduce((vehicleTotal, assignment) => {
      const rawPrice = assignment.exportPriceSnapshot || priceByVariant.get(`${assignment.productId}:${assignment.variantId}`) || '';
      const amount = Number(String(rawPrice).replace(/[^0-9-]/g, ''));
      return vehicleTotal + (Number.isFinite(amount) ? amount : 0);
    }, 0), 0);
    return { ...order, totalExportPrice };
  });
  return { items: summaries, pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems } };
}
async function createTireOrder(body, user) {
  const order = new TireOrder({ orderName: text(body.orderName, 'Tên đơn', Infinity, true), note: text(body.note, 'Ghi chú', 4000) || '', transactionDate: date(body.transactionDate), createdBy: user._id, createdByName: user.name });
  await order.save(); return serialize(order);
}
async function getTireOrder(orderId) {
  objectId(orderId, 'Mã đơn');
  const order = await TireOrder.findById(orderId);
  if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND');
  ensureNotDeleted(order);
  const result = serialize(order);
  const assignments = result.vehicles.flatMap((vehicle) => vehicle.assignments || []);
  const missingPrice = assignments.filter((assignment) => !assignment.exportPriceSnapshot);
  if (missingPrice.length) {
    const products = await Product.find({ _id: { $in: missingPrice.map((assignment) => assignment.productId) } }).select('variant._id variant.price').lean();
    const byId = new Map(products.map((product) => [String(product._id), product]));
    missingPrice.forEach((assignment) => {
      const variant = byId.get(String(assignment.productId))?.variant?.find((item) => String(item._id) === String(assignment.variantId));
      assignment.exportPriceSnapshot = variant?.price || '';
    });
  }
  return result;
}
async function updateTireOrder(orderId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND');
  ensureNotDeleted(order);
  const expectedVersion = version(body.expectedVersion);
  if (order.status === 'completed' && body.transactionDate !== undefined) throw new TireOrderError('Không thể sửa ngày thực hiện khi đơn đã hoàn thành.', 409, 'COMPLETED_METADATA_LOCKED');
  if (body.orderName !== undefined) order.orderName = text(body.orderName, 'Tên đơn', Infinity, true);
  if (body.note !== undefined) order.note = text(body.note, 'Ghi chú', 4000) || '';
  if (body.transactionDate !== undefined) order.transactionDate = date(body.transactionDate);
  await saveExpected(order, expectedVersion); return serialize(order);
}
async function addOrderVehicle(orderId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND'); ensureEditable(order);
  const vehicleId = objectId(body.vehicleId, 'Mã xe'); const vehicle = await Vehicle.findById(vehicleId); if (!vehicle) throw new TireOrderError('Không tìm thấy xe.', 404, 'VEHICLE_NOT_FOUND'); if (!vehicle.isActive) throw new TireOrderError('Xe đã ngừng sử dụng.', 409, 'VEHICLE_INACTIVE');
  const wheelCount = normalizeWheelCount(vehicle.wheelCount); if (!wheelCount) throw new TireOrderError('Loại xe chỉ hỗ trợ 10 hoặc 12 bánh.', 400, 'INVALID_WHEEL_COUNT');
  if (body.wheelCount !== undefined && normalizeWheelCount(body.wheelCount) !== wheelCount) throw new TireOrderError('Loại bánh xe không khớp với thông tin xe.', 400, 'WHEEL_COUNT_MISMATCH');
  if (order.vehicles.some((entry) => String(entry.vehicleId) === vehicleId)) throw new TireOrderError('Xe đã có trong đơn.', 409, 'DUPLICATE_VEHICLE');
  order.vehicles.push({ vehicleId: vehicle._id, licensePlateSnapshot: vehicle.licensePlate, vehicleNameSnapshot: vehicle.name || '', wheelCount, note: text(body.note, 'Ghi chú', 2000) || '' });
  await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function updateOrderVehicle(orderId, entryId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND'); ensureEditable(order);
  const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn'));
  if (body.note !== undefined) entry.note = text(body.note, 'Ghi chú', 2000) || '';
  await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function removeOrderVehicle(orderId, entryId, body) { const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order); findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn')); order.vehicles.pull(entryId); await saveExpected(order, body.expectedVersion); return serialize(order); }
async function addAssignments(orderId, entryId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order); const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn'));
  await requireTireType(); const productId = objectId(body.productId, 'Mã sản phẩm'); const product = await Product.findById(productId); if (!product) throw new TireOrderError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND'); if (product.type !== TIRE_PRODUCT_TYPE) throw new TireOrderError('Chỉ được chọn sản phẩm loại Lốp xe.', 400, 'INVALID_PRODUCT_TYPE');
  if (!Array.isArray(body.slotIds)) throw new TireOrderError('Danh sách vị trí không hợp lệ.'); const slots = body.slotIds.map((slot) => String(slot)); const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity !== slots.length || new Set(slots).size !== slots.length) throw new TireOrderError('Số lượng phải khớp số vị trí đã chọn.');
  const allowedSlots = slotsForWheelCount(entry.wheelCount); if (slots.some((slot) => !allowedSlots.includes(slot))) throw new TireOrderError(`Vị trí lốp không thuộc sơ đồ ${entry.wheelCount} bánh.`); if (slots.some((slot) => entry.assignments.some((item) => item.slotId === slot))) throw new TireOrderError('Có vị trí đã được gán lốp.', 409, 'SLOT_OCCUPIED'); if (entry.assignments.length + slots.length > allowedSlots.length) throw new TireOrderError(`Xe ${entry.wheelCount} bánh chỉ có tối đa ${allowedSlots.length} lốp.`);
  const base = snapshotProductVariant(product, body.variantIndex, body.variantId); const performedAt = date(body.performedAt, 'Ngày thay'); const note = text(body.note, 'Ghi chú', 2000) || '';
  const stoppedAtBySlot = body.previousTireStoppedAtBySlot;
  if (stoppedAtBySlot !== undefined && (!stoppedAtBySlot || typeof stoppedAtBySlot !== 'object' || Array.isArray(stoppedAtBySlot))) throw new TireOrderError('Thời điểm ngưng hoạt động theo vị trí không hợp lệ.');
  slots.forEach((slotId) => {
    const previousTireStoppedAt = nullableDate(stoppedAtBySlot?.[slotId], 'Thời điểm ngưng hoạt động');
    validateStoppedAt(previousTireStoppedAt, performedAt);
    entry.assignments.push({ ...base, slotId, performedAt, previousTireStoppedAt, note });
  });
  await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function updateAssignment(orderId, entryId, assignmentId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order); const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn')); const assignment = findAssignment(entry, objectId(assignmentId, 'Mã lốp trong đơn'));
  const hasProductChange = body.productId !== undefined || body.variantIndex !== undefined || body.variantId !== undefined;
  if (hasProductChange) { if (body.productId === undefined || body.variantIndex === undefined || body.variantId === undefined) throw new TireOrderError('Khi đổi lốp phải chọn đủ sản phẩm và phiên bản.'); await requireTireType(); const product = await Product.findById(objectId(body.productId, 'Mã sản phẩm')); if (!product) throw new TireOrderError('Không tìm thấy sản phẩm.', 404); if (product.type !== TIRE_PRODUCT_TYPE) throw new TireOrderError('Chỉ được chọn sản phẩm loại Lốp xe.'); Object.assign(assignment, snapshotProductVariant(product, body.variantIndex, body.variantId)); }
  const performedAt = body.performedAt !== undefined ? date(body.performedAt, 'Ngày thay') : assignment.performedAt;
  const previousTireStoppedAt = body.previousTireStoppedAt !== undefined ? nullableDate(body.previousTireStoppedAt, 'Thời điểm ngưng hoạt động') : assignment.previousTireStoppedAt;
  validateStoppedAt(previousTireStoppedAt, performedAt);
  if (body.performedAt !== undefined) assignment.performedAt = performedAt;
  if (body.previousTireStoppedAt !== undefined) assignment.previousTireStoppedAt = previousTireStoppedAt;
  if (body.note !== undefined) assignment.note = text(body.note, 'Ghi chú', 2000) || '';
  await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function moveAssignment(orderId, entryId, assignmentId, body) {
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order); const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn')); const assignment = findAssignment(entry, objectId(assignmentId, 'Mã lốp trong đơn')); const slotId = String(body.slotId || ''); if (!slotsForWheelCount(entry.wheelCount).includes(slotId)) throw new TireOrderError(`Vị trí lốp không thuộc sơ đồ ${entry.wheelCount} bánh.`); if (entry.assignments.some((item) => String(item._id) !== String(assignment._id) && item.slotId === slotId)) throw new TireOrderError('Vị trí đã được gán lốp.', 409, 'SLOT_OCCUPIED'); if (assignment.slotId !== slotId) { assignment.slotId = slotId; assignment.previousTireStoppedAt = null; } await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function replaceAssignmentSlot(orderId, entryId, assignmentId, body) {
  if (body.confirm !== true) throw new TireOrderError('Cần xác nhận thay thế lốp ở vị trí đã chọn.', 400, 'REPLACEMENT_NOT_CONFIRMED');
  const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order);
  const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn')); const assignment = findAssignment(entry, objectId(assignmentId, 'Mã lốp trong đơn')); const replacement = findAssignment(entry, objectId(body.replacedAssignmentId, 'Mã lốp cần thay thế'));
  const slotId = String(body.slotId || ''); if (!slotsForWheelCount(entry.wheelCount).includes(slotId) || replacement.slotId !== slotId) throw new TireOrderError('Vị trí thay thế không hợp lệ.');
  assignment.previousTireStoppedAt = replacement.previousTireStoppedAt || null;
  entry.assignments.pull(replacement._id); assignment.slotId = slotId; await saveExpected(order, body.expectedVersion); return serialize(order);
}
async function deleteAssignment(orderId, entryId, assignmentId, body) { const order = await TireOrder.findById(objectId(orderId, 'Mã đơn')); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureEditable(order); const entry = findVehicleEntry(order, objectId(entryId, 'Mã xe trong đơn')); findAssignment(entry, objectId(assignmentId, 'Mã lốp trong đơn')); entry.assignments.pull(assignmentId); await saveExpected(order, body.expectedVersion); return serialize(order); }
async function listProductOptions(query = {}) {
  await requireTireType(); const page = Math.max(1, Number.parseInt(query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)); const search = limitRegexInput(query.search).trim(); const filter = { type: TIRE_PRODUCT_TYPE }; if (search) { const safe = escapeRegex(search); filter.$or = [{ code: { $regex: safe, $options: 'i' } }, { name: { $regex: safe, $options: 'i' } }, { nameUnsigned: { $regex: safe, $options: 'i' } }]; }
  const [items, totalItems] = await Promise.all([Product.find(filter).select('code name brand value specifications variant').sort({ code: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)]);
  return { items: items.map((product) => ({ _id: product._id, code: product.code || '', name: product.name, brand: product.brand || '', value: product.value || '', specifications: product.specifications || '', variants: (product.variant || []).map((variant, index) => ({ index, _id: variant._id, color: variant.color || '', shape: variant.shape || '', buttonCount: variant.buttonCount || '', frame: variant.frame || '', note: variant.note || '', quantityForSale: Number(variant.quantityForSale || 0), quantityInStorage: Number(variant.quantityInStorage || 0) })) })), pagination: { currentPage: page, totalPages: Math.ceil(totalItems / limit), totalItems } };
}

module.exports = { TireOrderError, listTireOrders, createTireOrder, getTireOrder, updateTireOrder, addOrderVehicle, updateOrderVehicle, removeOrderVehicle, addAssignments, updateAssignment, moveAssignment, replaceAssignmentSlot, deleteAssignment, listProductOptions, serialize, objectId, version, ensureNotDeleted };
