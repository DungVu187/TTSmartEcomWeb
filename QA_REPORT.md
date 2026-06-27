# BÁO CÁO KIỂM THỬ CHẤT LƯỢNG (QA AUDIT REPORT) — TTSmartEcomWeb

Báo cáo này trình bày kết quả kiểm duyệt mã nguồn, kiểm thử tự động, và kiểm thử chịu tải cho hệ thống **TTSmartEcomWeb** trước khi đưa vào vận hành thực tế (Production).

---

## 1. BẢNG KẾT QUẢ KIỂM THỬ CHI TIẾT

| Mục kiểm thử | Kết quả | Bằng chứng kiểm thử / Log / Số liệu | Ghi chú & Cảnh báo từ QA Engineer |
| :--- | :---: | :--- | :--- |
| **1. Xác thực & phân quyền** | **FAIL một phần** | - Cookie `authToken` được thiết lập `httpOnly` động.<br>- Rate limit: 100 req/15 min.<br>- `checkPermission` bảo vệ backend tốt.<br>- **Thiếu tính năng khóa tài khoản** trong DB schema.<br>- **Kết quả Jest test suite**: 23/26 PASS, 3 FAIL pre-existing (xem mục 3). | **FAIL một phần**: Không hỗ trợ khóa tài khoản trong schema và API đăng nhập. Không rò rỉ dữ liệu nhạy cảm ở các public route. |
| **2. Quản lý sản phẩm** | **FAIL một phần** | - Cột VAT hiển thị, form tạo/sửa có VAT.<br>- Công thức tính giá bán đúng.<br>- Lọc `adjusted===false` hoạt động tốt.<br>- **Multer upload ảnh không giới hạn dung lượng/whitelist tệp.** | **FAIL một phần**: Thiếu whitelist định dạng tệp và giới hạn kích thước khi tải ảnh lên. |
| **3. Quét hóa đơn AI + Hybrid** | **PASS** | - Phân loại mã nhà cung cấp (R1) và Set token (R2) hoạt động đúng.<br>- Lọc type-word gate (R5), confidence badge (R6, R7), tạo `NEW_PRODUCT` tự động hoạt động tốt.<br>- Fallback chain và timeout 25s hoạt động.<br>- Re-scan: delta `Math.max` tránh rò rỉ kho.<br>- NEW_PRODUCT bỏ qua trừ kho (isNewProduct). | **PASS**: Hoạt động đúng đặc tả kỹ thuật và giải quyết tốt các case rủi ro. |
| **4. Đơn hàng nhập/xuất** | **PASS** | - Đồng bộ tên đơn hàng sang lịch sử kho hoạt động tốt.<br>- Hoàn tất đơn `completedAt` nhận ngày hiện tại.<br>- Chặn xuất kho vượt tồn kho (variant.quantityInStorage < requiredQty).<br>- Link liên kết lịch sử kho hoạt động tốt. | **PASS**: Luồng nghiệp vụ xuất/nhập kho và kiểm tra tồn kho chính xác. |
| **5. Lịch sử kho** | **PASS** | - Bộ lọc 5 loại hoạt động tốt (phân biệt AI scan bằng `{ isAIScan: { $ne: true } }`).<br>- Legacy records xử lý chính xác.<br>- Có debounce gõ phím 500ms và nút reset bộ lọc. | **PASS**: Bộ lọc hoạt động tốt, không bị trùng lặp số lượng. |
| **6. Lịch sử hoạt động** | **FAIL** | - Việt hóa nhãn và màu sắc hoạt động tốt.<br>- Diff `oldValue` -> `newValue` hiển thị trực quan.<br>- **Route `POST /:id/rotate-invite` chưa tồn tại và chưa ghi log.** | **FAIL**: Route xoay mã mời chưa được thiết lập, dẫn đến thiếu ghi nhận log tương ứng. |
| **7. Toàn vẹn dữ liệu & storage** | **FAIL** | - Database `test`: `activitylogs` (8 docs, size: 2.42 KB), `storagehistories` (281 docs, size: 76.60 KB).<br>- **Lưu trữ toàn bộ nội dung text dài gây phình DB.**<br>- **Không có index trên trường `createdAt` của StorageHistory**.<br>- **Cấu hình MongoDB bỏ qua DB_NAME trong .env (chạy mặc định vào DB `test`).** | **FAIL**: Nguy cơ phình cơ sở dữ liệu lớn; thiếu index phân trang trên lịch sử kho; cấu hình sai tên DB. |
| **8. Performance / chịu tải** | **PASS** | - 10 kết nối: **7492.4 req/s** (Avg: 1.02 ms)<br>- 100 kết nối: **7248.8 req/s** (Avg: 13.29 ms)<br>- 300 kết nối: **6973.4 req/s** (Avg: 42.54 ms)<br>- Lỗi/Timeout ở mọi cấp tải: **0** | **PASS**: Hệ thống chịu tải cực tốt, độ trễ thấp và không phát sinh lỗi ở 300 kết nối đồng thời. |
| **9. Bảo mật** | **FAIL** | - Không cứng hóa API key trong backend.<br>- **Cơ chế CORS cho phép origin `null`**.<br>- **Vô hiệu hóa HSTS và CSP trong Helmet**.<br>- **Lộ khóa AES key** (`VITE_AES_KEY` / `REACT_APP_AES_KEY`) trong bundle JS client.<br>- Thiếu kiểm tra NoSQL Injection. | **FAIL**: Nhiều lỗ hổng bảo mật mức độ nghiêm trọng (lộ khóa mã hóa client, CORS quá rộng, tắt bảo mật HTTP headers). |
| **10. Edge cases & ổn định** | **PASS** | - Mất kết nối MongoDB: Trả lỗi 500 thông qua try-catch, không sập app.<br>- Xử lý gracefully đơn hàng chứa sản phẩm bị xóa giữa chừng. | **PASS**: Hệ thống vận hành tương đối ổn định với các trường hợp ngoại lệ. |

---

## 2. Ý KIẾN ĐÁNH GIÁ ĐỘC LẬP & PHÂN TÍCH RỦI RO CHI TIẾT

### 2.1. Phân tích Cơ chế Mã hóa AES phía Client (Đánh giá mức độ: CRITICAL)
- **Cơ chế hoạt động**: Mã nguồn client (`login.jsx` và `changepassword.jsx`) sử dụng `AES.encrypt(phone + "+++" + password, AES_KEY)` để tạo ra trường `logInString`. Tệp `autolog.jsx` ở client sẽ giải mã chuỗi này để trích xuất ra số điện thoại và mật khẩu dạng plaintext, sau đó gửi yêu cầu đăng nhập POST thông thường đến backend.
- **Phân tích rủi ro thực sự**: 
  - Khóa AES (`VITE_AES_KEY` / `REACT_APP_AES_KEY`) chắc chắn bị lộ do bundle trực tiếp vào mã chạy phía client. 
  - AES ở đây không đóng vai trò "bảo mật vận chuyển" (transit security) vì HTTPS đã đảm nhiệm việc đó. Nó đóng vai trò mã hóa thông tin tài khoản (thường là QR Code vật lý hoặc liên kết NFC in sẵn cho các trạm trộn tự động đăng nhập).
  - Do đó, nếu kẻ xấu quét/có được URL chứa chuỗi mã hóa này, họ có thể dễ dàng trích xuất khóa AES từ file JS công khai và giải mã thành công **số điện thoại + mật khẩu dạng plaintext** của khách hàng. Điều này làm lộ mật khẩu thật của tài khoản.
- **Khuyến nghị**: Xếp hạng **CRITICAL** là hoàn toàn chính xác do rủi ro lộ mật khẩu gốc. Hệ thống nên chuyển sang dùng cơ chế **token dùng một lần (One-Time Token - OTT)** hoặc **token có hạn dùng (AutoLoginToken)** như đã định nghĩa một phần trong `be/components/autolog.js`, thay vì mã hóa mật khẩu trực tiếp.

### 2.2. Phân tích Nguy cơ từ File Upload qua Multer (Đánh giá mức độ: HIGH)
Cần phân loại cụ thể rủi ro của từng endpoint để tránh gộp chung chung:
- **Bộ nhớ tạm (MemoryStorage - Quét hóa đơn AI)**: Tệp tải lên được lưu trực tiếp vào RAM server dưới dạng buffer. Nếu không giới hạn dung lượng tệp (`limits.fileSize`), kẻ tấn công có thể liên tục gửi các tệp ảnh giả lập nặng hàng trăm MB làm cạn kiệt RAM server dẫn đến sập Node.js (Denial of Service - DoS).
- **Lưu trữ đĩa cứng (DiskStorage - Ảnh sản phẩm & ảnh trạm trộn)**: Tệp được lưu trực tiếp vào thư mục `./upload/`. Nếu thiếu `fileFilter` để xác minh phần mở rộng tệp và kiểu MIME thực tế (Magic Bytes), kẻ tấn công có thể tải lên các mã thực thi độc hại (ví dụ: `.js`, `.py`, `.php`) hoặc các tệp cực lớn làm đầy đĩa cứng server.
- **Khuyến nghị**:
  1. Thêm `{ limits: { fileSize: 5 * 1024 * 1024 } }` (giới hạn 5MB) vào cấu hình của tất cả các thực thể `multer`.
  2. Bổ sung hàm lọc `fileFilter` để chỉ chấp nhận các kiểu MIME ảnh tiêu chuẩn (`image/jpeg`, `image/png`, `image/webp`).

### 2.3. Rủi ro Phá hỏng Tương thích Ngược của Link Mời (rotate-invite) (Đánh giá mức độ: HIGH)
- **Vấn đề tiềm tàng**: Nếu thay đổi format `inviteCode` từ `stationCode` thuần túy sang dạng có secret `${stationCode}-${inviteSecret}`, các liên kết in sẵn/phát hành trước đó sẽ bị vô hiệu hóa lập tức nếu code mới so khớp nghiêm ngặt theo ký tự `-`.
- **Rủi ro xung đột ký tự**: Nếu `stationCode` đặt bởi admin có chứa dấu gạch ngang (ví dụ: `TT-HCM`), logic phân tách chuỗi bằng dấu `-` sẽ trả về kết quả sai (`stationCode='TT'`, `inviteSecret='HCM'`).
- **Khuyến nghị**:
  1. **Không phá vỡ link cũ**: Logic phân tách trong `findStationByInviteCode` phải có cơ chế fallback. Nếu không tìm thấy định dạng khớp `-` (hoặc sau khi tách không khớp), hệ thống phải tìm kiếm theo `stationCode` thuần để hỗ trợ các link đời cũ.
  2. **Tránh xung đột ký tự**: Thay vì phân tách đơn giản bằng dấu `-`, nên sử dụng dấu phân tách ít có khả năng xuất hiện hơn (ví dụ: `.` hoặc `_`), hoặc kiểm tra sự tồn tại của `inviteSecret` trong DB trước để kiểm tra khớp.
  3. **Tự động di chuyển (Migration)**: Cần có script di chuyển sinh ngẫu nhiên `inviteSecret` cho các trạm trộn cũ khi khởi chạy ứng dụng (giống như cách migrate trường `adjusted`).

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (JEST TEST BASELINE)

Để đảm bảo không xảy ra lỗi hồi quy (regression) sau này, chúng tôi ghi nhận chính xác hiện trạng kiểm thử tự động tại thời điểm kiểm duyệt (Baseline):

- **Tổng số ca test**: 26 ca kiểm thử thuộc 9 test suite.
- **Số ca THÀNH CÔNG (PASS)**: 23 ca.
- **Số ca THẤT BẠI (FAIL - Được ghi nhận từ trước và không do code thay đổi)**: 3 ca.
  1. **`api_product.test.js` - Test Case 7**: Thất bại do test gửi yêu cầu `GET /products` phân trang không đính kèm cookie `authToken` giả lập, trong khi cấu hình backend hiện tại bắt buộc phải có token mới trả danh sách sản phẩm.
  2. **`product.test.js` - Test Case 3**: Thất bại do Hook `post-init` của mongoose chưa tự động chuyển đổi định dạng ảnh tuyệt đối thành tương đối (`/images/...`).
  3. **`product.test.js` - Test Case 4**: Tương tự như trên đối với ảnh phân mục (`/section-images/...`).

*Lưu ý*: Môi trường chạy bộ test tự động bắt buộc phải kết nối tới MongoDB cục bộ (Database: `EcomTest`).

---

## 4. DANH SÁCH CÁC THẤT BẠI (FAILURES) PHÂN LOẠI THEO MỨC ĐỘ ƯU TIÊN

### MỨC ĐỘ: CRITICAL (Cực kỳ nghiêm trọng - Yêu cầu sửa ngay trước khi Go-live)

1. **Lộ khóa mật mã AES ở Client Bundle (Bảo mật)**
   - **Đề xuất**: Thay thế cơ chế mã hóa phía client bằng cách lưu trữ Token tạm thời/Sử dụng One-Time Token (OTT) từ backend truyền qua URL, thay vì giải mã mật khẩu plaintext ngay trên frontend.

2. **Cấu hình Sai lệch Database Mongoose (Toàn vẹn dữ liệu)**
   - **Đề xuất**: Đổi chuỗi kết nối trong `be/index.js` thành `` `mongodb://localhost:27017/${process.env.DB_NAME || 'Ecom'}` ``.
   - **Cảnh báo Migration**: Do dữ liệu hiện tại đang nằm hoàn toàn ở DB `test`, khi thực hiện thay đổi này cần chạy script sao lưu/di chuyển dữ liệu (export từ `test` và import sang `Ecom`) để tránh mất hiển thị dữ liệu của khách hàng.

3. **Thiếu Middleware Xác thực và Verification trên Zalo Callback (Bảo mật)**
   - **Đề xuất**: Thêm middleware `authenticateAdmin` bảo vệ route `/callback` và triển khai sinh mã `state` ngẫu nhiên để chống tấn công CSRF.

---

### MỨC ĐỘ: HIGH (Nghiêm trọng - Cần khắc phục sớm)

1. **Không có Tính năng Khóa Tài khoản (Xác thực)**
   - **Đề xuất**: Thêm trường `isLocked` (Boolean, default: false) vào schema User và chặn đăng nhập nếu tài khoản bị khóa.

2. **Thiếu Giới hạn Tải lên Tệp ảnh của Multer (Bảo mật)**
   - **Đề xuất**: Thêm giới hạn dung lượng (5MB) và bộ lọc MIME type kiểm tra định dạng ảnh hợp lệ cho cả bộ nhớ RAM và đĩa cứng.

3. **Vô hiệu hóa HSTS và CSP trong Helmet (Bảo mật)**
   - **Đề xuất**: Bật lại CSP và HSTS cấu hình riêng cho môi trường production.

---

### MỨC ĐỘ: MEDIUM (Trung bình - Cần cải thiện)

1. **Phình to Cơ sở Dữ liệu do Lưu trữ Text dài trong Log Hoạt động (Storage)**
   - **Đề xuất**: Đối với các trường rich-text lớn, chỉ nên ghi nhận nhãn thao tác là "đã thay đổi" mà không lưu giá trị văn bản cụ thể.

2. **Thiếu Chỉ mục (Index) Trên StorageHistory (Performance)**
   - **Đề xuất**: Thêm chỉ mục `storageHistorySchema.index({ createdAt: -1 })`.

3. **CORS Chấp nhận Origin `null` (Bảo mật)**
   - **Đề xuất**: Loại bỏ `'null'` khỏi danh sách whitelist CORS.

---

### MỨC ĐỘ: LOW (Thấp - Khuyến nghị)

1. **Thiếu chỉ mục `createdAt` trên ActivityLog cho phân trang**
   - **Khuyến nghị**: Nên duy trì chỉ mục đơn rõ ràng để đảm bảo tốc độ sắp xếp không bị ảnh hưởng.
