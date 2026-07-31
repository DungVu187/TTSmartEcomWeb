const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../index");
const { User } = require("../components/user");

beforeAll(async () => {
  await mongoose.connect("mongodb://localhost:27017/EcomTest");
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
});

async function createUser(overrides) {
  const user = new User({
    phone: overrides.phone,
    password: "password123",
    name: overrides.name || "User Administration Test",
    role: overrides.role,
    permissions: overrides.permissions || [],
    station: overrides.station || [],
  });
  await user.save();
  return user;
}

async function loginAgent(phone) {
  const agent = request.agent(app);
  await agent
    .post("/users/login")
    .send({ phone, password: "password123" })
    .expect(200);
  return agent;
}

describe("user administration HTTP characterization", () => {
  let superadminAgent;

  beforeEach(async () => {
    await createUser({ phone: "0932000001", role: "superadmin" });
    superadminAgent = await loginAgent("0932000001");
  });

  it("replaces the full station list without deduplicating it", async () => {
    const customer = await createUser({
      phone: "0932000002",
      role: "customer",
      station: ["old-station"],
    });

    const response = await superadminAgent
      .put("/users/stations")
      .send({
        phone: "+84 932 000 002",
        stations: ["station-a", "station-a", "station-b"],
      })
      .expect(200);

    expect(response.body).toEqual({
      message: "Cập nhật danh sách trạm thành công",
      stations: ["station-a", "station-a", "station-b"],
    });

    const storedCustomer = await User.findById(customer._id);
    expect(storedCustomer.station).toEqual(["station-a", "station-a", "station-b"]);
  });

  it("adds one station and treats a duplicate as a successful no-op", async () => {
    const customer = await createUser({ phone: "0932000003", role: "customer" });

    const added = await superadminAgent
      .post(`/users/${customer._id}/stations`)
      .send({ stationId: "station-a" })
      .expect(200);

    expect(added.body.message).toBe("Đã thêm trạm");
    expect(added.body.user.station).toEqual(["station-a"]);

    const duplicate = await superadminAgent
      .post(`/users/${customer._id}/stations`)
      .send({ stationId: "station-a" })
      .expect(200);

    expect(duplicate.body.message).toBe("Trạm đã tồn tại trong user");
    const storedCustomer = await User.findById(customer._id);
    expect(storedCustomer.station).toEqual(["station-a"]);
  });

  it("keeps the internal admin-only gate even when staff has station permission", async () => {
    const customer = await createUser({ phone: "0932000004", role: "customer" });
    await createUser({
      phone: "0932000005",
      role: "staff",
      permissions: ["customer.assign_station"],
    });
    const staffAgent = await loginAgent("0932000005");

    const response = await staffAgent
      .post(`/users/${customer._id}/stations`)
      .send({ stationId: "station-a" })
      .expect(403);

    expect(response.body.message).toBe("Bạn không có quyền thực hiện chức năng này");
  });

  it("returns only the current user's station list", async () => {
    await createUser({
      phone: "0932000006",
      role: "customer",
      station: ["station-a", "station-b"],
    });
    const customerAgent = await loginAgent("0932000006");

    const response = await customerAgent
      .get("/users/my-stations")
      .expect(200);

    expect(response.body).toEqual({ stations: ["station-a", "station-b"] });
  });

  it("updates basic user fields and canonicalizes the phone", async () => {
    const customer = await createUser({ phone: "0932000007", role: "customer" });

    const response = await superadminAgent
      .put(`/users/${customer._id}`)
      .send({
        name: "Updated Customer",
        email: "updated@example.com",
        phone: "+84 912 345 678",
      })
      .expect(200);

    expect(response.body.message).toBe("Cập nhật thông tin người dùng thành công");
    expect(response.body.user).toMatchObject({
      name: "Updated Customer",
      email: "updated@example.com",
      phone: "0912345678",
    });

    const storedCustomer = await User.findById(customer._id);
    expect(storedCustomer).toMatchObject({
      name: "Updated Customer",
      email: "updated@example.com",
      phone: "0912345678",
    });
  });
});

