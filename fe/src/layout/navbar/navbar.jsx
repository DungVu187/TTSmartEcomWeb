import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import logo from "../../assets/TTSlogo.jpg";
import { ShopContext } from "../../context/shopcontext";
import { useLanguage } from "../../context/languagecontext.jsx";
import "./navbar.css";

const apiUrl = process.env.REACT_APP_BACK_END;

function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const { getCartItemCount } = useContext(ShopContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

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
    const params = new URLSearchParams(location.search);
    setSearch(location.pathname === "/product" ? params.get("search") || "" : "");
  }, [location.pathname, location.search]);

  const closeMenu = () => setIsMenuOpen(false);

  const handleSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/product?search=${encodeURIComponent(term)}` : "/product");
  };

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
        toast.success("Đăng xuất thành công");
        window.location.href = "/login";
      } else {
        toast.error(data.message || "Đăng xuất thất bại");
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const cartItemCount = getCartItemCount();

  return (
    <header className="store-header">
      <div className="store-utility-bar">
        <div className="store-header-shell store-utility-content">
          <div><span><i className="fa-solid fa-location-dot" /> Giao hàng toàn quốc</span><a href="tel:0813158383"><i className="fa-solid fa-phone" /> Hỗ trợ kỹ thuật 24/7: 08.1315.8383</a></div>
          <div><Link to="/policy"><i className="fa-regular fa-file-lines" /> Tài liệu</Link><a href="#tin-tuc"><i className="fa-regular fa-newspaper" /> Tin tức</a><Link to="/introduction"><i className="fa-regular fa-envelope" /> Liên hệ</Link></div>
        </div>
      </div>

      <div className="store-main-nav">
        <div className="store-header-shell store-main-nav-content">
          <button className="store-menu-button" type="button" onClick={() => setIsMenuOpen(true)} aria-label="Mở danh mục"><i className="fa-solid fa-bars" /></button>
          <Link className="store-logo" to="/"><img src={logo} alt="TTSmart" /></Link>

          <form className="store-search" onSubmit={handleSearch}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, mã sản phẩm, hãng..." aria-label="Tìm kiếm sản phẩm" />
            <button type="submit" aria-label="Tìm kiếm"><i className="fa-solid fa-magnifying-glass" /></button>
          </form>

          <nav className="store-nav-actions" aria-label="Tiện ích khách hàng">
            <Link to="/station"><i className="fa-solid fa-industry" /><span>Trạm của tôi</span></Link>
            <Link className="store-mobile-account-link" to={isLoggedIn ? "/profile" : loginPath} aria-label="Tài khoản">
              <i className="fa-regular fa-user" />
            </Link>
            <div className="store-nav-popover store-account-popover">
              <button type="button"><i className="fa-regular fa-user" /><span>{isLoggedIn ? userName : "Tài khoản"}</span></button>
              <div className="store-popover-menu">
                {isLoggedIn ? (
                  <>
                    <Link to="/profile">Thông tin cá nhân</Link>
                    <Link to="/myorder">Đơn hàng của tôi</Link>
                    <Link to="/change-password">Đổi mật khẩu</Link>
                    <button type="button" onClick={handleLogout} disabled={isLoading}>{isLoading ? "Đang đăng xuất..." : "Đăng xuất"}</button>
                  </>
                ) : (
                  <><Link to={loginPath}>Đăng nhập</Link><Link to="/myorder">Đơn hàng của tôi</Link></>
                )}
              </div>
            </div>
            <div className="store-nav-popover store-language-menu">
              <button type="button"><i className="fa-solid fa-globe" /><span>{language === "vi" ? "Tiếng Việt" : language === "zh" ? "中文" : "English"}</span><i className="fa-solid fa-angle-down store-action-chevron" /></button>
              <div className="store-popover-menu">
                <button type="button" onClick={() => setLanguage("vi")}>Tiếng Việt</button>
                <button type="button" onClick={() => setLanguage("zh")}>中文</button>
                <button type="button" onClick={() => setLanguage("en")}>English</button>
              </div>
            </div>
            <Link className="store-cart-link" to="/cart"><span className="store-cart-icon"><i className="fa-solid fa-cart-shopping" /><b className={cartItemCount === 0 ? "is-empty" : ""}>{cartItemCount}</b></span><span>Giỏ hàng</span></Link>
          </nav>
        </div>

        <form className="store-mobile-search" onSubmit={handleSearch}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, mã sản phẩm..." />
          <button type="submit"><i className="fa-solid fa-magnifying-glass" /></button>
        </form>
      </div>

      <div className={`store-drawer-overlay ${isMenuOpen ? "is-open" : ""}`} onClick={closeMenu} />
      <aside className={`store-category-drawer ${isMenuOpen ? "is-open" : ""}`}>
        <div className="store-drawer-heading"><div><img src={logo} alt="TTSmart" /><span>{t("categories")}</span></div><button type="button" onClick={closeMenu}><i className="fa-solid fa-xmark" /></button></div>
        <div className="store-drawer-links">
          <Link to="/" onClick={closeMenu}><i className="fa-solid fa-house" /><span>{t("home")}</span><i className="fa-solid fa-angle-right" /></Link>
          <Link to="/product" onClick={closeMenu}><i className="fa-solid fa-border-all" /><span>{t("products")}</span><i className="fa-solid fa-angle-right" /></Link>
          <Link to="/station" onClick={closeMenu}><i className="fa-solid fa-industry" /><span>{t("station_mixer")}</span><i className="fa-solid fa-angle-right" /></Link>
          <Link to="/dashboard" onClick={closeMenu}><i className="fa-solid fa-layer-group" /><span>{t("equipment_group")}</span><i className="fa-solid fa-angle-right" /></Link>
          <Link to="/myorder" onClick={closeMenu}><i className="fa-solid fa-receipt" /><span>{t("my_orders")}</span><i className="fa-solid fa-angle-right" /></Link>
          {isLoggedIn ? (
            <button className="store-drawer-action" type="button" onClick={handleLogout} disabled={isLoading}>
              <i className="fa-solid fa-right-from-bracket" /><span>{isLoading ? t("logging_out") : t("logout")}</span>
            </button>
          ) : (
            <Link to={loginPath} onClick={closeMenu}><i className="fa-solid fa-right-to-bracket" /><span>{t("login")}</span><i className="fa-solid fa-angle-right" /></Link>
          )}

          <div className="store-drawer-language">
            <strong>{language === "vi" ? "NGÔN NGỮ" : language === "zh" ? "语言" : "LANGUAGE"}</strong>
            <div>
              <button type="button" className={language === "vi" ? "is-active" : ""} onClick={() => { setLanguage("vi"); closeMenu(); }}>VI</button>
              <button type="button" className={language === "zh" ? "is-active" : ""} onClick={() => { setLanguage("zh"); closeMenu(); }}>ZH</button>
              <button type="button" className={language === "en" ? "is-active" : ""} onClick={() => { setLanguage("en"); closeMenu(); }}>EN</button>
            </div>
          </div>
        </div>
        <div className="store-drawer-footer"><a href="tel:0813158383"><i className="fa-solid fa-headset" /> Hotline: 08.1315.8383</a></div>
      </aside>
    </header>
  );
}

export default Navbar;
