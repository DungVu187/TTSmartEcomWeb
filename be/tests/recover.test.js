const request = require('supertest');
const mongoose = require('mongoose');

// Mô phỏng bộ gửi thư để kiểm thử không phụ thuộc SMTP thật; mã production vẫn gửi thư thật.
jest.mock('../mailer', () => ({
  sendNewOrderNotification: jest.fn().mockResolvedValue(undefined),
  sendResetOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../index');
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
  await User.deleteMany({});
});

describe('Password Recovery API Tests', () => {
  it('should send OTP and reset password successfully', async () => {
    // 1. Tạo người dùng có số điện thoại và email.
    const user = new User({
      phone: '0987654321',
      password: 'oldPassword123',
      email: 'customer@example.com',
      name: 'Test Customer',
      role: 'customer'
    });
    await user.save();

    // 2. Yêu cầu gửi mã OTP.
    const forgotRes = await request(app)
      .post('/users/forgot-password')
      .send({ phone: '0987 654 321' });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.message).toContain('Mã OTP đã được gửi');

    // 3. Lấy mã OTP từ cơ sở dữ liệu.
    const updatedUser = await User.findOne({ phone: '0987654321' });
    expect(updatedUser.resetOtp).toBeDefined();
    expect(updatedUser.resetOtpExpires).toBeDefined();
    const otp = updatedUser.resetOtp;

    // 4. Đặt lại mật khẩu.
    const resetRes = await request(app)
      .post('/users/reset-password')
      .send({
        phone: '+84987654321',
        otp: otp,
        newPassword: 'newPassword123',
        logInString: 'someLoginString'
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toContain('Đặt lại mật khẩu thành công');

    // 5. Kiểm tra mật khẩu đã được cập nhật.
    const finalUser = await User.findOne({ phone: '0987654321' });
    expect(finalUser.resetOtp).toBeUndefined();
    expect(finalUser.resetOtpExpires).toBeUndefined();
    const isMatch = await finalUser.comparePassword('newPassword123');
    expect(isMatch).toBe(true);
  });
});
