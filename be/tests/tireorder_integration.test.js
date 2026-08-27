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
  test('keeps draft stock unchanged, completes, reverts and deletes with exact stock history', async () => {
    const agent = await createAdminAgent();
    await Type.create({ Type: 'Lốp xe' });
    const product = await createProduct();
    const variant = product.variant[0];

    const vehicleResponse = await agent.post('/vehicles').send({ licensePlate: '51A-123.45', name: 'Xe tải' }).expect(201);
    const vehicle = vehicleResponse.body.data.vehicle;
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
    expect(await TireOrder.findById(order._id)).toBeNull();
    stock = await Product.findById(product._id);
    expect(stock.variant[0].quantityForSale).toBe(10);
    expect(stock.variant[0].quantityInStorage).toBe(10);
    expect(await StorageHistory.find({ orderId: order._id.toString(), source: 'tire_order_delete_revert' })).toHaveLength(1);
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
  });
});
