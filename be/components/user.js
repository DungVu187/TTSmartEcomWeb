const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
require("dotenv").config();
const {
  getAdminFixedPermissions,
  getCatalogForClient,
  isGrantablePermission,
  getDependency,
} = require("../config/permissions");

const ADMIN_FULL_ACCESS = true; // B6 sẽ lật thành false khi hoàn tất đổi tên quyền + backfill quyền admin.

const generateSecureToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const router = express.Router();
const { ActivityLog } = require("./activitylog");

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
    validate: {
      validator: (v) => isValidVietnamPhone(v),
      message: "Số điện thoại không hợp lệ",
    },
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
  passwordChangedAt: {
    type: Date,
  },
  role: {
    type: String,
    required: true,
    enum: ["superadmin", "admin", "staff", "customer"],
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
  },
  resetOtp: {
    type: String
  },
  resetOtpExpires: {
    type: Date
  }
});

const getCookieOptions = (req, maxAge = 43200000) => {
  // req.secure đúng nhờ trust proxy=1 + Nginx X-Forwarded-Proto khi chạy HTTPS;
  // LAN/HTTP thì false. FE/BE cùng miền nên sameSite 'lax' là đủ và an toàn.
  const host = req.hostname || req.get("host")?.split(":")[0] || "";
  const isLocalHttp =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("192.168.");
  const secureCookie = req.secure && !isLocalHttp;
  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    ...(maxAge ? { maxAge } : {})
  };
};

function hasPermission(user, requiredPermission) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "admin") {
    if (ADMIN_FULL_ACCESS) return true;
    if (getAdminFixedPermissions().includes(requiredPermission)) return true;
    return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
  }
  return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
}

// Middleware xác thực admin (đọc token từ cookie)
const VALID_ROLES = ["superadmin", "admin", "staff", "customer"];
const ROLE_LEVELS = {
  customer: 0,
  staff: 1,
  admin: 2,
  superadmin: 3,
};

function getVisibleRolesFor(viewerRole) {
  const viewerLevel = ROLE_LEVELS[viewerRole];
  if (viewerLevel === undefined) return [];
  return VALID_ROLES.filter((role) => ROLE_LEVELS[role] <= viewerLevel);
}

function validateGrantablePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return { valid: false, message: "Danh sách quyền phải là một mảng" };
  }

  const normalizedPermissions = [];
  const seen = new Set();

  for (const permission of permissions) {
    if (typeof permission !== "string" || permission.trim() === "") {
      return { valid: false, message: "Quyền không hợp lệ hoặc không được phép cấp: giá trị rỗng" };
    }

    const normalizedPermission = permission.trim();
    if (!isGrantablePermission(normalizedPermission)) {
      return {
        valid: false,
        message: `Quyền không hợp lệ hoặc không được phép cấp: ${normalizedPermission}`,
      };
    }

    if (!seen.has(normalizedPermission)) {
      seen.add(normalizedPermission);
      normalizedPermissions.push(normalizedPermission);
    }
  }

  for (const permission of normalizedPermissions) {
    const dependency = getDependency(permission);
    if (dependency && !seen.has(dependency)) {
      return {
        valid: false,
        message: `Quyền ${permission} yêu cầu quyền ${dependency}`,
      };
    }
  }

  return { valid: true, permissions: normalizedPermissions };
}

const sanitizeUserForResponse = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.resetOtp;
  delete userObj.resetOtpExpires;
  delete userObj.logInString;
  return userObj;
};

const hasNonStringField = (source, fields) => {
  return fields.some((field) => (
    source[field] !== undefined &&
    source[field] !== null &&
    typeof source[field] !== "string"
  ));
};

const rejectInvalidStringFields = (res, source, fields) => {
  if (hasNonStringField(source, fields)) {
    res.status(400).json({ message: "Thông tin tìm kiếm không hợp lệ" });
    return true;
  }
  return false;
};

const canonicalizePhone = (raw) => {
  if (typeof raw !== "string") return null;

  const normalized = raw.replace(/[\s.\-()]/g, "");
  if (normalized.startsWith("+84")) {
    return `0${normalized.slice(3)}`;
  }
  if (/^84\d{9,10}$/.test(normalized)) {
    return `0${normalized.slice(2)}`;
  }
  return normalized;
};

const isValidVietnamPhone = (raw) => {
  const phone = canonicalizePhone(raw);
  if (!phone) return false;
  return /^0\d{9,10}$/.test(phone);
};

const INVALID_PHONE_MESSAGE = "Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm 10-11 chữ số, bắt đầu bằng 0.";

const validatePasswordPolicy = (password) => {
  if (typeof password !== "string" || password.length < 6) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 6 ký tự" };
  }
  return { valid: true };
};

const isTokenIssuedBeforePasswordChange = (decoded, user) => {
  if (!decoded?.iat || !user?.passwordChangedAt) return false;
  return decoded.iat * 1000 < user.passwordChangedAt.getTime();
};

const rejectExpiredPasswordSession = (res, decoded, user) => {
  if (isTokenIssuedBeforePasswordChange(decoded, user)) {
    res.status(401).json({ message: "Phiên đã hết hạn, vui lòng đăng nhập lại" });
    return true;
  }
  return false;
};

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
    if (rejectExpiredPasswordSession(res, decoded, user)) return;
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in authenticateAdmin:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const authenticateAdminOnly = async (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Access denied, admin only" });
    }
    if (rejectExpiredPasswordSession(res, decoded, user)) return;
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in authenticateAdminOnly:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware xác thực user (đọc token từ cookie, tra DB để xác thực còn tồn tại + lấy role tươi)
const authenticateUser = async (req, res, next) => {
  const token = req.cookies.authToken; // Đọc token từ cookie
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Tài khoản không tồn tại hoặc đã bị xóa" });
    }
    if (rejectExpiredPasswordSession(res, decoded, user)) return;
    // Giữ nguyên shape payload JWT (userId, ...) nhưng lấy giá trị tươi từ DB
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      functions: user.functions || [],
      permissions: user.permissions || [],
    };
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
    if (rejectExpiredPasswordSession(res, decoded, user)) return;
    if (!hasPermission(user, requiredPermission)) {
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

const checkAnyPermission = (requiredPermissions = []) => async (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ message: "Access denied, no token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    if (rejectExpiredPasswordSession(res, decoded, user)) return;

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const allowed = permissions.some((permission) => hasPermission(user, permission));

    if (!allowed) {
      return res.status(403).json({
        message: `Access denied, missing one of permissions: ${permissions.join(", ")}`,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in checkAnyPermission:", error.message);
    if (error.name === "JsonWebTokenError" && error.message === "jwt malformed") {
      return res.status(400).json({ message: "Token JWT khÃ´ng há»£p lá»‡ hoáº·c sai Ä‘á»‹nh dáº¡ng" });
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
    if (rejectInvalidStringFields(res, req.body, ["phone", "email"])) return;
    const { email, phone, name, password, role, permissions, logInString, stationCode, inviteCode } = req.body;
    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    const canonicalPhone = canonicalizePhone(phone);
    if (!isValidVietnamPhone(phone)) {
      return res.status(400).json({ message: INVALID_PHONE_MESSAGE });
    }
    const existingUser = await User.findOne({
      $or: [
        { phone: canonicalPhone },
        ...(email ? [{ email: email.toLowerCase() }] : [])
      ]
    });
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
      if (req.user.role === "superadmin") {
        finalRole = role || "customer";
      } else if (req.user.role === "admin") {
        if (role === "superadmin" || role === "admin") {
          return res.status(403).json({ message: "Admin chỉ được phép tạo tài khoản Staff hoặc Customer" });
        }
        finalRole = role || "customer";
      } else if (req.user.role === "staff") {
        if (role && role !== "customer") {
          return res.status(403).json({ message: "Nhân viên chỉ được tạo tài khoản khách hàng" });
        }
        if (!hasPermission(req.user, "customer.create")) {
          return res.status(403).json({ message: "Access denied, missing permission: customer.create" });
        }
        finalRole = "customer";
      } else {
        finalRole = "customer";
      }
    } else {
      finalRole = "customer";
    }

    // Chỉ admin/staff mới giữ permissions; customer/superadmin luôn rỗng.
    if (finalRole === "admin" || finalRole === "staff") {
      if (permissions !== undefined) {
        const result = validateGrantablePermissions(permissions);
        if (!result.valid) {
          return res.status(400).json({ message: result.message });
        }
        finalPermissions = result.permissions;
      } else {
        finalPermissions = [];
      }
    } else {
      finalPermissions = [];
    }

    if (finalRole === "superadmin") {
      const existingSuperadmin = await User.findOne({ role: "superadmin" });
      if (existingSuperadmin) {
        return res.status(400).json({ message: "Hệ thống chỉ được phép có duy nhất 1 tài khoản Super Admin" });
      }
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
      phone: canonicalPhone,
      name,
      password,
      role: finalRole,
      functions: [],
      permissions: finalPermissions,
      logInString: generateSecureToken(),
      station: userStations
    });
    await newUser.save();
    const userObj = sanitizeUserForResponse(newUser);
    res.status(201).json({ message: "User created successfully", logInString: newUser.logInString, user: userObj });
  } catch (error) {
    console.error("Error in register:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Đăng nhập người dùng (sử dụng cookie) - hỗ trợ đăng nhập bằng email hoặc SĐT
router.post("/login", authLimiter, async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone", "email"])) return;
    const { phone, email, password, inviteCode } = req.body;
    const identifier = phone || email;
    if (!identifier) {
      return res.status(400).json({ message: "Vui lòng nhập số điện thoại hoặc email" });
    }

    // Tìm user theo SĐT hoặc Email
    let user;
    if (phone) {
      user = await User.findOne({ phone: canonicalizePhone(phone) });
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Thông tin đăng nhập không hợp lệ" });
    }

    // Tự động gán trạm cho user hiện có khi họ đăng nhập từ link trạm
    if (inviteCode) {
      const { findStationByInviteCode } = require('./station');
      const station = await findStationByInviteCode(inviteCode);
      if (station) {
        const stationIdStr = station._id.toString();
        if (!user.station.includes(stationIdStr)) {
          user.station.push(stationIdStr);
          await user.save();
        }
      }
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
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Đăng nhập admin/staff (sử dụng cookie)
router.post("/admin/login", authLimiter, async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone"])) return;
    const { phone, password } = req.body;
    const user = await User.findOne({ phone: canonicalizePhone(phone) });
    if (!user || (user.role !== "superadmin" && user.role !== "admin" && user.role !== "staff")) {
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
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Đăng xuất (xóa cookie)
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", getCookieOptions(req, null));
  res.json({ message: "Logout successful" });
});

router.put("/change-password", authLimiter, authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
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
    user.logInString = generateSecureToken();
    user.passwordChangedAt = new Date();

    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Yêu cầu OTP khôi phục mật khẩu qua Số Điện Thoại hoặc Email
router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone", "email", "identifier"])) return;
    const { phone, email, identifier } = req.body;
    // Hỗ trợ nhận trường identifier (SĐT hoặc Email) hoặc riêng lẻ phone/email
    const input = identifier || phone || email;
    if (!input) {
      return res.status(400).json({ message: "Vui lòng cung cấp số điện thoại hoặc email" });
    }

    // Phát hiện xem input là email hay SĐT
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    let user;
    if (isEmail) {
      user = await User.findOne({ email: input.toLowerCase() });
    } else {
      user = await User.findOne({ phone: canonicalizePhone(input) });
    }

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản với thông tin đã cung cấp" });
    }

    if (!user.email) {
      return res.status(400).json({ message: "Tài khoản của bạn chưa được cập nhật email liên kết. Vui lòng liên hệ Admin để được hỗ trợ." });
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên
    const otp = crypto.randomInt(100000, 1000000).toString();
    
    // Lưu OTP và thời gian hết hạn (5 phút)
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    // Gửi email chứa OTP tới địa chỉ email của khách
    const { sendResetOtpEmail } = require("../mailer");
    await sendResetOtpEmail(user.email, otp, user.name);

    // Ẩn bớt email cho bảo mật, ví dụ: ab***@gmail.com
    const emailParts = user.email.split("@");
    const maskedEmail = emailParts[0].substring(0, 2) + "***@" + emailParts[1];

    res.json({ message: `Mã OTP đã được gửi về email ${maskedEmail}`, phone: user.phone });
  } catch (error) {
    console.error("Lỗi khi yêu cầu OTP quên mật khẩu:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Đặt lại mật khẩu mới bằng OTP - hỗ trợ tìm user bằng phone hoặc email
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone", "email", "identifier"])) return;
    const { phone, email, identifier, otp, newPassword } = req.body;
    const input = identifier || phone || email;
    if (!input || !otp || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin yêu cầu" });
    }
    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Tìm user theo SĐT hoặc Email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    let user;
    if (isEmail) {
      user = await User.findOne({ email: input.toLowerCase() });
    } else {
      user = await User.findOne({ phone: canonicalizePhone(input) });
    }

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    // Kiểm tra OTP
    if (!user.resetOtp || user.resetOtp !== otp || !user.resetOtpExpires || user.resetOtpExpires < Date.now()) {
      return res.status(400).json({ message: "Mã OTP không chính xác hoặc đã hết hạn" });
    }

    // Đặt mật khẩu mới
    user.password = newPassword;
    user.logInString = generateSecureToken();
    user.passwordChangedAt = new Date();
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới." });
  } catch (error) {
    console.error("Lỗi khi đặt lại mật khẩu bằng OTP:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/permission-catalog", authenticateAdminOnly, (req, res) => {
  try {
    res.json({
      success: true,
      catalog: getCatalogForClient(),
      adminFixed: getAdminFixedPermissions(),
    });
  } catch (error) {
    console.error("Error in get permission-catalog:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/all-users", authenticateAdminOnly, async (req, res) => {
  try {
    const visibleRoles = getVisibleRolesFor(req.user?.role);
    const users = await User.find({ role: { $in: visibleRoles } }).select("-password -logInString -resetOtp -resetOtpExpires");
    res.json(users.map(sanitizeUserForResponse));
  } catch (error) {
    console.error("Error in get users:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    res.json(sanitizeUserForResponse(user));
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
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
    
    res.json({ message: "Cập nhật thông tin cá nhân thành công", user: sanitizeUserForResponse(user) });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
  }
});


router.put("/:id/permissions", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, name, email, phone, password } = req.body;

    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (req.user.role === "admin") {
      if (user.role === "superadmin" || user.role === "admin") {
        return res.status(403).json({ message: "Admin không có quyền chỉnh sửa tài khoản Admin hoặc Super Admin khác" });
      }
      if (role && (role === "superadmin" || role === "admin")) {
        return res.status(403).json({ message: "Admin không có quyền chỉ định vai trò Admin hoặc Super Admin" });
      }
    }

    if (role === "superadmin") {
      const existingSuperadmin = await User.findOne({ role: "superadmin" });
      if (existingSuperadmin && existingSuperadmin._id.toString() !== id) {
        return res.status(400).json({ message: "Hệ thống chỉ được phép có duy nhất 1 tài khoản Super Admin" });
      }
    }

    // Validate quyền TRƯỚC khi thay đổi document; role mới quyết định nhóm quyền hợp lệ.
    const finalRole = role || user.role;
    if (!VALID_ROLES.includes(finalRole)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }
    let validatedPermissions = null; // null = không đụng permissions hiện tại
    if (finalRole === "admin" || finalRole === "staff") {
      if (permissions !== undefined) {
        const result = validateGrantablePermissions(permissions);
        if (!result.valid) {
          return res.status(400).json({ message: result.message });
        }
        validatedPermissions = result.permissions;
      } else if (role) {
        // Đổi sang admin/staff mà không gửi permissions -> đặt rỗng.
        validatedPermissions = [];
      }
    } else {
      // customer/superadmin: luôn xóa sạch quyền.
      validatedPermissions = [];
    }

    // Lưu thông tin cũ để so sánh
    const oldUserData = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      functions: [...(user.functions || [])],
      permissions: [...(user.permissions || [])]
    };

    let canonicalPhone;
    if (phone !== undefined) {
      canonicalPhone = canonicalizePhone(phone);
      if (!isValidVietnamPhone(phone)) {
        return res.status(400).json({ message: INVALID_PHONE_MESSAGE });
      }
    }

    // Kiểm tra trùng lặp Số điện thoại (nếu thay đổi)
    if (canonicalPhone && canonicalPhone !== user.phone) {
      const phoneExists = await User.findOne({ phone: canonicalPhone });
      if (phoneExists) {
        return res.status(400).json({ message: "Số điện thoại đã tồn tại ở tài khoản khác" });
      }
      user.phone = canonicalPhone;
    }

    // Kiểm tra trùng lặp Email (nếu thay đổi và không rỗng)
    if (email && email.trim() !== "") {
      const emailLower = email.toLowerCase();
      if (!user.email || emailLower !== user.email.toLowerCase()) {
        const emailExists = await User.findOne({ email: emailLower });
        if (emailExists) {
          return res.status(400).json({ message: "Email đã tồn tại ở tài khoản khác" });
        }
      }
      user.email = emailLower;
    } else if (email === "") {
      user.email = undefined;
    }

    if (name !== undefined) {
      user.name = name;
    }

    if (password) {
      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      user.password = password; // Sẽ được mã hóa tự động bằng pre-save hook của userSchema
      user.logInString = generateSecureToken();
      user.passwordChangedAt = new Date();
    }

    if (role) {
      user.role = finalRole;
    }
    if (validatedPermissions !== null) {
      user.permissions = validatedPermissions;
    }
    if (role || permissions !== undefined) {
      user.functions = [];
    }

    await user.save();

    // Ghi log hoạt động
    try {
      const details = [];
      if (oldUserData.name !== user.name) {
        details.push({ field: "name", oldValue: oldUserData.name || "", newValue: user.name || "" });
      }
      if (oldUserData.email !== user.email) {
        details.push({ field: "email", oldValue: oldUserData.email || "", newValue: user.email || "" });
      }
      if (oldUserData.phone !== user.phone) {
        details.push({ field: "phone", oldValue: oldUserData.phone || "", newValue: user.phone || "" });
      }
      if (oldUserData.role !== user.role) {
        details.push({ field: "role", oldValue: oldUserData.role || "", newValue: user.role || "" });
      }
      if (JSON.stringify(oldUserData.functions) !== JSON.stringify(user.functions)) {
        details.push({ field: "functions", oldValue: oldUserData.functions.join(", "), newValue: user.functions.join(", ") });
      }
      if (JSON.stringify(oldUserData.permissions) !== JSON.stringify(user.permissions)) {
        details.push({ field: "permissions", oldValue: oldUserData.permissions.join(", "), newValue: user.permissions.join(", ") });
      }

      if (details.length > 0) {
        await new ActivityLog({
          userName: req.user.name,
          action: "update_user_permissions",
          productName: user.name || user.phone,
          details
        }).save();
      }
    } catch (logErr) { console.error("ActivityLog error in permissions:", logErr.message); }

    res.json({ message: "Cập nhật tài khoản thành công", user: sanitizeUserForResponse(user) });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// 📌 Xoay token đăng nhập tự động (chỉ dành cho Admin)
router.post("/:id/rotate-autologin-token", authenticateAdmin, checkPermission("customer.edit"), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (user.role !== "customer" && req.user.role === "staff") {
      return res.status(403).json({ message: "Không có quyền thao tác trên tài khoản này." });
    }

    if ((user.role === "admin" || user.role === "superadmin") && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Không có quyền thao tác trên tài khoản này." });
    }

    const oldToken = user.logInString;
    const newToken = generateSecureToken();
    user.logInString = newToken;
    await user.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "rotate_autologin_token",
        productName: user.name || user.phone,
        details: [{ field: "logInString", oldValue: oldToken ? "Đã có token" : "Chưa có token", newValue: "Đã xoay token mới" }]
      }).save();
    } catch (logErr) {
      console.error("ActivityLog error in rotate_autologin_token:", logErr.message);
    }

    res.json({
      message: "Xoay mã đăng nhập tự động thành công",
      logInString: newToken
    });
  } catch (error) {
    console.error("Lỗi khi xoay mã đăng nhập tự động:", error.message);
    res.status(500).json({ message: "Lỗi server khi xoay mã đăng nhập tự động" });
  }
});

// Thêm tài khoản mới thủ công từ admin
router.post("/admin-create", authenticateAdmin, async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone", "email"])) return;
    const { email, phone, name, password, role, permissions } = req.body;

    if (req.user.role !== "superadmin" && req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    if (req.user.role === "admin") {
      if (role === "superadmin" || role === "admin") {
        return res.status(403).json({ message: "Admin chỉ được phép tạo tài khoản Staff hoặc Customer" });
      }
    } else if (req.user.role === "staff") {
      if (role && role !== "customer") {
        return res.status(403).json({ message: "Nhân viên chỉ được tạo tài khoản khách hàng" });
      }
      if (!hasPermission(req.user, "customer.create")) {
        return res.status(403).json({ message: "Access denied, missing permission: customer.create" });
      }
    }

    if (!phone || !password) {
      return res.status(400).json({ message: "Số điện thoại và mật khẩu là bắt buộc" });
    }
    const canonicalPhone = canonicalizePhone(phone);
    if (!isValidVietnamPhone(phone)) {
      return res.status(400).json({ message: INVALID_PHONE_MESSAGE });
    }
    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const existingUser = await User.findOne({
      $or: [
        { phone: canonicalPhone },
        ...(email ? [{ email: email.toLowerCase() }] : [])
      ]
    });
    if (existingUser) {
      return res.status(400).json({ message: "Email hoặc số điện thoại đã tồn tại" });
    }

    const finalRole = req.user.role === "staff" ? "customer" : role || "customer";
    if (finalRole === "superadmin") {
      const existingSuperadmin = await User.findOne({ role: "superadmin" });
      if (existingSuperadmin) {
        return res.status(400).json({ message: "Hệ thống chỉ được phép có duy nhất 1 tài khoản Super Admin" });
      }
    }

    let finalPermissions = [];
    if (finalRole === "admin" || finalRole === "staff") {
      if (permissions !== undefined) {
        const result = validateGrantablePermissions(permissions);
        if (!result.valid) {
          return res.status(400).json({ message: result.message });
        }
        finalPermissions = result.permissions;
      }
    }

    const newUser = new User({
      email: email ? email.toLowerCase() : undefined,
      phone: canonicalPhone,
      name,
      password,
      role: finalRole,
      functions: [],
      permissions: finalPermissions,
      logInString: generateSecureToken(),
    });

    await newUser.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "create_user",
        productName: newUser.name || newUser.phone,
        details: [
          { field: "Tạo tài khoản", oldValue: "", newValue: `${newUser.name || ""}, SĐT: ${newUser.phone}, Vai trò: ${newUser.role}` }
        ]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in admin-create:", logErr.message); }

    res.status(201).json({ message: "Tạo tài khoản thành công", logInString: newUser.logInString, user: sanitizeUserForResponse(newUser) });
  } catch (error) {
    console.error("Lỗi khi admin tạo tài khoản:", error.message);
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/customers", authenticateAdmin, checkPermission("customer.view"), async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("-password -logInString -resetOtp -resetOtpExpires");
    res.json(customers.map(sanitizeUserForResponse));
  } catch (error) {
    res.status(500).json({ message: "Không thể lấy danh sách khách hàng" });
  }
});

router.put("/stations", authenticateAdmin, checkPermission("customer.assign_station"), async (req, res) => {
  try {
    if (rejectInvalidStringFields(res, req.body, ["phone"])) return;
    const { phone, stations } = req.body;

    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    if (!phone || !Array.isArray(stations)) {
      return res.status(400).json({ message: "Thiếu số điện thoại hoặc danh sách trạm không hợp lệ" });
    }

    const user = await User.findOne({ phone: canonicalizePhone(phone) });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng với số điện thoại đã cung cấp" });
    }

    if (req.user.role === "admin") {
      if (user.role === "superadmin" || user.role === "admin") {
        return res.status(403).json({ message: "Admin không có quyền gán trạm cho tài khoản Admin hoặc Super Admin khác" });
      }
    }

    const oldStations = [...(user.station || [])];
    user.station = stations;
    await user.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "assign_user_stations",
        productName: user.name || user.phone,
        details: [{ field: "station", oldValue: oldStations.join(", "), newValue: stations.join(", ") }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in assign_user_stations:", logErr.message); }

    res.json({
      message: "Cập nhật danh sách trạm thành công",
      stations: user.station,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật danh sách station:", error.message);
    res.status(500).json({ message: "Không thể cập nhật danh sách station" });
  }
});

router.post("/:id/stations", authenticateAdmin, checkPermission("customer.assign_station"), async (req, res) => {
  try {
    const { id } = req.params;
    const { stationId } = req.body;

    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    if (!stationId) return res.status(400).json({ message: "Thiếu stationId" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    if (req.user.role === "admin") {
      if (user.role === "superadmin" || user.role === "admin") {
        return res.status(403).json({ message: "Admin không có quyền gán trạm cho tài khoản Admin hoặc Super Admin" });
      }
    }

    if (user.station.includes(stationId)) {
      return res.status(200).json({ message: "Trạm đã tồn tại trong user", user: sanitizeUserForResponse(user) });
    }

    user.station.push(stationId);
    await user.save();

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "assign_user_stations",
        productName: user.name || user.phone,
        details: [{ field: "station", oldValue: "", newValue: `Đã gán thêm trạm: ${stationId}` }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in assign_user_stations post:", logErr.message); }

    res.status(200).json({ message: "Đã thêm trạm", user: sanitizeUserForResponse(user) });
  } catch (err) {
    console.error("Lỗi thêm trạm:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Xóa người dùng theo ID
router.delete("/:id", authenticateAdmin, checkPermission("customer.delete"), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (["superadmin", "admin", "staff"].includes(userToDelete.role) && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Chi Super Admin duoc xoa tai khoan Admin hoac Nhan vien" });
    }

    if (req.user.role === "admin") {
      if (userToDelete.role === "superadmin" || userToDelete.role === "admin") {
        return res.status(403).json({ message: "Admin không có quyền xóa tài khoản Admin hoặc Super Admin" });
      }
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Ghi log hoạt động
    try {
      await new ActivityLog({
        userName: req.user.name,
        action: "delete_user",
        productName: deletedUser.name || deletedUser.phone,
        details: [{ field: "Xóa tài khoản", oldValue: `${deletedUser.name || ""}, SĐT: ${deletedUser.phone}, Vai trò: ${deletedUser.role}`, newValue: "" }]
      }).save();
    } catch (logErr) { console.error("ActivityLog error in delete_user:", logErr.message); }

    res.json({ message: "Xóa người dùng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa người dùng:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Cập nhật thông tin người dùng (tên, email, số điện thoại)
router.put("/:id", authenticateAdmin, checkPermission("customer.edit"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if (req.user.role === "admin") {
      if (user.role === "superadmin" || user.role === "admin") {
        return res.status(403).json({ message: "Admin không có quyền cập nhật tài khoản Admin hoặc Super Admin khác" });
      }
    }

    const oldUserData = { name: user.name, email: user.email, phone: user.phone };

    let canonicalPhone;
    if (phone !== undefined) {
      canonicalPhone = canonicalizePhone(phone);
      if (!isValidVietnamPhone(phone)) {
        return res.status(400).json({ message: INVALID_PHONE_MESSAGE });
      }

      if (canonicalPhone !== user.phone) {
        const phoneExists = await User.findOne({ phone: canonicalPhone });
        if (phoneExists) {
          return res.status(400).json({ message: "Số điện thoại đã tồn tại ở tài khoản khác" });
        }
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (canonicalPhone !== undefined) user.phone = canonicalPhone;

    await user.save();

    // Ghi log hoạt động
    try {
      const details = [];
      if (oldUserData.name !== user.name) details.push({ field: "name", oldValue: oldUserData.name || "", newValue: user.name || "" });
      if (oldUserData.email !== user.email) details.push({ field: "email", oldValue: oldUserData.email || "", newValue: user.email || "" });
      if (oldUserData.phone !== user.phone) details.push({ field: "phone", oldValue: oldUserData.phone || "", newValue: user.phone || "" });
      if (details.length > 0) {
        await new ActivityLog({
          userName: req.user.name,
          action: "update_user",
          productName: user.name || user.phone,
          details
        }).save();
      }
    } catch (logErr) { console.error("ActivityLog error in update_user:", logErr.message); }

    res.json({ message: "Cập nhật thông tin người dùng thành công", user: sanitizeUserForResponse(user) });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin người dùng:", error.message);
    res.status(500).json({ message: "Lỗi server" });
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
    res.status(500).json({ message: "Không thể lấy danh sách station" });
  }
});


// 📌 Đăng nhập tự động qua Token (Bảo mật - Thay thế cơ chế mã hóa AES phía client)
router.post("/autologin", authLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Thiếu mã đăng nhập tự động" });
    }

    if (typeof token !== "string") {
      return res.status(400).json({ message: "Mã đăng nhập tự động không hợp lệ" });
    }

    // 1. Thử tìm kiếm trực tiếp bằng token ngẫu nhiên mới (Cơ chế mới: 64 ký tự hex)
    let user;
    const isNewHexToken = typeof token === "string" && /^[0-9a-f]{64}$/i.test(token);

    if (isNewHexToken) {
      user = await User.findOne({ logInString: token });
    }

    // 2. Nếu không tìm thấy hoặc là token kiểu cũ (AES), giải mã và xác thực
    if (!user) {
      const aesKey = process.env.AES_KEY;
      if (aesKey) {
        try {
          const decodedToken = token.includes("%") ? decodeURIComponent(token) : token;
          const bytes = CryptoJS.AES.decrypt(decodedToken, aesKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (decrypted && decrypted.includes("+++")) {
            const [phone, password] = decrypted.split("+++");
            user = await User.findOne({ phone });
            if (user) {
              const isMatch = await user.comparePassword(password);
              if (!isMatch) {
                user = null; // Mật khẩu không đúng
              } else {
                // Tự động nâng cấp logInString của user này sang token ngẫu nhiên mới bảo mật hơn
                user.logInString = generateSecureToken();
                await user.save();
                console.log(`Đã nâng cấp tự động logInString của user ${phone} sang token ngẫu nhiên bảo mật.`);
              }
            }
          }
        } catch (decryptErr) {
          // Bỏ qua lỗi giải mã nếu không phải định dạng AES hợp lệ
          console.warn("Không thể giải mã AES token cũ:", decryptErr.message);
        }
      }

      // Dự phòng: Nếu giải mã thất bại nhưng token cũ thô được lưu trực tiếp trong DB (ví dụ user cũ chưa nâng cấp)
      if (!user) {
        user = await User.findOne({ logInString: token });
        if (user) {
          user.logInString = generateSecureToken();
          await user.save();
          console.log(`Đã tìm thấy và nâng cấp chuỗi logInString cũ trực tiếp của user ${user.phone}.`);
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: "Mã đăng nhập tự động không hợp lệ hoặc đã hết hạn" });
    }

    // 3. Tạo JWT session token đăng nhập
    const sessionToken = jwt.sign(
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
      { expiresIn: "12h" }
    );

    res.cookie("authToken", sessionToken, getCookieOptions(req, 12 * 60 * 60 * 1000));
    res.json({ message: "Đăng nhập tự động thành công" });
  } catch (error) {
    console.error("Lỗi autologin backend:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập tự động" });
  }
});

module.exports = {
  User,
  router,
  authenticateAdmin,
  authenticateAdminOnly,
  authenticateUser,
  checkPermission,
  checkAnyPermission,
  hasPermission,
  getCookieOptions,
  canonicalizePhone,
  isValidVietnamPhone,
};
