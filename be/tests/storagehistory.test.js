const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Product } = require('../components/product');
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
  await StorageHistory.deleteMany({});
});

const createAdminAgent = async () => {
  const user = new User({
    phone: '0944000001',
    password: 'password123',
    name: 'History Admin',
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

const seedHistory = async () => {
  const product = await Product.create({
    type: 'PLC',
    name: 'History Product',
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

  await StorageHistory.create([
    {
      productId: product._id,
      productName: product.name,
      quantity: -2,
      userName: 'Admin',
      orderId: 'EP-001',
      orderName: 'EP-001'
    },
    {
      productId: product._id,
      productName: product.name,
      quantity: 5,
      userName: 'Admin'
    },
    {
      productId: product._id,
      productName: product.name,
      quantity: -1,
      userName: 'Admin',
      orderId: 'ONLINE-001',
      orderName: 'ONLINE-001',
      note: 'Đơn hàng bán online'
    },
    {
      productId: product._id,
      productName: product.name,
      quantity: 1,
      userName: 'Admin',
      orderId: 'ONLINE-001',
      orderName: 'ONLINE-001',
      note: 'Hoàn tác đơn bán online'
    }
  ]);
};

describe('StorageHistory API', () => {
  it('filters by xuat_don, nhap_thu_cong and ban_online noteType', async () => {
    const agent = await createAdminAgent();
    await seedHistory();

    const xuatDon = await agent.get('/histories?noteType=xuat_don');
    expect(xuatDon.status).toBe(200);
    expect(xuatDon.body.history).toHaveLength(1);
    expect(xuatDon.body.history[0].orderName).toBe('EP-001');

    const nhapThuCong = await agent.get('/histories?noteType=nhap_thu_cong');
    expect(nhapThuCong.status).toBe(200);
    expect(nhapThuCong.body.history).toHaveLength(1);
    expect(nhapThuCong.body.history[0].quantity).toBe(5);

    const banOnline = await agent.get('/histories?noteType=ban_online');
    expect(banOnline.status).toBe(200);
    expect(banOnline.body.history).toHaveLength(2);
    expect(banOnline.body.history.map((item) => item.note).sort()).toEqual([
      'Hoàn tác đơn bán online',
      'Đơn hàng bán online'
    ].sort());
  });

  it('paginates history results with allowed limit values', async () => {
    const agent = await createAdminAgent();
    await seedHistory();

    const res = await agent.get('/histories?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.total).toBe(4);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.history).toHaveLength(4);
  });
});
