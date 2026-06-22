const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const router = express.Router();

// Rate limiting configuration
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max = parseInt(process.env.RATE_LIMIT_MAX) || 100;

const authLimiter = rateLimit({
  windowMs,
  max,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});


// Schema cho User (giữ nguyên)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
  },
  cart: [
    {
      productId: {
        type: String,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      variantIndex: {
        type: Number,
        required: true,
      },
      status: {
        type: Boolean,
        default: true,
      },
    },
  ],
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["admin", "staff", "customer"],
    default: "customer",
  },
  functions: [
    {
      type: String,
    },
  ],
  permissions: [
    {
      type: String,
    },
  ],
  orderTemplate: [
    {
      displayName: {
        type: String,
      },
      products: [
        {
          productId: {
            type: String,
          },
          quantity: {
            type: Number,
            default: 1,
          },
        },
      ],
    },
  ],
  station: [
    {
      type: String,
      trim: true
    },
  ],
  addresses: [
    {
      label: { type: String, default: "Công trình" },
      receiverName: { type: String },
      receiverPhone: { type: String },
      addressDetail: { type: String },
      isDefault: { type: Boolean, default: false },
    }
  ],
  logInString: {
    type: String
  }
});

// Hàm gán quyền dựa trên functions (giữ nguyên)
const assignPermissionsForFunctions = (functions = []) => {
  const functionPermissions = {
    order_management: ["read_order", "update_order", "delete_order"],
    iporder_management: ["read_iporder", "update_iporder", "delete_iporder"],
    eporder_management: ["read_eporder", "update_eporder", "delete_eporder"],
    product_management: ["read_product", "update_product", "delete_product"],
  };
  return functions.reduce((perms, func) => {
    return [...perms, ...(functionPermissions[func] || [])];
  }, []);
};

const getCookieOptions = (req, maxAge = 43200000) => {
  const origin = req.headers.origin || "";
  const isLocaltunnel = origin.includes("loca.lt") || origin.includes("localtunnel");
  // Chỉ set secure khi thực sự chạy trên HTTPS hoặc qua localtunnel
  const secureCookie = isLocaltunnel || req.secure;
  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite: secureCookie ? "none" : "lax",
    ...(maxAge ? { maxAge } : {})
  };
};

// Middleware xác thực admin (đọc token từ cookie)
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.authToken; // Đọc token từ cookie
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || user.role === "customer") {
      return res.status(403).json({ message: "Access denied, not an admin or staff" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in authenticateAdmin:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware xác thực user (đọc token từ cookie)
const authenticateUser = async (req, res, next) => {
  const token = req.cookies.authToken; // Đọc token từ cookie
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error in authenticateUser:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware kiểm tra quyền (đọc token từ cookie)
const checkPermission = (requiredPermission) => async (req, res, next) => {
  const token = req.cookies.authToken; // Đọc token từ cookie
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    if (user.role === "admin") {
      req.user = user;
      return next();
    }
    const userPermissions = user.permissions || [];
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({ message: `Access denied, missing permission: ${requiredPermission}` });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in checkPermission:", error.message);
    if (error.name === "JsonWebTokenError" && error.message === "jwt malformed") {
      return res.status(400).json({ message: "Token JWT không hợp lệ hoặc sai định dạng" });
    }
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Hash mật khẩu trước khi lưu (giữ nguyên)
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// So sánh mật khẩu (giữ nguyên)
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

const User = mongoose.model("User", userSchema);

// Đăng ký người dùng (Nodemon restart)
router.post("/register", authLimiter, (req, res, next) => {
  if (process.env.PUBLIC_SIGNUP_ENABLED === "true") {
    next();
  } else {
    authenticateAdmin(req, res, next);
  }
}, async (req, res) => {
  try {
    const { email, phone, name, password, role, functions, permissions, logInString, stationCode, inviteCode } = req.body;
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "Email hoặc số điện thoại đã tồn tại" });
    }

    let finalRole = "customer";
    let finalPermissions = [];

    // Phân quyền tạo tài khoản:
    // 1. Nếu không phải đăng ký công khai và người thực hiện là Admin -> Có toàn quyền gán role/permissions
    // 2. Nếu người thực hiện là Staff -> Chỉ được phép tạo tài khoản customer với permissions rỗng
    // 3. Nếu là đăng ký công khai (PUBLIC_SIGNUP_ENABLED=true) -> Chỉ tạo tài khoản customer với permissions rỗng
    if (process.env.PUBLIC_SIGNUP_ENABLED !== "true" && req.user) {
      if (req.user.role === "admin") {
        finalRole = role || "customer";
        finalPermissions = finalRole === "staff" && functions
          ? permissions || assignPermissionsForFunctions(functions)
          : permissions || [];
      } else {
        finalRole = "customer";
        finalPermissions = [];
      }
    } else {
      finalRole = "customer";
      finalPermissions = [];
    }

    let userStations = [];
    if (process.env.PUBLIC_SIGNUP_ENABLED === "true") {
      const publicInviteCode = inviteCode || stationCode;
      if (publicInviteCode) {
        const { findStationByInviteCode } = require('./station');
        const station = await findStationByInviteCode(publicInviteCode);
        if (!station) {
          return res.status(400).json({ message: "Mã link trạm không hợp lệ" });
        }
        if (!station.allowPublicSignup) {
          return res.status(403).json({ message: "Trạm hiện không cho phép đăng ký công khai" });
        }
        userStations.push(station._id.toString());
      }
    } else if (stationCode && req.user?.role === "admin") {
      const { Station } = require('./station');
      const station = await Station.findOne({ stationCode });
      if (station) {
        userStations.push(station._id.toString());
      }
    }

    const newUser = new User({
      email,
      phone,
      name,
      password,
      role: finalRole,
      functions: finalRole === "staff" ? functions || [] : [],
      permissions: finalPermissions,
      logInString: logInString,
      station: userStations
    });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error in register:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Đăng nhập người dùng (sử dụng cookie)
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        functions: user.functions || [],
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" } // Cập nhật thành 12 tiếng
    );
    // Đặt token vào httpOnly cookie
    res.cookie("authToken", token, getCookieOptions(req, 43200000));
    res.json({ message: "Đăng nhập thành công" });
  } catch (error) {
    console.error("Lỗi trong đăng nhập:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Đăng nhập admin/staff (sử dụng cookie)
router.post("/admin/login", authLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      return res.status(403).json({ message: "Truy cập bị từ chối. Chỉ dành cho admin hoặc nhân viên" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        functions: user.functions || [],
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" } // Cập nhật thành 12 tiếng
    );
    // Đặt token vào httpOnly cookie
    res.cookie("authToken", token, getCookieOptions(req, 43200000));
    res.json({ message: "Đăng nhập admin thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Đăng xuất (xóa cookie)
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", getCookieOptions(req, null));
  res.json({ message: "Logout successful" });
});

router.put("/change-password", authLimiter, authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword, logInString } = req.body;

    if (!logInString) {
      return res.status(400).json({ message: "Thiếu logInString" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    }

    user.password = newPassword;
    user.logInString = logInString;

    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/all-users", authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error in get users:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");;
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật thông tin cá nhân của người dùng hiện tại
router.put("/profile", authenticateUser, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    await user.save();
    
    const userObj = user.toObject();
    delete userObj.password;
    
    res.json({ message: "Cập nhật thông tin cá nhân thành công", user: userObj });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Thêm địa chỉ mới
router.post("/profile/addresses", authenticateUser, async (req, res) => {
  try {
    const { label, receiverName, receiverPhone, addressDetail } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const isFirstAddress = user.addresses.length === 0;
    const newAddress = {
      label: label || "Công trình",
      receiverName,
      receiverPhone,
      addressDetail,
      isDefault: isFirstAddress
    };

    user.addresses.push(newAddress);
    await user.save();
    res.status(201).json({ message: "Thêm địa chỉ thành công", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật địa chỉ
router.put("/profile/addresses/:addressId", authenticateUser, async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, receiverName, receiverPhone, addressDetail } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
    }

    if (label !== undefined) address.label = label;
    if (receiverName !== undefined) address.receiverName = receiverName;
    if (receiverPhone !== undefined) address.receiverPhone = receiverPhone;
    if (addressDetail !== undefined) address.addressDetail = addressDetail;

    await user.save();
    res.json({ message: "Cập nhật địa chỉ thành công", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Xóa địa chỉ
router.delete("/profile/addresses/:addressId", authenticateUser, async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const addressIndex = user.addresses.findIndex(a => a._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
    }

    const wasDefault = user.addresses[addressIndex].isDefault;
    user.addresses.splice(addressIndex, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ message: "Xóa địa chỉ thành công", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Đặt địa chỉ làm mặc định
router.put("/profile/addresses/:addressId/default", authenticateUser, async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    let found = false;
    user.addresses.forEach(a => {
      if (a._id.toString() === addressId) {
        a.isDefault = true;
        found = true;
      } else {
        a.isDefault = false;
      }
    });

    if (!found) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
    }

    await user.save();
    res.json({ message: "Đã đặt địa chỉ làm mặc định", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put("/:id/permissions", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, functions, permissions } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    if (role) {
      user.role = role;
    }
    if (role === "staff" && functions) {
      user.functions = functions;
      user.permissions = permissions || assignPermissionsForFunctions(functions);
    } else if (role === "admin") {
      user.functions = [];
      user.permissions = [];
    } else if (role === "customer") {
      user.functions = [];
      user.permissions = [];
    }
    await user.save();
    res.json({ message: "Cập nhật quyền thành công", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/order-template/:index/display-name", authenticateUser, async (req, res) => {
  try {
    const { index } = req.params;
    const { displayName } = req.body;
    if (!displayName) {
      return res.status(400).json({ message: "Display name is required" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (index < 0 || index >= user.orderTemplate.length) {
      return res.status(404).json({ message: "Order template index out of range" });
    }
    user.orderTemplate[index].displayName = displayName;
    await user.save();
    res.json({
      message: "Display name updated successfully",
      orderTemplate: user.orderTemplate[index],
    });
  } catch (error) {
    console.error("Error in update order template display name:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.put("/order-template/:index/products", authenticateUser, async (req, res) => {
  try {
    const { index } = req.params;
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "Products must be an array" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (index < 0 || index >= user.orderTemplate.length) {
      return res.status(404).json({ message: "Order template index out of range" });
    }
    user.orderTemplate[index].products = products.map((product) => ({
      productId: product.productId,
      quantity: product.quantity || 1,
    }));
    await user.save();
    res.json({
      message: "Products updated successfully",
      orderTemplate: user.orderTemplate[index],
    });
  } catch (error) {
    console.error("Error in update order template products:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/order-templates", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("orderTemplate");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ orderTemplates: user.orderTemplate });
  } catch (error) {
    console.error("Error in get order templates:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post("/order-templates", authenticateUser, async (req, res) => {
  try {
    const { displayName, products } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const newTemplate = { displayName, products: products || [] };
    user.orderTemplate.push(newTemplate);
    await user.save();
    const newIndex = user.orderTemplate.length - 1;
    res.status(201).json({ index: newIndex, orderTemplate: user.orderTemplate[newIndex] });
  } catch (error) {
    console.error("Error in create order template:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/order-template/:index", authenticateUser, async (req, res) => {
  try {
    const { index } = req.params;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (index < 0 || index >= user.orderTemplate.length) {
      return res.status(404).json({ message: "Order template index out of range" });
    }
    user.orderTemplate.splice(index, 1);
    await user.save();
    res.json({ message: "Order template deleted successfully" });
  } catch (error) {
    console.error("Error in delete order template:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/customers", authenticateAdmin, async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("-password");
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: "Không thể lấy danh sách khách hàng", details: error.message });
  }
});

router.put("/stations", authenticateAdmin, async (req, res) => {
  try {
    const { phone, stations } = req.body;

    if (!phone || !Array.isArray(stations)) {
      return res.status(400).json({ message: "Thiếu số điện thoại hoặc danh sách trạm không hợp lệ" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng với số điện thoại đã cung cấp" });
    }

    user.station = stations;
    await user.save();

    res.json({
      message: "Cập nhật danh sách trạm thành công",
      stations: user.station,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật danh sách station:", error.message);
    res.status(500).json({ message: "Không thể cập nhật danh sách station", details: error.message });
  }
});

router.post("/:id/stations", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { stationId } = req.body;

    if (!stationId) return res.status(400).json({ message: "Thiếu stationId" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    if (user.station.includes(stationId)) {
      return res.status(200).json({ message: "Trạm đã tồn tại trong user", user });
    }

    user.station.push(stationId);
    await user.save();

    res.status(200).json({ message: "Đã thêm trạm", user });
  } catch (err) {
    console.error("Lỗi thêm trạm:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// Xóa người dùng theo ID
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    res.json({ message: "Xóa người dùng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa người dùng:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Cập nhật thông tin người dùng (tên, email, số điện thoại)
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    res.json({ message: "Cập nhật thông tin người dùng thành công", user });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin người dùng:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Lấy danh sách station của người dùng hiện tại (chỉ trả về station)
router.get("/my-stations", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("station");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    res.json({ stations: user.station });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách station:", error.message);
    res.status(500).json({ message: "Không thể lấy danh sách station", details: error.message });
  }
});


module.exports = {
  User,
  router,
  authenticateAdmin,
  authenticateUser,
  checkPermission,
  getCookieOptions,
};