const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../models/user');
const { Product } = require('../models/product');
const { Type } = require('../models/producttype');
const { Vehicle } = require('../models/vehicle');
const { TireOrder } = require('../models/tireorder');
const { StorageHistory } = require('../models/storagehistory');
const { ActivityLog } = require('../models/activitylog');
const { TIRE_LAYOUTS } = require('../config/tireSlots');

// MongoDB on this host already stores the confirmed Test database as lowercase `test`.
const TEST_URI = 'mongodb://localhost:27017/test';

const clearTestDatabase = async () => {
  await Promise.all([
    User.deleteMany({}), Product.deleteMany({}), Type.deleteMany({}), Vehicle.deleteMany({}),
    TireOrder.deleteMany({}), StorageHistory.deleteMany({}), ActivityLog.deleteMany({}),
  ]);
};

const createAdminAgent = async () => {
  await new User({ phone: '0987000001', password: 'password123', name: 'Tire Order Admin', role: 'admin' }).save();
  const agent = request.agent(app);
  await agent.post('/users/admin/login').send({ phone: '0987000001', password: 'password123' }).expect(200);
  return agent;
};

const createStaffAgent = async (phone, permissions) => {
  await new User({ phone, password: 'password123', name: `Staff ${phone}`, role: 'staff', permissions }).save();
  const agent = request.agent(app);
  await agent.post('/users/admin/login').send({ phone, password: 'password123' }).expect(200);
  return agent;
};

const createProduct = (overrides = {}) => Product.create({
  type: 'Lốp xe', name: 'Lốp kiểm thử', brand: 'Tire Brand', section: 'Lốp', value: '12R22.5', warranty: '12 tháng',
  variant: [{ price: '100000', color: 'Đen', frame: '12R22.5', quantityForSale: 10, quantityInStorage: 10 }],
  ...overrides,
});

beforeAll(async () => {
  await mongoose.connect(TEST_URI);
  expect(mongoose.connection.name).toBe('test');
});
afterEach(clearTestDatabase);
afterAll(async () => { await clearTestDatabase(); await mongoose.disconnect(); });

describe('TireOrder integration on confirmed Test database', () => {
  test('soft deletes vehicles while preserving their documents and blocking reuse', async () => {
    const agent = await createAdminAgent();
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51Z-DELETE', name: 'Xe xóa mềm' }).expect(201)).body.data.vehicle;
    const deleted = await agent.delete(`/vehicles/${vehicle._id}`).send({ expectedVersion: vehicle.version }).expect(200);
    expect(deleted.body.data.vehicle).toMatchObject({ _id: vehicle._id, isActive: false });
    expect(await Vehicle.findById(vehicle._id)).toMatchObject({ isActive: false });
    expect((await agent.get('/vehicles?isActive=true&limit=100').expect(200)).body.data.items.some((item) => item._id === vehicle._id)).toBe(false);

    const replacementVehicle = (await agent.post('/vehicles').send({ licensePlate: '51Z-DELETE', name: 'Xe mới cùng biển số' }).expect(201)).body.data.vehicle;
    expect(replacementVehicle._id).not.toBe(vehicle._id);
    expect(replacementVehicle).toMatchObject({ licensePlate: vehicle.licensePlate, isActive: true });
    expect(await Vehicle.countDocuments({ licensePlate: vehicle.licensePlate })).toBe(2);

    const order = (await agent.post('/tire-orders').send({ orderName: 'Không dùng xe đã xóa mềm' }).expect(201)).body.data.order;
    await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(409);
    await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: replacementVehicle._id, expectedVersion: order.version }).expect(201);
  });

  test('protects tire lifecycle APIs with the dedicated view permission', async () => {
    const allowed = await createStaffAgent('0987000011', ['tirelifecycle.view']);
    const blocked = await createStaffAgent('0987000012', ['tireorder.view']);
    await allowed.get('/tire-lifecycles').expect(200);
    await blocked.get('/tire-lifecycles').expect(403);
  });

  test('keeps draft stock unchanged, completes, reverts and soft deletes without undoing completed stock', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const product = await createProduct();
    const variant = product.variant[0];

    const vehicleResponse = await agent.post('/vehicles').send({ licensePlate: '51A-123.45', name: 'Xe tải' }).expect(201);
    const vehicle = vehicleResponse.body.data.vehicle;
    expect(await ActivityLog.find({ entityType: 'vehicle', entityId: vehicle._id }).lean()).toEqual([
      expect.objectContaining({ action: 'create_vehicle', targetName: vehicle.licensePlate }),
    ]);
    await agent.post('/vehicles').send({ licensePlate: ' 51A-123.45 ' }).expect(409);

    const created = await agent.post('/tire-orders').send({ orderName: 'Đơn thay lốp kiểm thử' }).expect(201);
    let order = created.body.data.order;
    const addVehicle = await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201);
    order = addVehicle.body.data.order;
    const vehicleEntry = order.vehicles[0];

    await agent.post(`/tire-orders/${order._id}/vehicles/${vehicleEntry._id}/assignments`).send({
      productId: product._id.toString(), variantIndex: 0, variantId: variant._id.toString(), quantity: 2,
      slotIds: ['front_left', 'front_right'], expectedVersion: order.version,
    }).expect(201).then((response) => { order = response.body.data.order; });
    const listResponse = await agent.get('/tire-orders?limit=10').expect(200);
    expect(listResponse.body.data.items.find((item) => item._id === order._id).totalExportPrice).toBe(200000);
    let stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(10);
    expect(stock.variant[0].quantityInStorage).toBe(10);

    const completed = await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200);
    order = completed.body.data.order;
    expect(order.status).toBe('completed');
    stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(8);
    expect(stock.variant[0].quantityInStorage).toBe(8);
    expect(await StorageHistory.find({ orderId: order._id.toString(), source: 'tire_order_complete' })).toHaveLength(1);
    await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(409);

    const reverted = await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: order.version });
    expect(reverted.status).toBe(200);
    order = reverted.body.data.order;
    expect(order.status).toBe('processing');
    stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(10);
    expect(stock.variant[0].quantityInStorage).toBe(10);
    expect(await StorageHistory.find({ orderId: order._id.toString(), source: 'tire_order_revert' })).toHaveLength(1);

    const completedAgain = await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200);
    order = completedAgain.body.data.order;
    await agent.delete(`/tire-orders/${order._id}`).send({ expectedVersion: order.version }).expect(200);
    const deletedOrder = await TireOrder.findById(order._id);
    expect(deletedOrder).toMatchObject({ isDeleted: true, status: 'completed', inventory: { phase: 'applied' } });
    expect(deletedOrder.deletedAt).toBeInstanceOf(Date);
    expect(deletedOrder.vehicles[0].assignments).toHaveLength(2);
    expect((await agent.get('/tire-orders?limit=10').expect(200)).body.data.items.some((item) => item._id === order._id)).toBe(false);
    await agent.get(`/tire-orders/${order._id}`).expect(404);
    await agent.patch(`/tire-orders/${order._id}`).send({ orderName: 'Không được sửa', expectedVersion: deletedOrder.__v }).expect(404);
    await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: deletedOrder.__v }).expect(404);
    stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(8);
    expect(stock.variant[0].quantityInStorage).toBe(8);
    expect(await StorageHistory.find({ orderId: order._id.toString(), source: 'tire_order_delete_revert' })).toHaveLength(0);
    expect(await ActivityLog.distinct('action', { entityType: 'tire_order', entityId: order._id })).toEqual([]);
    expect(await ActivityLog.countDocuments({ entityType: 'vehicle', entityId: vehicle._id })).toBe(1);
  });

  test('does not leak another product type through product options or assignment', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const tire = await createProduct({ name: 'Lốp hiển thị' });
    const nonTire = await Product.create({ type: 'PLC', name: 'Không phải lốp', brand: 'Brand', section: 'PLC', value: 'PLC', warranty: '12 tháng', variant: [{ quantityForSale: 3, quantityInStorage: 3 }] });
    const options = await agent.get('/tire-orders/product-options?search=Không%20phải').expect(200);
    expect(options.body.data.items).toEqual([]);
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51B-111.11' }).expect(201)).body.data.vehicle;
    let order = (await agent.post('/tire-orders').send({ orderName: 'Chặn sai loại' }).expect(201)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201)).body.data.order;
    await agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({ productId: nonTire._id, variantIndex: 0, variantId: nonTire.variant[0]._id, quantity: 1, slotIds: ['front_left'], expectedVersion: order.version }).expect(400);
    expect(tire.type).toBe('Lốp xe');
  });

  test('stores the selected wheel layout and supports the extra front row only on 12-wheel vehicles', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const product = await createProduct({
      variant: [{ price: '100000', color: 'Đen', frame: '12R22.5', quantityForSale: 20, quantityInStorage: 20 }],
    });
    const variant = product.variant[0];
    const legacyVehicle = (await agent.post('/vehicles').send({ licensePlate: '51C-010.10' }).expect(201)).body.data.vehicle;
    const twelveWheelVehicle = (await agent.post('/vehicles').send({ licensePlate: '51C-012.12', wheelCount: 12 }).expect(201)).body.data.vehicle;
    expect(legacyVehicle.wheelCount).toBe(10);
    expect(twelveWheelVehicle.wheelCount).toBe(12);
    await agent.post('/vehicles').send({ licensePlate: '51C-008.08', wheelCount: 8 }).expect(400);
    let order = (await agent.post('/tire-orders').send({ orderName: 'Đơn xe 10 và 12 bánh' }).expect(201)).body.data.order;

    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({
      vehicleId: legacyVehicle._id,
      expectedVersion: order.version,
    }).expect(201)).body.data.order;
    expect(order.vehicles[0].wheelCount).toBe(10);
    await agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({
      productId: product._id.toString(), variantIndex: 0, variantId: variant._id.toString(), quantity: 1,
      slotIds: ['front_second_left'], expectedVersion: order.version,
    }).expect(400);

    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({
      vehicleId: twelveWheelVehicle._id,
      expectedVersion: order.version,
    }).expect(201)).body.data.order;
    const twelveWheelEntry = order.vehicles[1];
    expect(twelveWheelEntry.wheelCount).toBe(12);
    order = (await agent.post(`/tire-orders/${order._id}/vehicles/${twelveWheelEntry._id}/assignments`).send({
      productId: product._id.toString(), variantIndex: 0, variantId: variant._id.toString(), quantity: 12,
      slotIds: TIRE_LAYOUTS[12], expectedVersion: order.version,
    }).expect(201)).body.data.order;
    expect(order.totalTires).toBe(12);
    expect(order.vehicles[1].assignments.map((item) => item.slotId)).toEqual(expect.arrayContaining([
      'front_second_left', 'front_second_right',
    ]));

    order = (await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
    const stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(8);
    expect(stock.variant[0].quantityInStorage).toBe(8);
    const histories = await StorageHistory.find({ orderId: order._id.toString(), source: 'tire_order_complete' });
    expect(histories).toHaveLength(1);
    expect(histories[0].quantity).toBe(-12);
    const twelveWheelLifecycles = (await agent.get('/tire-lifecycles?wheelCount=12&limit=20').expect(200)).body.data;
    expect(twelveWheelLifecycles.items).toHaveLength(10);
    expect(twelveWheelLifecycles.pagination.totalItems).toBe(12);
    expect((await agent.get('/tire-lifecycles?wheelCount=10&limit=20').expect(200)).body.data.items).toHaveLength(0);
  });

  test('preserves the complete tire timeline and marks soft-deleted order links', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '30A-12345', name: 'Xe vòng đời' }).expect(201)).body.data.vehicle;
    const products = await Promise.all([1, 2, 3, 4].map((number) => createProduct({
      code: `LIFE-${number}`,
      name: `Lốp vòng đời ${number}`,
      variant: [{ price: '100000', color: 'Đen', frame: '12R22.5', quantityForSale: 5, quantityInStorage: 5 }],
    })));
    const dates = ['2021-01-10T08:00:00.000Z', '2022-01-10T08:00:00.000Z', '2023-01-10T08:00:00.000Z', '2025-01-10T08:00:00.000Z'];
    const stoppedDates = [null, '2021-12-01T08:00:00.000Z', '2022-12-01T08:00:00.000Z', '2024-12-01T08:00:00.000Z'];
    const completedOrders = [];

    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      let order = (await agent.post('/tire-orders').send({ orderName: `Đơn vòng đời ${index + 1}` }).expect(201)).body.data.order;
      order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201)).body.data.order;
      if (index === 1) {
        const activeTires = (await agent.get(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/active-tires`).expect(200)).body.data.items;
        expect(activeTires).toHaveLength(1);
        expect(activeTires[0]).toMatchObject({ slotId: 'front_left', productCode: 'LIFE-1', status: 'active' });
      }
      order = (await agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({
        productId: product._id.toString(), variantIndex: 0, variantId: product.variant[0]._id.toString(), quantity: 1,
        slotIds: ['front_left'], performedAt: dates[index],
        previousTireStoppedAtBySlot: stoppedDates[index] ? { front_left: stoppedDates[index] } : {},
        expectedVersion: order.version,
      }).expect(201)).body.data.order;
      order = (await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
      completedOrders.push(order);
    }

    let lifecycleResponse = await agent.get('/tire-lifecycles?vehicle=30A-12345&position=1&limit=10').expect(200);
    let records = lifecycleResponse.body.data.items;
    expect(lifecycleResponse.body.data.suggestions.vehicles).toContain('30A-12345');
    expect(lifecycleResponse.body.data.suggestions.tireCodes).toEqual(expect.arrayContaining(['LIFE-1', 'LIFE-4']));
    expect(records).toHaveLength(4);
    const byCode = new Map(records.map((record) => [record.productCode, record]));
    expect(byCode.get('LIFE-1')).toMatchObject({ status: 'ended', endedAt: stoppedDates[1], replacementOrderName: 'Đơn vòng đời 2' });
    expect(byCode.get('LIFE-2')).toMatchObject({ status: 'ended', replacementOrderName: 'Đơn vòng đời 3' });
    expect(byCode.get('LIFE-3')).toMatchObject({ status: 'ended', replacementOrderName: 'Đơn vòng đời 4' });
    expect(byCode.get('LIFE-4')).toMatchObject({ status: 'active', endedAt: null });

    await agent.delete(`/tire-orders/${completedOrders[1]._id}`).send({ expectedVersion: completedOrders[1].version }).expect(200);
    lifecycleResponse = await agent.get('/tire-lifecycles?vehicle=30A-12345&position=1&limit=10').expect(200);
    records = lifecycleResponse.body.data.items;
    expect(records).toHaveLength(4);
    const afterMiddleDelete = new Map(records.map((record) => [record.productCode, record]));
    expect(afterMiddleDelete.get('LIFE-1')).toMatchObject({ replacementOrderName: 'Đơn vòng đời 2', replacementOrderDeleted: true, endedAt: stoppedDates[1] });
    expect(afterMiddleDelete.get('LIFE-2')).toMatchObject({ installOrderDeleted: true, replacementOrderName: 'Đơn vòng đời 3', replacementOrderDeleted: false, endedAt: stoppedDates[2] });
    expect(afterMiddleDelete.get('LIFE-3')).toMatchObject({ installOrderDeleted: false, replacementOrderName: 'Đơn vòng đời 4' });
    expect(await TireOrder.findById(completedOrders[1]._id)).toMatchObject({ isDeleted: true });
    await agent.get(`/tire-orders/${completedOrders[1]._id}`).expect(404);
    expect((await agent.get('/tire-orders?limit=100').expect(200)).body.data.items.some((item) => item._id === completedOrders[1]._id)).toBe(false);
    expect((await Product.findById(products[1]._id)).variant[0].quantityInStorage).toBe(4);

    const detail = await agent.get(`/tire-lifecycles/${afterMiddleDelete.get('LIFE-2')._id}`).expect(200);
    expect(detail.body.data.chain.map((record) => record.productCode)).toEqual(['LIFE-1', 'LIFE-2', 'LIFE-3', 'LIFE-4']);
    expect(detail.body.data.selected).toMatchObject({ installOrderDeleted: true, replacementOrderDeleted: false });

    await agent.delete(`/tire-orders/${completedOrders[3]._id}`).send({ expectedVersion: completedOrders[3].version }).expect(200);
    lifecycleResponse = await agent.get('/tire-lifecycles?vehicle=30A-12345&position=1&limit=10').expect(200);
    expect(lifecycleResponse.body.data.items).toHaveLength(4);
    const latestAfterDelete = lifecycleResponse.body.data.items.find((record) => record.productCode === 'LIFE-4');
    expect(latestAfterDelete).toMatchObject({ status: 'active', endedAt: null, replacementOrderId: null, installOrderDeleted: true });
  });
});
