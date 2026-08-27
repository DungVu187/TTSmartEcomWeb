const { ActivityLog } = require('../models/activitylog');

async function writeTireOrderActivity({ order, userName, action, vehicleEntryId = null, details = [] }) {
  try {
    await new ActivityLog({
      userName: userName || 'Hệ thống',
      action,
      entityType: 'tire_order',
      entityId: order._id,
      entitySubId: vehicleEntryId || undefined,
      targetName: order.orderName,
      productName: `Đơn lốp: ${order.orderName}`,
      details,
    }).save();
  } catch (error) {
    console.error('ActivityLog error (tire order):', error.message);
  }
}

module.exports = { writeTireOrderActivity };
