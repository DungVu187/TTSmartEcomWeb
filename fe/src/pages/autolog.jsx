import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useLanguage } from "../context/languagecontext.jsx";

const AutoLog = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const loginFromCode = async () => {
      try {
        if (!code) throw new Error("auto_login_missing_code");

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
          throw new Error("auto_login_failed");
        }

        const queryParams = new URLSearchParams(window.location.search);
        const redirectPath = queryParams.get("redirect");

        const isSafeStationRedirect =
          redirectPath &&
          /^\/station\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(redirectPath);

        const safeRedirect = isSafeStationRedirect ? redirectPath : "/station";

        toast.success(t("auto_login_success"));
        window.location.href = safeRedirect;
      } catch (err) {
        console.error("Tự động đăng nhập lỗi:", err.message);
        if (err.message === "auto_login_missing_code") {
          toast.error(t("auto_login_missing_code"));
        } else if (err.message === "auto_login_failed") {
          toast.error(t("auto_login_failed"));
        } else {
          toast.error(t("auto_login_error"));
        }
      }
    };

    loginFromCode();
  }, [code, navigate, t]);

  return <div>{t("auto_logging_in")}</div>;
};

export default AutoLog;
