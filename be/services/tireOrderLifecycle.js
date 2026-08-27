const { randomUUID } = require('crypto');
const { TireOrder } = require('../models/tireorder');
const { Product } = require('../models/product');
const { Type } = require('../models/producttype');
const { StorageHistory } = require('../models/storagehistory');
const { ActivityLog } = require('../models/activitylog');
const { TIRE_PRODUCT_TYPE } = require('../config/tireSlots');
const { applyStockAdjustments, rollbackOrThrow } = require('./inventory');
const { TireOrderError, objectId, version, serialize, ensureNotDeleted } = require('./tireOrderService');
const { buildLifecycleRecords } = require('./tireLifecycleService');

const loadOrder = async (id, expectedVersion) => {
  objectId(id, 'Mã đơn');
  const order = await TireOrder.findById(id);
  if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND');
  ensureNotDeleted(order);
  if (order.__v !== version(expectedVersion)) throw new TireOrderError('Dữ liệu đã thay đổi, vui lòng tải lại.', 409, 'VERSION_CONFLICT');
  return order;
};
const save = async (order) => {
  try { await order.save(); } catch (error) { if (error?.name === 'VersionError') throw new TireOrderError('Dữ liệu đã thay đổi, vui lòng tải lại.', 409, 'VERSION_CONFLICT'); throw error; }
};
const assertCompleteable = (order) => {
  if (order.status !== 'processing' || order.inventory?.phase !== 'idle') throw new TireOrderError('Đơn không ở trạng thái có thể hoàn thành.', 409, 'ORDER_NOT_PROCESSING');
  if (!order.vehicles.length || !order.totalTires) throw new TireOrderError('Đơn cần có ít nhất một xe và một lốp.', 400, 'EMPTY_ORDER');
};
const buildBreakdown = (order) => {
  const grouped = new Map();
  for (const vehicle of order.vehicles) for (const assignment of vehicle.assignments) {
    const key = [vehicle._id, assignment.productId, assignment.variantId].map(String).join(':');
    const current = grouped.get(key) || { vehicleEntryId: vehicle._id, vehicleId: vehicle.vehicleId, vehiclePlateSnapshot: vehicle.licensePlateSnapshot, productId: assignment.productId, variantIndex: assignment.variantIndex, variantId: assignment.variantId, quantity: 0, productName: assignment.productNameSnapshot };
    current.quantity += 1; grouped.set(key, current);
  }
  return [...grouped.values()];
};
const aggregateStock = (breakdown, direction) => {
  const grouped = new Map();
  breakdown.forEach((item) => { const key = [item.productId, item.variantId].map(String).join(':'); const value = grouped.get(key) || { productId: item.productId, variantIndex: item.variantIndex, expectedVariantId: item.variantId, quantityForSaleDelta: 0, quantityInStorageDelta: 0 }; value.quantityForSaleDelta += direction * item.quantity; value.quantityInStorageDelta += direction * item.quantity; grouped.set(key, value); });
  return [...grouped.values()];
};
const validateProducts = async (breakdown) => {
  if (!(await Type.exists({ Type: TIRE_PRODUCT_TYPE }))) throw new TireOrderError('Chưa có phân loại sản phẩm "Lốp xe".', 409, 'TIRE_PRODUCT_TYPE_NOT_CONFIGURED');
  const products = await Product.find({ _id: { $in: breakdown.map((item) => item.productId) } }).select('type variant._id');
  const byId = new Map(products.map((product) => [String(product._id), product]));
  for (const item of breakdown) {
    const product = byId.get(String(item.productId));
    if (!product) throw new TireOrderError('Sản phẩm trong đơn không còn tồn tại.', 404, 'PRODUCT_NOT_FOUND');
    if (product.type !== TIRE_PRODUCT_TYPE) throw new TireOrderError('Sản phẩm trong đơn không còn thuộc loại Lốp xe.', 409, 'PRODUCT_TYPE_CHANGED');
    if (!product.variant[item.variantIndex] || String(product.variant[item.variantIndex]._id) !== String(item.variantId)) throw new TireOrderError('Phiên bản sản phẩm đã thay đổi, vui lòng cập nhật đơn.', 409, 'VARIANT_CHANGED');
  }
};
const validatePreviousTireStopTimes = async (order) => {
  const replacements = order.vehicles.flatMap((vehicle) => vehicle.assignments
    .filter((assignment) => assignment.previousTireStoppedAt)
    .map((assignment) => ({ vehicle, assignment })));
  if (!replacements.length) return;
  const records = await buildLifecycleRecords();
  for (const { vehicle, assignment } of replacements) {
    const stoppedAt = new Date(assignment.previousTireStoppedAt);
    const performedAt = new Date(assignment.performedAt || order.transactionDate || Date.now());
    if (stoppedAt > performedAt) throw new TireOrderError('Thời điểm ngưng hoạt động không được sau ngày thay lốp.', 400, 'INVALID_TIRE_STOPPED_AT');
    const previous = records
      .filter((record) => record.vehicleId === String(vehicle.vehicleId) && record.slotId === assignment.slotId && record.startedAt <= performedAt)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
    if (previous && stoppedAt < previous.startedAt) throw new TireOrderError('Thời điểm ngưng hoạt động không được trước ngày lắp lốp cũ.', 400, 'INVALID_TIRE_STOPPED_AT');
  }
};
const createHistories = async ({ order, entries, userName, source, operationId, transactionDate }) => {
  const docs = entries.map((item) => ({ productId: item.productId, productName: item.productName || '', quantity: item.quantity, userName, orderId: String(order._id), orderName: order.orderName, note: source === 'tire_order_complete' ? 'Xuất lốp cho xe' : 'Hoàn kho đơn lốp', source, transactionDate, variantId: item.variantId, variantIndex: item.variantIndex, vehicleId: item.vehicleId, vehicleEntryId: item.vehicleEntryId, vehiclePlate: item.vehiclePlateSnapshot, orderType: 'tire_order', inventoryOperationId: operationId }));
  await StorageHistory.insertMany(docs, { ordered: true });
};
const cleanupHistories = (operationId) => StorageHistory.deleteMany({ inventoryOperationId: operationId });
const release = async (order, phase = 'idle') => { order.inventory.phase = phase; order.inventory.operationId = null; order.inventory.startedAt = null; await save(order); };

async function completeTireOrder(orderId, body, user) {
  const order = await loadOrder(orderId, body.expectedVersion); assertCompleteable(order); const breakdown = buildBreakdown(order); await validateProducts(breakdown); await validatePreviousTireStopTimes(order);
  const operationId = randomUUID(); order.inventory.phase = 'applying'; order.inventory.operationId = operationId; order.inventory.startedAt = new Date(); await save(order);
  let applied = [];
  try {
    applied = await applyStockAdjustments(aggregateStock(breakdown, -1));
    await createHistories({ order, entries: breakdown.map((entry) => ({ ...entry, quantity: -entry.quantity })), userName: user.name, source: 'tire_order_complete', operationId, transactionDate: order.transactionDate || new Date() });
    order.vehicles.forEach((vehicle) => vehicle.assignments.forEach((assignment) => { assignment.stockAppliedQuantity = 1; if (!assignment.performedAt) assignment.performedAt = order.transactionDate || new Date(); }));
    order.status = 'completed'; order.completedAt = new Date(); order.inventory.phase = 'applied'; order.inventory.appliedAt = new Date(); order.inventory.adjustments = breakdown.map(({ productName, ...entry }) => entry); await save(order);
    return serialize(order);
  } catch (error) {
    await cleanupHistories(operationId).catch(() => {});
    if (applied.length) { try { await rollbackOrThrow(applied, error); } catch (rollbackError) { throw rollbackError; } }
    // A failed final save must leave the order as a draft because stock was compensated.
    order.vehicles.forEach((vehicle) => vehicle.assignments.forEach((assignment) => { assignment.stockAppliedQuantity = 0; }));
    order.status = 'processing'; order.completedAt = null;
    order.inventory = { phase: 'idle', operationId: null, startedAt: null, appliedAt: null, adjustments: [] };
    await save(order).catch(() => {});
    throw error;
  }
}
async function revertTireOrder(orderId, body, user) {
  const order = await loadOrder(orderId, body.expectedVersion);
  if (order.status !== 'completed' || order.inventory?.phase !== 'applied') throw new TireOrderError('Đơn chưa hoàn thành hoặc đã được hoàn kho.', 409, 'ORDER_NOT_COMPLETED');
  const breakdown = (order.inventory.adjustments || []).map((entry) => {
    // Mongoose subdocuments do not expose their paths through object spread.
    // Convert the persisted ledger before passing identifiers to inventory.
    const adjustment = entry.toObject ? entry.toObject() : entry;
    return {
      ...adjustment,
      productName: order.vehicles.id(adjustment.vehicleEntryId)?.assignments.find((assignment) => String(assignment.productId) === String(adjustment.productId) && String(assignment.variantId) === String(adjustment.variantId))?.productNameSnapshot || '',
    };
  });
  if (!breakdown.length) throw new TireOrderError('Không tìm thấy thông tin tồn kho đã áp dụng.', 409, 'MISSING_STOCK_LEDGER');
  const previousCompletedAt = order.completedAt;
  const previousAppliedAt = order.inventory.appliedAt;
  const operationId = randomUUID(); order.inventory.phase = 'reverting'; order.inventory.operationId = operationId; order.inventory.startedAt = new Date(); await save(order);
  let applied = [];
  try {
    applied = await applyStockAdjustments(aggregateStock(breakdown, 1));
    await createHistories({ order, entries: breakdown, userName: user.name, source: 'tire_order_revert', operationId, transactionDate: new Date() });
    order.vehicles.forEach((vehicle) => vehicle.assignments.forEach((assignment) => { assignment.stockAppliedQuantity = 0; })); order.status = 'processing'; order.completedAt = null; order.inventory = { phase: 'idle', operationId: null, startedAt: null, appliedAt: null, adjustments: [] }; await save(order); return serialize(order);
  } catch (error) {
    await cleanupHistories(operationId).catch(() => {});
    if (applied.length) { try { await rollbackOrThrow(applied, error); } catch (rollbackError) { throw rollbackError; } }
    // The stock was put back to its completed-state amount, so restore the persisted order state too.
    order.vehicles.forEach((vehicle) => vehicle.assignments.forEach((assignment) => { assignment.stockAppliedQuantity = 1; }));
    order.status = 'completed';
    order.completedAt = previousCompletedAt || new Date();
    order.inventory = {
      phase: 'applied', operationId: null, startedAt: null, appliedAt: previousAppliedAt || new Date(),
      adjustments: breakdown.map(({ productName, ...entry }) => entry),
    };
    await save(order).catch(() => {});
    throw error;
  }
}
async function deleteTireOrder(orderId, body, user) {
  const order = await loadOrder(orderId, body.expectedVersion);
  if (!['idle', 'applied'].includes(order.inventory?.phase)) throw new TireOrderError('Đơn đang xử lý tồn kho.', 409, 'INVENTORY_OPERATION_IN_PROGRESS');
  order.isDeleted = true;
  order.deletedAt = new Date();
  order.deletedBy = user._id;
  order.deletedByName = user.name || '';
  await save(order);
  return serialize(order);
}
async function listTireOrderHistory(orderId, vehicleEntryId) {
  objectId(orderId, 'Mã đơn'); objectId(vehicleEntryId, 'Mã xe trong đơn');
  const order = await TireOrder.findById(orderId).select('isDeleted vehicles._id'); if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404); ensureNotDeleted(order); if (!order.vehicles.id(vehicleEntryId)) throw new TireOrderError('Không tìm thấy xe trong đơn.', 404);
  const [stockMovements, activities] = await Promise.all([
    StorageHistory.find({ orderId: String(orderId), vehicleEntryId, source: { $in: ['tire_order_complete', 'tire_order_revert', 'tire_order_delete_revert'] } }).sort({ transactionDate: -1, createdAt: -1 }).lean(),
    ActivityLog.find({ entityType: 'tire_order', entityId: orderId, $or: [{ entitySubId: vehicleEntryId }, { entitySubId: null }, { entitySubId: { $exists: false } }] }).sort({ createdAt: -1 }).lean(),
  ]);
  return { stockMovements, activities };
}
module.exports = { completeTireOrder, revertTireOrder, deleteTireOrder, listTireOrderHistory };
