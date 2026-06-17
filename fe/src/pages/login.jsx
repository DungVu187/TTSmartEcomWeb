import React, { useState } from "react";
import "./styles/login.css";
import { toast } from "react-hot-toast";
import AES from 'crypto-js/aes';
const AES_KEY = process.env.REACT_APP_AES_KEY;

function LogIn() {
  const [isSignUpActive, setIsSignUpActive] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Hàm kiểm tra định dạng số điện thoại (10 chữ số)
  const validatePhone = (phone) => {
    const re = /^\d{10}$/;
    return re.test(phone);
  };

  const handleToggle = () => {
    setIsSignUpActive((prev) => !prev);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Mật khẩu không khớp");
      return;
    }
    if (!validatePhone(phone)) {
      toast.error("Số điện thoại phải có đúng 10 chữ số");
      return;
    }

    const raw = `${phone}+++${password}`;
    const encrypted = AES.encrypt(raw, AES_KEY).toString();
    const logInString = encodeURIComponent(encrypted);

    const user = { name, phone, password, logInString };

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/users/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
          credentials: "include",
        }
      );

      const data = await response.json();
      if (response.ok) {
        toast.success("Đăng ký thành công");
        setIsSignUpActive(false);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validatePhone(phone)) {
      toast.error("Số điện thoại phải có đúng 10 chữ số");
      return;
    }
    const user = { phone, password };
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
          credentials: "include", // Gửi cookie
        }
      );

      if (response.ok) {
        toast.success("Đăng nhập thành công");
        const queryParams = new URLSearchParams(window.location.search);
        const redirectUrl = queryParams.get("redirect") || "/";
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      } else {
        toast.error("Số điện thoại hoặc mật khẩu không đúng");
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
    }
  };

  return (
    <div className="login-main-container" style={{ minHeight: "100vh" }}>
      <div
        className={`login-container ${isSignUpActive ? "active" : ""}`}
        id="login-container"
      >
        <div className="form-container sign-up">
          <form onSubmit={handleRegister}>
            <h1>Tạo tài khoản</h1>
            <input
              type="text"
              placeholder="Tên người dùng"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="tel"
              placeholder="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="submit">Đăng ký</button>
          </form>
        </div>

        <div className="form-container sign-in">
          <form onSubmit={handleLogin}>
            <h1>Đăng nhập</h1>
            <input
              type="tel"
              placeholder="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Đăng nhập</button>
          </form>
        </div>

        <div className="login-toggle-container">
          <div className="login-toggle">
            <div className="login-toggle-panel login-toggle-left">
              <h1>Chào mừng!</h1>
              <p>Hãy điền thông tin để tạo tài khoản</p>
              <button onClick={handleToggle} className="hidden" id="login">
                Đăng nhập
              </button>
            </div>
            <div className="login-toggle-panel login-toggle-right">
              <h1>Xin chào!</h1>
              <p>Hãy đăng nhập để sử dụng hết các tính năng</p>
              <button onClick={handleToggle} className="hidden" id="register">
                Đăng ký
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogIn;
