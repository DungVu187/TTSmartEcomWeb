import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";
import { toast } from "react-hot-toast";

const AutoLog = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const loginFromCode = async () => {
      try {
        if (!code) throw new Error("Không có mã đăng nhập.");

        const key = process.env.REACT_APP_AES_KEY;
        if (!key) throw new Error("Thiếu biến môi trường REACT_APP_AES_KEY");

        const bytes = AES.decrypt(code, key);
        const decrypted = bytes.toString(Utf8);

        if (!decrypted.includes("+++")) {
          throw new Error("Mã không hợp lệ hoặc sai định dạng.");
        }

        const [phone, password] = decrypted.split("+++");

        const response = await fetch(
          `${process.env.REACT_APP_BACK_END}/users/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ phone, password }),
          }
        );

        if (!response.ok) {
          toast.error("Đăng nhập tự động thất bại.");
          return;
        }

        toast.success("Đăng nhập tự động thành công!");
        window.location.href = "/station";
      } catch (err) {
        console.error("Tự động đăng nhập lỗi:", err.message);
        toast.error(err.message || "Lỗi khi đăng nhập tự động.");
      }
    };

    loginFromCode();
  }, [code, navigate]);

  return <div>Đang đăng nhập tự động...</div>;
};

export default AutoLog;
