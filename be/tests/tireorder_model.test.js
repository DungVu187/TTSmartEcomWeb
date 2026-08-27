const mongoose = require('mongoose');
const { TireOrder } = require('../models/tireorder');

const id = () => new mongoose.Types.ObjectId();
const assignment = (slotId) => ({
  productId: id(), variantIndex: 0, variantId: id(), productNameSnapshot: 'Lốp thử', exportPriceSnapshot: '1.250.000', slotId,
});
const vehicle = (vehicleId = id(), assignments = [], wheelCount) => ({
  vehicleId, licensePlateSnapshot: '51A-123.45', assignments, ...(wheelCount ? { wheelCount } : {}),
});
const order = (vehicles) => new TireOrder({ orderName: 'Đơn lốp thử', createdBy: id(), createdByName: 'Nhân viên', vehicles });

describe('TireOrder model invariants', () => {
  test('derives vehicle and tire totals on validation', async () => {
    const document = order([vehicle(id(), [assignment('front_left'), assignment('front_right')])]);
    await document.validate();
    expect(document.totalVehicles).toBe(1);
    expect(document.totalTires).toBe(2);
    expect(document.totalExportPrice).toBe(2500000);
    expect(document.stockAppliedTireCount).toBe(0);
    expect(document.isDeleted).toBe(false);
  });

  test('keeps complete order data when marked as soft deleted', async () => {
    const document = order([vehicle(id(), [assignment('front_left')])]);
    document.isDeleted = true;
    document.deletedAt = new Date('2026-08-27T06:00:00.000Z');
    document.deletedBy = id();
    document.deletedByName = 'Super Admin';
    await document.validate();
    expect(document).toMatchObject({ isDeleted: true, orderName: 'Đơn lốp thử', deletedByName: 'Super Admin' });
    expect(document.vehicles[0].assignments).toHaveLength(1);
  });

  test('rejects a duplicate vehicle within one order', async () => {
    const vehicleId = id();
    await expect(order([vehicle(vehicleId), vehicle(vehicleId)]).validate()).rejects.toThrow('Một xe chỉ được xuất hiện một lần');
  });

  test('keeps legacy vehicles on the 10-wheel layout', async () => {
    const document = order([vehicle(id(), [assignment('front_left')])]);
    await document.validate();
    expect(document.vehicles[0].wheelCount).toBe(10);
    await expect(order([vehicle(id(), [assignment('front_second_left')])]).validate()).rejects.toThrow('Vị trí lốp không thuộc sơ đồ 10 bánh');
  });

  test('accepts all twelve slots for a 12-wheel vehicle', async () => {
    const slots = [
      'front_left', 'front_right', 'front_second_left', 'front_second_right',
      'rear_left_forward_outer', 'rear_left_forward_inner', 'rear_left_aft_outer', 'rear_left_aft_inner',
      'rear_right_forward_inner', 'rear_right_forward_outer', 'rear_right_aft_inner', 'rear_right_aft_outer',
    ];
    const document = order([vehicle(id(), slots.map(assignment), 12)]);
    await document.validate();
    expect(document.totalTires).toBe(12);
  });

  test('rejects duplicate slots and assignments beyond the selected layout', async () => {
    await expect(order([vehicle(id(), [assignment('front_left'), assignment('front_left')])]).validate()).rejects.toThrow('Không được trùng vị trí');
    const slots = [
      'front_left', 'front_right', 'front_second_left', 'front_second_right',
      'rear_left_forward_outer', 'rear_left_forward_inner', 'rear_left_aft_outer', 'rear_left_aft_inner',
      'rear_right_forward_inner', 'rear_right_forward_outer', 'rear_right_aft_inner', 'rear_right_aft_outer',
    ];
    await expect(order([vehicle(id(), [...slots.map(assignment), assignment('front_left')], 12)]).validate()).rejects.toThrow('Xe 12 bánh chỉ có tối đa 12 lốp');
  });
});
