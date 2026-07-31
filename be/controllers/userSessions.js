const { User, canonicalizePhone } = require('../models/user');
const { getCookieOptions } = require('../middlewares/auth');
const {
  SESSION_DURATION_MS,
  assignStationFromInviteCode,
  createSessionToken,
  resolveAutoLoginUser,
} = require('../services/userSessions');

const hasNonStringField = (source, fields) => fields.some((field) => (
  source[field] !== undefined
  && source[field] !== null
  && typeof source[field] !== 'string'
));

const rejectInvalidStringFields = (res, source, fields) => {
  if (hasNonStringField(source, fields)) {
    res.status(400).json({ message: 'Thông tin tìm kiếm không hợp lệ' });
    return true;
  }
  return false;
};

async function loginUser(req, res) {
  try {
    if (rejectInvalidStringFields(res, req.body, ['phone', 'email'])) return;
    const { phone, email, password, inviteCode } = req.body;
    const identifier = phone || email;
    if (!identifier) {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại hoặc email' });
    }

    let user;
    if (phone) {
      user = await User.findOne({ phone: canonicalizePhone(phone) });
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không hợp lệ' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không hợp lệ' });
    }

    if (inviteCode) {
      await assignStationFromInviteCode(user, inviteCode);
    }

    const token = createSessionToken(user);
    res.cookie('authToken', token, getCookieOptions(req, SESSION_DURATION_MS));
    res.json({ message: 'Đăng nhập thành công' });
  } catch (error) {
    console.error('Lỗi trong đăng nhập:', error.message);
    res.status(500).json({ message: 'Lỗi server' });
  }
}

async function loginAdmin(req, res) {
  try {
    if (rejectInvalidStringFields(res, req.body, ['phone'])) return;
    const { phone, password } = req.body;
    const user = await User.findOne({ phone: canonicalizePhone(phone) });
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin' && user.role !== 'staff')) {
      return res.status(403).json({ message: 'Truy cập bị từ chối. Chỉ dành cho admin hoặc nhân viên' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Thông tin đăng nhập không hợp lệ' });
    }

    const token = createSessionToken(user);
    res.cookie('authToken', token, getCookieOptions(req, SESSION_DURATION_MS));
    res.json({ message: 'Đăng nhập admin thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
}

function logoutUser(req, res) {
  res.clearCookie('authToken', getCookieOptions(req, null));
  res.json({ message: 'Logout successful' });
}

async function autoLogin(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Thiếu mã đăng nhập tự động' });
    }
    if (typeof token !== 'string') {
      return res.status(400).json({ message: 'Mã đăng nhập tự động không hợp lệ' });
    }

    const user = await resolveAutoLoginUser(token);
    if (!user) {
      return res.status(401).json({ message: 'Mã đăng nhập tự động không hợp lệ hoặc đã hết hạn' });
    }

    const sessionToken = createSessionToken(user);
    res.cookie('authToken', sessionToken, getCookieOptions(req, SESSION_DURATION_MS));
    res.json({ message: 'Đăng nhập tự động thành công' });
  } catch (error) {
    console.error('Lỗi autologin backend:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập tự động' });
  }
}

module.exports = {
  autoLogin,
  loginAdmin,
  loginUser,
  logoutUser,
};
