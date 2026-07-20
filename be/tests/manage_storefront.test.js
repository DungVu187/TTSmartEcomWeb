const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Manage } = require('../components/manage');
const { ActivityLog } = require('../components/activitylog');

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/EcomTest');
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
  await Manage.deleteMany({});
  await ActivityLog.deleteMany({});
});

const createStaffAgent = async ({ phone, permissions = [] }) => {
  await new User({
    phone,
    password: 'password123',
    name: `Staff ${phone}`,
    role: 'staff',
    functions: ['product_management'],
    permissions,
  }).save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/admin/login')
    .send({ phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  expect(loginRes.headers['set-cookie']).toBeDefined();
  return agent;
};

describe('Manage storefront authorization', () => {
  it('allows staff with storefront.manage to update introduction', async () => {
    const agent = await createStaffAgent({
      phone: '0944000001',
      permissions: ['storefront.manage'],
    });

    const res = await agent
      .put('/manages/update-introduction')
      .send({ introduction: 'Storefront intro' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.introduction).toBe('Storefront intro');
  });

  it('blocks staff missing storefront.manage on update introduction', async () => {
    const agent = await createStaffAgent({
      phone: '0944000002',
      permissions: [],
    });

    const res = await agent
      .put('/manages/update-introduction')
      .send({ introduction: 'Blocked intro' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('storefront.manage');
  });

  it('keeps GET /manages public', async () => {
    await Manage.create({ introduction: 'Public intro' });

    const res = await request(app).get('/manages/');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.introduction).toBe('Public intro');
  });

  it('allows storefront managers to configure home categories', async () => {
    const agent = await createStaffAgent({
      phone: '0944000003',
      permissions: ['storefront.manage'],
    });

    const res = await agent
      .put('/manages/update-home-categories')
      .send({
        configured: true,
        sidebarTitle: 'Thiết bị nổi bật',
        showSidebar: true,
        showQuickCategories: true,
        items: [
          {
            id: 'lighting',
            label: 'Đèn báo',
            type: 'Đèn',
            link: '',
            icon: 'ri-tb-bulb',
            image: '/images/category-light.jpg',
            showSidebar: true,
            showQuick: true,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(1);
    expect(res.body.data.homeCategoryConfig.sidebarTitle).toBe('Thiết bị nổi bật');
    expect(res.body.data.homeCategoryConfig.items).toHaveLength(1);
    expect(res.body.data.homeCategoryConfig.items[0].type).toBe('Đèn');
    expect(res.body.data.homeCategoryConfig.items[0].icon).toBe('ri-tb-bulb');
  });

  it('rejects invalid home category configuration', async () => {
    const agent = await createStaffAgent({
      phone: '0944000004',
      permissions: ['storefront.manage'],
    });

    const res = await agent
      .put('/manages/update-home-categories')
      .send({
        items: [{ label: 'Thiếu đích đến', icon: 'fa-microchip' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(0);
  });

  it('blocks staff missing storefront.manage on home category updates', async () => {
    const agent = await createStaffAgent({
      phone: '0944000005',
      permissions: [],
    });

    const res = await agent
      .put('/manages/update-home-categories')
      .send({ items: [] });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('storefront.manage');
  });
});
