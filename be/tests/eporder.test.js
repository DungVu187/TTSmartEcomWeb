const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Product } = require('../components/product');
const { EpOrder } = require('../components/eporder');

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
});

const createAdminAgent = async () => {
  const user = new User({
    phone: '0933000001',
    password: 'password123',
    name: 'EP Admin',
    role: 'admin'
  });
  await user.save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/admin/login')
    .send({ phone: user.phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  return agent;
};

const createProduct = async ({ quantityInStorage = 10, quantityForSale = 10 } = {}) => {
  return Product.create({
    type: 'PLC',
    name: 'EP Test Product',
    brand: 'Siemens',
    section: 'Thiết bị tự động hóa',
    value: 'PLC',
    warranty: '12 tháng',
    variant: [{
      price: '100000',
      color: 'Xám',
      quantityForSale,
      quantityInStorage
    }]
  });
};

describe('EpOrder API', () => {
  it('creates export order and setStatusAndQuantity subtracts storage and sale quantities', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct({ quantityInStorage: 10, quantityForSale: 8 });

    const createRes = await agent
      .post('/eporders/orders')
      .send({
        orderName: 'Xuất test',
        productList: [{
          productId: product._id.toString(),
          price: '20.000',
          unit: 'cái',
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
        orderName: 'Xuất thiếu tồn',
        productList: [{
          productId: product._id.toString(),
          price: '20.000',
          unit: 'cái',
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
});
