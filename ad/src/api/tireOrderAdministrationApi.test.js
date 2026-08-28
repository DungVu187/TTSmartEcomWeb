import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('./httpClient', () => ({ apiFetch: apiFetchMock }));

import * as api from './tireOrderAdministrationApi';

const success = (data = {}) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({ success: true, data }),
});

describe('tireOrderAdministrationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue(success({ marker: true }));
  });

  it('exports the complete tire feature contract', () => {
    expect(Object.keys(api).sort()).toEqual([
      'addTireAssignments', 'addTireOrderVehicle', 'completeTireOrder', 'createTireOrder', 'createVehicle',
      'deleteTireAssignment', 'deleteTireOrder', 'deleteVehicle', 'getActiveVehicleTires', 'getTireLifecycleDetail',
      'getTireOrder', 'getTireOrderHistory', 'listTireLifecycles', 'listTireOrders', 'listTireProductOptions',
      'listVehicles', 'moveTireAssignment', 'removeTireOrderVehicle', 'replaceTireAssignmentSlot', 'revertTireOrder',
      'updateTireAssignment', 'updateTireOrder', 'updateTireOrderVehicle', 'updateVehicle', 'updateVehicleStatus',
    ].sort());
  });

  it('maps order reads and lifecycle mutations without changing payloads', async () => {
    const body = { expectedVersion: 3, note: 'Kiểm thử' };
    await api.listTireOrders({ page: 2, limit: 20, search: 'Đơn A', status: '', ignored: undefined });
    await api.createTireOrder(body);
    await api.getTireOrder('order-1');
    await api.updateTireOrder('order-1', body);
    await api.deleteTireOrder('order-1', body);
    await api.completeTireOrder('order-1', body);
    await api.revertTireOrder('order-1', body);
    await api.getTireOrderHistory('order-1', 'entry-1');

    expect(apiFetchMock.mock.calls).toEqual([
      ['/tire-orders?page=2&limit=20&search=%C4%90%C6%A1n+A', {}],
      ['/tire-orders', { method: 'POST', json: body }],
      ['/tire-orders/order-1', {}],
      ['/tire-orders/order-1', { method: 'PATCH', json: body }],
      ['/tire-orders/order-1', { method: 'DELETE', json: body }],
      ['/tire-orders/order-1/complete', { method: 'POST', json: body }],
      ['/tire-orders/order-1/revert', { method: 'POST', json: body }],
      ['/tire-orders/order-1/history?vehicleEntryId=entry-1', {}],
    ]);
  });

  it('maps vehicle and assignment contracts', async () => {
    const body = { expectedVersion: 4 };
    await api.listVehicles({ isActive: 'true', search: '51A' });
    await api.createVehicle(body);
    await api.updateVehicle('vehicle-1', body);
    await api.updateVehicleStatus('vehicle-1', body);
    await api.deleteVehicle('vehicle-1', body);
    await api.addTireOrderVehicle('order-1', body);
    await api.updateTireOrderVehicle('order-1', 'entry-1', body);
    await api.removeTireOrderVehicle('order-1', 'entry-1', body);
    await api.getActiveVehicleTires('order-1', 'entry-1');
    await api.addTireAssignments('order-1', 'entry-1', body);
    await api.updateTireAssignment('order-1', 'entry-1', 'assignment-1', body);
    await api.moveTireAssignment('order-1', 'entry-1', 'assignment-1', body);
    await api.replaceTireAssignmentSlot('order-1', 'entry-1', 'assignment-1', body);
    await api.deleteTireAssignment('order-1', 'entry-1', 'assignment-1', body);

    expect(apiFetchMock.mock.calls).toEqual([
      ['/vehicles?isActive=true&search=51A', {}],
      ['/vehicles', { method: 'POST', json: body }],
      ['/vehicles/vehicle-1', { method: 'PATCH', json: body }],
      ['/vehicles/vehicle-1/status', { method: 'PATCH', json: body }],
      ['/vehicles/vehicle-1', { method: 'DELETE', json: body }],
      ['/tire-orders/order-1/vehicles', { method: 'POST', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1', { method: 'PATCH', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1', { method: 'DELETE', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1/active-tires', {}],
      ['/tire-orders/order-1/vehicles/entry-1/assignments', { method: 'POST', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1/assignments/assignment-1', { method: 'PATCH', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1/assignments/assignment-1/slot', { method: 'PATCH', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1/assignments/assignment-1/replace-slot', { method: 'POST', json: body }],
      ['/tire-orders/order-1/vehicles/entry-1/assignments/assignment-1', { method: 'DELETE', json: body }],
    ]);
  });

  it('maps product options and lifecycle list/detail filters', async () => {
    await api.listTireProductOptions({ search: 'Michelin 215', page: 1 });
    await api.listTireLifecycles({ vehicle: '51A', wheelCount: 10, status: 'active', from: '' });
    await api.getTireLifecycleDetail('life-1');

    expect(apiFetchMock.mock.calls).toEqual([
      ['/tire-orders/product-options?search=Michelin+215&page=1', {}],
      ['/tire-lifecycles?vehicle=51A&wheelCount=10&status=active', {}],
      ['/tire-lifecycles/life-1', {}],
    ]);
  });

  it('returns response data and preserves backend error metadata', async () => {
    expect(await api.getTireOrder('ok')).toEqual({ marker: true });
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({ message: 'Dữ liệu đã thay đổi.', code: 'VERSION_CONFLICT', details: { marker: 'conflict' } }),
    });
    await expect(api.getTireOrder('conflict')).rejects.toMatchObject({
      message: 'Dữ liệu đã thay đổi.', status: 409, code: 'VERSION_CONFLICT', details: { marker: 'conflict' },
    });
    apiFetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn().mockRejectedValue(new Error('invalid json')) });
    await expect(api.getTireOrder('broken')).rejects.toThrow('Không thể thực hiện yêu cầu.');
  });
});
