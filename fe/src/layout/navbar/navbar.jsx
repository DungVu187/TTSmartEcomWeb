import React, { useState, useEffect, useContext } from "react";
import "./navbar.css";
import logo from "../../assets/TTSlogo.jpg";
import { Link, useLocation } from "react-router-dom";
import { ShopContext } from "../../context/shopcontext";
import toast from "react-hot-toast";
const apiUrl = process.env.REACT_APP_BACK_END;

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const { getCartItemCount } = useContext(ShopContext);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${apiUrl}/users/profile`, {
          method: "GET",
          credentials: "include",
        });
        setIsLoggedIn(response.ok);
      } catch (error) {
        setIsLoggedIn(false);
        console.error("Error checking auth:", error);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandsData, typesData] = await Promise.all([
          fetch(`${apiUrl}/chips/brands`, { credentials: "include" }).then(
            (res) => res.json()
          ),
          fetch(`${apiUrl}/chips/types`, { credentials: "include" }).then(
            (res) => res.json()
          ),
        ]);
        setBrands(brandsData);
        setTypes(typesData);
      } catch (error) {
        console.error("Error fetching brands/types:", error);
        toast.error("Không thể tải dữ liệu thương hiệu hoặc loại sản phẩm");
      }
    };
    fetchData();
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/users/logout`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setIsLoggedIn(false);
        toast.success("Đăng xuất thành công");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        toast.error(data.message || "Đăng xuất thất bại");
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterClick = (filterType, value) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set(filterType, value);
    return `/product?${searchParams.toString()}`;
  };

  const linkStyle = {
    textDecoration: "none",
    color: "black",
  };

  return (
    <div className="navbar-container">
      <div className="navbar-top">
        <div className="navbar-top-content">
          <div style={{ display: "flex", gap: "1rem" }}>
            <div
              style={{ margin: "auto" }}
              className="hamburger-menu"
              onClick={toggleMenu}
            >
              <i className="fa-solid fa-bars fa-2xl"></i>
            </div>
            <Link to="/">
              <img src={logo} alt="TTSmart logo" />
            </Link>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            {/* <a href="tel:+8413158383" style={{ textDecoration: "none" }}>
              <div className="phone tab">
                <i className="fa-solid fa-phone fa-2xl"></i>
                <div className="phone-text">
                  <p>+8413158383</p>
                </div>
              </div>
            </a> */}

            <Link to="/station" style={{ textDecoration: "none" }}>
              <div className="station tab">
                <i className="fa-solid fa-industry fa-2xl"></i>
                <div className="station-text">
                  <p>Trạm của tôi</p>
                </div>
              </div>
            </Link>

            <div className="account tab">
              <i className="fa-solid fa-user fa-2xl"></i>
              <div className="account-text">
                <p>Tài khoản</p>
              </div>
              <div className="account-dropdown">
                {isLoggedIn ? (
                  <>
                    <p
                      onClick={handleLogout}
                      style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                    >
                      {isLoading ? "Đang đăng xuất..." : "Đăng xuất"}
                    </p>
                    <Link
                      style={{ textDecoration: "none" }}
                      to="/change-password"
                    >
                      <p>Đổi mật khẩu</p>
                    </Link>
                  </>
                ) : (
                  <Link style={{ textDecoration: "none" }} to="/login">
                    <p>Đăng nhập</p>
                  </Link>
                )}
                <Link style={{ textDecoration: "none" }} to="/myorder">
                  <p>Đơn hàng của tôi</p>
                </Link>
              </div>
            </div>

            <Link style={{ textDecoration: "none" }} to="/cart">
              <div className="cart tab">
                <i className="fa-solid fa-cart-shopping fa-2xl"></i>
                <div className="cart-item-count">{getCartItemCount()}</div>
                <div className="cart-text">
                  <p>Giỏ hàng</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div
        className={`overlay ${isMenuOpen ? "active" : ""}`}
        onClick={closeMenu}
      ></div>

      <div className={`hamburger-menu-dropdown ${isMenuOpen ? "active" : ""}`}>
        <header>
          <p>Danh mục</p>
          <div className="close-btn" onClick={closeMenu}>
            <i className="fa-solid fa-times fa-xl"></i>
          </div>
        </header>
        <ul>
          <li className="hamburger-filter">
            <Link to="/" onClick={closeMenu} style={linkStyle}>
              Trang chủ
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/cart" onClick={closeMenu} style={linkStyle}>
              Giỏ hàng ({getCartItemCount()})
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/station" onClick={closeMenu} style={linkStyle}>
              Trạm trộn
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/product" onClick={closeMenu} style={linkStyle}>
              Sản phẩm
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/dashboard" onClick={closeMenu} style={linkStyle}>
              Trang chủ Swiper
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/introduction" onClick={closeMenu} style={linkStyle}>
              Giới thiệu
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/policy" onClick={closeMenu} style={linkStyle}>
              Chính sách mua hàng
            </Link>
          </li>
          <li className="hamburger-filter">
            <a href="tel:+8413158383" style={linkStyle}>
              Liên hệ
            </a>
          </li>
          <li className="hamburger-filter">
            {isLoggedIn ? (
              <p
                onClick={handleLogout}
                style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
              >
                {isLoading ? "Đang đăng xuất..." : "Đăng xuất"}
              </p>
            ) : (
              <Link to="/login" onClick={closeMenu} style={linkStyle}>
                Đăng nhập
              </Link>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Navbar;
