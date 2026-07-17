import React from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/TTSlogo.jpg";
import { useLanguage } from "../../context/languagecontext.jsx";
import "./footer.css";

function Footer() {
  const { t } = useLanguage();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const keepVisualOnly = (event) => event.preventDefault();

  return (
    <footer className="store-footer">
      <div className="store-footer-shell">
        <div className="store-footer-grid">
          <section className="store-footer-brand">
            <div className="store-footer-logo"><img src={logo} alt="TTSmart" /></div>
            <p>{t("footer_brand_desc")}</p>
            <ul className="store-footer-contact">
              <li><i className="fa-solid fa-location-dot" /><span>{t("footer_address")}</span></li>
              <li><i className="fa-solid fa-phone" /><a href="tel:0813158383">08.1315.8383</a></li>
              <li><i className="fa-solid fa-envelope" /><a href="mailto:ttsmart.ltd@gmail.com">ttsmart.ltd@gmail.com</a></li>
            </ul>
            <div className="store-footer-socials">
              <a href="https://zalo.me/0813158383" target="_blank" rel="noreferrer" aria-label="Zalo"><i className="fa-solid fa-comment-dots" /></a>
              <a href="tel:0813158383" aria-label="Hotline"><i className="fa-solid fa-phone" /></a>
              <a href="mailto:ttsmart.ltd@gmail.com" aria-label="Email"><i className="fa-solid fa-envelope" /></a>
            </div>
          </section>

          <section className="store-footer-column">
            <h3>{t("quick_links")}</h3>
            <Link to="/" onClick={scrollToTop}>{t("home")}</Link>
            <Link to="/product" onClick={scrollToTop}>{t("products")}</Link>
            <Link to="/dashboard" onClick={scrollToTop}>{t("equipment_group")}</Link>
            <Link to="/station" onClick={scrollToTop}>{t("my_stations_nav")}</Link>
            <Link to="/introduction" onClick={scrollToTop}>{t("introduction")}</Link>
          </section>

          <section className="store-footer-column">
            <h3>{t("policies")}</h3>
            <Link to="/policy" onClick={scrollToTop}>{t("purchase_policy")}</Link>
            <Link to="/policy" onClick={scrollToTop}>Chính sách bảo hành</Link>
            <Link to="/policy" onClick={scrollToTop}>{t("return_warranty")}</Link>
            <Link to="/policy" onClick={scrollToTop}>Vận chuyển & giao nhận</Link>
            <Link to="/policy" onClick={scrollToTop}>Chính sách bảo mật</Link>
          </section>

          <section className="store-footer-column">
            <h3>Hỗ trợ</h3>
            <Link to="/policy" onClick={scrollToTop}>Hướng dẫn mua hàng</Link>
            <Link to="/policy" onClick={scrollToTop}>Hướng dẫn thanh toán</Link>
            <Link to="/policy" onClick={scrollToTop}>Tài liệu kỹ thuật</Link>
            <Link to="/policy" onClick={scrollToTop}>{t("faqs")}</Link>
            <a href="tel:0813158383">Hỗ trợ kỹ thuật 24/7</a>
          </section>

          <section className="store-footer-newsletter">
            <h3>Đăng ký nhận tin</h3>
            <p>Nhận thông tin khuyến mãi và sản phẩm mới nhất từ TTSmart.</p>
            <form onSubmit={keepVisualOnly}>
              <input type="email" placeholder="Nhập email của bạn" aria-label="Email đăng ký nhận tin" />
              <button type="submit" aria-label="Đăng ký"><i className="fa-solid fa-paper-plane" /></button>
            </form>
            <div className="store-footer-badges">
              <span>VISA</span><span>Mastercard</span><span>QR</span><span>ZaloPay</span>
            </div>
          </section>
        </div>

        <div className="store-footer-bottom">
          <span>{t("copyright")}</span>
          <button type="button" onClick={scrollToTop} aria-label="Lên đầu trang"><i className="fa-solid fa-angle-up" /></button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
