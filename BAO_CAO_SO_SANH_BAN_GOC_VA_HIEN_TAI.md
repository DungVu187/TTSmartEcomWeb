# Báo cáo so sánh bản deploy gốc và bản hiện tại

Ngày lập báo cáo: 2026-06-30  
Repo: `D:\TTSmartEcomWeb`  
Bản gốc dùng để so sánh: `6713f8213e0e055b398be78973e33f8c0dba93a7`  
Ngày commit gốc: 2026-06-11  
Commit message: `Initial commit`

## 1. Phạm vi kiểm tra

Báo cáo này so sánh bản hiện tại trong workspace với bản đầu tiên đã push lên GitHub, tức bản đã deploy chính thức ban đầu.

Theo yêu cầu, phần đánh giá production bỏ qua file test:

- Bỏ qua `be/tests/**`
- Bỏ qua các file `*.test.js`

Mục tiêu kiểm tra:

- Những thay đổi về chức năng
- Những thay đổi về backend
- Những thay đổi về frontend khách hàng
- Những thay đổi về admin panel
- Những thay đổi về cấu trúc deploy
- Rủi ro khi deploy production
- Đánh giá mức độ sẵn sàng deploy chính thức

## 2. Tóm tắt kết quả

So với bản deploy gốc, bản hiện tại là một bản mở rộng lớn, không phải một hotfix nhỏ.

Thống kê production diff, không tính test:

- 129 file thay đổi
- Khoảng 30,419 dòng thêm
- Khoảng 5,234 dòng xóa
- Có thêm nhiều module backend mới
- Có thêm nhiều màn hình admin mới
- Có thêm nhiều chức năng frontend khách hàng mới
- Backend hiện tại vừa chạy API vừa serve static frontend/admin build

Kết luận ngắn:

> Bản hiện tại có thể deploy, nhưng nên coi là major release. Trước khi deploy chính thức cần backup MongoDB, kiểm tra dữ liệu trùng `product.code`, kiểm tra biến môi trường production và chạy smoke test các flow chính.

## 3. Trạng thái Git hiện tại

Khi kiểm tra, workspace đang ở branch `main` và có khác biệt với `origin/main`:

- `be/components/product.js`
- `be/tests/api_product.test.js`

Nếu bỏ qua test, production hiện chỉ còn khác `origin/main` ở:

- `be/components/product.js`

Khác biệt này là mở rộng prompt cho tính năng voice search bằng Gemini, không thay đổi route, middleware, DB schema hay response contract.

Không phát hiện file untracked khi kiểm tra.

## 4. Thay đổi tổng thể theo khu vực

### 4.1 Backend

Backend có thay đổi lớn nhất về mặt chức năng và kiến trúc.

Các nhóm thay đổi chính:

- Thêm activity log
- Thêm Zalo OA integration
- Thêm mailer và reset password bằng OTP
- Thêm rate limit cho auth và voice query
- Thêm phân quyền chi tiết theo `functions` và `permissions`
- Thêm profile khách hàng và địa chỉ giao hàng
- Thêm quản lý trạm và gán khách hàng vào trạm
- Thêm public signup qua invite code của trạm
- Thêm auto-login token
- Thêm voice search bằng Gemini
- Thêm scan hóa đơn bằng Gemini
- Thêm chống trùng mã sản phẩm
- Thêm search không dấu qua `nameUnsigned`
- Thêm trạng thái `adjusted` cho sản phẩm
- Thêm ghi log cho nhiều hành động quản trị
- Thêm serve static admin/frontend từ backend

File backend thay đổi đáng chú ý:

- `be/index.js`
- `be/components/product.js`
- `be/components/user.js`
- `be/components/order.js`
- `be/components/iporder.js`
- `be/components/eporder.js`
- `be/components/station.js`
- `be/components/chip.js`
- `be/components/manage.js`
- `be/components/activitylog.js`
- `be/components/zalo.js`
- `be/mailer.js`
- `be/zaloService.js`
- `be/package.json`

### 4.2 Frontend khách hàng

Frontend khách hàng được mở rộng đáng kể.

Các thay đổi chính:

- Thêm hệ thống đa ngôn ngữ qua `LanguageProvider`
- Thêm trang profile khách hàng
- Thêm quản lý địa chỉ trong profile
- Thêm voice search floating button
- Thêm flow forgot password/reset password
- Cải thiện trang product, filter, station
- Cải thiện cart và my order
- Cải thiện layout có footer và wrapper nội dung mới
- Bỏ chat widget cũ
- Thay đổi mapping route trang chủ:
  - Bản gốc: `/` trỏ `MainPage`
  - Bản hiện tại: `/` trỏ `Dashboard`, `/dashboard` trỏ `MainPage`

File frontend đáng chú ý:

- `fe/src/App.js`
- `fe/src/context/languagecontext.jsx`
- `fe/src/pages/profile.jsx`
- `fe/src/components/VoiceSearchFAB.jsx`
- `fe/src/pages/login.jsx`
- `fe/src/pages/product.jsx`
- `fe/src/pages/cart.jsx`
- `fe/src/pages/myorder.jsx`
- `fe/src/layout/navbar/navbar.jsx`
- `fe/src/layout/footer/footer.jsx`

### 4.3 Admin panel

Admin panel có nhiều màn hình và flow mới.

Các thay đổi chính:

- Thêm activity log page
- Thêm Zalo settings page
- Thêm voice search floating button
- Thêm phân quyền chi tiết hơn trong account management
- Thêm responsive/mobile improvements
- Thêm lock phiên chat theo admin đang hỗ trợ
- Thêm realtime processing order count qua socket
- Cải thiện import order/export order detail rất lớn
- Cải thiện quản lý trạm và khách hàng theo trạm
- Cải thiện quản lý sản phẩm, chip, section, station display
- Xóa các component cũ:
  - `ad/src/components/ttproducts.jsx`
  - `ad/src/components/ttproductdisplay.jsx`
  - `ad/src/components/ttproductvariants.jsx`

File admin đáng chú ý:

- `ad/src/App.jsx`
- `ad/src/components/activitylog.jsx`
- `ad/src/components/ZaloSettings.jsx`
- `ad/src/components/VoiceSearchFAB.jsx`
- `ad/src/components/account.jsx`
- `ad/src/components/chat.jsx`
- `ad/src/components/products.jsx`
- `ad/src/components/iporder/iporderdetail.jsx`
- `ad/src/components/eporder/eporderdetail.jsx`
- `ad/src/layout/sidebar.jsx`
- `ad/vite.config.js`

## 5. Thay đổi kiến trúc deploy

Đây là thay đổi quan trọng nhất so với bản gốc.

### Bản gốc

Backend chủ yếu chạy API:

- `/users`
- `/products`
- `/orders`
- `/chips`
- `/carts`
- `/manages`
- `/iporders`
- `/eporders`
- `/stations`
- `/histories`
- `/chat`
- Static upload image routes

Frontend/admin thường được build/deploy riêng hoặc phục vụ riêng.

### Bản hiện tại

Backend vừa chạy API vừa serve frontend/admin build:

- Serve admin dashboard tại `/admin`
- Serve customer frontend từ `fe/build`
- Fallback React Router cho frontend
- Serve invoice images tại `/invoice-images`
- Thêm route `/activity-logs`
- Thêm route `/zalo`

Điều này giúp deploy một Node backend là có thể phục vụ cả API, admin và frontend, nhưng cũng làm backend phụ thuộc vào việc build sẵn:

- `ad/dist`
- `fe/build`

Nếu thiếu một trong hai thư mục này khi deploy, route frontend/admin có thể lỗi hoặc trả file không đúng.

## 6. Thay đổi bảo mật và phân quyền

### Cải thiện

- Thêm rate limit cho auth
- Thêm rate limit cho voice query
- Thêm phân quyền chi tiết bằng `permissions`
- Thêm `checkPermission(...)` ở nhiều route admin
- Thêm cookie auth flow ổn định hơn
- Không track `.env` lên Git
- `.gitignore` đã thêm:
  - `.claude/`
  - `.codex-backups/`
  - `be/upload/`
  - `backups/`
  - `wdata/*.archive`

### Điểm cần chú ý

- `helmet` hiện tắt:
  - `hsts`
  - `contentSecurityPolicy`
- CORS mở rộng cho nhiều origin:
  - `ttsmart.com.vn`
  - `irelia.online`
  - localhost
  - LAN `192.168.*`
  - localtunnel
- Với production public, nên rà lại CORS để chỉ giữ domain cần thiết.

## 7. Thay đổi dữ liệu và database

Các thay đổi có thể ảnh hưởng dữ liệu production:

### 7.1 Product code unique

Schema product hiện có:

- `code` trim
- `sparse: true`
- `unique: true`

Route tạo sản phẩm cũng kiểm tra trùng code và trả HTTP `409`.

Rủi ro:

- Nếu DB production đã có nhiều sản phẩm trùng `code`, unique index có thể không tạo được hoặc gây lỗi khi thao tác.
- Nếu code rỗng/null thì `sparse` giúp nhiều sản phẩm không code cùng tồn tại, nhưng cần kiểm tra dữ liệu thực tế.

Khuyến nghị:

- Trước deploy, chạy kiểm tra duplicate `code` trong MongoDB production.
- Làm sạch dữ liệu trùng trước khi bật version mới.

### 7.2 nameUnsigned

Product có thêm `nameUnsigned` để search không dấu.

Rủi ro thấp, nhưng sản phẩm cũ có thể thiếu `nameUnsigned` nếu chưa được save lại hoặc chưa có migration.

Khuyến nghị:

- Nếu search không dấu với sản phẩm cũ chưa ổn, cần script backfill `nameUnsigned`.

### 7.3 adjusted

Product có thêm field `adjusted`.

Backend khi start có logic:

- Set `adjusted: true` cho sản phẩm cũ chưa có field này
- Tính lại total cho import/export orders cũ

Rủi ro:

- Đây là logic ghi dữ liệu khi server start.
- Nếu công thức tính total khác kỳ vọng dữ liệu cũ, production data có thể bị cập nhật hàng loạt.

Khuyến nghị:

- Backup MongoDB trước deploy.
- Nếu có thể, chạy thử trên bản copy DB production trước.

## 8. Tính năng AI/Gemini

Bản hiện tại thêm 2 tính năng dùng Gemini:

### 8.1 Scan hóa đơn

Endpoint:

- `POST /products/scan-invoice`

Chức năng:

- Upload ảnh hóa đơn
- Gọi Gemini để trích xuất item
- Match item với sản phẩm trong DB
- Lưu ảnh tạm hóa đơn
- Có route xóa ảnh tạm

Yêu cầu production:

- `GEMINI_API_KEY`
- Thư mục upload invoices có quyền ghi

Rủi ro:

- Gemini output không tuyệt đối ổn định
- Cần test hóa đơn thật
- Cần dọn file tạm định kỳ nếu người dùng scan nhiều

### 8.2 Voice search

Endpoint:

- `POST /products/voice-query`

Chức năng:

- Nhận audio
- Gọi Gemini multimodal
- Trả transcript, keyword, intent, filters

Yêu cầu production:

- User phải đăng nhập
- `GEMINI_API_KEY`
- Frontend/admin gửi file audio đúng field `audio`

Rủi ro:

- Prompt hiện hardcode danh sách brand/type. Nếu DB production thêm brand/type mới, voice search có thể chưa nhận ra.
- Response Gemini được parse JSON nhưng chưa validate schema cứng.

## 9. Zalo OA integration

File mới:

- `be/components/zalo.js`
- `be/zaloService.js`
- `ad/src/components/ZaloSettings.jsx`

Chức năng:

- Lưu cấu hình Zalo OA
- Sinh auth URL
- Callback OAuth
- Gửi thông báo đơn hàng qua Zalo

Yêu cầu production:

- Cấu hình Zalo app đúng
- Callback URL đúng domain production
- Token/secret đúng
- HTTPS/domain public ổn định

Rủi ro:

- Nếu cấu hình sai, phần Zalo lỗi nhưng không nhất thiết làm sập app chính.
- Cần test callback OAuth trên domain thật.

## 10. Mailer và reset password

File mới:

- `be/mailer.js`

Endpoint liên quan:

- `POST /users/forgot-password`
- `POST /users/reset-password`

Chức năng:

- Gửi OTP reset password qua email
- OTP hết hạn sau thời gian ngắn
- Rate limit chống spam

Yêu cầu production:

- Email SMTP/env đúng
- User phải có email hợp lệ

Rủi ro:

- Nếu mail env thiếu/sai, forgot password không hoạt động.
- Cần test với email thật trước deploy.

## 11. Realtime chat/socket

Bản gốc đã có socket chat. Bản hiện tại mở rộng:

- Danh sách active support sessions
- Admin occupy session
- Release session khi rời hoặc disconnect
- Admin nhận notify tin nhắn mới
- Sidebar admin cập nhật processing order count realtime
- Socket path động để phù hợp khi chạy sau tunnel/proxy

Rủi ro:

- Cần kiểm tra sau reverse proxy/Cloudflare tunnel.
- Cần đảm bảo websocket path đúng khi backend serve dưới domain thật.

## 12. Import/export order

Import order và export order được thay đổi nhiều.

Nhóm thay đổi:

- Giao diện detail lớn hơn, nhiều thao tác hơn
- Cập nhật status/payment/date
- Date fallback và completedAt
- Tính lại tổng tiền
- Template order
- Lịch sử kho
- Ordered/exported products filters

Rủi ro:

- Đây là vùng nghiệp vụ quan trọng, cần smoke test kỹ.
- Cần test tạo đơn, sửa đơn, hoàn tất đơn, hủy đơn, lọc theo ngày, xem lịch sử kho.

## 13. Product management

Thay đổi chính:

- Unique product code
- Search theo name/code/brand, hỗ trợ nameUnsigned
- Toggle display
- Update earn/import price
- Product review
- Product variant CRUD
- Image upload/delete/cleanup
- AI invoice scan
- AI voice query
- Activity log cho thao tác sản phẩm

Rủi ro:

- Unique code cần kiểm tra DB.
- Upload folder cần quyền ghi.
- Image URL cũ tuyệt đối/relative cần kiểm tra hiển thị thực tế.

## 14. Station/customer station

Thay đổi chính:

- Quản lý trạm trong admin
- Upload ảnh trạm
- Public station page
- Invite code/public signup
- Gán khách hàng vào trạm
- Frontend khách hàng xem trạm được gán
- Product filtering theo station

Rủi ro:

- Cần kiểm tra user cũ chưa có `station` field.
- Cần test public station URL và invite code.

## 15. Dependency/package thay đổi

Backend thêm/cập nhật:

- `crypto-js`
- `nodemailer`
- `jest`
- `supertest`

Frontend thêm proxy dev:

- `proxy: http://localhost:5000`

Admin Vite thêm dev proxy cho nhiều API path.

Không thấy `.env` bị track.

## 16. File dữ liệu/runtime

`.gitignore` đã được cải thiện để tránh đưa dữ liệu runtime lên Git:

- `be/upload/`
- `backups/`
- `wdata/*.archive`

So với bản gốc, nhiều file `.archive` trong `wdata` đã bị xóa khỏi Git diff.

Đây là hướng đúng cho production, vì dữ liệu backup/upload không nên nằm trong source repo.

## 17. Kết quả kiểm tra build/syntax

Đã kiểm tra:

### Backend syntax

Lệnh đã chạy:

```bash
node --check components/product.js
```

Kết quả:

- Pass

### Frontend customer build

Lệnh đã chạy trong `fe`:

```bash
npm run build
```

Kết quả:

- Build thành công
- Có warning ESLint, chủ yếu unused vars và hook dependency
- Warning không làm fail build

### Admin build

Lệnh đã chạy trong `ad`:

```bash
npm run build
```

Kết quả:

- Build thành công
- Có warning bundle chunk lớn hơn 500 kB
- Warning không làm fail build

## 18. Test tự động

Người dùng yêu cầu không tính file test cho production.

Tuy vậy, khi từng chạy full backend test suite:

- 9 test suites pass
- 1 test suite fail
- 30 tests pass
- 2 tests fail

Hai lỗi fail nằm ở `be/tests/product.test.js`, liên quan expectation rằng URL ảnh tuyệt đối phải tự chuyển thành relative path.

Vì production không dùng file test, lỗi này không trực tiếp chặn deploy theo phạm vi yêu cầu. Nhưng nếu team dùng test suite làm deploy gate, cần sửa test hoặc sửa logic normalize image URL.

## 19. Rủi ro deploy theo mức độ

### Cao

1. Unique index `product.code`
   - Có thể xung đột với dữ liệu production đang trùng mã.

2. Logic ghi dữ liệu khi backend start
   - Tự cập nhật `adjusted`
   - Tự tính lại total import/export order

3. Thay đổi kiến trúc serve frontend/admin từ backend
   - Cần đảm bảo `fe/build` và `ad/dist` tồn tại trên server.

### Trung bình

1. Zalo OA
   - Phụ thuộc callback URL, app secret, token.

2. Mail reset password
   - Phụ thuộc SMTP/env.

3. Gemini AI
   - Phụ thuộc `GEMINI_API_KEY`, network, output AI.

4. Socket realtime
   - Cần test với reverse proxy/tunnel.

5. CORS
   - Nên thu hẹp origin cho production thật.

### Thấp

1. Warning build frontend/admin
   - Không fail build.

2. Tài liệu/kỹ năng/scripts mới
   - Không ảnh hưởng runtime trực tiếp.

## 20. Checklist trước deploy chính thức

### Bắt buộc

- Backup MongoDB production.
- Backup thư mục upload production.
- Kiểm tra duplicate product code.
- Build lại frontend customer: `fe/build`.
- Build lại admin: `ad/dist`.
- Đảm bảo server deploy có đúng thư mục:
  - `fe/build`
  - `ad/dist`
  - `be/upload/images`
  - `be/upload/sections`
  - `be/upload/stations`
  - `be/upload/invoices`
- Kiểm tra `.env` production:
  - `JWT_SECRET`
  - `FRONTEND_URL`
  - `ADDRESS`
  - `GEMINI_API_KEY`
  - SMTP mail config
  - Zalo config nếu dùng
- Kiểm tra process manager dùng lệnh phù hợp. Hiện `be/package.json` có `start: nodemon index.js`; production nên cân nhắc dùng `node index.js` hoặc PM2 chạy `node`.

### Smoke test sau deploy

- Mở website khách hàng `/`
- Mở admin `/admin`
- Login customer
- Login admin
- Xem danh sách sản phẩm
- Tạo sản phẩm mới
- Tạo sản phẩm trùng code để xác nhận trả `409`
- Upload ảnh sản phẩm
- Thêm sản phẩm vào giỏ
- Tạo đơn bán
- Admin nhận đơn mới
- Cập nhật trạng thái đơn
- Tạo/sửa import order
- Tạo/sửa export order
- Xem lịch sử kho
- Xem activity log
- Xem profile khách hàng
- Thêm/sửa/xóa địa chỉ
- Tạo trạm
- Gán khách hàng vào trạm
- Mở public station URL
- Test chat realtime
- Test forgot password
- Test Zalo settings/callback nếu dùng
- Test voice search nếu có `GEMINI_API_KEY`
- Test scan hóa đơn nếu có `GEMINI_API_KEY`

## 21. Kiểm tra duplicate product code

Nên chạy trên MongoDB production trước deploy.

Pipeline tham khảo:

```javascript
db.products.aggregate([
  {
    $match: {
      code: { $exists: true, $nin: [null, ""] }
    }
  },
  {
    $group: {
      _id: "$code",
      count: { $sum: 1 },
      ids: { $push: "$_id" },
      names: { $push: "$name" }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  }
])
```

Nếu query trả về bản ghi, cần xử lý trước khi deploy bản có unique product code.

## 22. Kiểm tra build artifact

Trước khi chạy backend production, kiểm tra:

```powershell
Test-Path D:\TTSmartEcomWeb\fe\build\index.html
Test-Path D:\TTSmartEcomWeb\ad\dist\index.html
```

Cả hai nên trả về `True`.

## 23. Đề xuất deploy

Đánh giá hiện tại:

- Code production build được.
- Không có `.env` bị track.
- Không có file untracked.
- Thay đổi chức năng lớn nhưng có cấu trúc tương đối rõ.
- Rủi ro chính nằm ở dữ liệu production và cấu hình môi trường.

Khuyến nghị:

1. Không deploy như hotfix.
2. Deploy như major release.
3. Backup DB và upload trước.
4. Chạy kiểm tra duplicate `product.code`.
5. Build `fe` và `ad` trước khi restart backend.
6. Restart backend trong khung giờ ít người dùng.
7. Smoke test ngay sau restart.
8. Theo dõi log server trong 30-60 phút đầu.

## 24. Kết luận cuối

So với bản deploy gốc ngày 2026-06-11, bản hiện tại đã mở rộng mạnh về chức năng, đặc biệt ở các mảng:

- Quản trị sản phẩm
- Quản lý đơn nhập/xuất
- Quản lý trạm
- Phân quyền nhân sự
- Profile khách hàng
- Zalo OA
- Email/OTP
- Activity log
- AI voice search
- AI scan hóa đơn
- Serve frontend/admin từ backend

Bản hiện tại đủ điều kiện kỹ thuật cơ bản để deploy vì build frontend/admin thành công và backend không có lỗi syntax ở phần đã kiểm tra. Tuy nhiên, do có thay đổi schema, dữ liệu và startup migration, cần xem đây là major release và bắt buộc backup/kiểm tra dữ liệu trước khi lên production chính thức.
