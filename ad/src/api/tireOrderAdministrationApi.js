import { apiFetch } from './httpClient';

const query = (params = {}) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
const request = async (path, options = {}) => {
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.message || 'Không thể thực hiện yêu cầu.'); error.status = response.status; error.code = payload.code; error.details = payload.details; throw error; }
  return payload.data;
};
export const listTireOrders = (params) => request(`/tire-orders?${query(params)}`);
export const createTireOrder = (body) => request('/tire-orders', { method: 'POST', json: body });
export const getTireOrder = (id) => request(`/tire-orders/${id}`);
export const updateTireOrder = (id, body) => request(`/tire-orders/${id}`, { method: 'PATCH', json: body });
export const deleteTireOrder = (id, body) => request(`/tire-orders/${id}`, { method: 'DELETE', json: body });
export const completeTireOrder = (id, body) => request(`/tire-orders/${id}/complete`, { method: 'POST', json: body });
export const revertTireOrder = (id, body) => request(`/tire-orders/${id}/revert`, { method: 'POST', json: body });
export const listTireProductOptions = (params) => request(`/tire-orders/product-options?${query(params)}`);
export const addTireOrderVehicle = (id, body) => request(`/tire-orders/${id}/vehicles`, { method: 'POST', json: body });
export const updateTireOrderVehicle = (id, vehicleEntryId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}`, { method: 'PATCH', json: body });
export const removeTireOrderVehicle = (id, vehicleEntryId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}`, { method: 'DELETE', json: body });
export const getActiveVehicleTires = (id, vehicleEntryId) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/active-tires`);
export const addTireAssignments = (id, vehicleEntryId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/assignments`, { method: 'POST', json: body });
export const updateTireAssignment = (id, vehicleEntryId, assignmentId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/assignments/${assignmentId}`, { method: 'PATCH', json: body });
export const moveTireAssignment = (id, vehicleEntryId, assignmentId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/assignments/${assignmentId}/slot`, { method: 'PATCH', json: body });
export const replaceTireAssignmentSlot = (id, vehicleEntryId, assignmentId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/assignments/${assignmentId}/replace-slot`, { method: 'POST', json: body });
export const deleteTireAssignment = (id, vehicleEntryId, assignmentId, body) => request(`/tire-orders/${id}/vehicles/${vehicleEntryId}/assignments/${assignmentId}`, { method: 'DELETE', json: body });
export const listVehicles = (params) => request(`/vehicles?${query(params)}`);
export const createVehicle = (body) => request('/vehicles', { method: 'POST', json: body });
export const updateVehicle = (id, body) => request(`/vehicles/${id}`, { method: 'PATCH', json: body });
export const updateVehicleStatus = (id, body) => request(`/vehicles/${id}/status`, { method: 'PATCH', json: body });
export const deleteVehicle = (id, body) => request(`/vehicles/${id}`, { method: 'DELETE', json: body });
export const getTireOrderHistory = (id, vehicleEntryId) => request(`/tire-orders/${id}/history?${query({ vehicleEntryId })}`);
export const listTireLifecycles = (params) => request(`/tire-lifecycles?${query(params)}`);
export const getTireLifecycleDetail = (id) => request(`/tire-lifecycles/${id}`);
