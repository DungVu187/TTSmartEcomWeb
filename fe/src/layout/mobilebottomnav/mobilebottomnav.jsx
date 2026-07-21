import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./mobilebottomnav.css";

const getNavClass = ({ isActive }) => `mobile-bottom-nav-item${isActive ? " is-active" : ""}`;

function MobileBottomNav() {
  const { pathname } = useLocation();
  const isProductDetail = /^\/product\/[^/]+$/.test(pathname);
  const isHidden = isProductDetail || pathname === "/cart" || pathname === "/login";

  if (isHidden) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Điều hướng mobile">
      <NavLink className={getNavClass} to="/" end>
        <i className="fa-solid fa-house" />
        <span>Trang chủ</span>
      </NavLink>
      <NavLink className={getNavClass} to="/product">
        <i className="fa-solid fa-border-all" />
        <span>Danh mục</span>
      </NavLink>
      <NavLink className={getNavClass} to="/station">
        <i className="fa-solid fa-industry" />
        <span>Trạm của tôi</span>
      </NavLink>
      <NavLink className={getNavClass} to="/profile">
        <i className="fa-regular fa-user" />
        <span>Tài khoản</span>
      </NavLink>
      <a className="mobile-bottom-nav-item" href="tel:0813158383">
        <i className="fa-solid fa-headset" />
        <span>Hỗ trợ</span>
      </a>
    </nav>
  );
}

export default MobileBottomNav;
