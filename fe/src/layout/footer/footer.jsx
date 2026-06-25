import React from "react";
import { Link } from "react-router-dom";
import logo from '../../assets/TTSlogo.jpg';
import { useLanguage } from "../../context/languagecontext.jsx";
import './footer.css';

function Footer() {
    const { t } = useLanguage();

    const handleLinkClick = () => {
        window.scrollTo(0, 0);
    };

    return (
        <footer className="footer">
            <div className="footer-content">
                {/* Column 1: Brand Info */}
                <div className="footer-column footer-brand">
                    <div className="footer-logo-wrapper">
                        <img src={logo} alt="TTSmart logo" className="footer-logo" />
                    </div>
                    <p className="footer-brand-desc">
                        TTSmart - Giải pháp tự động hóa, thiết bị đo lường và vật tư trạm trộn bê tông hàng đầu.
                    </p>
                    <div className="footer-contact-info">
                        <div className="footer-contact-item">
                            <i className="fa-solid fa-location-dot footer-icon"></i>
                            <span>Số 28/29 Vũ Đức Thận, Việt Hưng, Long Biên, Hà Nội</span>
                        </div>
                        <div className="footer-contact-item">
                            <i className="fa-solid fa-phone footer-icon"></i>
                            <a href="tel:0813158383" className="footer-link">08.1315.8383</a>
                        </div>
                        <div className="footer-contact-item">
                            <i className="fa-solid fa-envelope footer-icon"></i>
                            <a href="mailto:ttsmart.ltd@gmail.com" className="footer-link">ttsmart.ltd@gmail.com</a>
                        </div>
                    </div>
                </div>

                {/* Column 2: Quick Links */}
                <div className="footer-column">
                    <h4 className="footer-heading">{t("quick_links")}</h4>
                    <ul className="footer-links-list">
                        <li>
                            <Link to="/" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("home")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/product" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("products")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/dashboard" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("equipment_group")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/station" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("my_stations_nav")}
                            </Link>
                        </li>
                    </ul>
                </div>

                {/* Column 3: Policies */}
                <div className="footer-column">
                    <h4 className="footer-heading">{t("policies")}</h4>
                    <ul className="footer-links-list">
                        <li>
                            <Link to="/policy" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("purchase_policy")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/policy" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("return_warranty")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/policy" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("faqs")}
                            </Link>
                        </li>
                    </ul>
                </div>

                {/* Column 4: Contact & Social */}
                <div className="footer-column">
                    <h4 className="footer-heading">{t("contact_us")}</h4>
                    <ul className="footer-links-list">
                        <li>
                            <Link to="/introduction" onClick={handleLinkClick} className="footer-link-item">
                                <i className="fa-solid fa-chevron-right list-arrow"></i>
                                {t("introduction")}
                            </Link>
                        </li>
                    </ul>
                    <div className="footer-social-wrapper">
                        <p className="footer-social-title">Kết nối với chúng tôi</p>
                        <div className="footer-social-icons">
                            <a href="https://zalo.me/0813158383" target="_blank" rel="noopener noreferrer" className="social-icon-btn zalo" title="Zalo">
                                <i className="fa-solid fa-comment-dots"></i>
                            </a>
                            <a href="tel:0813158383" className="social-icon-btn phone" title="Hotline">
                                <i className="fa-solid fa-phone"></i>
                            </a>
                            <a href="mailto:ttsmart.ltd@gmail.com" className="social-icon-btn email" title="Email">
                                <i className="fa-solid fa-envelope"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Bottom */}
            <div className="footer-bottom">
                <div className="footer-bottom-content">
                    <p className="copyright-text">{t("copyright")}</p>
                    <div className="footer-bottom-links">
                        <Link to="/introduction" onClick={handleLinkClick}>{t("introduction")}</Link>
                        <span>•</span>
                        <Link to="/policy" onClick={handleLinkClick}>{t("purchase_policy")}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;