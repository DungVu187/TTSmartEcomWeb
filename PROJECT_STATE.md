# PROJECT_STATE — TTSmartEcomWeb

> **File "ảnh chụp" hiện trạng — GHI ĐÈ mỗi phiên, KHÔNG giữ lịch sử.**
> Agent mới vào phiên chỉ cần đọc file này + file plan của việc đang làm. Lịch sử chi tiết xem `CHANGELOG.md`.
> Cập nhật lần cuối: **2026-07-03** | Cập nhật bởi: Claude (khởi tạo từ việc gộp 5 báo cáo cũ)

---

## 1. TÌNH TRẠNG TỔNG THỂ

| Hạng mục | Mức | Ghi chú |
|---|---|---|
| Hoàn thiện chức năng | Khá cao | Các module chính đã đủ flow |
| Ổn định kỹ thuật | Trung bình–khá | Còn issue bảo mật/tồn kho chưa xử lý |
| Sẵn sàng demo bảo vệ | **Có điều kiện** | Cần chốt các blocker mục 3 trước khi demo |
| Test tự động | Yếu | Chỉ `be/` có test; `ad/`, `fe/` chưa/không đầy đủ |

**Điểm QA tham khảo (từ báo cáo 2026-06-30, CHƯA verify lại):** BE API 8.0 · FE 7.0 · Admin 6.5 · Security 5.0 · Test coverage 4.0 · Production readiness 7.2.

---

## 2. TRẠNG THÁI KIỂM THỬ / BUILD (cần cập nhật mỗi phiên)

> Con số dưới đây là kết quả LẦN CHẠY GẦN NHẤT được ghi nhận, **KHÔNG phải phiên hiện tại**. Chạy lại và cập nhật khi review.

| Kiểm thử | Kết quả gần nhất | Nguồn | Phiên này đã chạy lại? |
|---|---|---|---|
| `be/` Jest | 32/32 tests, 10/10 suites PASS | báo cáo 2026-06-30 | CHƯA |
| `fe/` build (CRA) | PASS (warning cũ) | báo cáo 2026-06-30 | CHƯA |
| `ad/` build (Vite) | PASS (warning chunk lớn) | báo cáo 2026-06-30 | CHƯA |
| `ad/` lint | FAIL ~149 errors (còn tồn) | báo cáo 2026-06-30 | CHƯA |

---

## 3. ISSUE CÒN TỒN ĐỌNG (gộp từ audit 06-22 → 06-30 — CHƯA verify lại phiên này)

> Cần đọc code hiện tại để xác nhận cái nào đã fix trước khi báo cáo. Đây là danh sách "nghi ngờ còn tồn", không phải "chắc chắn còn".

### BLOCKER cho demo bảo vệ
- **DB-1** — Cấu hình DB có thể đang chạy vào DB tên `test` thay vì `Ecom` (`DB_NAME` trong `.env` không dùng trong URI). Kiểm tra `be/index.js` trước demo.
- **DB-2** — DB `test` có 5 nhóm `product.code` trùng → vỡ nếu bật unique index. DB `Ecom` sạch (0 trùng).
- **DATA** — Cần backup DB + chuẩn bị dữ liệu demo trước buổi bảo vệ (đề phòng edge case data thiếu).

### Bảo mật — CRITICAL/HIGH (nghi còn tồn)
- **SEC-C1** — AES key hardcode trong `be/tests/autologin.test.js` → nên đọc từ env.
- **SEC-C4** — `GET /zalo/callback` (`be/components/zalo.js`) không auth + không verify CSRF state.
- **H1** — `PUT /products/purchase/:_id` (`product.js`) thiếu auth.
- **H2** — Socket.IO không xác thực JWT — client tự đặt `senderRole` (`be/index.js`).
- **H3** — `total` đơn hàng do client gửi, server không tính lại (`order.js`).
- **H4** — Cancel/delete đơn không check ownership (`order.js`).
- **H5** — `trust proxy: true` không giới hạn → spoof `X-Forwarded-For` bypass rate limit.
- **H6** — CORS chấp nhận `origin === 'null'` và mọi tunnel subdomain (`be/index.js`).
- **H7** — JWT không revocation — logout chỉ xóa cookie client, token vẫn valid 12h.
- **H8** — Staff có thể lọt qua `authenticateAdmin` (dùng blacklist `customer` thay vì whitelist `admin`/`staff`).

### Bảo mật — MEDIUM (nghi còn tồn)
- **M2** — HTML email không escape → nguy cơ XSS trong email (`mailer.js`).
- **M3** — Zalo `secretKey`/token lưu plaintext MongoDB.
- **M4** — Helmet tắt CSP và HSTS.
- **M5** — Multer thiếu `fileFilter` + `limits.fileSize` → nguy cơ DoS file lớn.
- **M7** — Thiếu `express-mongo-sanitize` → nguy cơ NoSQL injection.

### Chất lượng code / tồn kho (nghi còn tồn)
- **BE-C1** — Không có MongoDB transaction cho multi-doc write ở `order.js` → crash giữa chừng làm tồn kho lệch, không rollback.
- **INV** — Inventory dual-counter chưa reconcile (H1 audit backend cũ).
- **FE** — `toast.warn` gây crash runtime (3 vị trí, báo cáo 06-29).
- **SOCKET** — Nghi socket connection leak phía FE (H2 cũ, chưa xác nhận).

---

## 4. ĐIỂM MẠNH ĐÃ XÁC LẬP (từ audit, giữ để trình bày khi bảo vệ)

- Bcrypt hash password (cost 10) qua pre-save hook.
- JWT trong httpOnly cookie — chống XSS đánh cắp token.
- Rate limiting cho `/register`, `/login`, `/change-password`.
- Generic error khi login sai — chống user enumeration.
- `authenticateAdmin` tra DB — phát hiện user đã bị xóa.
- Autologin đã nâng lên secure token (`crypto.randomBytes(32)`), invalidate khi đổi mật khẩu, admin rotate được.
- Gemini AI scan hóa đơn: fallback 3 model + timeout 25s.
- Chịu tải tốt: ~7000 req/s ở 300 kết nối đồng thời, 0 lỗi/timeout (báo cáo 06-22).

---

## 5. VIỆC ĐANG LÀM / PLAN MỞ

*(trống — cập nhật khi bắt đầu một tính năng; trỏ tới file `plan-bangiao-*.md` tương ứng nếu có)*
