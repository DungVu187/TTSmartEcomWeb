const service = require('../services/tireOrderService');
const lifecycle = require('../services/tireOrderLifecycle');
const { writeTireOrderActivity } = require('../services/tireOrderActivity');

const send = (res, data, status = 200) => res.status(status).json({ success: true, data });
const sendError = (res, error) => {
  const status = error?.statusCode || 500;
  res.status(status).json({ success: false, code: error?.code, message: error?.message || 'Lỗi server.' });
};
const wrap = (handler) => async (req, res) => { try { await handler(req, res); } catch (error) { sendError(res, error); } };

const listOrders = wrap(async (req, res) => send(res, await service.listTireOrders(req.query)));
const createOrder = wrap(async (req, res) => { const order = await service.createTireOrder(req.body || {}, req.user); await writeTireOrderActivity({ order, userName: req.user.name, action: 'create_tire_order' }); send(res, { order }, 201); });
const getOrder = wrap(async (req, res) => send(res, { order: await service.getTireOrder(req.params.id) }));
const updateOrder = wrap(async (req, res) => { const order = await service.updateTireOrder(req.params.id, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'update_tire_order' }); send(res, { order }); });
const addVehicle = wrap(async (req, res) => { const order = await service.addOrderVehicle(req.params.id, req.body || {}); const entry = order.vehicles.at(-1); await writeTireOrderActivity({ order, userName: req.user.name, action: 'add_tire_order_vehicle', vehicleEntryId: entry?._id }); send(res, { order }, 201); });
const updateVehicle = wrap(async (req, res) => { const order = await service.updateOrderVehicle(req.params.id, req.params.vehicleEntryId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'update_tire_order', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const removeVehicle = wrap(async (req, res) => { const order = await service.removeOrderVehicle(req.params.id, req.params.vehicleEntryId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'remove_tire_order_vehicle', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const addAssignments = wrap(async (req, res) => { const order = await service.addAssignments(req.params.id, req.params.vehicleEntryId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'add_tire_assignment', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }, 201); });
const updateAssignment = wrap(async (req, res) => { const order = await service.updateAssignment(req.params.id, req.params.vehicleEntryId, req.params.assignmentId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'update_tire_assignment', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const moveAssignment = wrap(async (req, res) => { const order = await service.moveAssignment(req.params.id, req.params.vehicleEntryId, req.params.assignmentId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'move_tire_assignment', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const replaceAssignmentSlot = wrap(async (req, res) => { const order = await service.replaceAssignmentSlot(req.params.id, req.params.vehicleEntryId, req.params.assignmentId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'move_tire_assignment', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const deleteAssignment = wrap(async (req, res) => { const order = await service.deleteAssignment(req.params.id, req.params.vehicleEntryId, req.params.assignmentId, req.body || {}); await writeTireOrderActivity({ order, userName: req.user.name, action: 'delete_tire_assignment', vehicleEntryId: req.params.vehicleEntryId }); send(res, { order }); });
const productOptions = wrap(async (req, res) => send(res, await service.listProductOptions(req.query)));
const completeOrder = wrap(async (req, res) => { const order = await lifecycle.completeTireOrder(req.params.id, req.body || {}, req.user); await writeTireOrderActivity({ order, userName: req.user.name, action: 'complete_tire_order' }); send(res, { order }); });
const revertOrder = wrap(async (req, res) => { const order = await lifecycle.revertTireOrder(req.params.id, req.body || {}, req.user); await writeTireOrderActivity({ order, userName: req.user.name, action: 'revert_tire_order' }); send(res, { order }); });
const deleteOrder = wrap(async (req, res) => { await lifecycle.deleteTireOrder(req.params.id, req.body || {}, req.user); send(res, { deleted: true }); });
const orderHistory = wrap(async (req, res) => send(res, await lifecycle.listTireOrderHistory(req.params.id, req.query.vehicleEntryId)));

module.exports = { listOrders, createOrder, getOrder, updateOrder, addVehicle, updateVehicle, removeVehicle, addAssignments, updateAssignment, moveAssignment, replaceAssignmentSlot, deleteAssignment, productOptions, completeOrder, revertOrder, deleteOrder, orderHistory, sendError };
