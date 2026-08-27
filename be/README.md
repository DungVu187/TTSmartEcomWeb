# Backend B2B TTSmart Ecom API

Tài liệu hướng dẫn cấu hình và chạy các công cụ bảo mật/kiểm thử của hệ thống backend.

## 1. Cấu hình biến môi trường (`.env`)

Hệ thống cung cấp một số biến môi trường mới để cấu hình cơ chế đăng ký và chống spam/brute-force:

| Biến môi trường | Kiểu dữ liệu | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| `PUBLIC_SIGNUP_ENABLED` | `Boolean` | `false` | Bật/tắt tính năng đăng ký công khai. Nếu đặt `false`, API `/users/register` sẽ yêu cầu quyền Admin/Staff. Nếu đặt `true`, cho phép đăng ký tự do nhưng vai trò mặc định được thiết lập cứng là `customer`. |
| `RATE_LIMIT_WINDOW_MS` | `Number` | `900000` | Khoảng thời gian giới hạn IP (tính bằng mili-giây). Mặc định là 15 phút. |
| `RATE_LIMIT_MAX` | `Number` | `100` | Số lượt gửi yêu cầu tối đa từ cùng một IP trong khoảng thời gian `RATE_LIMIT_WINDOW_MS`. |

---

## 2. Kiểm thử tự động (Automated Tests)

Hệ thống sử dụng **Jest** và **Supertest** để kiểm tra tính đúng đắn của các API phân quyền đăng ký.

Để thực thi bộ kiểm thử đăng ký:
```bash
# Cài đặt môi trường kiểm thử (nếu chưa có)
npm install --save-dev jest supertest

# Thực thi kiểm thử đăng ký
npx jest tests/register.test.js
```

---

## 3. Script dọn dẹp cơ sở dữ liệu (Database Cleanup)

Khi cần loại bỏ các tài khoản tự đăng ký "mồ côi" (không được gán vào bất kỳ trạm concrete trộn nào), bạn có thể chạy script dọn dẹp:

```bash
# Chạy script dọn dẹp từ thư mục be
$env:NODE_PATH="node_modules"; node C:\Users\TTSmart\.gemini\antigravity-ide\brain\30af9d70-58f4-4a66-ad3b-3de7d19fb298\scratch\cleanup-users.js
```
*Lưu ý: Bạn có thể sao chép tệp `cleanup-users.js` vào thư mục `be/scratch/` hoặc một thư mục khác để quản lý lâu dài.*
