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

    // 2. Gửi request GET phân trang (limit = 10, page = 1)
    const resPage1 = await request(app)
      .get('/products')
      .query({ page: 1, limit: 10 });

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.total).toBe(15);
    expect(resPage1.body.page).toBe(1);
    expect(resPage1.body.limit).toBe(10);
    expect(resPage1.body.products).toHaveLength(10);

    // 3. Gửi request GET phân trang (limit = 10, page = 2)
    const resPage2 = await request(app)
      .get('/products')
      .query({ page: 2, limit: 10 });

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.total).toBe(15);
    expect(resPage2.body.page).toBe(2);
    expect(resPage2.body.limit).toBe(10);
    expect(resPage2.body.products).toHaveLength(5);

    // 4. Gửi request lọc theo brand 'Siemens'
    const resBrand = await request(app)
      .get('/products')
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
});
