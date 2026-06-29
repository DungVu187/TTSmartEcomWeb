import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const AutoLog = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const loginFromCode = async () => {
      try {
        if (!code) throw new Error("Không có mã đăng nhập.");

        const response = await fetch(
          `${process.env.REACT_APP_BACK_END}/users/autologin`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: code }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Đăng nhập tự động thất bại.");
        }

        const queryParams = new URLSearchParams(window.location.search);
        const redirectPath = queryParams.get("redirect");

        const isSafeStationRedirect =
          redirectPath &&
          /^\/station\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(redirectPath);

        const safeRedirect = isSafeStationRedirect ? redirectPath : "/station";

        toast.success("Đăng nhập tự động thành công!");
        window.location.href = safeRedirect;
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
