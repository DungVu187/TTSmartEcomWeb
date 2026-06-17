const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { Product } = require('../components/product');
const { User } = require('../components/user');
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
});

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
});
