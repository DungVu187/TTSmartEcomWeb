const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');
const { TelegramConfig } = require('../components/telegram');
const { ActivityLog } = require('../components/activitylog');

const previousTelegramToken = process.env.TELEGRAM_BOT_TOKEN;

beforeAll(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  await mongoose.connect('mongodb://localhost:27017/EcomTest');
});

afterAll(async () => {
  if (previousTelegramToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = previousTelegramToken;
  }
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
  await TelegramConfig.deleteMany({});
  await ActivityLog.deleteMany({});
});

const createAgent = async ({ phone, role }) => {
  await new User({
    phone,
    password: 'password123',
    name: `${role} Telegram`,
    role,
  }).save();

  const agent = request.agent(app);
  const loginPath = role === 'customer' ? '/users/login' : '/users/admin/login';
  const loginRes = await agent
    .post(loginPath)
    .send({ phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  return agent;
};

describe('Telegram configuration API', () => {
  it('allows an admin to manage Telegram recipients without returning the bot token', async () => {
    const adminAgent = await createAgent({ phone: '0955000001', role: 'admin' });

    const settingsRes = await adminAgent.get('/telegram/settings');
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.success).toBe(true);
    expect(settingsRes.body.data.botConfigured).toBe(false);
    expect(settingsRes.body.data).not.toHaveProperty('botToken');
    expect(JSON.stringify(settingsRes.body)).not.toContain('TELEGRAM_BOT_TOKEN');

    const createRes = await adminAgent
      .post('/telegram/recipients')
      .send({ label: 'Nguoi nhan thu', chatId: '123456', type: 'personal', enabled: true, notifyTypes: ['new_order'] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.chatId).toBe('123456');

    const recipientId = createRes.body.data._id;
    const updateRes = await adminAgent
      .put(`/telegram/recipients/${recipientId}`)
      .send({ label: 'Nhom HN', chatId: '-100123456', type: 'group', enabled: false, notifyTypes: ['new_order'] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.label).toBe('Nhom HN');
    expect(updateRes.body.data.type).toBe('group');
    expect(updateRes.body.data.enabled).toBe(false);

    const toggleRes = await adminAgent.put('/telegram/settings').send({ enabled: true });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.enabled).toBe(true);

    const deleteRes = await adminAgent.delete(`/telegram/recipients/${recipientId}`);
    expect(deleteRes.status).toBe(200);

    const config = await TelegramConfig.findOne();
    expect(config.recipients).toHaveLength(0);
    expect(await ActivityLog.countDocuments({ action: { $in: [
      'create_telegram_recipient',
      'update_telegram_recipient',
      'update_telegram_settings',
      'delete_telegram_recipient',
    ] } })).toBe(4);
  });

  it('blocks staff and customers from Telegram configuration routes', async () => {
    const staffAgent = await createAgent({ phone: '0955000002', role: 'staff' });
    const customerAgent = await createAgent({ phone: '0955000003', role: 'customer' });

    await staffAgent.get('/telegram/settings').expect(403);
    await staffAgent.post('/telegram/recipients').send({ chatId: '123456' }).expect(403);
    await customerAgent.get('/telegram/settings').expect(403);
    await customerAgent.post('/telegram/test').send({ chatId: '123456' }).expect(403);
  });

  it('returns a concise error when sending a test message without a bot token', async () => {
    const adminAgent = await createAgent({ phone: '0955000004', role: 'admin' });

    const res = await adminAgent.post('/telegram/test').send({ chatId: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Chưa cấu hình TELEGRAM_BOT_TOKEN trên máy chủ');
  });
});
