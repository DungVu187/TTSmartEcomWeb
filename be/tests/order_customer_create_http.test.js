const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../mailer', () => ({
  sendNewOrderNotification: jest.fn().mockResolvedValue(undefined),
  sendResetOtpEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../zaloService', () => ({
  sendZaloOrderNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../telegramService', () => ({
  sendTelegramOrderNotification: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../index');
const { Order } = require('../models/order');
const { Product } = require('../models/product');
const { Station } = require('../models/station');
const { User } = require('../models/user');
const { sendNewOrderNotification } = require('../mailer');
const { sendZaloOrderNotification } = require('../zaloService');
const { sendTelegramOrderNotification } = require('../telegramService');

const DATABASE_URL = 'mongodb://localhost:27017/EcomTest';
const CUSTOMER_PHONE = '0984800001';
const PRODUCT_CODE_PREFIX = 'ORDER-CUSTOMER-CREATE-PRODUCT-';
const STATION_CODE_PREFIX = 'ORDER-CUSTOMER-CREATE-STATION-';
const PASSWORD = 'password123';

let fixtureSequence = 0;

const nextSuffix = () => String(Date.now()) + '-' + String(++fixtureSequence);

const cleanupFixtures = async () => {
  await Promise.all([
    Order.deleteMany({ userPhone: CUSTOMER_PHONE }),
    Product.deleteMany({ code: new RegExp('^' + PRODUCT_CODE_PREFIX) }),
    Station.deleteMany({ stationCode: new RegExp('^' + STATION_CODE_PREFIX) }),
    User.deleteMany({ phone: CUSTOMER_PHONE }),
  ]);
};

const createProduct = async ({
  name = 'Customer Create Product',
  price = '125.500',
  quantityForSale = 10,
  importPrice,
  earn,
} = {}) => {
  return Product.create({
    type: 'PLC',
    name,
    code: PRODUCT_CODE_PREFIX + nextSuffix(),
    brand: 'Customer Create Brand',
    section: 'Automation',
    value: 'PLC',
    warranty: '12 months',
    display: true,
    variant: [{
      price,
      importPrice,
      earn,
      color: 'Gray',
      quantityForSale,
      quantityInStorage: 20,
    }],
  });
};

const createStation = async (productIds = []) => {
  const suffix = nextSuffix();
  return Station.create({
    stationName: 'Customer Create Station ' + suffix,
    stationCode: STATION_CODE_PREFIX + suffix,
    productId: productIds.map((productId) => productId.toString()),
  });
};

const createCustomerAgent = async ({ cart = [], station = [] } = {}) => {
  const user = await User.create({
    phone: CUSTOMER_PHONE,
    password: PASSWORD,
    name: 'Customer Create User',
    role: 'customer',
    cart,
    station: station.map((stationId) => stationId.toString()),
  });
  const agent = request.agent(app);
  const login = await agent
    .post('/users/login')
    .send({ phone: CUSTOMER_PHONE, password: PASSWORD });
  expect(login.status).toBe(200);
  return { agent, user };
};

const orderPayload = (product, quantity = 1, stationCode) => ({
  cartItems: [{
    productId: product._id.toString(),
    variantIndex: 0,
    quantity,
  }],
  stationCode,
  total: 1,
});

beforeAll(async () => {
  await mongoose.connect(DATABASE_URL);
  await cleanupFixtures();
});

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await cleanupFixtures();
});

afterAll(async () => {
  jest.restoreAllMocks();
  await cleanupFixtures();
  await mongoose.disconnect();
});

describe('POST /orders/create-order HTTP characterization', () => {
  it('keeps the legacy 404 when the controller user lookup misses', async () => {
    const product = await createProduct();
    const { agent } = await createCustomerAgent();
    const originalFindById = User.findById.bind(User);
    jest.spyOn(User, 'findById')
      .mockImplementationOnce((...args) => originalFindById(...args))
      .mockResolvedValueOnce(null);

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Không tìm thấy người dùng.' });
  });

  it('returns the legacy 404 before stock access when the selected station is missing', async () => {
    const product = await createProduct();
    const { agent } = await createCustomerAgent();

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product, 1, STATION_CODE_PREFIX + 'MISSING'));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Không tìm thấy trạm được chọn.' });
    expect((await Product.findById(product._id)).variant[0].quantityForSale).toBe(10);
  });

  it('rejects products outside the selected station without reserving stock', async () => {
    const allowedProduct = await createProduct({ name: 'Allowed Product' });
    const blockedProduct = await createProduct({ name: 'Blocked Product' });
    const station = await createStation([allowedProduct._id]);
    const { agent } = await createCustomerAgent({ station: [station._id] });

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(blockedProduct, 2, station.stationCode));

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('không thuộc phạm vi trạm');
    expect((await Product.findById(blockedProduct._id)).variant[0].quantityForSale).toBe(10);
    expect(await Order.countDocuments({ userPhone: CUSTOMER_PHONE })).toBe(0);
  });

  it('keeps contact-only rejection outside the reservation path', async () => {
    const product = await createProduct({
      price: '5480000',
      importPrice: '5480000',
      earn: 0,
      quantityForSale: 18,
    });
    const { agent } = await createCustomerAgent();

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product));

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('chỉ nhận liên hệ');
    expect((await Product.findById(product._id)).variant[0].quantityForSale).toBe(18);
    expect(await Order.countDocuments({ userPhone: CUSTOMER_PHONE })).toBe(0);
  });

  it('creates the order, cleans the cart, links the station and emits notifications', async () => {
    const product = await createProduct();
    const station = await createStation([product._id]);
    const { agent } = await createCustomerAgent({
      cart: [{ productId: product._id.toString(), variantIndex: 0, quantity: 2 }],
    });
    const emit = jest.fn();
    const to = jest.spyOn(app.get('io'), 'to').mockReturnValue({ emit });

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product, 2, station.stationCode));

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Đặt hàng thành công');
    expect(response.body.success).toBeUndefined();
    expect(response.body.order).toMatchObject({
      userPhone: CUSTOMER_PHONE,
      total: 251000,
      status: 'Processing',
      state: 'Processing',
    });
    expect((await Product.findById(product._id)).variant[0].quantityForSale).toBe(8);
    const updatedUser = await User.findOne({ phone: CUSTOMER_PHONE });
    expect(updatedUser.cart).toHaveLength(0);
    expect(updatedUser.station).toContain(station._id.toString());
    expect(sendNewOrderNotification).toHaveBeenCalledWith(expect.objectContaining({
      userPhone: CUSTOMER_PHONE,
      total: 251000,
      stationNames: station.stationName,
      stationCodes: station.stationCode,
    }));
    expect(sendZaloOrderNotification).toHaveBeenCalledWith(expect.objectContaining({
      userPhone: CUSTOMER_PHONE,
      total: 251000,
    }));
    expect(sendTelegramOrderNotification).toHaveBeenCalledWith(expect.objectContaining({
      stationNames: station.stationName,
      stationCodes: station.stationCode,
    }));
    expect(to).toHaveBeenCalledWith('admins');
    expect(emit).toHaveBeenCalledWith('order_created', expect.objectContaining({
      orderCode: response.body.order.orderCode,
      userPhone: CUSTOMER_PHONE,
      total: 251000,
    }));
  });

  it('rolls reserved stock back when saving the Order fails', async () => {
    const product = await createProduct({ quantityForSale: 8 });
    const { agent } = await createCustomerAgent();
    jest.spyOn(Order.prototype, 'save').mockRejectedValueOnce(new Error('forced customer save failure'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product, 2));

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Lỗi khi tạo đơn hàng');
    expect((await Product.findById(product._id)).variant[0].quantityForSale).toBe(8);
    expect(await Order.countDocuments({ userPhone: CUSTOMER_PHONE })).toBe(0);
  });

  it('keeps a successful response when all notification channels reject', async () => {
    const product = await createProduct();
    const { agent } = await createCustomerAgent();
    sendNewOrderNotification.mockRejectedValueOnce(new Error('forced email failure'));
    sendZaloOrderNotification.mockRejectedValueOnce(new Error('forced Zalo failure'));
    sendTelegramOrderNotification.mockRejectedValueOnce(new Error('forced Telegram failure'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await agent
      .post('/orders/create-order')
      .send(orderPayload(product));

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Đặt hàng thành công');
    expect((await Product.findById(product._id)).variant[0].quantityForSale).toBe(9);
    expect(await Order.countDocuments({ userPhone: CUSTOMER_PHONE })).toBe(1);
  });
});
