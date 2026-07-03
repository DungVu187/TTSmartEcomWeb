import axios from "axios";
import { toast } from "react-hot-toast";

const api = axios.create({
  baseURL: process.env.REACT_APP_BACK_END,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  xsrfCookieName: "csrf-token",
  xsrfHeaderName: "X-CSRF-Token",
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isInvalidToken =
      error.response?.status === 400 &&
      error.response.data?.message?.includes("Token không hợp lệ");

    if (error.response?.status === 401 || isInvalidToken) {
      toast.error("Token đã hết hạn, bạn cần đăng nhập lại");
      window.location.href =
        "/login?redirect=" +
        encodeURIComponent(window.location.pathname + window.location.search);
    }

    return Promise.reject(error);
  }
);

export default api;
