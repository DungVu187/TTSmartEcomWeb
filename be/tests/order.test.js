const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { Product } = require('../components/product');
const { User } = require('../components/user');
const { StorageHistory } = require('../components/storagehistory');
const Order = mongoose.model('Order');

beforeAll(async () => {
  const url = 'mongodb://localhost:27017/EcomTest';
  await mongoose.connect(url);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await Product.deleteMany({});
  await User.deleteMany({});
  await Order.deleteMany({});
  await StorageHistory.deleteMany({});
});

const createUser = async ({ phone, role = 'customer' }) => {
  const user = new User({
    phone,
    password: 'password123',
    name: `Test ${phone}`,
    role
  });
  await user.save();
  return user;
};

const loginAgent = async ({ phone, role = 'customer' }) => {
  const agent = request.agent(app);
  const endpoint = role === 'customer' ? '/users/login' : '/users/admin/login';
  const response = await agent
    .post(endpoint)
    .send({ phone, password: 'password123' });

  expect(response.status).toBe(200);
  expect(response.headers['set-cookie']).toBeDefined();
  return agent;
};

const createProduct = async () => {
  return Product.create({
    type: 'PLC',
    name: 'Test Product',
    brand: 'Test Brand',
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

const createOrder = async ({ userPhone, product, orderCode, quantity = 1 }) => {
  return Order.create({
    orderCode,
    userPhone,
    userName: `Customer ${userPhone}`,
    cartItems: [{
      productId: product._id.toString(),
      variantIndex: 0,
      quantity
    }],
    total: 100000 * quantity
  });
};

describe('Orders API Tests (Phase 5)', () => {
  it('Test Case 9: POST /orders/create-order lưu đơn hàng và giảm số lượng tồn kho mở bán tương ứng', async () => {
    // 1. Tạo và lưu sản phẩm mẫu có tồn kho mở bán = 10
    const product = new Product({
      type: 'PLC',
      name: 'Siemens S7-1200 CPU',
      brand: 'Siemens',
      section: 'Thiết bị tự động hóa',
      value: 'PLC',
      warranty: '12 tháng',
      variant: [{
        price: '4500000',
        color: 'Xám',
        quantityForSale: 10,
        quantityInStorage: 10
      }]
    });
    const savedProduct = await product.save();

    // 2. Tạo và lưu người dùng mua hàng
    const customerUser = new User({
      phone: '0987654326',
      password: 'password123',
      name: 'Test Customer',
      role: 'customer'
    });
    await customerUser.save();

    const customerToken = jwt.sign(
      { userId: customerUser._id, phone: customerUser.phone, name: customerUser.name, role: customerUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // 3. Gửi request đặt hàng (mua 2 sản phẩm)
    const response = await request(app)
      .post('/orders/create-order')
      .set('Cookie', [`authToken=${customerToken}`])
      .send({
        cartItems: [{
          productId: savedProduct._id.toString(),
          variantIndex: 0,
          quantity: 2
        }],
        total: 9000000
      });

    // Khẳng định đặt hàng thành công
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Đặt hàng thành công');

    // 4. Kiểm tra: Số lượng tồn kho mở bán (quantityForSale) giảm từ 10 xuống còn 8
    const updatedProduct = await Product.findById(savedProduct._id);
    expect(updatedProduct.variant[0].quantityForSale).toBe(8);

    // Đảm bảo đơn hàng được lưu chính xác trong database
    const savedOrder = await Order.findOne({ userPhone: '0987654326' });
    expect(savedOrder).toBeDefined();
    expect(savedOrder.total).toBe(9000000);
    expect(savedOrder.cartItems[0].productId).toBe(savedProduct._id.toString());
  });

  it('Test Case 10: GET /orders yêu cầu quyền admin', async () => {
    // 1. Thử truy cập không có token
    const resUnauthenticated = await request(app)
      .get('/orders');
    expect(resUnauthenticated.status).toBe(401);

    // 2. Thử truy cập bằng tài khoản customer thường
    const customerUser = new User({
      phone: '0987654327',
      password: 'password123',
      role: 'customer'
    });
    await customerUser.save();

    const customerToken = jwt.sign(
      { userId: customerUser._id, phone: customerUser.phone, role: customerUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const resForbidden = await request(app)
      .get('/orders')
      .set('Cookie', [`authToken=${customerToken}`]);
    expect(resForbidden.status).toBe(403);

    // 3. Truy cập bằng tài khoản admin hợp lệ
    const adminUser = new User({
      phone: '0987654328',
      password: 'password123',
      role: 'admin'
    });
    await adminUser.save();

    const adminToken = jwt.sign(
      { userId: adminUser._id, phone: adminUser.phone, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const resSuccess = await request(app)
      .get('/orders')
      .set('Cookie', [`authToken=${adminToken}`]);

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.orders).toBeDefined();
    expect(resSuccess.body.total).toBeDefined();
  });

  it('Test Case 11: user A không xem, hủy, xóa được đơn của user B', async () => {
    const product = await createProduct();
    await createUser({ phone: '0900000001' });
    await createUser({ phone: '0900000002' });
    const order = await createOrder({
      userPhone: '0900000002',
      product,
      orderCode: 'TTSM-IDOR-01'
    });
    const userAAgent = await loginAgent({ phone: '0900000001' });

    const getResponse = await userAAgent.get(`/orders/${order._id}`);
    expect(getResponse.status).toBe(403);

    const cancelResponse = await userAAgent
      .put(`/orders/${order._id}`)
      .send({ state: 'Cancelled' });
    expect(cancelResponse.status).toBe(403);

    const deleteResponse = await userAAgent.delete(`/orders/${order._id}`);
    expect(deleteResponse.status).toBe(403);

    const unchangedOrder = await Order.findById(order._id);
    expect(unchangedOrder).toBeDefined();
    expect(unchangedOrder.state).toBe('Processing');
  });

  it('Test Case 12: chính chủ vẫn hủy và xóa được đơn của mình', async () => {
    const product = await createProduct();
    await createUser({ phone: '0900000003' });
    const ownerAgent = await loginAgent({ phone: '0900000003' });
    const orderToCancel = await createOrder({
      userPhone: '0900000003',
      product,
      orderCode: 'TTSM-OWNER-01'
    });
    const orderToDelete = await createOrder({
      userPhone: '0900000003',
      product,
      orderCode: 'TTSM-OWNER-02'
    });

    const cancelResponse = await ownerAgent
      .put(`/orders/${orderToCancel._id}`)
      .send({ state: 'Cancelled' });
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.order.state).toBe('Cancelled');

    const deleteResponse = await ownerAgent.delete(`/orders/${orderToDelete._id}`);
    expect(deleteResponse.status).toBe(200);

    const deletedOrder = await Order.findById(orderToDelete._id);
    expect(deletedOrder).toBeNull();
  });

  it('Test Case 13: admin vẫn xem và hủy được đơn của người khác', async () => {
    const product = await createProduct();
    await createUser({ phone: '0900000004' });
    await createUser({ phone: '0900000005', role: 'admin' });
    const order = await createOrder({
      userPhone: '0900000004',
      product,
      orderCode: 'TTSM-ADMIN-01'
    });
    const adminAgent = await loginAgent({ phone: '0900000005', role: 'admin' });

    const getResponse = await adminAgent.get(`/orders/${order._id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.userPhone).toBe('0900000004');

    const cancelResponse = await adminAgent
      .put(`/orders/${order._id}`)
      .send({ state: 'Cancelled' });
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.order.state).toBe('Cancelled');
  });

  it('Test Case 14: ghi StorageHistory khi admin hoàn thành và hoàn tác đơn bán online', async () => {
    const product = await createProduct();
    await createUser({ phone: '0900000006' });
    await createUser({ phone: '0900000007', role: 'admin' });
    const order = await createOrder({
      userPhone: '0900000006',
      product,
      orderCode: 'TTSM-ONLINE-01',
      quantity: 2
    });
    const adminAgent = await loginAgent({ phone: '0900000007', role: 'admin' });

    const completeResponse = await adminAgent
      .put(`/orders/update-order/${order._id}`)
      .send({ field: 'status', value: 'Completed' });
    expect(completeResponse.status).toBe(200);

    const completeHistory = await StorageHistory.findOne({
      orderId: order.orderCode,
      note: 'Đơn hàng bán online'
    });
    expect(completeHistory).toBeDefined();
    expect(completeHistory.quantity).toBe(-2);

    const revertResponse = await adminAgent
      .put(`/orders/update-order/${order._id}`)
      .send({ field: 'status', value: 'Processing' });
    expect(revertResponse.status).toBe(200);

    const revertHistory = await StorageHistory.findOne({
      orderId: order.orderCode,
      note: 'Hoàn tác đơn bán online'
    });
    expect(revertHistory).toBeDefined();
    expect(revertHistory.quantity).toBe(2);
  });

  it('Test Case 15: token cũ bị từ chối khi user đã bị xóa khỏi DB', async () => {
    const product = await createProduct();
    const customer = await createUser({ phone: '0900000008' });
    const customerAgent = await loginAgent({ phone: '0900000008' });
    const order = await createOrder({
      userPhone: '0900000008',
      product,
      orderCode: 'TTSM-DELETED-USER-01'
    });

    const beforeDeleteResponse = await customerAgent.get(`/orders/${order._id}`);
    expect(beforeDeleteResponse.status).toBe(200);

    await User.findByIdAndDelete(customer._id);

    const afterDeleteResponse = await customerAgent.get(`/orders/${order._id}`);
    expect(afterDeleteResponse.status).toBe(401);
  });
});
