const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const { User } = require('../components/user');

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/EcomTest');
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
});

const createCustomerAgent = async () => {
  const user = new User({
    phone: '0911000001',
    password: 'password123',
    name: 'Cart Customer',
    role: 'customer'
  });
  await user.save();

  const agent = request.agent(app);
  const loginRes = await agent
    .post('/users/login')
    .send({ phone: user.phone, password: 'password123' });

  expect(loginRes.status).toBe(200);
  return { agent, user };
};

describe('Cart API', () => {
  it('adds new item, accumulates duplicate quantity, returns cart, removes item and clears cart', async () => {
    const { agent, user } = await createCustomerAgent();
    const productId = new mongoose.Types.ObjectId().toString();

    const firstAdd = await agent
      .post('/carts/addToCart')
      .send({ productId, variantIndex: 0, quantity: 2 });
    expect(firstAdd.status).toBe(200);

    let userInDb = await User.findById(user._id);
    expect(userInDb.cart).toHaveLength(1);
    expect(userInDb.cart[0].quantity).toBe(2);

    const secondAdd = await agent
      .post('/carts/addToCart')
      .send({ productId, variantIndex: 0, quantity: 3 });
    expect(secondAdd.status).toBe(200);

    userInDb = await User.findById(user._id);
    expect(userInDb.cart).toHaveLength(1);
    expect(userInDb.cart[0].quantity).toBe(5);

    const getCart = await agent.get('/carts/getCart');
    expect(getCart.status).toBe(200);
    expect(getCart.body.cart).toHaveLength(1);
    expect(getCart.body.cart[0].quantity).toBe(5);

    const remove = await agent
      .post('/carts/removeFromCart')
      .send({ productId, variantIndex: 0 });
    expect(remove.status).toBe(200);

    userInDb = await User.findById(user._id);
    expect(userInDb.cart).toHaveLength(0);

    await agent
      .post('/carts/addToCart')
      .send({ productId, variantIndex: 1, quantity: 1 });

    const clear = await agent.post('/carts/clearCart');
    expect(clear.status).toBe(200);

    userInDb = await User.findById(user._id);
    expect(userInDb.cart).toHaveLength(0);
  });
});
