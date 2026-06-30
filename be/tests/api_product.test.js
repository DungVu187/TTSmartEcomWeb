const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { Product } = require('../components/product');
const { User } = require('../components/user');

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
});

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

    // Kiểm tra xem sản phẩm đã lưu vào cơ sở dữ liệu chưa
    const productInDb = await Product.findOne({ name: 'Màn hình Siemens HMI KTP700' });
    expect(productInDb).toBeDefined();
    expect(productInDb.brand).toBe('Siemens');
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
