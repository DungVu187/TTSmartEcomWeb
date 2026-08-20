# Hướng dẫn làm việc trong TTSmartEcom

## 1. Phạm vi và nguồn sự thật

- File này áp dụng cho toàn bộ repository TTSmartEcom hiện tại.
- Đây không phải dự án Nova và không phải bản ASP.NET Core + SQL Server dự kiến trong tương lai.
- Source code, cấu hình trên branch hiện tại và yêu cầu mới nhất của người dùng là nguồn sự thật. Tài liệu local bị ignore có thể đã cũ; luôn đối chiếu lại với code.
- Không tự đổi framework, database, ngôn ngữ, API contract hoặc mở rộng task thành migration/refactor toàn hệ thống.
- Repository đang có thể chứa thay đổi chưa commit của người dùng. Luôn bảo toàn các thay đổi đó.

## 2. Tổng quan hệ thống

TTSmartEcom là hệ thống bán hàng và quản lý kho gồm ba ứng dụng npm độc lập:

- `fe/`: storefront React 18 + Vite 6 cho khách hàng.
- `ad/`: dashboard quản trị React 18 + Vite 6, chạy dưới base path `/admin`.
- `be/`: API Node.js CommonJS dùng Express 4, Mongoose 8, MongoDB và Socket.IO.

Trong development, hai frontend gọi backend mặc định ở port `5000`. Trong production, `be/index.js` phục vụ `fe/dist` tại `/` và `ad/dist` tại `/admin`; vì vậy phải build cả hai frontend trước khi chạy production theo cách này. Storefront dùng prefix `/api` và backend strip prefix để giữ tương thích với các endpoint không prefix. Admin gọi trực tiếp các endpoint như `/users`, `/products`, `/orders`.

## 3. Bản đồ repository

| Đường dẫn | Vai trò | Điểm vào/cấu hình chính |
| --- | --- | --- |
| `fe/` | Storefront SPA | `src/main.jsx`, `src/App.jsx`, `src/api/httpClient.js`, `vite.config.js`, `eslint.config.js` |
| `ad/` | Admin SPA | `src/main.jsx`, `src/App.jsx`, `src/api/httpClient.js`, `vite.config.js`, `eslint.config.js` |
| `be/` | API, auth, Socket.IO và static hosting | `index.js`, `components/`, `controllers/`, `services/`, `models/`, `middlewares/`, `validators/`, `config/` |
| `be/upload/` | Dữ liệu upload runtime, bị Git ignore | `images/`, `documents/`, `sections/`, `stations/`, `invoices/` |
| `scripts/` | Script backup MongoDB cho Windows | `backup_db.ps1`, `install_daily_backup_task.ps1` |
| `wdata/` | Archive/dữ liệu backup local, bị Git ignore | Không sửa, xóa, restore hoặc commit nếu chưa được yêu cầu rõ |

Không có root `package.json` hay npm workspace. Mỗi ứng dụng có `package.json` và `package-lock.json` riêng. Hiện repository không có Docker, PM2 ecosystem, Nginx, CI/CD hoặc deploy config được track; không tự suy đoán command cho các công cụ đó. `docs/`, `backups/`, `copy/` và `wdata/` là dữ liệu local bị ignore, không phải nguồn sự thật mặc định.

## 4. Thiết lập và lệnh thường dùng

Ba lockfile đều là npm lockfile v3. Chạy lệnh trong đúng thư mục ứng dụng. `fe/package.json` yêu cầu Node `^22.13.0 || >=24.0.0`; `ad` và `be` chưa khai báo `engines`. Nếu làm xuyên cả repo, dùng phiên bản Node thỏa constraint của `fe`.

```powershell
# Chạy từ repository root
npm --prefix fe ci
npm --prefix fe run dev       # Vite port 3000
npm --prefix fe test          # vitest run
npm --prefix fe run lint      # eslint src --max-warnings=0
npm --prefix fe run build
npm --prefix fe run preview

npm --prefix ad ci
npm --prefix ad run dev       # Vite port 5173, host: true
npm --prefix ad test          # vitest run
npm --prefix ad run test:watch
npm --prefix ad run lint      # eslint .
npm --prefix ad run build
npm --prefix ad run preview

npm --prefix be ci
npm --prefix be start         # nodemon index.js; port mặc định 5000
npm --prefix be test          # Jest tuần tự
```

`fe` còn có `npm start`, hiện tương đương `vite`. `be` không có script `lint`, `build`, `dev` hoặc production `start` riêng ngoài `npm start` dùng `nodemon`. Không phát minh command còn thiếu.

Backend phải được chạy với working directory `be/`, vì một số upload legacy dùng đường dẫn tương đối. Không tự chạy toàn bộ backend test: nhiều suite kết nối MongoDB test thật và gọi `dropDatabase()`/`deleteMany({})`. Trước mọi Jest run phải đọc test liên quan, xác nhận URI/database cô lập và chắc chắn đó không phải development/production data. Khi an toàn, có thể chạy scoped test:

```powershell
npm --prefix be test -- --runTestsByPath tests/<file>.test.js
```

## 5. Biến môi trường và dịch vụ

Chỉ ghi tên biến; không ghi giá trị vào source, log hoặc báo cáo.

### Frontend

- `VITE_BACK_END`: base URL API của `fe`; để rỗng trong local có thể dùng proxy `/api` của Vite.
- `VITE_API_URL`: base URL API và Socket.IO của `ad`.
- `VITE_APP_ADMIN_LOGIN`: URL đăng nhập admin được code admin sử dụng.
- `VITE_DASHBOARD`: URL dashboard/storefront được code admin sử dụng.

### Backend

- `MONGODB_URI`: URI MongoDB ưu tiên; bắt buộc chứa database name.
- `DB_NAME`: database local khi không có `MONGODB_URI`.
- `PORT`: port HTTP; mặc định `5000`.
- `NODE_ENV`: phân biệt development, test và production.
- `JWT_SECRET`, `AES_KEY`: ký JWT và xử lý dữ liệu đăng nhập/autologin.
- `ADDRESS`: public server URL dùng để tạo URL upload/callback.
- `FRONTEND_URL`: origin frontend được CORS/Zalo flow sử dụng.
- `PUBLIC_SIGNUP_ENABLED`: bật đăng ký public khi bằng `true`.
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`: rate limit cho auth.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_NOTIFY_EMAIL`: gửi email/OTP/thông báo.
- `GEMINI_API_KEY`: Gemini cho scan hóa đơn và voice query.
- `TELEGRAM_BOT_TOKEN`: Telegram Bot API.
- `ZALO_DEMO_MODE`: chế độ demo tích hợp Zalo.

Không đọc hoặc in nội dung `.env`. Dùng `.env.example` nếu có và chỉ thêm placeholder an toàn. Không hard-code URL production, credential, connection string hay absolute path của máy cá nhân.

## 6. Kiến trúc và luồng dữ liệu

### Backend

- `be/index.js` tạo Express/HTTP/Socket.IO, cấu hình CORS/cookie/static files, mount router, kết nối MongoDB rồi mới listen.
- Route facade nằm ở `be/components/*.js`; giữ facade mỏng. HTTP orchestration nằm ở `controllers/`, logic dùng lại/nghiệp vụ ở `services/`, validation ở `validators/`, helper ở `utils/`, schema duy nhất ở `models/`.
- Các route chính được mount tại `/users`, `/products`, `/orders`, `/chips`, `/carts`, `/manages`, `/iporders`, `/eporders`, `/stations`, `/histories`, `/activity-logs`, `/zalo`, `/telegram`, `/voice-vocabs`.
- API hiện không có response envelope duy nhất. Có route trả document/array, `{ message }`, `{ error }` hoặc `{ success, data, message }`; phải giữ contract hiện tại và khóa bằng test.
- Global error handler chỉ chuẩn hóa malformed JSON và lỗi `500`. Validation thường dùng `400`, chưa xác thực `401`, thiếu quyền `403`, không tìm thấy `404`, conflict/version `409`.

### Xác thực và phân quyền

- JWT nằm trong cookie `authToken`, được gửi qua `credentials: "include"`; cookie là HttpOnly, SameSite Lax và Secure theo HTTPS/non-local.
- Role hiện có: `superadmin`, `admin`, `staff`, `customer`.
- Dùng đúng `authenticateUser`, `authenticateAdmin`, `authenticateAdminOnly`, `checkPermission` hoặc `checkAnyPermission` trong `be/middlewares/auth.js`. `authenticateAdmin` bao gồm cả `staff`; tên middleware không có nghĩa là admin-only.
- Permission catalog nằm tại `be/config/permissions.js`. Hiện `superadmin` luôn full access và `ADMIN_FULL_ACCESS` đang cho `admin` full access; đây là behavior hiện tại, không phải lý do để bỏ guard.
- Socket.IO cũng xác thực cookie và chỉ nhận `staff`/`admin`/`superadmin`.

### Model và invariant quan trọng

- Model chính gồm `User`, `Product`, `Order`/`Counter`, `IpOrder`, `EpOrder`, `Station`, `Manage`, `StorageHistory`, `ActivityLog`, `Type`, `Brand`/`Chip`/`Section`, `VoiceVocab`, `TelegramConfig`, `ZaloConfig`.
- `User.phone`, `Product.code` (sparse) và mã đơn có uniqueness rule; không đổi normalization/index nếu chưa kiểm tra dữ liệu tương thích.
- Stock không được âm. Mọi mutation tồn kho phải đi qua `be/services/inventory.js`; không tự `$inc`/save stock trong controller và không bỏ rollback/conflict handling.
- `Order`, `IpOrder`, `EpOrder` có concurrency/lifecycle rule. Khi sửa trạng thái, pricing hoặc line item, phải đọc model, service, controller và test cùng domain.
- MongoDB hiện có thể chạy standalone; không giả định multi-document transaction khả dụng.

### Upload và dịch vụ ngoài

- Product image: tối đa `4MB`, các định dạng trong `be/config/imageUpload.js`; product document: PDF tối đa `20MB`.
- Voice audio: tối đa `10MB`; invoice/order media phổ biến tối đa `5MB`. Một số upload legacy có rule khác, nên đọc đúng middleware của route thay vì áp một giới hạn chung.
- `/invoice-images` cần admin auth; các static upload route khác hiện có thể public. Không vô tình mở rộng quyền truy cập.
- Gemini, Telegram, Zalo và Gmail là network service thật. Mock network trong test; không gọi service thật khi chưa được yêu cầu.

## 7. Quy tắc thay đổi code

- Sửa nhỏ nhất có thể và đúng phạm vi task; không format/rewrite file không liên quan.
- Bám JavaScript/JSX và convention hiện có của từng ứng dụng. Không chuyển hàng loạt sang TypeScript.
- Không migrate React/Vite, Express, MongoDB hoặc thay kiến trúc chỉ để sửa một lỗi nhỏ.
- Trước khi đổi route, payload, response, schema hoặc field name, dùng `rg` kiểm tra mọi consumer trong `fe`, `ad`, `be` và test.
- Thay đổi model/schema phải kiểm tra controller, service, validator, index, dữ liệu legacy và cả hai frontend.
- Không tự thêm production dependency. Nếu thực sự cần, giải thích lý do và chỉ sửa manifest/lockfile trong đúng app.
- Không ghi đè thay đổi chưa commit của người dùng; luôn đọc diff hiện tại trước khi sửa file đang dirty.
- Khi nghiệp vụ chưa rõ, khảo sát flow và test liên quan rồi hỏi người dùng; không tự sáng tác behavior.

## 8. Quy tắc riêng theo thành phần

### `fe`

- Entry/routing ở `src/App.jsx`; state dùng `LanguageProvider` và `ShopContextProvider`.
- Route `/:code` là catch-all autolog. Khi thêm route, kiểm tra thứ tự để không bị route này bắt nhầm.
- API mới nên đặt theo domain trong `src/api/` và dùng `apiFetch`/`resolveApiUrl` từ `src/api/httpClient.js`. Giữ `credentials: "include"` cho flow có auth; public fetch có chủ đích có thể không gửi cookie.
- Styling hiện dùng global CSS, CSS theo feature/layout và MUI/Emotion. Đặt CSS cạnh feature theo convention hiện có.

### `ad`

- Vite `base` và `BrowserRouter basename` đều là `/admin`; không bỏ hoặc nhân đôi prefix này.
- Route nằm trong `src/App.jsx`; ngoài `/login`, màn hình được bọc bởi `ProtectedRoute` và `RoleGuard`. Khi thêm màn admin, cập nhật guard/permission và sidebar liên quan.
- API mới ưu tiên module theo domain trong `src/api/` và shared `apiFetch`. Không nhân rộng các direct `fetch` legacy nếu không cần.
- Ưu tiên MUI `sx`, `src/theme.js`, global admin layout/table class và feature CSS hiện có.

### `be`

- Giữ CommonJS (`require`/`module.exports`) và ranh giới `components` → `controllers` → `services`/`validators` → `models`.
- Auth/authz và input validation phải đứng trước mutation. Không hạ quyền để “sửa nhanh”.
- Giữ nguyên status code/response shape của route trừ khi task yêu cầu đổi contract; bổ sung regression test tương ứng.
- Không định nghĩa lại Mongoose model/schema trong route facade. Dùng model trong `be/models/`.

### Dữ liệu local

- `wdata/`, `backups/`, `copy/` và `be/upload/` không phải source để chỉnh sửa. Không đọc hàng loạt, xóa, move, restore hoặc commit chúng.
- `scripts/backup_db.ps1` có giả định đường dẫn máy và tự dọn archive cũ; script cài Scheduled Task hiện truyền tham số chưa khớp với backup script. Không chạy/cài hai script này nếu chưa được yêu cầu, chưa xác nhận DB đích và chưa sửa/kiểm chứng mismatch.

## 9. An toàn và bảo mật

- Không commit `.env`, credential, database dump, archive backup, upload runtime hoặc secret.
- Không log token, password, cookie, OTP, API key, connection string hay dữ liệu nhạy cảm.
- Không kết nối, sửa hoặc xóa development/production data nếu người dùng chưa yêu cầu rõ và chưa xác nhận database đích.
- Không tự chạy migration, seed, restore, backup cleanup, deploy hay script phá hủy. Script trong `be/scripts/` có thể sửa dữ liệu; đọc kỹ trước khi đề xuất chạy.
- Không dùng database thật cho test. Kiểm tra cả URI lẫn database name; tên có chữ “test” không đủ để chứng minh an toàn.
- Khi sửa API, luôn kiểm tra authorization, ownership/IDOR, validation, upload limit và path traversal.
- Không đưa absolute path riêng của Windows/VPS vào source mới. Cấu hình khác nhau giữa Windows, Linux và reverse proxy phải được xử lý rõ ràng.

## 10. Git và phạm vi thao tác

- Chạy `git status --short` trước và sau thay đổi; kiểm tra diff chỉ gồm file thuộc task.
- Không dùng `git reset --hard`, `git restore`, `git checkout --` hoặc lệnh phá hủy worktree.
- Không commit, push, merge, rebase, tag hoặc deploy nếu chưa được yêu cầu.
- Không xóa/sửa thay đổi sẵn có của người dùng và không “dọn” file ngoài phạm vi.
- `AGENTS.md` là tên đúng. Root `.gitignore` chỉ ignore `AGENT.md` số ít.

## 11. Chính sách subagents

- Được chủ động dùng subagents khi task có các phần độc lập và song song giúp khảo sát, test hoặc review nhanh hơn.
- Mỗi subagent phải có nhiệm vụ cụ thể, ranh giới file rõ và tiêu chí trả kết quả rõ.
- Ưu tiên subagents cho khảo sát read-only, targeted test, log analysis, security review và kiểm tra chéo.
- Tránh nhiều agents cùng sửa một khu vực; chỉ định một owner cho mỗi file hoặc domain thay đổi.
- Main agent chịu trách nhiệm kiểm chứng phát hiện quan trọng, giải quyết mâu thuẫn, tích hợp và review kết quả cuối.
- Không dùng subagent cho tác vụ quá nhỏ khi chi phí điều phối lớn hơn lợi ích.

## 12. Hoàn thành và kiểm chứng

Sau mỗi thay đổi:

1. Xem `git diff --check` và diff scoped; xác nhận không có file ngoài phạm vi.
2. Chạy test/lint/build nhỏ nhất nhưng đủ bao phủ thay đổi, theo script có thật trong từng `package.json`.
3. Với backend test, chỉ chạy sau khi xác nhận MongoDB test cô lập; nếu chưa an toàn thì không chạy và phải báo rõ.
4. Nếu đổi API/schema/shared utility, kiểm tra mọi ứng dụng phụ thuộc và chạy regression test liên quan ở cả `fe`, `ad`, `be`.
5. Không tuyên bố pass cho command chưa chạy. Ghi rõ command, kết quả và giới hạn kiểm chứng.
6. Tóm tắt file đã sửa, behavior thay đổi và rủi ro/công việc còn lại.

Definition of Done: thay đổi đúng yêu cầu và convention, diff không lẫn thay đổi ngoài phạm vi, auth/data contract được bảo toàn hoặc cập nhật có chủ đích, kiểm chứng liên quan đã pass (hoặc nêu rõ lý do chưa chạy), không lộ secret và không ảnh hưởng dữ liệu thật.

## 13. Những điều không được giả định

- Không coi ASP.NET Core + SQL Server là stack hiện tại và không gọi dự án này là Nova.
- Không áp chức năng hoặc yêu cầu từ một đồ án/báo cáo khác vào source công ty.
- Không coi `fe` là CRA: trạng thái hiện tại dùng Vite. Vẫn phải kiểm tra branch/code nếu cấu hình thay đổi sau này.
- Không giả định Windows, Ubuntu, VPS và local dùng cùng path, service manager hoặc reverse proxy.
- Không giả định có PM2, Nginx, Docker, CI/CD, root npm workspace hoặc command deploy khi repository không cung cấp.
- Không tự tạo port, collection, field, permission, business rule hoặc command không có bằng chứng trong code/config.
