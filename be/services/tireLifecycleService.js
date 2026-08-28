const mongoose = require('mongoose');
const { TireOrder } = require('../models/tireorder');
const { slotsForWheelCount } = require('../config/tireSlots');
const { TireOrderError, ensureNotDeleted } = require('./tireOrderService');

const normalizedText = (value) => String(value || '').trim().toLocaleLowerCase('vi-VN');
const validDate = (value, field, endOfDay = false) => {
  if (!value) return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TireOrderError(`${field} không hợp lệ.`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) result.setHours(23, 59, 59, 999);
  return result;
};

const compareEvents = (left, right) => (
  left.startedAt.getTime() - right.startedAt.getTime()
  || left.sequenceAt.getTime() - right.sequenceAt.getTime()
  || left.installOrderId.localeCompare(right.installOrderId)
  || left._id.localeCompare(right._id)
);

async function buildLifecycleRecords() {
  const orders = await TireOrder.find({ status: 'completed' })
    .select('orderName transactionDate completedAt createdAt isDeleted deletedAt vehicles')
    .sort({ completedAt: 1, createdAt: 1, _id: 1 })
    .lean();
  const chains = new Map();

  for (const order of orders) {
    for (const vehicle of order.vehicles || []) {
      const wheelCount = Number(vehicle.wheelCount || 10) === 12 ? 12 : 10;
      const slots = slotsForWheelCount(wheelCount);
      for (const assignment of vehicle.assignments || []) {
        const startedAt = new Date(assignment.performedAt || order.transactionDate || order.completedAt || order.createdAt);
        if (Number.isNaN(startedAt.getTime())) continue;
        const slotId = String(assignment.slotId || '');
        const positionNumber = slots.indexOf(slotId) + 1;
        if (!positionNumber) continue;
        const vehicleId = String(vehicle.vehicleId);
        const chainKey = `${vehicleId}:${slotId}`;
        const record = {
          _id: String(assignment._id),
          vehicleId,
          vehicleEntryId: String(vehicle._id),
          licensePlate: vehicle.licensePlateSnapshot,
          vehicleName: vehicle.vehicleNameSnapshot || '',
          wheelCount,
          slotId,
          positionNumber,
          productId: String(assignment.productId),
          variantId: String(assignment.variantId),
          productCode: assignment.productCodeSnapshot || '',
          productName: assignment.productNameSnapshot || '',
          brand: assignment.brandSnapshot || '',
          serialNumber: assignment.serialNumber || '',
          startedAt,
          previousTireStoppedAt: assignment.previousTireStoppedAt ? new Date(assignment.previousTireStoppedAt) : null,
          endedAt: null,
          status: 'active',
          installOrderId: String(order._id),
          installOrderName: order.orderName,
          installOrderDeleted: Boolean(order.isDeleted),
          replacementOrderId: null,
          replacementOrderName: '',
          replacementOrderDeleted: false,
          sequenceAt: new Date(order.completedAt || order.createdAt || startedAt),
        };
        if (!chains.has(chainKey)) chains.set(chainKey, []);
        chains.get(chainKey).push(record);
      }
    }
  }

  const records = [];
  for (const chain of chains.values()) {
    chain.sort(compareEvents);
    chain.forEach((record, index) => {
      const next = chain[index + 1];
      if (next) {
        record.endedAt = next.previousTireStoppedAt || next.startedAt;
        record.status = 'ended';
        record.replacementOrderId = next.installOrderId;
        record.replacementOrderName = next.installOrderName;
        record.replacementOrderDeleted = next.installOrderDeleted;
      }
      delete record.sequenceAt;
      records.push(record);
    });
  }
  return records;
}

const matchesQuery = (record, query) => {
  const vehicle = normalizedText(query.vehicle);
  const tire = normalizedText(query.tire);
  const wheelCount = Number.parseInt(query.wheelCount, 10);
  const slot = Number.parseInt(query.position, 10);
  if (vehicle && !normalizedText(`${record.licensePlate} ${record.vehicleName}`).includes(vehicle)) return false;
  if (tire && !normalizedText(`${record.productCode} ${record.productName} ${record.serialNumber}`).includes(tire)) return false;
  if (query.wheelCount && record.wheelCount !== wheelCount) return false;
  if (query.position && (!Number.isInteger(slot) || record.positionNumber !== slot)) return false;
  if (query.status && record.status !== query.status) return false;
  return true;
};

async function listTireLifecycles(query = {}) {
  if (query.status && !['active', 'ended'].includes(query.status)) throw new TireOrderError('Trạng thái vòng đời không hợp lệ.');
  if (query.wheelCount && ![10, 12].includes(Number.parseInt(query.wheelCount, 10))) throw new TireOrderError('Loại xe chỉ hỗ trợ 10 hoặc 12 bánh.');
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const from = validDate(query.from, 'Từ ngày');
  const to = validDate(query.to, 'Đến ngày', true);
  const allRecords = await buildLifecycleRecords();
  const suggestions = {
    vehicles: [...new Set(allRecords.map((record) => record.licensePlate).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'vi')),
    tireCodes: [...new Set(allRecords.map((record) => record.productCode).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'vi')),
  };
  let records = allRecords.filter((record) => matchesQuery(record, query));
  if (from) records = records.filter((record) => record.startedAt >= from);
  if (to) records = records.filter((record) => record.startedAt <= to);
  records.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime() || right._id.localeCompare(left._id));
  const totalItems = records.length;
  const items = records.slice((page - 1) * limit, page * limit);
  return { items, suggestions, pagination: { currentPage: page, totalPages: Math.max(1, Math.ceil(totalItems / limit)), totalItems, limit } };
}

async function getTireLifecycleDetail(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new TireOrderError('Mã vòng đời lốp không hợp lệ.', 400, 'INVALID_LIFECYCLE_ID');
  const records = await buildLifecycleRecords();
  const selected = records.find((record) => record._id === String(id));
  if (!selected) throw new TireOrderError('Không tìm thấy vòng đời lốp.', 404, 'TIRE_LIFECYCLE_NOT_FOUND');
  const chain = records
    .filter((record) => record.vehicleId === selected.vehicleId && record.slotId === selected.slotId)
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  return { selected, chain };
}

async function getActiveTiresForOrderVehicle(orderId, vehicleEntryId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new TireOrderError('Mã đơn không hợp lệ.', 400, 'INVALID_ORDER_ID');
  if (!mongoose.Types.ObjectId.isValid(vehicleEntryId)) throw new TireOrderError('Mã xe trong đơn không hợp lệ.', 400, 'INVALID_ORDER_VEHICLE_ID');
  const order = await TireOrder.findById(orderId).select('status isDeleted vehicles');
  if (!order) throw new TireOrderError('Không tìm thấy đơn lốp.', 404, 'ORDER_NOT_FOUND');
  ensureNotDeleted(order);
  if (order.status !== 'processing') throw new TireOrderError('Đơn đã hoàn thành, không thể chọn lốp thay thế.', 409, 'ORDER_NOT_EDITABLE');
  const vehicle = order.vehicles.id(vehicleEntryId);
  if (!vehicle) throw new TireOrderError('Không tìm thấy xe trong đơn.', 404, 'ORDER_VEHICLE_NOT_FOUND');
  const allowedSlots = new Set(slotsForWheelCount(vehicle.wheelCount));
  const records = await buildLifecycleRecords();
  const items = records
    .filter((record) => (
      record.vehicleId === String(vehicle.vehicleId)
      && record.status === 'active'
      && allowedSlots.has(record.slotId)
    ))
    .map((record) => ({
      _id: record._id,
      slotId: record.slotId,
      positionNumber: record.positionNumber,
      productCode: record.productCode,
      productName: record.productName,
      serialNumber: record.serialNumber,
      startedAt: record.startedAt,
      status: record.status,
    }));
  return { items };
}

module.exports = { buildLifecycleRecords, listTireLifecycles, getTireLifecycleDetail, getActiveTiresForOrderVehicle };
