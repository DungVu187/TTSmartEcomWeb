const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index');
const { User } = require('../models/user');
const { Product } = require('../models/product');
const { Type } = require('../models/producttype');
const { Vehicle } = require('../models/vehicle');
const { TireOrder } = require('../models/tireorder');
const { StorageHistory } = require('../models/storagehistory');
const { ActivityLog } = require('../models/activitylog');
const { TIRE_LAYOUTS } = require('../config/tireSlots');

jest.setTimeout(120000);

let mongoServer;

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
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('tireorder_test'));
  expect(mongoose.connection.name).toBe('tireorder_test');
});
afterEach(clearTestDatabase);
afterAll(async () => {
  await clearTestDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('TireOrder integration on isolated in-memory database', () => {
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

  test('validates, filters and updates order metadata with optimistic concurrency', async () => {
    const agent = await createAdminAgent();
    await agent.post('/tire-orders').send({ orderName: '   ' }).expect(400);
    await agent.post('/tire-orders').send({ orderName: 'Ngày lỗi', transactionDate: 'not-a-date' }).expect(400);

    const first = (await agent.post('/tire-orders').send({
      orderName: 'Đơn lọc Alpha', note: 'Ghi chú cũ', transactionDate: '2026-01-10T08:00:00.000Z',
    }).expect(201)).body.data.order;
    await agent.post('/tire-orders').send({
      orderName: 'Đơn lọc Beta', transactionDate: '2026-02-10T08:00:00.000Z',
    }).expect(201);

    const createdFrom = encodeURIComponent(new Date(Date.now() - 86400000).toISOString());
    const createdTo = encodeURIComponent(new Date(Date.now() + 86400000).toISOString());
    const searched = (await agent.get(`/tire-orders?search=Alpha&creator=Tire%20Order&status=processing&from=${createdFrom}&to=${createdTo}&limit=1`).expect(200)).body.data;
    expect(searched.items).toHaveLength(1);
    expect(searched.items[0]).toMatchObject({ _id: first._id, orderName: 'Đơn lọc Alpha' });
    expect(searched.pagination).toMatchObject({ currentPage: 1, totalItems: 1 });
    await agent.get('/tire-orders?status=invalid').expect(400);
    await agent.get('/tire-orders?from=invalid').expect(400);

    const updated = (await agent.patch(`/tire-orders/${first._id}`).send({
      orderName: 'Đơn Alpha đã sửa', note: 'Ghi chú mới', transactionDate: '2026-01-11T09:30:00.000Z', expectedVersion: first.version,
    }).expect(200)).body.data.order;
    expect(updated).toMatchObject({ orderName: 'Đơn Alpha đã sửa', note: 'Ghi chú mới' });
    expect(updated.transactionDate).toBe('2026-01-11T09:30:00.000Z');
    await agent.patch(`/tire-orders/${first._id}`).send({ orderName: 'Ghi đè', expectedVersion: first.version }).expect(409);
    await agent.patch('/tire-orders/not-an-id').send({ orderName: 'Lỗi', expectedVersion: 0 }).expect(400);
    await agent.get(`/tire-orders/${new mongoose.Types.ObjectId()}`).expect(404);
  });

  test('covers vehicle CRUD, active filtering and create-only activity logging', async () => {
    const agent = await createAdminAgent();
    const created = (await agent.post('/vehicles').send({ licensePlate: ' 51d-123.45 ', name: 'Xe ban đầu', wheelCount: 10, note: 'Cũ' }).expect(201)).body.data.vehicle;
    expect(created).toMatchObject({ licensePlate: '51D-123.45', name: 'Xe ban đầu', isActive: true });

    const updated = (await agent.patch(`/vehicles/${created._id}`).send({
      licensePlate: '51D-543.21', name: 'Xe đã sửa', wheelCount: 12, note: 'Mới', expectedVersion: created.version,
    }).expect(200)).body.data.vehicle;
    expect(updated).toMatchObject({ licensePlate: '51D-543.21', name: 'Xe đã sửa', wheelCount: 12, note: 'Mới' });
    await agent.patch(`/vehicles/${created._id}`).send({ name: 'Xung đột', expectedVersion: created.version }).expect(409);
    await agent.patch(`/vehicles/${created._id}/status`).send({ isActive: 'false', expectedVersion: updated.version }).expect(400);

    const inactive = (await agent.patch(`/vehicles/${created._id}/status`).send({ isActive: false, expectedVersion: updated.version }).expect(200)).body.data.vehicle;
    expect(inactive.isActive).toBe(false);
    expect((await agent.get('/vehicles?isActive=false&search=543.21&limit=5').expect(200)).body.data.items).toHaveLength(1);
    expect((await agent.get('/vehicles?isActive=true&search=543.21').expect(200)).body.data.items).toHaveLength(0);

    const logs = await ActivityLog.find({ entityType: 'vehicle', entityId: created._id }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'create_vehicle', targetName: '51D-123.45' });
    expect(logs[0].details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'licensePlate', newValue: '51D-123.45' }),
      expect.objectContaining({ field: 'wheelCount', newValue: '10' }),
    ]));
    await agent.delete(`/vehicles/${created._id}`).send({ expectedVersion: inactive.version - 1 }).expect(409);
    await agent.patch(`/vehicles/${new mongoose.Types.ObjectId()}`).send({ name: 'Không có', expectedVersion: 0 }).expect(404);
  });

  test('updates, moves, replaces and deletes tire assignments with date validation', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const [firstProduct, secondProduct] = await Promise.all([
      createProduct({ code: 'EDIT-1', name: 'Lốp sửa 1' }),
      createProduct({ code: 'EDIT-2', name: 'Lốp sửa 2' }),
    ]);
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51E-EDIT' }).expect(201)).body.data.vehicle;
    let order = (await agent.post('/tire-orders').send({ orderName: 'Sửa lốp' }).expect(201)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, note: 'Xe cũ', expectedVersion: order.version }).expect(201)).body.data.order;
    const entryId = order.vehicles[0]._id;

    await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments`).send({
      productId: firstProduct._id, variantIndex: 0, variantId: firstProduct.variant[0]._id, quantity: 2,
      slotIds: ['front_left'], expectedVersion: order.version,
    }).expect(400);
    await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments`).send({
      productId: firstProduct._id, variantIndex: 0, variantId: firstProduct.variant[0]._id, quantity: 2,
      slotIds: ['front_left', 'front_right'], performedAt: '2026-05-10T08:00:00.000Z', expectedVersion: order.version,
    }).expect(201).then((response) => { order = response.body.data.order; });

    const [left, right] = order.vehicles[0].assignments;
    await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments`).send({
      productId: firstProduct._id, variantIndex: 0, variantId: firstProduct.variant[0]._id, quantity: 1,
      slotIds: ['front_left'], expectedVersion: order.version,
    }).expect(409);
    await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}`).send({
      performedAt: '2026-05-10T08:00:00.000Z', previousTireStoppedAt: '2026-05-11T08:00:00.000Z', expectedVersion: order.version,
    }).expect(400);

    order = (await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}`).send({
      productId: secondProduct._id, variantIndex: 0, variantId: secondProduct.variant[0]._id,
      performedAt: '2026-05-12T08:00:00.000Z', previousTireStoppedAt: '2026-05-11T08:00:00.000Z', note: 'Đã sửa', expectedVersion: order.version,
    }).expect(200)).body.data.order;
    expect(order.vehicles[0].assignments.id).toBeUndefined();
    expect(order.vehicles[0].assignments.find((item) => item._id === left._id)).toMatchObject({ productCodeSnapshot: 'EDIT-2', note: 'Đã sửa' });

    await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}/slot`).send({ slotId: 'front_right', expectedVersion: order.version }).expect(409);
    await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}/replace-slot`).send({
      replacedAssignmentId: right._id, slotId: 'front_right', confirm: false, expectedVersion: order.version,
    }).expect(400);
    order = (await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}/replace-slot`).send({
      replacedAssignmentId: right._id, slotId: 'front_right', confirm: true, expectedVersion: order.version,
    }).expect(200)).body.data.order;
    expect(order.vehicles[0].assignments).toHaveLength(1);
    expect(order.vehicles[0].assignments[0]).toMatchObject({ _id: left._id, slotId: 'front_right' });

    order = (await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}`).send({ note: 'Xe mới', expectedVersion: order.version }).expect(200)).body.data.order;
    expect(order.vehicles[0].note).toBe('Xe mới');
    order = (await agent.delete(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${left._id}`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
    expect(order.totalTires).toBe(0);
    order = (await agent.delete(`/tire-orders/${order._id}/vehicles/${entryId}`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
    expect(order.vehicles).toHaveLength(0);
  });

  test('rejects empty completion, insufficient stock and completed-order mutations without corrupting state', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const empty = (await agent.post('/tire-orders').send({ orderName: 'Đơn rỗng' }).expect(201)).body.data.order;
    await agent.post(`/tire-orders/${empty._id}/complete`).send({ expectedVersion: empty.version }).expect(400);

    const product = await createProduct({ code: 'NO-STOCK', variant: [{ price: '1', quantityForSale: 0, quantityInStorage: 0 }] });
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51F-STOCK' }).expect(201)).body.data.vehicle;
    let order = (await agent.post('/tire-orders').send({ orderName: 'Thiếu tồn', transactionDate: '2026-06-01T08:00:00.000Z' }).expect(201)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({
      productId: product._id, variantIndex: 0, variantId: product.variant[0]._id, quantity: 1,
      slotIds: ['front_left'], expectedVersion: order.version,
    }).expect(201)).body.data.order;
    const failed = await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(400);
    expect(failed.body.code).toBe('INSUFFICIENT_SALE_STOCK');
    let persisted = await TireOrder.findById(order._id);
    expect(persisted).toMatchObject({ status: 'processing', inventory: { phase: 'idle' } });
    expect(persisted.vehicles[0].assignments[0].stockAppliedQuantity).toBe(0);
    expect(await StorageHistory.countDocuments({ orderId: order._id })).toBe(0);

    product.variant[0].quantityForSale = 2;
    product.variant[0].quantityInStorage = 2;
    await product.save();
    order = (await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: persisted.__v }).expect(200)).body.data.order;
    await agent.patch(`/tire-orders/${order._id}`).send({ transactionDate: '2026-06-02', expectedVersion: order.version }).expect(409);
    await agent.patch(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}`).send({ note: 'Không sửa', expectedVersion: order.version }).expect(409);
    await agent.get(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/active-tires`).expect(409);
    order = (await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
    await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: order.version }).expect(409);
  });

  test('returns order history and blocks every retained document after soft deletion', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const product = await createProduct({ code: 'HISTORY-1' });
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51G-HISTORY' }).expect(201)).body.data.vehicle;
    let order = (await agent.post('/tire-orders').send({ orderName: 'Lịch sử đơn' }).expect(201)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201)).body.data.order;
    const entryId = order.vehicles[0]._id;
    order = (await agent.post(`/tire-orders/${order._id}/vehicles/${entryId}/assignments`).send({
      productId: product._id, variantIndex: 0, variantId: product.variant[0]._id, quantity: 1,
      slotIds: ['front_left'], expectedVersion: order.version,
    }).expect(201)).body.data.order;
    const assignmentId = order.vehicles[0].assignments[0]._id;
    order = (await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200)).body.data.order;
    order = (await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: order.version }).expect(200)).body.data.order;

    const history = (await agent.get(`/tire-orders/${order._id}/history?vehicleEntryId=${entryId}`).expect(200)).body.data;
    expect(history.stockMovements.map((item) => item.source)).toEqual(expect.arrayContaining(['tire_order_complete', 'tire_order_revert']));
    expect(history.activities).toEqual([]);
    await agent.get(`/tire-orders/${order._id}/history?vehicleEntryId=${new mongoose.Types.ObjectId()}`).expect(404);

    await agent.delete(`/tire-orders/${order._id}`).send({ expectedVersion: order.version }).expect(200);
    const deleted = await TireOrder.findById(order._id);
    expect(deleted.isDeleted).toBe(true);
    await agent.get(`/tire-orders/${order._id}`).expect(404);
    await agent.get(`/tire-orders/${order._id}/history?vehicleEntryId=${entryId}`).expect(404);
    await agent.patch(`/tire-orders/${order._id}`).send({ note: 'Không sửa', expectedVersion: deleted.__v }).expect(404);
    await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: deleted.__v }).expect(404);
    await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}`).send({ note: 'Không sửa', expectedVersion: deleted.__v }).expect(404);
    await agent.delete(`/tire-orders/${order._id}/vehicles/${entryId}`).send({ expectedVersion: deleted.__v }).expect(404);
    await agent.get(`/tire-orders/${order._id}/vehicles/${entryId}/active-tires`).expect(404);
    await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${assignmentId}`).send({ note: 'Không sửa', expectedVersion: deleted.__v }).expect(404);
    await agent.patch(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${assignmentId}/slot`).send({ slotId: 'front_right', expectedVersion: deleted.__v }).expect(404);
    await agent.delete(`/tire-orders/${order._id}/vehicles/${entryId}/assignments/${assignmentId}`).send({ expectedVersion: deleted.__v }).expect(404);
    await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: deleted.__v }).expect(404);
    await agent.post(`/tire-orders/${order._id}/revert`).send({ expectedVersion: deleted.__v }).expect(404);
  });

  test('covers lifecycle fallback dates, filters, pagination and error contracts', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const vehicle = (await agent.post('/vehicles').send({ licensePlate: '51H-LIFE', name: 'Xe lọc' }).expect(201)).body.data.vehicle;
    const products = await Promise.all([1, 2].map((number) => createProduct({ code: `FILTER-${number}`, name: `Lốp lọc ${number}` })));
    const performedDates = ['2026-01-01T08:00:00.000Z', '2026-03-01T08:00:00.000Z'];

    for (let index = 0; index < products.length; index += 1) {
      let order = (await agent.post('/tire-orders').send({ orderName: `Đơn lọc vòng đời ${index + 1}` }).expect(201)).body.data.order;
      order = (await agent.post(`/tire-orders/${order._id}/vehicles`).send({ vehicleId: vehicle._id, expectedVersion: order.version }).expect(201)).body.data.order;
      order = (await agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({
        productId: products[index]._id, variantIndex: 0, variantId: products[index].variant[0]._id, quantity: 1,
        slotIds: ['front_left'], performedAt: performedDates[index], expectedVersion: order.version,
      }).expect(201)).body.data.order;
      await agent.post(`/tire-orders/${order._id}/complete`).send({ expectedVersion: order.version }).expect(200);
    }

    const filtered = (await agent.get('/tire-lifecycles?vehicle=Xe%20lọc&tire=FILTER-1&status=ended&from=2026-01-01&to=2026-01-31&position=1&wheelCount=10').expect(200)).body.data;
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]).toMatchObject({ productCode: 'FILTER-1', status: 'ended', endedAt: performedDates[1] });
    expect(filtered.suggestions).toMatchObject({ vehicles: ['51H-LIFE'], tireCodes: ['FILTER-1', 'FILTER-2'] });
    const active = (await agent.get('/tire-lifecycles?status=active').expect(200)).body.data.items;
    expect(active).toHaveLength(1);
    expect(active[0].productCode).toBe('FILTER-2');
    await agent.get('/tire-lifecycles?status=bad').expect(400);
    await agent.get('/tire-lifecycles?wheelCount=8').expect(400);
    await agent.get('/tire-lifecycles?from=bad').expect(400);
    await agent.get('/tire-lifecycles/not-an-id').expect(400);
    await agent.get(`/tire-lifecycles/${new mongoose.Types.ObjectId()}`).expect(404);

    const secondRecord = active[0];
    const detail = (await agent.get(`/tire-lifecycles/${secondRecord._id}`).expect(200)).body.data;
    expect(detail.chain.map((item) => item.productCode)).toEqual(['FILTER-1', 'FILTER-2']);
    expect(detail.selected.productCode).toBe('FILTER-2');
  });

  test('keeps tire serials unique while active and releases them after replacement', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const product = await createProduct({ code: 'SERIAL-TIRE' });
    const [firstVehicle, secondVehicle] = await Promise.all([
      agent.post('/vehicles').send({ licensePlate: '51S-000.01' }).expect(201).then((response) => response.body.data.vehicle),
      agent.post('/vehicles').send({ licensePlate: '51S-000.02' }).expect(201).then((response) => response.body.data.vehicle),
    ]);
    const addVehicleToOrder = async (order, vehicle) => (await agent.post(`/tire-orders/${order._id}/vehicles`).send({
      vehicleId: vehicle._id, expectedVersion: order.version,
    }).expect(201)).body.data.order;
    const addSerial = (order, slotId, value, extra = {}) => agent.post(`/tire-orders/${order._id}/vehicles/${order.vehicles[0]._id}/assignments`).send({
      productId: product._id, variantIndex: 0, variantId: product.variant[0]._id, quantity: 1,
      slotIds: [slotId], serialNumbersBySlot: { [slotId]: value }, expectedVersion: order.version, ...extra,
    });

    let duplicateBatch = (await agent.post('/tire-orders').send({ orderName: 'Trùng trong lần thêm' }).expect(201)).body.data.order;
    duplicateBatch = await addVehicleToOrder(duplicateBatch, secondVehicle);
    const duplicateResponse = await agent.post(`/tire-orders/${duplicateBatch._id}/vehicles/${duplicateBatch.vehicles[0]._id}/assignments`).send({
      productId: product._id, variantIndex: 0, variantId: product.variant[0]._id, quantity: 2,
      slotIds: ['front_left', 'front_right'], serialNumbersBySlot: { front_left: 'DUP-001', front_right: 'dup-001' }, expectedVersion: duplicateBatch.version,
    }).expect(409);
    expect(duplicateResponse.body.code).toBe('DUPLICATE_TIRE_SERIAL');

    duplicateBatch = (await addSerial(duplicateBatch, 'front_right', 'DRAFT-001').expect(201)).body.data.order;
    let otherDraft = (await agent.post('/tire-orders').send({ orderName: 'Đơn nháp B' }).expect(201)).body.data.order;
    otherDraft = await addVehicleToOrder(otherDraft, firstVehicle);
    const draftConflict = await addSerial(otherDraft, 'front_right', ' draft-001 ').expect(409);
    expect(draftConflict.body).toMatchObject({
      code: 'TIRE_SERIAL_RESERVED',
      message: 'Sản phẩm Lốp kiểm thử mã lốp DRAFT-001 đã tồn tại ở đơn Trùng trong lần thêm.',
      details: { normalizedSerial: 'DRAFT-001', serialNumber: 'DRAFT-001', orderName: 'Trùng trong lần thêm' },
    });

    let firstOrder = (await agent.post('/tire-orders').send({ orderName: 'Lắp seri lần đầu', transactionDate: '2026-01-01T08:00:00.000Z' }).expect(201)).body.data.order;
    firstOrder = await addVehicleToOrder(firstOrder, firstVehicle);
    firstOrder = (await addSerial(firstOrder, 'front_left', '  Seri-001  ', { performedAt: '2026-01-01T08:00:00.000Z' }).expect(201)).body.data.order;
    expect(firstOrder.vehicles[0].assignments[0].serialNumber).toBe('Seri-001');
    firstOrder = (await agent.post(`/tire-orders/${firstOrder._id}/complete`).send({ expectedVersion: firstOrder.version }).expect(200)).body.data.order;
    const activeTires = (await agent.get(`/tire-orders/${duplicateBatch._id}/vehicles/${duplicateBatch.vehicles[0]._id}/active-tires`).expect(200)).body.data.items;
    expect(activeTires).toEqual([]);
    expect((await agent.get('/tire-lifecycles?tire=seri-001').expect(200)).body.data.items[0]).toMatchObject({ serialNumber: 'Seri-001', status: 'active' });

    const inUse = await addSerial(duplicateBatch, 'front_left', 'seri-001', { performedAt: '2026-04-01T08:00:00.000Z' }).expect(409);
    expect(inUse.body.code).toBe('TIRE_SERIAL_IN_USE');

    let replacementOrder = (await agent.post('/tire-orders').send({ orderName: 'Tháo seri cũ', transactionDate: '2026-03-01T08:00:00.000Z' }).expect(201)).body.data.order;
    replacementOrder = await addVehicleToOrder(replacementOrder, firstVehicle);
    replacementOrder = (await addSerial(replacementOrder, 'front_left', 'SERI-002', {
      performedAt: '2026-03-01T08:00:00.000Z', previousTireStoppedAtBySlot: { front_left: '2026-02-28T08:00:00.000Z' },
    }).expect(201)).body.data.order;
    replacementOrder = (await agent.post(`/tire-orders/${replacementOrder._id}/complete`).send({ expectedVersion: replacementOrder.version }).expect(200)).body.data.order;

    duplicateBatch = (await addSerial(duplicateBatch, 'front_left', 'sErI-001', { performedAt: '2026-04-01T08:00:00.000Z' }).expect(201)).body.data.order;
    duplicateBatch = (await agent.post(`/tire-orders/${duplicateBatch._id}/complete`).send({ expectedVersion: duplicateBatch.version }).expect(200)).body.data.order;
    const revertConflict = await agent.post(`/tire-orders/${replacementOrder._id}/revert`).send({ expectedVersion: replacementOrder.version }).expect(409);
    expect(revertConflict.body.code).toBe('TIRE_SERIAL_CONFLICT_ON_REVERT');
  });

  test('enforces independent tire-order permissions for staff', async () => {
    const viewAgent = await createStaffAgent('0987000021', ['tireorder.view']);
    await viewAgent.get('/tire-orders').expect(200);
    await viewAgent.get('/vehicles').expect(200);
    await viewAgent.get('/tire-orders/product-options').expect(409);
    await viewAgent.post('/tire-orders').send({ orderName: 'Không được tạo' }).expect(403);
    await viewAgent.get('/tire-lifecycles').expect(403);

    const createAgent = await createStaffAgent('0987000022', ['tireorder.create']);
    await createAgent.post('/tire-orders').send({ orderName: 'Staff tạo' }).expect(201);
    await createAgent.post('/vehicles').send({ licensePlate: '51K-STAFF' }).expect(201);
    await createAgent.get('/tire-orders').expect(403);
    await createAgent.get('/tire-orders/product-options').expect(409);
  });
});
