import React from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/TTSlogo.jpg";
import { useLanguage } from "../../context/languagecontext.jsx";
import "./footer.css";

function Footer() {
  const { t } = useLanguage();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

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
              <a href="https://zalo.me/0813158383" target="_blank" rel="noreferrer" aria-label={t("contact_zalo")}><i className="fa-solid fa-comment-dots" /></a>
              <a href="tel:0813158383" aria-label={t("hotline_label")}><i className="fa-solid fa-phone" /></a>
              <a href="mailto:ttsmart.ltd@gmail.com" aria-label={t("send_email")}><i className="fa-solid fa-envelope" /></a>
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
            <Link to="/policy/purchase" onClick={scrollToTop}>{t("purchase_policy")}</Link>
            <Link to="/policy/warranty" onClick={scrollToTop}>{t("return_warranty")}</Link>
            <Link to="/policy/shipping" onClick={scrollToTop}>{t("shipping_policy")}</Link>
            <Link to="/policy/privacy" onClick={scrollToTop}>{t("privacy_policy")}</Link>
          </section>

          <section className="store-footer-column">
            <h3>{t("support")}</h3>
            <Link to="/policy/purchase" onClick={scrollToTop}>{t("shopping_guide")}</Link>
            <Link to="/policy/warranty" onClick={scrollToTop}>{t("warranty_request")}</Link>
            <a href="mailto:ttsmart.ltd@gmail.com">{t("send_support_request")}</a>
            <a href="tel:0813158383">{t("technical_support_247")}</a>
          </section>

        </div>

        <div className="store-footer-bottom">
          <span>{t("copyright")}</span>
          <button type="button" onClick={scrollToTop} aria-label={t("back_to_top")}><i className="fa-solid fa-angle-up" /></button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
