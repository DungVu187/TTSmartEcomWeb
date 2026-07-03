const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Product } = require('../components/product');
const { IpOrder } = require('../components/iporder');

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
  await IpOrder.deleteMany({});
});

const createAdminAgent = async ({ phone = '0922000001', role = 'admin', permissions = [] } = {}) => {
  const user = new User({
    phone,
    password: 'password123',
    name: `Admin ${phone}`,
    role,
    permissions
  });
  await user.save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/admin/login')
    .send({ phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  return agent;
};

const createProduct = async () => {
  return Product.create({
    type: 'PLC',
    name: 'IP Test Product',
    brand: 'Siemens',
    section: 'Thiết bị tự động hóa',
    value: 'PLC',
    warranty: '12 tháng',
    variant: [{
      price: '100000',
      color: 'Xám',
      quantityForSale: 10,
      quantityInStorage: 10
    }]
  });
};

describe('IpOrder API', () => {
  it('creates import order with calculated total and fetches detail with product information', async () => {
    const agent = await createAdminAgent();
    const product = await createProduct();

    const createRes = await agent
      .post('/iporders/orders')
      .send({
        orderName: 'Nhập test',
        productList: [{
          productId: product._id.toString(),
          price: '12.500',
          unit: 'cái',
          quantity: 4
        }]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.total).toBe('50000');

    const detailRes = await agent.get(`/iporders/orders/${createRes.body._id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.productList[0].name).toBe('IP Test Product');
    expect(detailRes.body.productList[0].brand).toBe('Siemens');
  });

  it('returns 403 for staff missing update_iporder permission on create route', async () => {
    const agent = await createAdminAgent({
      phone: '0922000002',
      role: 'staff',
      permissions: ['read_iporder']
    });

    const res = await agent
      .post('/iporders/orders')
      .send({ orderName: 'Không đủ quyền', productList: [] });

    expect(res.status).toBe(403);
  });
});
