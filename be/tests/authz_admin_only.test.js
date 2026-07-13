const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { ZaloConfig } = require('../components/zalo');
const { ActivityLog } = require('../components/activitylog');

beforeAll(async () => {
  const url = 'mongodb://localhost:27017/EcomTest';
  await mongoose.connect(url);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
  await ZaloConfig.deleteMany({});
  await ActivityLog.deleteMany({});
});

describe('Admin-only authorization regression tests', () => {
  let adminAgent;
  let staffAgent;
  let customerAgent;
  let customerId;

  beforeEach(async () => {
    const admin = new User({
      phone: '0910000001',
      password: 'adminpassword123',
      name: 'Admin User',
      role: 'admin'
    });
    await admin.save();

    const staff = new User({
      phone: '0910000002',
      password: 'staffpassword123',
      name: 'Staff User',
      role: 'staff',
      functions: ['order_management'],
      permissions: ['order.view']
    });
    await staff.save();

    const customer = new User({
      phone: '0910000003',
      password: 'customerpassword123',
      name: 'Customer User',
      role: 'customer'
    });
    await customer.save();
    customerId = customer._id.toString();

    adminAgent = request.agent(app);
    staffAgent = request.agent(app);
    customerAgent = request.agent(app);

    await adminAgent
      .post('/users/login')
      .send({ phone: '0910000001', password: 'adminpassword123' })
      .expect(200);

    await staffAgent
      .post('/users/login')
      .send({ phone: '0910000002', password: 'staffpassword123' })
      .expect(200);

    await customerAgent
      .post('/users/login')
      .send({ phone: '0910000003', password: 'customerpassword123' })
      .expect(200);
  });

  it('blocks staff from admin-only Zalo and user management routes', async () => {
    await staffAgent
      .get('/zalo/settings')
      .expect(403);

    await staffAgent
      .post('/zalo/settings')
      .send({
        appId: 'test-app-id',
        secretKey: 'test-secret-key',
        oaId: 'test-oa-id',
        recipientUserId: 'test-recipient'
      })
      .expect(403);

    await staffAgent
      .get('/users/all-users')
      .expect(403);

    await staffAgent
      .post(`/users/${customerId}/rotate-autologin-token`)
      .expect(403);

    await staffAgent
      .get('/users/customers')
      .expect(403);
  });

  it('allows admin and continues to block customer on admin-only routes', async () => {
    await adminAgent
      .get('/zalo/settings')
      .expect(200);

    await adminAgent
      .get('/users/all-users')
      .expect(200);

    await customerAgent
      .get('/zalo/settings')
      .expect(403);
  });

  it('keeps activity logs admin-only', async () => {
    await ActivityLog.create({
      userName: 'Admin User',
      action: 'create_product',
      productName: 'Sample Product',
    });

    await adminAgent
      .get('/activity-logs')
      .expect(200);

    await staffAgent
      .get('/activity-logs')
      .expect(403);

    await customerAgent
      .get('/activity-logs')
      .expect(403);

    await request(app)
      .get('/activity-logs')
      .expect(401);
  });

  it('still allows staff to access routes through granted permissions', async () => {
    await staffAgent
      .get('/orders')
      .expect(200);
  });
});
