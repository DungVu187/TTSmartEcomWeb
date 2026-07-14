const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { Product } = require('../components/product');
const { User } = require('../components/user');
const { StorageHistory } = require('../components/storagehistory');

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
  await StorageHistory.deleteMany({});
});

const createProductPayload = (overrides = {}) => ({
  type: 'PLC',
  name: `Permission Product ${Date.now()} ${Math.random()}`,
  brand: 'Siemens',
  section: 'Automation',
  value: 'PLC',
  code: `PERM-${Date.now()}-${Math.random()}`,
  warranty: '12 months',
  variant: [{
    price: '100000',
    color: 'Gray',
    quantityForSale: 10,
    quantityInStorage: 10
  }],
  ...overrides
});

const createProductDoc = async (overrides = {}) => Product.create(createProductPayload(overrides));

const createStaffAgent = async ({ phone, permissions = [], functions = ['product_management'] }) => {
  await new User({
    phone,
    password: 'password123',
    name: `Staff ${phone}`,
    role: 'staff',
    functions,
    permissions
  }).save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/admin/login')
    .send({ phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  expect(loginRes.headers['set-cookie']).toBeDefined();
  return agent;
};

describe('Products API Tests (Phase 4)', () => {
  it('Test Case 7: GET /products phân trang và bộ lọc hoạt động chính xác', async () => {
    // 1. Thêm một vài sản phẩm mẫu trực tiếp vào DB test
    const productsToInsert = [];
    for (let i = 1; i <= 15; i++) {
      productsToInsert.push({
        type: 'PLC',
        name: `Sản phẩm PLC thứ ${i}`,
        brand: i % 2 === 0 ? 'Siemens' : 'Mitsubishi',
        section: 'Thiết bị tự động hóa',
        value: 'PLC',
        warranty: '12 tháng',
        variant: [{
          price: '5000000',
          color: 'Xám',
          quantityForSale: 10,
          quantityInStorage: 10
        }]
      });
    }
    await Product.insertMany(productsToInsert);

    const adminUser = new User({
      phone: '0987654323',
      password: 'password123',
      role: 'admin'
    });
    await adminUser.save();

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // 2. Gửi request GET phân trang (limit = 10, page = 1)
    const resPage1 = await request(app)
      .get('/products')
      .set('Cookie', [`authToken=${adminToken}`])
      .query({ page: 1, limit: 10 });

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.total).toBe(15);
    expect(resPage1.body.page).toBe(1);
    expect(resPage1.body.limit).toBe(10);
    expect(resPage1.body.products).toHaveLength(10);

    // 3. Gửi request GET phân trang (limit = 10, page = 2)
    const resPage2 = await request(app)
      .get('/products')
      .set('Cookie', [`authToken=${adminToken}`])
      .query({ page: 2, limit: 10 });

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.total).toBe(15);
    expect(resPage2.body.page).toBe(2);
    expect(resPage2.body.limit).toBe(10);
    expect(resPage2.body.products).toHaveLength(5);

    // 4. Gửi request lọc theo brand 'Siemens'
    const resBrand = await request(app)
      .get('/products')
      .set('Cookie', [`authToken=${adminToken}`])
      .query({ brand: 'Siemens' });

    expect(resBrand.status).toBe(200);
    // Có 15 sản phẩm, số chẵn từ 1 đến 15 là 2, 4, 6, 8, 10, 12, 14 (7 sản phẩm)
    expect(resBrand.body.total).toBe(7);
  });

  it('Test Case 8: POST /products/create yêu cầu quyền admin', async () => {
    const newProductData = {
      type: 'HMI',
      name: 'Màn hình Siemens HMI KTP700',
      brand: 'Siemens',
      section: 'Thiết bị hiển thị',
      value: 'HMI',
      vat: '10%',
      warranty: '12 tháng',
      variant: [{
        price: '8000000',
        color: 'Xám',
        quantityForSale: 5,
        quantityInStorage: 5
      }]
    };

    // 1. Thử tạo khi chưa đăng nhập (không gửi cookie)
    const resUnauthenticated = await request(app)
      .post('/products/create')
      .send(newProductData);
    expect(resUnauthenticated.status).toBe(401);

    // 2. Thử tạo với tài khoản customer thường
    const customerUser = new User({
      phone: '0987654324',
      password: 'password123',
      role: 'customer'
    });
    await customerUser.save();

    const customerToken = jwt.sign(
      { userId: customerUser._id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const resForbidden = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${customerToken}`])
      .send(newProductData);
    expect(resForbidden.status).toBe(403);

    // 3. Thử tạo với tài khoản admin
    const adminUser = new User({
      phone: '0987654325',
      password: 'password123',
      role: 'admin'
    });
    await adminUser.save();

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const resSuccess = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send(newProductData);

    expect(resSuccess.status).toBe(201);
    expect(resSuccess.body.message).toBe('Product created successfully');
    expect(resSuccess.body.product.name).toBe('Màn hình Siemens HMI KTP700');
    expect(resSuccess.body.product.vat).toBe('10%');
    expect(resSuccess.body.product.variant[0].earn).toBe(25);

    // Kiểm tra xem sản phẩm đã lưu vào cơ sở dữ liệu chưa
    const productInDb = await Product.findOne({ name: 'Màn hình Siemens HMI KTP700' });
    expect(productInDb).toBeDefined();
    expect(productInDb.brand).toBe('Siemens');
    expect(productInDb.vat).toBe('10%');
    expect(productInDb.variant[0].earn).toBe(25);
  });

  it('Test Case 9: POST /products/create ngăn chặn tạo trùng mã sản phẩm và trả về 409', async () => {
    const adminUser = new User({
      phone: '0987654326',
      password: 'password123',
      role: 'admin'
    });
    await adminUser.save();

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const product1 = {
      type: 'PLC',
      name: 'Siemens PLC S7-1200',
      brand: 'Siemens',
      section: 'Thiết bị tự động hóa',
      value: 'PLC',
      code: 'S71200-DUP',
      warranty: '12 tháng',
      variant: [{ price: '6000000', color: 'Xám', quantityForSale: 10, quantityInStorage: 10 }]
    };

    // 1. Tạo sản phẩm đầu tiên thành công (201)
    const res1 = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send(product1);
    expect(res1.status).toBe(201);

    // 2. Thử tạo sản phẩm thứ hai trùng mã (code: 'S71200-DUP') -> Phải trả về 409
    const product2 = {
      ...product1,
      name: 'Siemens PLC S7-1200 V2'
    };

    const res2 = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send(product2);

    expect(res2.status).toBe(409);
    expect(res2.body.message).toContain('đã tồn tại');
  });

  it('Test Case 10: POST /products/voice-query yêu cầu đăng nhập và validation âm thanh', async () => {
    // 1. Khi chưa đăng nhập -> trả về 401
    const resUnauth = await request(app)
      .post('/products/voice-query');
    expect(resUnauth.status).toBe(401);

    // 2. Đăng nhập nhưng thiếu file audio -> trả về 400
    const customerUser = new User({
      phone: '0987654327',
      password: 'password123',
      role: 'customer'
    });
    await customerUser.save();

    const customerToken = jwt.sign(
      { userId: customerUser._id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const resNoFile = await request(app)
      .post('/products/voice-query')
      .set('Cookie', [`authToken=${customerToken}`]);

    expect(resNoFile.status).toBe(400);
    expect(resNoFile.body.message).toContain('Không nhận được file âm thanh nào');
  });
  it('staff with product.create can create products and staff without it gets 403', async () => {
    const allowedAgent = await createStaffAgent({
      phone: '0987654331',
      permissions: ['product.create']
    });
    const blockedAgent = await createStaffAgent({
      phone: '0987654332',
      permissions: []
    });

    const allowed = await allowedAgent
      .post('/products/create')
      .send(createProductPayload({ name: 'Staff Product Create OK', code: 'STAFF-CREATE-OK' }));

    expect(allowed.status).toBe(201);
    expect(allowed.body.product.name).toBe('Staff Product Create OK');

    const blocked = await blockedAgent
      .post('/products/create')
      .send(createProductPayload({ name: 'Staff Product Create Blocked', code: 'STAFF-CREATE-BLOCKED' }));

    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Access denied, missing permission: product.create');
  });

  it('staff with product.edit can edit products and create-only staff cannot edit', async () => {
    const product = await createProductDoc({ name: 'Editable Product', code: 'EDITABLE-PRODUCT' });
    const allowedAgent = await createStaffAgent({
      phone: '0987654333',
      permissions: ['product.edit']
    });
    const createOnlyAgent = await createStaffAgent({
      phone: '0987654334',
      permissions: ['product.create']
    });

    const allowed = await allowedAgent
      .put(`/products/${product._id}`)
      .send({ name: 'Edited Product' });

    expect(allowed.status).toBe(200);
    expect(allowed.body.name).toBe('Edited Product');

    const blocked = await createOnlyAgent
      .put(`/products/${product._id}`)
      .send({ name: 'Blocked Edit Product' });

    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Access denied, missing permission: product.edit');
  });

  it('staff with product.delete can delete products and staff without it gets 403', async () => {
    const deletable = await createProductDoc({ name: 'Deletable Product', code: 'DELETABLE-PRODUCT' });
    const protectedProduct = await createProductDoc({ name: 'Protected Product', code: 'PROTECTED-PRODUCT' });
    const allowedAgent = await createStaffAgent({
      phone: '0987654335',
      permissions: ['product.delete']
    });
    const blockedAgent = await createStaffAgent({
      phone: '0987654336',
      permissions: ['product.edit']
    });

    const allowed = await allowedAgent.delete(`/products/${deletable._id}`);
    expect(allowed.status).toBe(200);
    expect(await Product.findById(deletable._id)).toBeNull();

    const blocked = await blockedAgent.delete(`/products/${protectedProduct._id}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Access denied, missing permission: product.delete');
    expect(await Product.findById(protectedProduct._id)).toBeDefined();
  });

  it('scan invoice accepts any scan permission and blocks staff without scan permission', async () => {
    const orderScanAgent = await createStaffAgent({
      phone: '0987654337',
      permissions: ['order.scan_ai']
    });
    const iporderScanAgent = await createStaffAgent({
      phone: '0987654338',
      permissions: ['iporder.scan_ai']
    });
    const eporderScanAgent = await createStaffAgent({
      phone: '0987654339',
      permissions: ['eporder.scan_ai']
    });
    const blockedAgent = await createStaffAgent({
      phone: '0987654340',
      permissions: []
    });

    const orderScan = await orderScanAgent.post('/products/scan-invoice');
    expect(orderScan.status).not.toBe(403);

    const iporderScan = await iporderScanAgent.post('/products/scan-invoice');
    expect(iporderScan.status).not.toBe(403);

    const eporderScan = await eporderScanAgent.post('/products/scan-invoice');
    expect(eporderScan.status).not.toBe(403);

    const blocked = await blockedAgent.post('/products/scan-invoice');
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe(
      'Access denied, missing one of permissions: order.scan_ai, iporder.scan_ai, eporder.scan_ai'
    );
  });

  it('DELETE /products/clean-temp-image requires product.edit', async () => {
    const agent = await createStaffAgent({
      phone: '0987654341',
      permissions: ['product.create']
    });

    const res = await agent
      .delete('/products/clean-temp-image')
      .query({ imageUrl: '/invoice-images/temp.webp' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied, missing permission: product.edit');
  });

  it('POST /products/:id/:variantIndex rejects a zero inventory change without writing history', async () => {
    const product = await createProductDoc({ name: 'Zero Change Product', code: 'ZERO-CHANGE-PRODUCT' });
    const agent = await createStaffAgent({
      phone: '0987654342',
      permissions: ['product.edit']
    });

    const res = await agent
      .post(`/products/${product._id}/0`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Số lượng thay đổi phải khác 0' });

    const unchangedProduct = await Product.findById(product._id);
    expect(unchangedProduct.variant[0].quantityForSale).toBe(10);
    expect(unchangedProduct.variant[0].quantityInStorage).toBe(10);
    expect(await StorageHistory.countDocuments({ productId: product._id })).toBe(0);
  });
});
describe('Product code normalized duplicate validation', () => {
  it('rejects equivalent codes ignoring spaces and symbols on create and update', async () => {
    const adminUser = new User({
      phone: '0987654328',
      password: 'password123',
      role: 'admin'
    });
    await adminUser.save();

    const adminToken = jwt.sign(
      { userId: adminUser._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const baseProduct = {
      type: 'PLC',
      name: 'Normalized Code Product A',
      brand: 'Siemens',
      section: 'Automation',
      value: 'PLC',
      code: 'S7 1200 NORM',
      warranty: '12 months',
      variant: [{ price: '6000000', color: 'Gray', quantityForSale: 10, quantityInStorage: 10 }]
    };

    const res1 = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send(baseProduct);
    expect(res1.status).toBe(201);

    const resDuplicateCreate = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send({
        ...baseProduct,
        name: 'Normalized Code Product B',
        code: 's7-1200norm'
      });
    expect(resDuplicateCreate.status).toBe(409);
    expect(resDuplicateCreate.body.message).toBeTruthy();

    const resOther = await request(app)
      .post('/products/create')
      .set('Cookie', [`authToken=${adminToken}`])
      .send({
        ...baseProduct,
        name: 'Normalized Code Product C',
        code: 'OTHER-NORM-CODE'
      });
    expect(resOther.status).toBe(201);

    const resDuplicateUpdate = await request(app)
      .put(`/products/${resOther.body.product._id}`)
      .set('Cookie', [`authToken=${adminToken}`])
      .send({ code: 'S71200NORM' });
    expect(resDuplicateUpdate.status).toBe(409);
    expect(resDuplicateUpdate.body.message).toBeTruthy();
  });
});
