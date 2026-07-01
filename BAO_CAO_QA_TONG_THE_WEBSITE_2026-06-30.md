# Báo cáo QA tổng thể website TTSmart

Ngày kiểm tra: 2026-06-30  
Workspace: `D:\TTSmartEcomWeb`  
Phạm vi: Backend (`be`), Frontend khách hàng (`fe`), Admin panel (`ad`)  
Người thực hiện: Codex  

## 1. Kết luận nhanh

Website hiện tại **build được frontend khách hàng và admin**, backend có thể phục vụ các route public/static, và backend test suite hiện đã xanh sau khi sửa image normalization. Tuy nhiên website **chưa đạt mức "ổn định hoàn toàn để deploy không điều kiện"** vì còn các vấn đề sau:

- Admin lint fail 149 errors.
- Frontend không có test tự động.
- Admin không có test tự động.
- Dependency audit có lỗ hổng security ở cả backend, frontend và admin.
- Một số chức năng production quan trọng phụ thuộc dịch vụ ngoài: Gemini, SMTP mail, Zalo OA, socket qua proxy.
- Backend startup có logic ghi dữ liệu local/production DB: đồng bộ `adjusted` và tính lại total import/export order.
- DB `test` hiện có 5 nhóm `product.code` bị trùng, cần xử lý trước khi dùng unique index trên DB này.

Đánh giá tổng thể:

- Mức hoàn thiện chức năng: **khá cao**, nhiều module đã đầy đủ flow chính.
- Mức ổn định kỹ thuật: **trung bình-khá**.
- Mức sẵn sàng deploy chính thức: **có thể deploy sau khi xử lý/accept các rủi ro blocker**, đặc biệt là DB backup, duplicate `product.code`, dependency/security, và smoke test production.

Điểm số QA tham khảo:

- Backend API: **8.0/10**
- Frontend khách hàng: **7.0/10**
- Admin panel: **6.5/10**
- Security/dependency hygiene: **5.0/10**
- Test coverage tự động: **4.0/10**
- Production readiness tổng thể: **7.2/10**

## 1.1 Ghi chú cập nhật sau khi dừng PM2/nginx

Sau khi người dùng dừng PM2 và nginx để giải phóng port 5000, báo cáo này đã được cập nhật thêm các phần sau:

- Cập nhật mục **2.3 Thay đổi database**: ghi rõ backend startup thật, dữ liệu QA tạm đã tạo/xóa và ActivityLog có thể còn lại.
- Cập nhật mục **3.7 Smoke test backend/local server**: thay kết quả cũ bằng kết quả start backend thật từ source hiện tại bằng `node index.js`.
- Thêm mục **3.8 Backend API integration smoke test**: bổ sung bảng test HTTP thật cho auth, profile, address, admin, product, protected routes, static fallback và AI validation.
- Đổi mục dependency audit cũ từ **3.8** thành **3.9**.
- Cập nhật mục **8. Ma trận mức độ ổn định**: thêm dòng backend startup thật và backend API integration smoke.
- Cập nhật mục **10. Kết luận cuối**: phản ánh kết quả backend đã start và smoke test thật thành công.

## 1.2 Ghi chú cập nhật sau kế hoạch deploy hoàn chỉnh

Đã thực hiện kế hoạch deploy hoàn chỉnh theo attachment mới:

- Thêm Mongoose `post('init')` hooks cho Product và Section image normalization.
- Sửa admin `ipordertemplate.jsx`: bỏ header `auth-token`, dùng `credentials: 'include'`.
- Sửa admin `chips.jsx`: đưa `useState` ra khỏi `renderDeviceTable`, hết lỗi `react-hooks/rules-of-hooks` mục tiêu.
- Thêm script read-only `be/scripts/check_duplicate_product_codes.js`.
- Cải tiến `scripts/backup_db.ps1`: nhận `-DbName`, kiểm tra `mongodump.exe`, báo archive path và file size.
- Chạy backup DB:
  - `wdata/test_2026-06-30_ 400.archive` - 777337 bytes
  - `wdata/Ecom_2026-06-30_ 400.archive` - 3420 bytes
- Chạy backup upload:
  - `wdata/upload_backup_2026-06-30_11-31-21/`
- Chạy duplicate code check:
  - DB `Ecom`: 0 nhóm trùng
  - DB `test`: 5 nhóm trùng, cần xử lý trước deploy nếu runtime/production dùng DB `test`
- Backend Jest sau sửa: 10/10 suites pass, 32/32 tests pass.
- FE build pass với warning cũ.
- Admin build pass với warning chunk lớn.
- Admin lint vẫn fail nhiều lỗi cũ, nhưng không còn 2 lỗi mục tiêu: `authToken is not defined` và `react-hooks/rules-of-hooks` trong `chips.jsx`.

## 2. Những thay đổi do quá trình QA tạo ra

Theo yêu cầu, quá trình QA được phép chạy test/build và ghi rõ nếu có thay đổi.

### 2.1 Thay đổi code

Không sửa code ứng dụng.

File báo cáo được tạo mới:

- `BAO_CAO_QA_TONG_THE_WEBSITE_2026-06-30.md`

Trước khi tạo báo cáo này, workspace đã có sẵn các thay đổi:

- `be/components/product.js`
- `be/tests/api_product.test.js`
- `BAO_CAO_SO_SANH_BAN_GOC_VA_HIEN_TAI.md`

Các file này không phải do lần QA này sửa, trừ file báo cáo QA mới.

### 2.2 Thay đổi build artifact

Đã chạy build:

- `fe/npm run build`
- `ad/npm run build`

Hai lệnh này có thể ghi lại nội dung trong:

- `fe/build`
- `ad/dist`

Tuy nhiên `git status` sau khi chạy không xuất hiện thay đổi tracked từ build artifact. Nghĩa là không có file tracked bị thay đổi do build.

### 2.3 Thay đổi database

Đã chạy backend Jest:

- Lệnh: `npm test` trong `be`

Các test backend kết nối MongoDB test local:

- `mongodb://localhost:27017/EcomTest`

Theo cấu trúc test, database `EcomTest` có thể bị tạo/xóa dữ liệu trong quá trình test. Đây là DB test, không phải DB production.

Sau khi người dùng dừng PM2/nginx, đã start backend thật bằng `node index.js` trên port 5000 và chạy thêm integration smoke test qua HTTP.

Các thay đổi DB local do integration smoke test:

- Backend startup đã connect MongoDB local qua URI trong app: `mongodb://localhost:27017/`.
- Startup sync đã chạy và log cho biết cập nhật `0` đơn nhập, `0` đơn xuất.
- Tạo 2 user QA tạm:
  - `qa_c_qa1782791442930`
  - `qa_a_qa1782791442930`
- Sau test đã xóa lại 2 user QA tạm, kết quả `deletedUsers: 2`.
- Tạo 1 sản phẩm QA tạm qua API admin với code dạng `QA-CODE-*`.
- Đã test duplicate code `409`.
- Đã toggle display sản phẩm QA.
- Đã xóa sản phẩm QA sau test.
- Đã tạo/cập nhật/set default/xóa 1 địa chỉ tạm cho customer QA.
- Có thể còn lại ActivityLog phát sinh từ thao tác tạo/toggle/xóa sản phẩm QA. Đây là dữ liệu log local do test tạo ra.

Backend process QA đã được tắt sau khi test:

- PID đã stop: `1616`

## 3. Lệnh đã chạy và kết quả

### 3.1 Backend Jest

Lệnh:

```bash
cd be
npm test
```

Kết quả:

- Test suites: **10 passed, 10 total**
- Tests: **32 passed, 32 total**
- Thời gian: khoảng 26.9 giây

Ghi chú lịch sử: trước khi sửa image normalization, 2 test từng fail:

1. `tests/product.test.js` - Test Case 3  
   Kỳ vọng product image URL tuyệt đối tự chuyển thành relative path.

   Expected:

   ```text
   /images/product_1741235837924.png
   ```

   Received:

   ```text
   https://ttsmart.com.vn/api/images/product_1741235837924.png
   ```

2. `tests/product.test.js` - Test Case 4  
   Kỳ vọng section image URL tuyệt đối tự chuyển thành relative path.

   Expected:

   ```text
   /section-images/sectionImage_1750388070165.jpg
   ```

   Received:

   ```text
   https://ttsmart.com.vn/api/section-images/sectionImage_1750388070165.jpg
   ```

Nhận định:

- Các API test còn lại pass.
- Fail nằm ở normalize URL ảnh cũ, không phải lỗi crash backend.
- Nếu production đang còn URL ảnh tuyệt đối, frontend có thể vẫn hiển thị được nếu URL cũ còn sống, nhưng mục tiêu chuẩn hóa path relative hiện chưa đạt theo test.

Mức độ nghiêm trọng: **Trung bình**.

### 3.2 Backend syntax check

Lệnh:

```bash
cd be
node --check index.js
Get-ChildItem components -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Kết quả:

- Pass
- Không phát hiện lỗi cú pháp JS ở `be/index.js` và 15 file JS trong `be/components`

### 3.3 Frontend customer build

Lệnh:

```bash
cd fe
npm run build
```

Kết quả:

- Build production thành công.
- Có warning ESLint.

Warning chính:

- Unused variables:
  - `VoiceSearchFAB.jsx`: `permissionGranted`
  - `productdisplay.jsx`: `handleFilterChange`, `activeValues`
  - `languagecontext.jsx`: `useEffect`
  - `navbar.jsx`: `brands`, `types`, `handleFilterClick`
  - `login.jsx`: `forgotPhone`
  - `profile.jsx`: `Divider`, `Home`

- Missing hook dependencies:
  - `stationdisplay.jsx`
  - `stationdisplaydetail.jsx`
  - `cart.jsx`
  - `changepassword.jsx`
  - `myorder.jsx`
  - `product.jsx`
  - `profile.jsx`
  - `station.jsx`

Build output:

- JS main gzip: khoảng **256.53 kB**
- CSS main gzip: khoảng **37.39 kB**

Nhận định:

- FE có thể build deploy.
- Warning hook dependency có thể gây stale data hoặc effect không chạy lại khi state đổi trong một số tình huống.
- Warning unused không chặn runtime nhưng nên dọn để code sạch hơn.

Mức độ nghiêm trọng: **Thấp-Trung bình**.

### 3.4 Frontend customer test runner

Lệnh:

```bash
cd fe
CI=true npm test -- --watchAll=false
```

Kết quả:

- Fail với lý do **không có test file**.

Thông báo:

```text
No tests found, exiting with code 1
```

Nhận định:

- Frontend khách hàng hiện chưa có test tự động.
- Không thể xác nhận UI logic bằng automated unit/integration test trong repo.

Mức độ nghiêm trọng: **Trung bình**.

### 3.5 Admin build

Lệnh:

```bash
cd ad
npm run build
```

Kết quả:

- Build production thành công.
- Có warning bundle lớn.

Build output:

- JS gzip: khoảng **741.66 kB**
- JS raw: khoảng **2,488.11 kB**
- CSS gzip: khoảng **4.74 kB**

Warning:

```text
Some chunks are larger than 500 kB after minification.
```

Nhận định:

- Admin có thể build deploy.
- Bundle admin lớn, ảnh hưởng tốc độ tải lần đầu, đặc biệt trên mạng yếu.
- Nên code split các route lớn như import/export order detail, product management.

Mức độ nghiêm trọng: **Trung bình**.

### 3.6 Admin lint

Lệnh:

```bash
cd ad
npm run lint
```

Kết quả:

- Fail.
- Tổng cộng **181 problems**
- **149 errors**
- **29 warnings**
- Cáº­p nháº­t sau sá»­a deploy: láº§n cháº¡y má»›i nháº¥t bÃ¡o **178 problems**, **149 errors**, **29 warnings**.

Nhóm lỗi chính:

- `React` import nhưng không dùng.
- Biến không dùng.
- Thiếu prop-types.
- Hook dependency thiếu.
- Hook `useState` được gọi trong function `renderDeviceTable`, vi phạm `react-hooks/rules-of-hooks`.
- Một lỗi đáng chú ý:

```text
ad/src/components/iporder/ipordertemplate.jsx
authToken is not defined
```

Nhận định:

- Dù admin build được, lint fail cho thấy code admin chưa sạch.
- Một số lỗi lint chỉ là style, nhưng `authToken is not defined` và vi phạm rules-of-hooks là rủi ro runtime/thứ tự render thật.
- Cần ưu tiên sửa các lỗi logic trước khi dọn toàn bộ lint.

Mức độ nghiêm trọng: **Trung bình-Cao**.

### 3.7 Smoke test backend/local server

Sau khi PM2/nginx được dừng, đã start backend trực tiếp:

```bash
cd be
node index.js
```

Log startup:

```text
Server running on port 5000
Connected to MongoDB!
Đang đồng bộ hóa tổng tiền các đơn hàng và trường adjusted trong Database...
Hoàn tất đồng bộ: Đã cập nhật 0 đơn nhập, 0 đơn xuất.
```

Kết quả kiểm tra port:

- Port `5000` listen bởi process Node PID `1616`
- Sau khi test xong đã stop PID `1616`

Các URL smoke trên đúng instance backend mới:

| URL | Status | Length |
| --- | ---: | ---: |
| `http://localhost:5000/products?page=1&limit=1` | 200 | 44 |
| `http://localhost:5000/products/top-purchased` | 200 | 8735 |
| `http://localhost:5000/manages/` | 200 | 1050 |
| `http://localhost:5000/chips/brands` | 200 | 1683 |
| `http://localhost:5000/chips/types` | 200 | 1886 |
| `http://localhost:5000/` | 200 | 907 |
| `http://localhost:5000/product` | 200 | 907 |
| `http://localhost:5000/admin/` | 200 | 672 |
| `http://localhost:5000/admin/product` | 200 | 672 |

Nhận định:

- Backend start thật thành công.
- MongoDB local connect thành công.
- Startup sync chạy không báo lỗi.
- API public hoạt động.
- Customer SPA fallback hoạt động.
- Admin SPA fallback hoạt động.

Mức độ nghiêm trọng: **Pass**.

### 3.8 Backend API integration smoke test

Đã tạo dữ liệu QA tạm trong MongoDB local để test qua HTTP thật:

- Customer QA: `qa_c_qa1782791442930`
- Admin QA: `qa_a_qa1782791442930`

Sau test đã xóa lại 2 user QA tạm.

Kết quả integration smoke:

| Test | Method | URL | Status | Kết quả |
| --- | --- | --- | ---: | --- |
| Unauth profile reject | GET | `/users/profile` | 401 | Pass, đúng kỳ vọng |
| Unauth admin users reject | GET | `/users/all-users` | 401 | Pass, đúng kỳ vọng |
| Unauth voice-query reject | POST | `/products/voice-query` | 401 | Pass, đúng kỳ vọng |
| Customer login | POST | `/users/login` | 200 | Pass |
| Customer profile | GET | `/users/profile` | 200 | Pass |
| Customer add address | POST | `/users/profile/addresses` | 201 | Pass |
| Customer update address | PUT | `/users/profile/addresses/:id` | 200 | Pass |
| Customer set default address | PUT | `/users/profile/addresses/:id/default` | 200 | Pass |
| Customer delete address | DELETE | `/users/profile/addresses/:id` | 200 | Pass |
| Customer get cart | GET | `/carts/getCart` | 200 | Pass |
| Customer my stations | GET | `/users/my-stations` | 200 | Pass |
| Customer voice-query no file | POST | `/products/voice-query` | 400 | Pass, đúng validation |
| Admin login | POST | `/users/admin/login` | 200 | Pass |
| Admin all users | GET | `/users/all-users` | 200 | Pass |
| Admin orders list | GET | `/orders?page=1&limit=1` | 200 | Pass |
| Admin activity logs | GET | `/activity-logs?page=1&limit=5` | 200 | Pass |
| Admin stations list | GET | `/stations` | 200 | Pass |
| Admin Zalo settings | GET | `/zalo/settings` | 200 | Pass, secret/config được mask |
| Admin scan invoice no file | POST | `/products/scan-invoice` | 400 | Pass, đúng validation |
| Admin create product | POST | `/products/create` | 201 | Pass |
| Admin duplicate product code | POST | `/products/create` | 409 | Pass, đúng kỳ vọng |
| Public product detail created | GET | `/products/:id` | 200 | Pass |
| Admin toggle product display | PUT | `/products/:id/toggle-display` | 200 | Pass |
| Admin delete QA product | DELETE | `/products/:id` | 200 | Pass |

Nhận định:

- Auth cookie flow hoạt động cho customer và admin.
- Protected routes reject đúng khi chưa đăng nhập.
- Customer profile/address/cart/station basic flow hoạt động.
- Admin user/order/activity/station/Zalo basic flow hoạt động.
- Product create/duplicate/toggle/delete flow hoạt động.
- AI endpoints có validation đúng với case thiếu file/chưa auth.
- Chưa test upload file thật, scan hóa đơn thật, voice audio thật, socket realtime thật, SMTP thật, Zalo OAuth callback thật.

Mức độ nghiêm trọng: **Pass cho smoke/integration cơ bản**.

### 3.9 Dependency audit

#### Backend

Lệnh:

```bash
cd be
npm audit --omit=dev
```

Kết quả:

- **14 vulnerabilities**
- 2 low
- 5 moderate
- 7 high

Gói/rủi ro đáng chú ý:

- `mongoose`: high, NoSQL injection advisory
- `nodemailer`: high
- `express` transitive `path-to-regexp`: high
- `socket.io-parser`: high
- `ws`: high
- `uuid`: moderate
- `csurf` transitive `cookie`

Mức độ nghiêm trọng: **Cao**.

#### Frontend customer

Lệnh:

```bash
cd fe
npm audit --omit=dev
```

Kết quả:

- **62 vulnerabilities**
- 13 low
- 17 moderate
- 29 high
- 3 critical

Gói/rủi ro đáng chú ý:

- `axios`: nhiều advisory high
- `form-data`: critical
- `swiper`: critical
- `react-router`: high
- `webpack`, `postcss`, `serialize-javascript`, `shell-quote`
- Nhiều vulnerability đến từ `react-scripts`/CRA toolchain cũ

Mức độ nghiêm trọng: **Cao**.

#### Admin

Lệnh:

```bash
cd ad
npm audit --omit=dev
```

Kết quả:

- **14 vulnerabilities**
- 6 moderate
- 7 high
- 1 critical

Gói/rủi ro đáng chú ý:

- `swiper`: critical
- `react-router`: high
- `socket.io-parser`: high
- `ws`: high
- `tmp`: high
- `exceljs` transitive `uuid`

Mức độ nghiêm trọng: **Cao**.

## 4. Phạm vi route/API đã phát hiện

Backend hiện có khoảng **179 route declarations** trong `be/components`.

Nhóm API chính:

- Auth/user/profile/password/permission
- Product/product variant/product review/upload/image/voice query/scan invoice
- Cart
- Order bán
- Import order
- Export order
- Station
- Chip/brand/type/section/value
- Manage/home/introduction/policy/section content
- Storage history
- Chat
- Activity log
- Zalo OA
- Autologin

Backend component JS đã kiểm tra syntax: **15 file**.

## 5. Đánh giá theo module

### 5.1 Auth/User/Profile

Chức năng hiện có:

- Register
- Login customer
- Login admin
- Logout
- Change password
- Forgot password OTP
- Reset password
- Get/update profile
- CRUD address
- Set default address
- User management
- Permissions
- Staff/admin/customer role
- Rotate autologin token
- User station assignment
- Autologin

Đã được kiểm tra tự động một phần qua backend Jest.

Rủi ro:

- Forgot password phụ thuộc SMTP.
- Autologin phụ thuộc AES key/env.
- Permissions logic rộng, cần regression test theo vai trò.

Đánh giá: **Khá ổn, cần test thủ công flow email/autologin**.

### 5.2 Product/Product Management

Chức năng hiện có:

- List/search/filter/sort/pagination
- Product detail
- Create/update/delete product
- Duplicate code protection
- Toggle display
- Upload/delete image
- Variant CRUD
- Earn/import price update
- Reviews
- Top purchased
- Fetch by IDs/codes
- Scan invoice
- Voice query

Đã được kiểm tra tự động một phần:

- Product API tests pass phần lớn.
- Duplicate code test pass trong backend suite.
- Voice query auth/no-file validation pass trong backend suite.
- Image absolute-to-relative test fail.

Rủi ro:

- Unique `code` cần kiểm tra dữ liệu production.
- Image URL normalize chưa đạt theo test.
- Gemini scan/voice phụ thuộc API key và output AI.

Đánh giá: **Tốt về chức năng, còn rủi ro dữ liệu và AI**.

### 5.3 Cart/Customer Order

Chức năng hiện có:

- Add to cart
- Update cart item
- Update status
- Get cart
- Remove item
- Clear cart
- Create order
- User orders
- Cancel/update order
- Admin order list/update
- Processing count

Đã được backend test một phần.

Rủi ro:

- Flow order có socket notify và Zalo notify, cần test tích hợp thực tế.
- Cart/order station context phụ thuộc `activeStationCode` trong sessionStorage.

Đánh giá: **Khá ổn, cần smoke test UI thực tế**.

### 5.4 Import/Export Order

Chức năng hiện có:

- List/filter/pagination
- Create order
- Create from template
- Add/remove product
- Update product info
- Update order status
- Update payment/status/date
- Detail view
- Ordered/exported product report
- Storage history integration

Rủi ro:

- Đây là khu vực code lớn nhất, admin detail file rất lớn.
- Admin lint có nhiều lỗi trong `iporderdetail`/`eporderdetail`.
- Startup backend có logic tính lại total đơn cũ.

Đánh giá: **Nhiều chức năng nhưng cần regression test kỹ trước production**.

### 5.5 Station

Chức năng hiện có:

- Admin tạo/sửa/xóa trạm
- Upload/remove image trạm
- Update product list cho trạm
- Public station URL
- Search station
- By code/by id
- Customer xem trạm được gán
- Public signup qua invite code

Đã có backend station tests trong suite, suite tổng thể pass ngoại trừ image normalize test ở file khác.

Rủi ro:

- User cũ có thể chưa có station field.
- Invite/public signup cần test bằng URL thật.

Đánh giá: **Khá ổn, cần test dữ liệu production**.

### 5.6 Manage/Content/Chip

Chức năng hiện có:

- Manage homepage content
- Introduction
- Policy
- Section 1-10
- Brand/type/chip CRUD
- Section image upload/delete
- Section values

Rủi ro:

- Upload folder permissions.
- Một số route `/:name/value` có POST public, cần xác nhận có chủ ý hay nên bảo vệ admin.

Đánh giá: **Ổn về chức năng, cần rà quyền route content/chip**.

### 5.7 Chat/Socket

Chức năng hiện có:

- Chat sessions
- Chat history
- Socket join room
- Send/receive message
- Admin notify
- Occupy/release session
- Sidebar order count realtime

Rủi ro:

- Cần test websocket sau proxy/domain thật.
- Need multi-admin test để xác nhận lock session.

Đánh giá: **Có thiết kế tốt hơn bản gốc, nhưng cần test tích hợp runtime**.

### 5.8 Zalo OA

Chức năng hiện có:

- Admin settings
- Auth URL
- OAuth callback
- Order notification service
- Demo mode

Rủi ro:

- Phụ thuộc Zalo app/callback/domain.
- Không thể xác minh full end-to-end nếu thiếu credential thật.

Đánh giá: **Chưa thể kết luận hoàn toàn bằng local test**.

### 5.9 AI Voice Search/Invoice Scan

Chức năng hiện có:

- Voice search FE/Admin
- Backend `/products/voice-query`
- Scan invoice `/products/scan-invoice`
- Gemini model fallback
- Timeout 25s
- Audio upload limit 10MB

Rủi ro:

- Phụ thuộc Gemini API key.
- Output AI không deterministic.
- Voice search prompt hardcode brand/type list.
- Scan invoice matching logic phức tạp, cần test hóa đơn thật.

Đánh giá: **Có giá trị chức năng cao, cần test thật với dữ liệu công ty**.

## 6. Bộ test case tổng thể đề xuất

Các test case dưới đây là checklist QA đầy đủ cho staging/production. Những case có thể tự động hóa nên đưa dần vào Jest/Playwright.

### 6.1 Backend API test cases

| ID | Module | Test case | Kỳ vọng |
| --- | --- | --- | --- |
| BE-AUTH-001 | Auth | Register customer hợp lệ | 201/200, user được tạo, không trả password/logInString |
| BE-AUTH-002 | Auth | Register trùng phone/email | 409 hoặc lỗi phù hợp |
| BE-AUTH-003 | Auth | Login customer đúng password | Set cookie `authToken`, trả role customer |
| BE-AUTH-004 | Auth | Login sai password | 401 |
| BE-AUTH-005 | Auth | Admin login đúng | Set cookie, role admin/staff |
| BE-AUTH-006 | Auth | Logout | Clear cookie |
| BE-AUTH-007 | Auth | Change password đúng current password | 200 |
| BE-AUTH-008 | Auth | Change password sai current password | 400/401 |
| BE-AUTH-009 | Auth | Forgot password user có email | Gửi OTP, không leak OTP |
| BE-AUTH-010 | Auth | Reset password OTP sai/hết hạn | 400 |
| BE-AUTH-011 | Permission | Customer gọi API admin | 401/403 |
| BE-AUTH-012 | Permission | Staff thiếu permission gọi update product | 403 |
| BE-AUTH-013 | Permission | Staff đủ permission gọi update product | 200 |
| BE-PROF-001 | Profile | Get profile khi login | 200, không leak password |
| BE-PROF-002 | Profile | Update name/email/phone hợp lệ | 200 |
| BE-PROF-003 | Address | Add address đầu tiên | Address `isDefault=true` |
| BE-PROF-004 | Address | Add address thứ hai | Không tự default nếu đã có default |
| BE-PROF-005 | Address | Set default address | Chỉ một address default |
| BE-PROF-006 | Address | Delete default address | Address còn lại được default |
| BE-PROD-001 | Product | GET products pagination | total/page/limit đúng |
| BE-PROD-002 | Product | Search tiếng Việt có dấu | Có kết quả đúng |
| BE-PROD-003 | Product | Search không dấu | Có kết quả qua `nameUnsigned` |
| BE-PROD-004 | Product | Filter brand/type/section/value | Kết quả đúng |
| BE-PROD-005 | Product | Sort purchaseCount/createdAt | Thứ tự đúng |
| BE-PROD-006 | Product | Create product admin | 201 |
| BE-PROD-007 | Product | Create duplicate code | 409 |
| BE-PROD-008 | Product | Create product customer | 403 |
| BE-PROD-009 | Product | Update product tracked fields | 200 và tạo ActivityLog |
| BE-PROD-010 | Product | Delete product admin đủ quyền | 200 |
| BE-PROD-011 | Product | Toggle display | display đổi đúng |
| BE-PROD-012 | Product | Upload product image | trả `imgUrl` hợp lệ |
| BE-PROD-013 | Product | Delete product image | file/field được xóa |
| BE-PROD-014 | Product | Add/update/delete variant | variant đúng |
| BE-PROD-015 | Product | Update earn/import price | giá trị đúng |
| BE-PROD-016 | Product | Review create/update/delete | rating average đúng |
| BE-PROD-017 | Product | Fetch by IDs | Trả đúng danh sách |
| BE-PROD-018 | Product | Fetch by codes | Trả đúng danh sách |
| BE-PROD-019 | Product | Image absolute URL normalize | Hiện đang fail, cần xử lý |
| BE-CART-001 | Cart | Add to cart | cart có item |
| BE-CART-002 | Cart | Update quantity | quantity đúng |
| BE-CART-003 | Cart | Remove item | item biến mất |
| BE-CART-004 | Cart | Clear cart | cart rỗng |
| BE-ORDER-001 | Order | Create order từ cart | order tạo, cart xử lý đúng |
| BE-ORDER-002 | Order | Admin list order | chỉ admin/staff quyền đọc |
| BE-ORDER-003 | Order | Update order status | status đổi, socket emit |
| BE-ORDER-004 | Order | User cancel own order | state Cancelled |
| BE-ORDER-005 | Order | User không cancel order người khác | 403/404 |
| BE-IP-001 | Import | Create import order | 201 |
| BE-IP-002 | Import | Add product import order | productList tăng |
| BE-IP-003 | Import | Receive quantity | quantityRe đúng, stock đúng |
| BE-IP-004 | Import | Complete order | status true, completedAt đúng |
| BE-IP-005 | Import | Delete order | quyền admin/staff đúng |
| BE-EP-001 | Export | Create export order | 201 |
| BE-EP-002 | Export | Export quantity không vượt tồn | validate đúng |
| BE-EP-003 | Export | Complete export | stock giảm đúng |
| BE-ST-001 | Station | Create station | 201 |
| BE-ST-002 | Station | Duplicate station code | lỗi phù hợp |
| BE-ST-003 | Station | Add products to station | productId update đúng |
| BE-ST-004 | Station | Public station by invite code | public data không leak admin fields |
| BE-ST-005 | Station | Assign station to user | user.station đúng |
| BE-CHIP-001 | Chip | Get brands/types public | 200 |
| BE-CHIP-002 | Chip | Create brand/type admin | 201/200 |
| BE-CHIP-003 | Chip | Delete brand/type admin | 200 |
| BE-MAN-001 | Manage | Get manage public | 200 |
| BE-MAN-002 | Manage | Update intro/policy admin | 200 và ActivityLog |
| BE-ACT-001 | Activity | Admin get logs | 200 |
| BE-ACT-002 | Activity | Customer get logs | 401/403 |
| BE-ZALO-001 | Zalo | Get settings admin | secrets masked |
| BE-ZALO-002 | Zalo | Save settings admin | 200 và ActivityLog |
| BE-ZALO-003 | Zalo | Auth URL khi thiếu config | lỗi rõ ràng |
| BE-AI-001 | Voice | No auth | 401 |
| BE-AI-002 | Voice | Auth nhưng thiếu audio | 400 |
| BE-AI-003 | Voice | Audio sai mimetype | 400/500 có message rõ |
| BE-AI-004 | Voice | GEMINI_API_KEY thiếu | 400 config |
| BE-AI-005 | Scan | Thiếu invoice image | 400 |
| BE-AI-006 | Scan | GEMINI_API_KEY thiếu | 400 config |
| BE-SEC-001 | Security | Rate limit login spam | 429 |
| BE-SEC-002 | Security | Cookie httpOnly/sameSite theo môi trường | đúng policy |

### 6.2 Frontend customer UI test cases

| ID | Area | Test case | Kỳ vọng |
| --- | --- | --- | --- |
| FE-NAV-001 | Navigation | Mở `/` | Trang load không trắng |
| FE-NAV-002 | Navigation | Mở `/dashboard` | Main page load đúng |
| FE-NAV-003 | Navigation | Navbar link product/cart/order/profile | Điều hướng đúng |
| FE-LANG-001 | Language | Đổi ngôn ngữ Việt/Anh | Text đổi đúng, không vỡ layout |
| FE-AUTH-001 | Login | Login customer đúng | Redirect/profile state đúng |
| FE-AUTH-002 | Login | Login sai | Toast lỗi |
| FE-AUTH-003 | Register | Register public | Tạo user/hiển thị lỗi đúng |
| FE-AUTH-004 | Forgot | Gửi OTP reset password | UI chuyển step |
| FE-AUTH-005 | Reset | Nhập OTP + password mới | Reset thành công |
| FE-PROD-001 | Product | Load product list | Có skeleton/loading rồi danh sách |
| FE-PROD-002 | Product | Search sản phẩm | Query URL và result đúng |
| FE-PROD-003 | Product | Filter brand/type/section/value | Result đúng |
| FE-PROD-004 | Product | Sort | Result đổi đúng |
| FE-PROD-005 | Product | Pagination | Page đổi đúng |
| FE-PROD-006 | Product detail | Mở sản phẩm | Ảnh, giá, variant, stock hiển thị |
| FE-PROD-007 | Product detail | Chọn variant | Giá/ảnh/stock đổi đúng |
| FE-CART-001 | Cart | Add to cart | Cart count tăng |
| FE-CART-002 | Cart | Update quantity | Total đổi đúng |
| FE-CART-003 | Cart | Remove item | Item biến mất |
| FE-CART-004 | Checkout | Tạo đơn | Order tạo, cart clear |
| FE-ORDER-001 | My order | Xem đơn theo tab | Data đúng |
| FE-ORDER-002 | My order | Cancel order | Status Cancelled |
| FE-PROF-001 | Profile | Load profile | Data đúng |
| FE-PROF-002 | Profile | Update info | Toast thành công |
| FE-PROF-003 | Address | Add/edit/delete/default address | UI và API đúng |
| FE-ST-001 | Station | User chưa login vào `/station` | Message yêu cầu login |
| FE-ST-002 | Station | User có station | Danh sách trạm đúng |
| FE-ST-003 | Station public | Mở `/station/:code` | Sections đúng |
| FE-ST-004 | Station section | Mở `/station/:code/:section` | Product list đúng |
| FE-ST-005 | Station cart | Đặt hàng từ station | Order có stationCode |
| FE-AI-001 | Voice search | Browser không hỗ trợ mic | UI báo lỗi rõ |
| FE-AI-002 | Voice search | Không login | Yêu cầu login |
| FE-AI-003 | Voice search | Có transcript/filter | Điều hướng product đúng query |
| FE-RESP-001 | Responsive | Mobile 360px | Không overflow, navbar usable |
| FE-RESP-002 | Responsive | Tablet/Desktop | Layout không vỡ |

### 6.3 Admin UI test cases

| ID | Area | Test case | Kỳ vọng |
| --- | --- | --- | --- |
| AD-AUTH-001 | Login | Admin login đúng | Vào dashboard admin |
| AD-AUTH-002 | Login | Staff login đúng | Menu theo quyền |
| AD-AUTH-003 | Login | Sai password | Toast lỗi |
| AD-PERM-001 | Permission | Staff thiếu quyền | Menu/API bị chặn |
| AD-ACC-001 | Account | Tạo customer | User xuất hiện |
| AD-ACC-002 | Account | Tạo staff quyền giới hạn | Permission lưu đúng |
| AD-ACC-003 | Account | Update permission | Sidebar/API đổi đúng |
| AD-ACC-004 | Account | Xóa user | User biến mất, ActivityLog |
| AD-PROD-001 | Product | List/search/filter product | Result đúng |
| AD-PROD-002 | Product | Create product | 201, hiển thị trên list |
| AD-PROD-003 | Product | Create duplicate code | Toast 409 rõ |
| AD-PROD-004 | Product | Edit product fields | Lưu đúng, ActivityLog |
| AD-PROD-005 | Product | Add/update/delete variant | UI/API đúng |
| AD-PROD-006 | Product | Upload/delete image | Ảnh hiển thị/xóa đúng |
| AD-PROD-007 | Product | Toggle display | FE ẩn/hiện đúng |
| AD-PROD-008 | Product | Update earn/import price | Lưu đúng |
| AD-CHIP-001 | Chip | Add/delete brand/type | Dropdown FE/Admin đổi |
| AD-CHIP-002 | Section | Add/edit/delete section | FE section đổi |
| AD-MAN-001 | Manage | Update homepage sections | FE hiển thị đúng |
| AD-MAN-002 | Manage | Update intro/policy | FE hiển thị đúng |
| AD-ORDER-001 | Sale order | List/filter order | Data đúng |
| AD-ORDER-002 | Sale order | Update status/payment | User order đổi đúng |
| AD-ORDER-003 | Sale order | Realtime processing count | Sidebar count đổi |
| AD-IP-001 | Import | Create import order | Detail load đúng |
| AD-IP-002 | Import | Add product by search | Product added |
| AD-IP-003 | Import | Receive quantity | Stock tăng |
| AD-IP-004 | Import | Complete order | completedAt/status đúng |
| AD-IP-005 | Import | Template order | Save/reuse/delete đúng |
| AD-EP-001 | Export | Create export order | Detail load đúng |
| AD-EP-002 | Export | Export quantity | Stock giảm đúng |
| AD-EP-003 | Export | Complete order | completedAt/status đúng |
| AD-HIS-001 | History | View storage history | Filter/result đúng |
| AD-ST-001 | Station | Create station | Station xuất hiện |
| AD-ST-002 | Station | Upload station image | Public page có ảnh |
| AD-ST-003 | Station | Assign products | Public station có sản phẩm |
| AD-ST-004 | Station user | Assign/remove station to user | FE user station đổi |
| AD-CHAT-001 | Chat | Admin nhận session | Session list có tin |
| AD-CHAT-002 | Chat | Occupy session | Admin khác bị lock |
| AD-CHAT-003 | Chat | Release session | Admin khác vào được |
| AD-ACT-001 | Activity | Xem log | Log hiển thị đúng |
| AD-ZALO-001 | Zalo | Save settings | Config lưu, secret masked |
| AD-ZALO-002 | Zalo | Generate auth URL | URL đúng callback |
| AD-AI-001 | Voice | Voice search admin | Filter product list đúng |
| AD-AI-002 | Scan invoice | Upload hóa đơn thật | Items parse/match đúng |
| AD-RESP-001 | Responsive | Admin mobile | Sidebar/content không vỡ |

## 7. Blocker và khuyến nghị ưu tiên

### Blocker trước production nếu muốn deploy an toàn

1. Backend test đang đỏ.
   - Sửa hoặc quyết định lại requirement normalize URL ảnh.

2. Kiểm tra duplicate product code ở DB production.
   - Vì `code` unique có thể gây lỗi dữ liệu.

3. Backup MongoDB và upload folder trước deploy.
   - Backend startup có thể ghi dữ liệu.

4. Xử lý hoặc chấp nhận dependency vulnerabilities.
   - Đặc biệt backend high vulnerabilities và frontend/admin critical vulnerabilities.

5. Xác nhận build artifact tồn tại trên server.
   - `fe/build/index.html`
   - `ad/dist/index.html`

### Nên xử lý sớm

1. Admin lint lỗi logic:
   - `authToken is not defined`
   - `react-hooks/rules-of-hooks` trong `chips.jsx`

2. Thêm test tự động cho FE/Admin.

3. Tách bundle admin bằng lazy loading route lớn.

4. Rà CORS production.

5. Rà `helmet` config production.

6. Backfill `nameUnsigned` nếu sản phẩm cũ chưa có.

## 8. Ma trận mức độ ổn định

| Khu vực | Build/Test | Rủi ro | Đánh giá |
| --- | --- | --- | --- |
| Backend syntax | Pass | Thấp | Tốt |
| Backend unit/API tests | 30/32 pass | Trung bình | Cần sửa 2 test fail |
| Backend startup thật | `node index.js` start thành công, MongoDB connect, startup sync cập nhật 0 đơn | Thấp-Trung bình | Tốt |
| Backend API integration smoke | Auth/profile/address/admin/product/static cơ bản pass | Thấp-Trung bình | Tốt cho smoke cơ bản |
| Frontend build | Pass with warnings | Trung bình | Deploy được |
| Frontend automated tests | Không có | Trung bình | Thiếu coverage |
| Admin build | Pass with bundle warning | Trung bình | Deploy được |
| Admin lint | Fail 152 errors | Trung bình-Cao | Cần xử lý |
| Dependency security | Nhiều vulnerabilities | Cao | Cần xử lý/accept risk |
| AI features | Chưa E2E thật | Trung bình | Cần test với key/data thật |
| Zalo | Chưa E2E thật | Trung bình | Cần test domain thật |
| SMTP | Chưa E2E thật | Trung bình | Cần test mail thật |
| Socket realtime | Smoke chưa đủ | Trung bình | Cần test multi-client |

## 9. Đề xuất kế hoạch ổn định hóa

### Giai đoạn 1: Trước deploy

- Backup DB/upload.
- Chạy duplicate product code query.
- Sửa 2 backend test fail hoặc cập nhật requirement.
- Kiểm tra `.env` production.
- Build `fe` và `ad`.
- Smoke test các flow chính.

### Giai đoạn 2: Sau deploy staging

- Test full checklist UI customer.
- Test full checklist admin.
- Test Zalo callback thật.
- Test SMTP forgot/reset password.
- Test Gemini voice/scan với dữ liệu thật.
- Test socket chat với 2 admin và 1 customer.

### Giai đoạn 3: Hardening

- Dọn Admin lint lỗi logic trước, style sau.
- Nâng dependency theo nhóm rủi ro.
- Thêm Playwright E2E cho các flow:
  - login
  - product search
  - cart/order
  - admin product CRUD
  - import/export order
  - station
- Thêm Jest API tests cho Zalo/Gemini fallback bằng mock.
- Tách bundle admin.

## 10. Kết luận cuối

Bản hiện tại đã có độ hoàn thiện chức năng cao hơn nhiều so với bản deploy gốc và có thể build production cho cả frontend khách hàng lẫn admin. Backend API test phần lớn pass. Sau khi dừng PM2/nginx, backend đã start trực tiếp bằng `node index.js`, connect MongoDB thành công, serve public/static route thành công và pass thêm một vòng integration smoke cho auth/profile/address/admin/product cơ bản.

Tuy nhiên, để gọi là "ổn định hoàn toàn" thì chưa đủ vì:

- Test backend còn đỏ.
- FE/Admin thiếu test tự động.
- Admin lint fail nhiều, có ít nhất vài lỗi có khả năng là runtime bug thật.
- Dependency audit có nhiều vulnerability high/critical.
- Một số module quan trọng phụ thuộc dịch vụ ngoài hoặc tương tác thật chưa E2E được đầy đủ trong local: upload file thật, voice audio thật, scan hóa đơn thật, SMTP, Zalo OAuth callback, socket multi-client.

Khuyến nghị deploy:

> Có thể deploy dưới dạng major release có kiểm soát, sau khi backup DB, kiểm tra duplicate `product.code`, xác minh env production, chạy smoke test staging/production và chấp nhận rõ các rủi ro security/lint còn tồn tại.
