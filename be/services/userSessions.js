const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { User } = require("../models/user");
const { findStationByInviteCode } = require("../models/station");

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

const generateSecureToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const createSessionToken = (user) => {
  return jwt.sign(
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
};

const assignStationFromInviteCode = async (user, inviteCode) => {
  if (!inviteCode) return user;

  const station = await findStationByInviteCode(inviteCode);
  if (!station) return user;

  const stationId = station._id.toString();
  if (!user.station.includes(stationId)) {
    user.station.push(stationId);
    await user.save();
  }

  return user;
};

const resolveAutoLoginUser = async (token) => {
  if (typeof token !== "string" || !token) return null;

  let user;
  const isNewHexToken = /^[0-9a-f]{64}$/i.test(token);

  if (isNewHexToken) {
    user = await User.findOne({ logInString: token });
  }

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
              user = null;
            } else {
              user.logInString = generateSecureToken();
              await user.save();
              console.log(
                `Đã nâng cấp tự động logInString của user ${phone} sang token ngẫu nhiên bảo mật.`
              );
            }
          }
        }
      } catch (decryptError) {
        console.warn("Không thể giải mã AES token cũ:", decryptError.message);
      }
    }

    if (!user) {
      user = await User.findOne({ logInString: token });
      if (user) {
        user.logInString = generateSecureToken();
        await user.save();
        console.log(
          `Đã tìm thấy và nâng cấp chuỗi logInString cũ trực tiếp của user ${user.phone}.`
        );
      }
    }
  }

  return user || null;
};

module.exports = {
  SESSION_DURATION_MS,
  generateSecureToken,
  createSessionToken,
  assignStationFromInviteCode,
  resolveAutoLoginUser,
};
