const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const CryptoJS = require('crypto-js');

const AES_KEY = '4iMJKyD4JOktNOP5'; // Khóa mặc định dùng trong kiểm thử.

beforeAll(async () => {
  const url = 'mongodb://localhost:27017/EcomTest';
  await mongoose.connect(url);
  process.env.AES_KEY = AES_KEY;
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('Auto-login API Tests', () => {
  it('should generate a secure token on register, and log in successfully with it', async () => {
    // 1. Đăng ký người dùng.
    const regRes = await request(app)
      .post('/users/register')
      .send({
        phone: '0987654321',
        password: 'password123',
        name: 'AutoLogin Test User',
        email: 'autolog@test.com'
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.logInString).toBeDefined();
    const token = regRes.body.logInString;
    expect(token.length).toBe(64); // Token hex tạo từ 32 byte phải có 64 ký tự.

    // 2. Đăng nhập tự động bằng token vừa tạo.
    const loginRes = await request(app)
      .post('/users/autologin')
      .send({ token });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.message).toContain('Đăng nhập tự động thành công');
    expect(loginRes.headers['set-cookie']).toBeDefined();
  });

  it('should support legacy AES encrypted tokens, perform fallback log in, and upgrade the token', async () => {
    // 1. Tạo thủ công người dùng có `logInString` AES theo cơ chế cũ.
    const raw = '0987654321+++password123';
    const legacyEncrypted = CryptoJS.AES.encrypt(raw, AES_KEY).toString();
    const legacyToken = encodeURIComponent(legacyEncrypted);

    const user = new User({
      phone: '0987654321',
      password: 'password123',
      name: 'Legacy User',
      email: 'legacy@test.com',
      logInString: legacyToken
    });
    await user.save();

    // 2. Đăng nhập tự động bằng token theo cơ chế cũ.
    const loginRes = await request(app)
      .post('/users/autologin')
      .send({ token: legacyToken });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.message).toContain('Đăng nhập tự động thành công');

    // 3. Kiểm tra `logInString` trong cơ sở dữ liệu đã được đổi sang token mới gồm 64 ký tự hex.
    const updatedUser = await User.findOne({ phone: '0987654321' });
    expect(updatedUser.logInString).toBeDefined();
    expect(updatedUser.logInString).not.toBe(legacyToken);
    expect(updatedUser.logInString.length).toBe(64);
  });

  it('should invalidate token on password change', async () => {
    // 1. Đăng ký người dùng và lấy token ban đầu.
    const regRes = await request(app)
      .post('/users/register')
      .send({
        phone: '0987654321',
        password: 'password123',
        name: 'AutoLogin Test User',
        email: 'autolog@test.com'
      });
    const originalToken = regRes.body.logInString;

    // Đăng nhập theo cách thông thường để lấy cookie xác thực.
    const loginRes = await request(app)
      .post('/users/login')
      .send({ phone: '0987654321', password: 'password123' });
    const authCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // 2. Change password
    const changeRes = await request(app)
      .put('/users/change-password')
      .set('Cookie', authCookie)
      .send({
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      });
    expect(changeRes.status).toBe(200);

    // 3. Verify original token is invalid
    const oldTokenLoginRes = await request(app)
      .post('/users/autologin')
      .send({ token: originalToken });
    expect(oldTokenLoginRes.status).toBe(401);

    // 4. Verify new token works
    const finalUser = await User.findOne({ phone: '0987654321' });
    const newToken = finalUser.logInString;
    expect(newToken).not.toBe(originalToken);

    const newTokenLoginRes = await request(app)
      .post('/users/autologin')
      .send({ token: newToken });
    expect(newTokenLoginRes.status).toBe(200);
  });

  it('should support rotate-autologin-token route by admin, invalidate old token and accept new token', async () => {
    // 1. Tạo người dùng admin.
    const adminUser = new User({
      phone: '0987654320',
      password: 'adminpassword',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin'
    });
    await adminUser.save();

    // Đăng nhập bằng tài khoản admin để lấy cookie.
    const adminLoginRes = await request(app)
      .post('/users/login')
      .send({ phone: '0987654320', password: 'adminpassword' });
    const adminCookie = adminLoginRes.headers['set-cookie'][0].split(';')[0];

    // 2. Tạo người dùng khách hàng.
    const customerUser = new User({
      phone: '0987654321',
      password: 'password123',
      name: 'Customer User',
      email: 'customer@test.com',
      logInString: 'initialCustomerToken'
    });
    await customerUser.save();

    // 3. Admin tạo lại token đăng nhập tự động cho khách hàng.
    const rotateRes = await request(app)
      .post(`/users/${customerUser._id}/rotate-autologin-token`)
      .set('Cookie', adminCookie);

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.logInString).toBeDefined();
    const newToken = rotateRes.body.logInString;
    expect(newToken).not.toBe('initialCustomerToken');

    // 4. Verify old token is invalid
    const oldLoginRes = await request(app)
      .post('/users/autologin')
      .send({ token: 'initialCustomerToken' });
    expect(oldLoginRes.status).toBe(401);

    // 5. Verify new token is valid
    const newLoginRes = await request(app)
      .post('/users/autologin')
      .send({ token: newToken });
    expect(newLoginRes.status).toBe(200);
  });
});
