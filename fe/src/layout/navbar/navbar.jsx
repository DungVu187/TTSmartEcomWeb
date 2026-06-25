import React, { useState, useEffect, useContext } from "react";
import "./navbar.css";
import logo from "../../assets/TTSlogo.jpg";
import { Link, useLocation } from "react-router-dom";
import { ShopContext } from "../../context/shopcontext";
import toast from "react-hot-toast";
import { useLanguage } from "../../context/languagecontext.jsx";
const apiUrl = process.env.REACT_APP_BACK_END;

function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
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
        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(true);
          setUserName(data.name || data.phone || "Tài khoản");
        } else {
          setIsLoggedIn(false);
          setUserName("");
        }
      } catch (error) {
        setIsLoggedIn(false);
        setUserName("");
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
        setUserName("");
        localStorage.removeItem("chat_session");
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
                  <p>{t("my_stations_nav")}</p>
                </div>
              </div>
            </Link>

            <div className="account tab">
              <i className="fa-solid fa-user fa-2xl"></i>
              <div className="account-text">
                <p>{isLoggedIn && userName ? userName : t("account")}</p>
              </div>
              <div className="account-dropdown">
                {isLoggedIn ? (
                  <>
                    <Link
                      style={{ textDecoration: "none" }}
                      to="/profile"
                    >
                      <p>{t("personal_info")}</p>
                    </Link>
                    <Link
                      style={{ textDecoration: "none" }}
                      to="/myorder"
                    >
                      <p>{t("my_orders")}</p>
                    </Link>
                    <Link
                      style={{ textDecoration: "none" }}
                      to="/change-password"
                    >
                      <p>{t("change_password")}</p>
                    </Link>
                    <p
                      onClick={handleLogout}
                      style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                    >
                      {isLoading ? t("logging_out") : t("logout")}
                    </p>
                  </>
                ) : (
                  <>
                    <Link style={{ textDecoration: "none" }} to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}>
                      <p>{t("login")}</p>
                    </Link>
                    <Link style={{ textDecoration: "none" }} to="/myorder">
                      <p>{t("my_orders")}</p>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="language-selector tab">
              <i className="fa-solid fa-globe fa-2xl"></i>
              <div className="language-text">
                <p>{language === "vi" ? "Tiếng Việt" : language === "zh" ? "中文" : "English"}</p>
              </div>
              <div className="language-dropdown">
                <p onClick={() => setLanguage("vi")}>Tiếng Việt</p>
                <p onClick={() => setLanguage("zh")}>中文 (Chinese)</p>
                <p onClick={() => setLanguage("en")}>English</p>
              </div>
            </div>

            <Link style={{ textDecoration: "none" }} to="/cart">
              <div className="cart tab">
                <i className="fa-solid fa-cart-shopping fa-2xl"></i>
                <div className="cart-item-count">{getCartItemCount()}</div>
                <div className="cart-text">
                  <p>{t("cart")}</p>
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
          <p>{t("categories")}</p>
          <div className="close-btn" onClick={closeMenu}>
            <i className="fa-solid fa-times fa-xl"></i>
          </div>
        </header>
        <ul>
          <li className="hamburger-filter">
            <Link to="/" onClick={closeMenu} style={linkStyle}>
              {t("home")}
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/product" onClick={closeMenu} style={linkStyle}>
              {t("products")}
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/station" onClick={closeMenu} style={linkStyle}>
              {t("station_mixer")}
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/dashboard" onClick={closeMenu} style={linkStyle}>
              {t("equipment_group")}
            </Link>
          </li>
          <li className="hamburger-filter">
            <Link to="/myorder" onClick={closeMenu} style={linkStyle}>
              {t("my_orders")}
            </Link>
          </li>
          <li className="hamburger-filter">
            <a href="tel:0813158383" style={linkStyle}>
              Hotline: 0813158383
            </a>
          </li>
          <li className="hamburger-filter">
            {isLoggedIn ? (
              <p
                onClick={handleLogout}
                style={{ cursor: isLoading ? "not-allowed" : "pointer", margin: 0 }}
              >
                {isLoading ? t("logging_out") : t("logout")}
              </p>
            ) : (
              <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} onClick={closeMenu} style={linkStyle}>
                {t("login")}
              </Link>
            )}
          </li>
          {/* Language Selector in Hamburger */}
          <li className="hamburger-filter" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", marginTop: "1rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
            <span style={{ fontWeight: "bold", fontSize: "14px", color: "#666" }}>
              {language === "vi" ? "NGÔN NGỮ" : language === "zh" ? "语言" : "LANGUAGE"}
            </span>
            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              <span onClick={() => { setLanguage("vi"); closeMenu(); }} style={{ cursor: "pointer", fontWeight: language === "vi" ? "bold" : "normal", color: language === "vi" ? "#007bff" : "black" }}>VI</span>
              <span onClick={() => { setLanguage("zh"); closeMenu(); }} style={{ cursor: "pointer", fontWeight: language === "zh" ? "bold" : "normal", color: language === "zh" ? "#007bff" : "black" }}>ZH</span>
              <span onClick={() => { setLanguage("en"); closeMenu(); }} style={{ cursor: "pointer", fontWeight: language === "en" ? "bold" : "normal", color: language === "en" ? "#007bff" : "black" }}>EN</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Navbar;
