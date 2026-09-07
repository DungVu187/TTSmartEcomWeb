const { TireOrder } = require('../models/tireorder');

class TireSerialError extends Error {
  constructor(message, code = 'TIRE_SERIAL_IN_USE', details) {
    super(message);
    this.statusCode = 409;
    this.code = code;
    this.details = details;
  }
}

const normalizeTireSerial = (value) => String(value || '').trim().normalize('NFKC').toLocaleUpperCase('vi-VN');
const asObject = (value) => (value?.toObject ? value.toObject() : value);

const compareRecords = (left, right) => (
  left.startedAt.getTime() - right.startedAt.getTime()
  || left.sequenceAt.getTime() - right.sequenceAt.getTime()
  || left.installOrderId.localeCompare(right.installOrderId)
  || left.assignmentId.localeCompare(right.assignmentId)
);

const buildActiveSerialRecords = (orders) => {
  const activeByPosition = new Map();
  for (const rawOrder of orders) {
    const order = asObject(rawOrder);
    for (const vehicle of order.vehicles || []) {
      for (const assignment of vehicle.assignments || []) {
        const serialNumber = String(assignment.serialNumber || '').trim();
        const startedAt = new Date(assignment.performedAt || order.transactionDate || order.completedAt || order.createdAt);
        if (Number.isNaN(startedAt.getTime())) continue;
        const sequenceAt = new Date(order.completedAt || order.createdAt || startedAt);
        const record = {
          serialNumber,
          normalizedSerial: normalizeTireSerial(serialNumber),
          vehicleId: String(vehicle.vehicleId),
          licensePlate: vehicle.licensePlateSnapshot || '',
          slotId: String(assignment.slotId || ''),
          startedAt,
          sequenceAt,
          installOrderId: String(order._id),
          assignmentId: String(assignment._id),
        };
        const positionKey = `${record.vehicleId}:${record.slotId}`;
        const current = activeByPosition.get(positionKey);
        if (!current || compareRecords(current, record) < 0) activeByPosition.set(positionKey, record);
      }
    }
  }
  return [...activeByPosition.values()].filter((record) => record.normalizedSerial);
};

const assertNoActiveSerialDuplicates = (records, code = 'TIRE_SERIAL_IN_USE') => {
  const bySerial = new Map();
  for (const record of records) {
    const existing = bySerial.get(record.normalizedSerial);
    if (existing && (existing.vehicleId !== record.vehicleId || existing.slotId !== record.slotId)) {
      throw new TireSerialError(`Mã lốp "${record.serialNumber}" đang được sử dụng ở một vị trí khác.`, code, {
        normalizedSerial: record.normalizedSerial,
        serialNumber: record.serialNumber,
      });
    }
    bySerial.set(record.normalizedSerial, record);
  }
};

const assertNotReservedByDraftOrder = (candidateOrder, draftOrders) => {
  const reservations = new Map();
  for (const order of draftOrders) for (const vehicle of order.vehicles || []) for (const assignment of vehicle.assignments || []) {
    const normalizedSerial = normalizeTireSerial(assignment.serialNumber);
    if (!normalizedSerial || reservations.has(normalizedSerial)) continue;
    reservations.set(normalizedSerial, {
      normalizedSerial,
      serialNumber: String(assignment.serialNumber).trim(),
      productName: assignment.productNameSnapshot || assignment.productCodeSnapshot || 'Lốp',
      orderId: String(order._id),
      orderName: order.orderName || 'đơn khác',
    });
  }
  for (const vehicle of candidateOrder.vehicles || []) for (const assignment of vehicle.assignments || []) {
    const normalizedSerial = normalizeTireSerial(assignment.serialNumber);
    const reservation = reservations.get(normalizedSerial);
    if (!reservation) continue;
    const message = `Sản phẩm ${reservation.productName} mã lốp ${reservation.serialNumber} đã tồn tại ở đơn ${reservation.orderName}.`;
    throw new TireSerialError(message, 'TIRE_SERIAL_RESERVED', reservation);
  }
};

const loadCompletedOrders = async (excludedOrderId) => {
  const filter = { status: 'completed' };
  if (excludedOrderId) filter._id = { $ne: excludedOrderId };
  return TireOrder.find(filter)
    .select('orderName transactionDate completedAt createdAt vehicles')
    .lean();
};

const loadDraftOrders = async (excludedOrderId) => TireOrder.find({
  status: 'processing',
  isDeleted: { $ne: true },
  ...(excludedOrderId ? { _id: { $ne: excludedOrderId } } : {}),
}).select('orderName vehicles').lean();

async function assertProjectedOrderSerialsAvailable(order) {
  const orderValue = asObject(order);
  const [completedOrders, draftOrders] = await Promise.all([
    loadCompletedOrders(orderValue._id),
    loadDraftOrders(orderValue._id),
  ]);
  assertNotReservedByDraftOrder(orderValue, draftOrders);
  completedOrders.push({ ...orderValue, status: 'completed' });
  assertNoActiveSerialDuplicates(buildActiveSerialRecords(completedOrders));
}

async function assertRevertKeepsSerialsUnique(orderId) {
  const completedOrders = await loadCompletedOrders(orderId);
  assertNoActiveSerialDuplicates(buildActiveSerialRecords(completedOrders), 'TIRE_SERIAL_CONFLICT_ON_REVERT');
}

module.exports = {
  TireSerialError,
  normalizeTireSerial,
  buildActiveSerialRecords,
  assertProjectedOrderSerialsAvailable,
  assertRevertKeepsSerialsUnique,
};
