const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { Station } = require('../components/station');

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
  await Station.deleteMany({});
});

describe('Station API Automated Tests (Module 5)', () => {
  let adminCookie;
  let userCookie;

  beforeEach(async () => {
    // 1. Tạo tài khoản admin
    const admin = new User({
      phone: '0901112223',
      password: 'adminpassword123',
      name: 'Admin Manager',
      role: 'admin'
    });
    await admin.save();

    // Đăng nhập admin để lấy cookie
    const adminLogin = await request(app)
      .post('/users/login')
      .send({ phone: '0901112223', password: 'adminpassword123' });
    adminCookie = adminLogin.headers['set-cookie'];

    // 2. Tạo tài khoản user thường
    const customer = new User({
      phone: '0987654321',
      password: 'password123',
      name: 'Regular Customer',
      role: 'customer'
    });
    await customer.save();

    // Đăng nhập user thường để lấy cookie
    const userLogin = await request(app)
      .post('/users/login')
      .send({ phone: '0987654321', password: 'password123' });
    userCookie = userLogin.headers['set-cookie'];
  });

  it('TC-STA-001/002: Thêm station mới thành công nếu là Admin, thất bại nếu là User thường', async () => {
    // Thử thêm bằng tài khoản User thường -> Phải lỗi 403 Forbidden hoặc redirect
    const userRes = await request(app)
      .post('/stations')
      .set('Cookie', userCookie)
      .send({
        stationName: 'Trạm Trộn Bê Tông 01',
        stationCode: 'TRAM-01',
        location: 'Hà Nội'
      });
    expect(userRes.status).toBe(403);

    // Thêm bằng tài khoản Admin -> Phải thành công 201 Created
    const adminRes = await request(app)
      .post('/stations')
      .set('Cookie', adminCookie)
      .send({
        stationName: 'Trạm Trộn Bê Tông 01',
        stationCode: 'TRAM-01',
        location: 'Hà Nội'
      });
    expect(adminRes.status).toBe(201);
    expect(adminRes.body.stationName).toBe('Trạm Trộn Bê Tông 01');
    expect(adminRes.body.stationCode).toBe('TRAM-01');
  });

  it('TC-STA-003: Lấy danh sách trạm (GET /stations) yêu cầu quyền admin', async () => {
    // Tạo 1 trạm mẫu
    const station = new Station({
      stationName: 'Trạm Trộn 02',
      stationCode: 'TRAM-02',
      location: 'Hải Phòng'
    });
    await station.save();

    // Lấy không có auth -> Lỗi 401 hoặc 403
    const noAuthRes = await request(app).get('/stations');
    expect(noAuthRes.status).toBe(401);

    // Lấy bằng admin -> Thành công
    const adminRes = await request(app)
      .get('/stations')
      .set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toHaveLength(1);
    expect(adminRes.body[0].stationCode).toBe('TRAM-02');
  });

  it('TC-STA-005: Không cho tạo hai trạm có cùng mã, kể cả khác hoa thường và khoảng trắng', async () => {
    await new Station({
      stationName: 'Trạm đã tồn tại',
      stationCode: 'TRAM-DUP',
      location: 'Hà Nội'
    }).save();

    const duplicateRes = await request(app)
      .post('/stations')
      .set('Cookie', adminCookie)
      .send({
        stationName: 'Trạm bị trùng',
        stationCode: '  tram-dup  ',
        location: 'Hải Phòng'
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toContain('đã tồn tại');
    expect(await Station.countDocuments({})).toBe(1);
  });

  it('TC-STA-006: Không cho cập nhật một trạm sang mã của trạm khác', async () => {
    const firstStation = await new Station({
      stationName: 'Trạm thứ nhất',
      stationCode: 'TRAM-FIRST',
      location: 'Hà Nội'
    }).save();
    const secondStation = await new Station({
      stationName: 'Trạm thứ hai',
      stationCode: 'TRAM-SECOND',
      location: 'Hải Phòng'
    }).save();

    const duplicateRes = await request(app)
      .put(`/stations/${secondStation._id}`)
      .set('Cookie', adminCookie)
      .send({
        stationName: secondStation.stationName,
        stationCode: ` ${firstStation.stationCode.toLowerCase()} `,
        location: secondStation.location
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toContain('đã tồn tại');

    const unchangedStation = await Station.findById(secondStation._id);
    expect(unchangedStation.stationCode).toBe('TRAM-SECOND');
  });

  it('TC-STA-004: Truy cập công khai qua link inviteCode (GET /stations/public/:inviteCode)', async () => {
    // Tạo trạm mẫu
    const station = new Station({
      stationName: 'Trạm Trộn Công Cộng',
      stationCode: 'TRAM-PUB',
      location: 'Đà Nẵng',
      allowPublicSignup: true
    });
    await station.save();

    // Truy cập không cần đăng nhập
    const res = await request(app).get('/stations/public/TRAM-PUB');
    expect(res.status).toBe(200);
    expect(res.body.stationName).toBe('Trạm Trộn Công Cộng');
    // Trường ảo `inviteCode` bị loại khỏi kết quả của `toPublicStation`.
    expect(res.body.inviteCode).toBeUndefined();
  });
});
