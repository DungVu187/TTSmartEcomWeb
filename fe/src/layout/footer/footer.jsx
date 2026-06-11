import React from "react";
import logo from '../../assets/TTSlogo.jpg';
import './footer.css'

function Footer () {
    return(
        <div className="footer">
            <div className="footer-section">
                <img src={logo} alt="company's logo" />
                <p>Số 28/29 Vũ Đức Thuận, Việt Hưng, Long Biên, Hà Nội</p>
                <p>Điện Thoại: <u>08.1315.8383</u></p>
                <p>Email: ttsmart.ltd@gmail.com</p>
            </div>
            <div className="footer-section hide">
                <p className="footer-header-section">Thông tin</p>
                <p>Giới thiệu</p>
                <p>Liên hệ</p>
                <p>Đơn hàng</p>
                <p>Giải pháp</p>
                <p>Tin tức</p>
            </div>
            <div className="footer-section hide">
                <p className="footer-header-section">Chính sách</p>
                <p>Chính sách bảo hành</p>
                <p>Chính sách đổi trả</p>
                <p>Chính sách vận chuyển</p>
                <p>Điều khoản dịch vụ</p>
            </div>
            <div className="footer-section">
                <p className="footer-header-section">Hỗ trợ</p>
                <p>Hotline</p>
            </div>
        </div>
    )
}

export default Footer