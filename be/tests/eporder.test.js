const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Product } = require('../components/product');
const { EpOrder } = require('../components/eporder');
const { StorageHistory } = require('../components/storagehistory');

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/EcomTest');
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
  await Product.deleteMany({});
  await EpOrder.deleteMany({});
  await StorageHistory.deleteMany({});
});

const createAdminAgent = async ({
  phone = '0933000001',
  role = 'admin',
  permissions = [],
  functions = []
} = {}) => {
  const user = new User({
    phone,
    password: 'password123',
    name: `EP ${phone}`,
    role,
    permissions,
    functions
  });
  await user.save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/admin/login')
    .send({ phone: user.phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  return agent;
};

const createEpOrder = async ({ orderName = 'Export order', productList = [] } = {}) => {
  return EpOrder.create({
    orderName,
    userName: 'Seeder',
    productList,
  });
};

const createProduct = async ({ quantityInStorage = 10, quantityForSale = 10 } = {}) => {
  return Product.create({
    type: 'PLC',
    name: 'EP Test Product',
    brand: 'Siemens',
    section: 'Thiet bi tu dong hoa',
    value: 'PLC',
    warranty: '12 thang',
    variant: [{
      price: '100000',
      color: 'Xam',
      quantityForSale,
      quantityInStorage
    }]
  });
};

describe('EpOrder API', () => {
  it('ticks one export order line and subtracts storage and sale quantities', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 10, quantityForSale: 8 });
    const order = await createEpOrder({
      orderName: 'Line complete',
      productList: [{
        productId: product._id.toString(),
        price: '20.000',
        unit: 'cai',
        quantity: 3,
        quantityEx: 0,
        status: false
      }]
    });

    const res = await agent
      .put(`/eporders/orders/${order._id}/products/0/setStatusAndQuantity`)
      .send({ status: true });

    expect(res.status).toBe(200);
    expect(res.body.productList[0].status).toBe(true);
    expect(res.body.productList[0].quantityEx).toBe(3);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variant[0].quantityInStorage).toBe(7);
    expect(updatedProduct.variant[0].quantityForSale).toBe(5);
  });

  it('keeps a completed export order line unchanged when status false is sent', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 10, quantityForSale: 8 });
    const order = await createEpOrder({
      orderName: 'Line revert',
      productList: [{
        productId: product._id.toString(),
        price: '20.000',
        unit: 'cai',
        quantity: 3,
        quantityEx: 0,
        status: false
      }]
    });

    const completeRes = await agent
      .put(`/eporders/orders/${order._id}/products/0/setStatusAndQuantity`)
      .send({ status: true });
    expect(completeRes.status).toBe(200);

    const unchangedRes = await agent
      .put(`/eporders/orders/${order._id}/products/0/setStatusAndQuantity`)
      .send({ status: false });

    expect(unchangedRes.status).toBe(200);
    expect(unchangedRes.body.productList[0].status).toBe(true);
    expect(unchangedRes.body.productList[0].quantityEx).toBe(3);

    const restoredProduct = await Product.findById(product._id);
    expect(restoredProduct.variant[0].quantityInStorage).toBe(7);
    expect(restoredProduct.variant[0].quantityForSale).toBe(5);
  });

  it('returns 400 and keeps stock unchanged when one export order line lacks stock', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 1, quantityForSale: 8 });
    const order = await createEpOrder({
      orderName: 'Line lacks stock',
      productList: [{
        productId: product._id.toString(),
        price: '20.000',
        unit: 'cai',
        quantity: 3,
        quantityEx: 0,
        status: false
      }]
    });

    const res = await agent
      .put(`/eporders/orders/${order._id}/products/0/setStatusAndQuantity`)
      .send({ status: true });

    expect(res.status).toBe(400);

    const unchangedProduct = await Product.findById(product._id);
    expect(unchangedProduct.variant[0].quantityInStorage).toBe(1);
    expect(unchangedProduct.variant[0].quantityForSale).toBe(8);
  });

  it('creates export order and setStatusAndQuantity subtracts storage and sale quantities', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 10, quantityForSale: 8 });

    const createRes = await agent
      .post('/eporders/orders')
      .send({
        orderName: 'Xuat test',
        productList: [{
          productId: product._id.toString(),
          price: '20.000',
          unit: 'cai',
          quantity: 3,
          quantityEx: 0
        }]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.total).toBe('60000');

    const statusRes = await agent
      .put(`/eporders/orders/${createRes.body._id}/setStatusAndQuantity`)
      .send({ status: true });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe(true);
    expect(statusRes.body.productList[0].quantityEx).toBe(3);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.variant[0].quantityInStorage).toBe(7);
    expect(updatedProduct.variant[0].quantityForSale).toBe(5);
  });

  it('returns 400 and keeps stock unchanged when export order lacks stock', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 1, quantityForSale: 1 });

    const createRes = await agent
      .post('/eporders/orders')
      .send({
        orderName: 'Xuat thieu ton',
        productList: [{
          productId: product._id.toString(),
          price: '20.000',
          unit: 'cai',
          quantity: 3,
          quantityEx: 0
        }]
      });

    expect(createRes.status).toBe(201);

    const statusRes = await agent
      .put(`/eporders/orders/${createRes.body._id}/setStatusAndQuantity`)
      .send({ status: true });

    expect(statusRes.status).toBe(400);

    const unchangedProduct = await Product.findById(product._id);
    expect(unchangedProduct.variant[0].quantityInStorage).toBe(1);
    expect(unchangedProduct.variant[0].quantityForSale).toBe(1);
  });

  it('allows staff with eporder.view and blocks staff missing eporder.view on list route', async () => {
    await createEpOrder({ orderName: 'Viewable export order' });
    const allowedAgent = await createAdminAgent({
      phone: '0933000002',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.view']
    });
    const blockedAgent = await createAdminAgent({
      phone: '0933000003',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: []
    });

    const allowed = await allowedAgent.get('/eporders/orders');
    expect(allowed.status).toBe(200);
    expect(allowed.body.orders).toHaveLength(1);

    const blocked = await blockedAgent.get('/eporders/orders');
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Access denied, missing permission: eporder.view');
  });

  it('allows staff with eporder.create to create export order', async () => {
    const agent = await createAdminAgent({
      phone: '0933000004',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.create']
    });

    const res = await agent
      .post('/eporders/orders')
      .send({ orderName: 'Staff create', productList: [] });

    expect(res.status).toBe(201);
    expect(res.body.orderName).toBe('Staff create');
  });

  it('returns 403 for staff with eporder.view but missing eporder.create on create route', async () => {
    const agent = await createAdminAgent({
      phone: '0933000005',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.view']
    });

    const res = await agent
      .post('/eporders/orders')
      .send({ orderName: 'Missing create', productList: [] });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied, missing permission: eporder.create');
  });

  it('allows staff with eporder.edit to update export order name', async () => {
    const order = await createEpOrder({ orderName: 'Old name' });
    const agent = await createAdminAgent({
      phone: '0933000006',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.edit']
    });

    const res = await agent
      .put(`/eporders/orders/${order._id}/name`)
      .send({ orderName: 'New name' });

    expect(res.status).toBe(200);
    expect(res.body.orderName).toBe('New name');
  });

  it('returns 403 for staff with eporder.create but missing eporder.edit on edit route', async () => {
    const agent = await createAdminAgent({
      phone: '0933000007',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.create']
    });
    const createRes = await agent
      .post('/eporders/orders')
      .send({ orderName: 'Create only', productList: [] });
    expect(createRes.status).toBe(201);

    const editRes = await agent
      .put(`/eporders/orders/${createRes.body._id}/name`)
      .send({ orderName: 'Should fail' });

    expect(editRes.status).toBe(403);
    expect(editRes.body.message).toBe('Access denied, missing permission: eporder.edit');
  });

  it('allows staff with eporder.delete and blocks staff missing eporder.delete on delete route', async () => {
    const deletable = await createEpOrder({ orderName: 'Delete allowed' });
    const protectedOrder = await createEpOrder({ orderName: 'Delete blocked' });
    const allowedAgent = await createAdminAgent({
      phone: '0933000008',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.delete']
    });
    const blockedAgent = await createAdminAgent({
      phone: '0933000009',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.view']
    });

    const allowed = await allowedAgent.delete(`/eporders/orders/${deletable._id}`);
    expect(allowed.status).toBe(200);
    expect(await EpOrder.findById(deletable._id)).toBeNull();

    const blocked = await blockedAgent.delete(`/eporders/orders/${protectedOrder._id}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Access denied, missing permission: eporder.delete');
    expect(await EpOrder.findById(protectedOrder._id)).toBeDefined();
  });

  it('requires eporder.edit for invoice image routes', async () => {
    const agent = await createAdminAgent({
      phone: '0933000010',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['eporder.view']
    });

    const uploadRes = await agent.post('/eporders/upload-image');
    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.message).toBe('Access denied, missing permission: eporder.edit');

    const deleteRes = await agent
      .delete('/eporders/delete-image')
      .query({ imageUrl: '/invoice-images/sample.webp' });
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.message).toBe('Access denied, missing permission: eporder.edit');
  });
});
