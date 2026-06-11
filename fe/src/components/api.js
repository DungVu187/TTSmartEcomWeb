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

// Middleware cho response (xử lý token hết hạn)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 400 &&
      error.response.data.message.includes("Token không hợp lệ") &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        await api.post("/users/refresh-token");
        return api(originalRequest); // Thử lại request ban đầu
      } catch (refreshError) {
        toast.error("Token đã hết hạn, bạn cần đăng nhập lại");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;