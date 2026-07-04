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

const createUser = async ({
  phone,
  email,
  role = 'customer',
  password = 'password123',
  functions = [],
  permissions = []
}) => {
  const user = new User({
    phone,
    email,
    password,
    name: `Test ${phone}`,
    role,
    functions,
    permissions
  });
  await user.save();
  return user;
};

const loginAgent = async ({ phone, role = 'customer', password = 'password123' }) => {
  const agent = request.agent(app);
  const endpoint = role === 'customer' ? '/users/login' : '/users/admin/login';
  const response = await agent
    .post(endpoint)
    .send({ phone, password });

  expect(response.status).toBe(200);
  return agent;
};

const createProduct = async () => {
  return Product.create({
    type: 'PLC',
    name: 'Security Test Product',
    brand: 'Siemens',
    section: 'Thiáº¿t bá»‹ tá»± Ä‘á»™ng hÃ³a',
    value: 'PLC',
    warranty: '12 thÃ¡ng',
    variant: [{
      price: '100000',
      color: 'XÃ¡m',
      quantityForSale: 10,
      quantityInStorage: 10
    }]
  });
};

describe('Backend security hardening regression tests', () => {
  it('rejects object autologin token and keeps valid string autologin working', async () => {
    const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    await createUser({
      phone: '0920000001',
      email: 'autologin@example.com',
      logInString: validToken
    });

    await User.updateOne({ phone: '0920000001' }, { $set: { logInString: validToken } });

    const injectionResponse = await request(app)
      .post('/users/autologin')
      .send({ token: { $gt: '' } });

    expect(injectionResponse.status).toBe(400);
    expect(injectionResponse.headers['set-cookie']).toBeUndefined();

    const validResponse = await request(app)
      .post('/users/autologin')
      .send({ token: validToken });

    expect(validResponse.status).toBe(200);
    expect(validResponse.headers['set-cookie']).toBeDefined();
  });

  it('does not expose sensitive user fields through all-users', async () => {
    await createUser({
      phone: '0920000002',
      email: 'admin@example.com',
      role: 'admin'
    });
    await createUser({
      phone: '0920000003',
      email: 'customer@example.com'
    });
    await User.updateOne(
      { phone: '0920000003' },
      {
        $set: {
          logInString: 'secret-autologin-token',
          resetOtpExpires: new Date()
        }
      }
    );

    const adminAgent = await loginAgent({ phone: '0920000002', role: 'admin' });
    const response = await adminAgent.get('/users/all-users');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    for (const user of response.body) {
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('logInString');
    }
  });

  it('requires authentication for purchase count updates', async () => {
    const product = await createProduct();

    const response = await request(app)
      .put(`/products/purchase/${product._id}`)
      .send({ action: 'increase', amount: 1 });

    expect(response.status).toBe(401);
  });

  it('prevents review IDOR while allowing owner and moderators to update', async () => {
    const product = await createProduct();
    await createUser({ phone: '0920000004', email: 'owner@example.com' });
    await createUser({ phone: '0920000005', email: 'other@example.com' });
    await createUser({ phone: '0920000006', email: 'staff@example.com', role: 'staff' });
    await createUser({ phone: '0920000007', email: 'admin2@example.com', role: 'admin' });

    const ownerAgent = await loginAgent({ phone: '0920000004' });
    const otherAgent = await loginAgent({ phone: '0920000005' });
    const staffAgent = await loginAgent({ phone: '0920000006', role: 'staff' });
    const adminAgent = await loginAgent({ phone: '0920000007', role: 'admin' });

    const createReviewResponse = await ownerAgent
      .post(`/products/${product._id}/review/create`)
      .send({ comment: 'Initial review', rating: 4 });

    expect(createReviewResponse.status).toBe(201);
    const reviewId = createReviewResponse.body.review._id;

    await otherAgent
      .put(`/products/${product._id}/review/${reviewId}`)
      .send({ comment: 'Illegal edit', rating: 1 })
      .expect(403);

    await otherAgent
      .delete(`/products/${product._id}/review/${reviewId}`)
      .expect(403);

    await ownerAgent
      .put(`/products/${product._id}/review/${reviewId}`)
      .send({ comment: 'Owner edit', rating: 5 })
      .expect(200);

    await staffAgent
      .put(`/products/${product._id}/review/${reviewId}`)
      .send({ comment: 'Staff moderation', rating: 4 })
      .expect(200);

    await adminAgent
      .put(`/products/${product._id}/review/${reviewId}`)
      .send({ comment: 'Admin moderation', rating: 3 })
      .expect(200);
  });

  it('allows update_eporder permission on product setStatusAndQuantity route', async () => {
    const staff = await createUser({
      phone: '0920000008',
      email: 'ep-staff@example.com',
      role: 'staff',
      functions: ['eporder_management'],
      permissions: ['update_eporder']
    });
    const staffAgent = await loginAgent({ phone: staff.phone, role: 'staff' });
    const order = await EpOrder.create({
      userName: 'EP Staff',
      productList: [{
        productId: new mongoose.Types.ObjectId().toString(),
        price: '10000',
        unit: 'cÃ¡i',
        quantity: 2,
        quantityEx: 0
      }]
    });

    const response = await staffAgent
      .put(`/eporders/orders/${order._id}/products/0/setStatusAndQuantity`)
      .send({ status: true });

    expect(response.status).not.toBe(403);
  });
});
