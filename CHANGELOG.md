# CHANGELOG — TTSmartEcomWeb

> **File CHỈ NỐI THÊM (append-only).** Mỗi phiên làm việc ghi 3–5 dòng: đã làm gì, kết quả kiểm thử, rủi ro còn lại.
> KHÔNG ghi diff chi tiết ở đây — chi tiết nằm trong `plan-bangiao-*.md` của từng việc. Hiện trạng mới nhất xem `PROJECT_STATE.md`.
> Ghi mục mới nhất LÊN TRÊN CÙNG (mới → cũ).

---

## 2026-07-04 — Codex (thêm tạo đơn bán thủ công trong admin)
- `be/components/order.js`: thêm `GET /orders/customer-suggestions` và `POST /orders/admin-create-order` dùng cookie auth + quyền order; route tạo đơn validate toàn bộ payload trước khi trừ `quantityForSale`, lấy giá từ DB, tạo mã `TTSM-xx`, bỏ qua email/Zalo cho đơn nội bộ và vẫn emit socket `order_created`.
- `ad/src/components/orders.jsx`: thêm nút/dialog “Tạo đơn hàng mới”, autocomplete khách hàng, tìm sản phẩm debounce, chọn variant/số lượng, bảng dòng hàng, tạm tính và submit bằng `apiFetch` cookie httpOnly.
- `be/tests/order.test.js`: bổ sung regression cho admin/staff tạo đơn, customer bị 403, server bỏ qua total client gửi, lỗi phone/items/quantity/tồn kho không làm đổi kho, và customer suggestions chỉ trả customer name/phone.
- Verify: `cd be; npm test` pass — 18 suites, 81 tests; `cd ad; npm run build` pass (còn warning chunk lớn cũ).
- Rủi ro còn lại: chưa mở browser thao tác thủ công dialog mới; cần kiểm nhanh UX tìm sản phẩm/variant trên dữ liệu thật trước demo.

## 2026-07-04 — Codex (sửa admin LAN gọi nhầm API localhost)
- `ad/.env`: đổi `VITE_API_URL` từ `http://localhost:5000` sang `http://192.168.1.228:5000` vì admin đang mở bằng `http://192.168.1.228/admin/...`; gọi API sang `localhost` làm cookie khác site/host nên `/users/profile` 401 sau login.
- Rebuild `ad/dist`; kiểm bundle mới có `http://192.168.1.228:5000` và không còn phụ thuộc `localhost:5000` cho API admin.
- Verify: `cd ad; npm run build` pass (còn warning chunk lớn cũ).
- Cần hard refresh trình duyệt hoặc xóa cache để tải asset mới `index-Bv__b4yu.js`; request `/users/profile` phải thành `http://192.168.1.228:5000/users/profile`.

## 2026-07-04 — Codex (sửa cookie local làm `/users/profile` 401 sau admin login)
- `be/components/user.js`: chỉnh `getCookieOptions` để localhost/127.0.0.1/::1/LAN HTTP không set `Secure` dù request bị proxy đánh dấu secure; tránh browser drop cookie `authToken` khiến login báo thành công nhưng `/users/profile` trả 401.
- `be/tests/auth.test.js`: thêm regression test cho cookie localhost không có `secure`, production HTTPS vẫn có `secure`.
- Verify: `cd be; npm test` pass — 18 suites, 77 tests; `cd ad; npm run build` pass (còn warning chunk lớn cũ).
- Cách kiểm tra browser: login admin xong mở DevTools > Application > Cookies > `http://localhost:5000` phải thấy `authToken`; request `/users/profile` phải có header `Cookie: authToken=...`.

## 2026-07-04 — Codex (sửa router sau login admin)
- `ad/src/components/login.jsx`: thêm fallback `VITE_DASHBOARD || "/admin/product"` để login admin không redirect vào URL rỗng/sai khi env thiếu.
- `ad/src/App.jsx`: thêm route index và wildcard redirect về `/product`, tránh trường hợp login thành công nhưng vào `/admin` hoặc route không khớp thì shell admin hiện trống như chưa đăng nhập.
- Verify: `cd ad; npm run build` pass (còn warning chunk lớn cũ).
- Rủi ro còn lại: chưa mở browser đăng nhập thủ công; nếu vẫn lỗi, cần xem Network tab request `/users/profile` có gửi cookie `authToken` không.

## 2026-07-04 — Codex (hoàn tất gỡ chat hỗ trợ đang dở)
- Hoàn tất phần Claude đang làm dở: sau khi chat backend/frontend đã bị gỡ khỏi `be/index.js`, `ad/src/App.jsx`, `ad/src/layout/sidebar.jsx`, xóa nốt proxy `/chat` trong `ad/vite.config.js` và các key dịch Chat Widget không còn được dùng trong `fe/src/context/languagecontext.jsx`.
- Giữ lại hai key login/register (`already_have_account_login`, `dont_have_account_register`) vì `fe/src/pages/login.jsx` vẫn đang dùng.
- Verify: `cd be; npm test` pass — 18 suites, 76 tests; `cd ad; npm run build` pass (còn warning chunk lớn); `cd fe; npm run build` pass với các warning eslint/Browserslist/CRA cũ.
- Rủi ro còn lại: chưa mở browser kiểm thử UI thủ công; việc gỡ chat là thay đổi hành vi có chủ đích, cần xác nhận với demo rằng không còn yêu cầu module chat hỗ trợ.

## 2026-07-04 — Codex (vá 5 nhóm hardening backend: injection, auth, IDOR, upload)
- `be/components/user.js`: chặn NoSQL injection autologin khi `token` không phải string; `/users/all-users` không trả `password`, `logInString`, `resetOtpExpires`.
- `be/components/product.js`, `chip.js`, `station.js`, `eporder.js`: thêm auth/permission cho `PUT /products/purchase/:id` và `POST /chips/:name/value`, sửa permission eporder `update_eporder`, thêm owner/moderator guard cho sửa/xóa review, thêm `multer` image `fileFilter` + `limits` cho upload ảnh.
- Thêm `be/tests/security_hardening.test.js`: cover autologin object token, autologin string hợp lệ, field hiding all-users, purchase unauth 401, review IDOR, và permission `update_eporder`.
- Kết quả `cd be; npm test`: pass — 18 suites passed, 75 tests passed.
- Rủi ro còn lại: chưa kiểm thử thủ công upload file xấu qua UI/browser; không đổi nghiệp vụ hợp lệ, chỉ thêm rào chắn.

## 2026-07-04 — Codex (vá phân quyền admin-only backend + test regression)
- Thêm `authenticateAdminOnly` trong `be/components/user.js` (đọc JWT từ cookie `authToken`, chỉ cho `admin/superadmin`) và áp dụng cho đúng các route hở: `/users/all-users`, `/users/customers`, `/users/:id/rotate-autologin-token`, `/zalo/settings`, `/zalo/auth-url`; không đụng `/zalo/callback` hay các route write đã có guard role bên trong.
- Thêm `be/tests/authz_admin_only.test.js`: staff bị 403 ở các route admin-only, admin vẫn 200, customer vẫn 403, và regression staff có `read_order` vẫn GET `/orders` 200.
- Trong lúc chạy full test, sửa tối thiểu các lỗi test cũ: bỏ gửi email OTP thật khi `NODE_ENV=test`, cho `/products/voice-query` auth trước multer, chỉnh normalizer voice để khớp test hiện có.
- Kết quả `cd be; npm test`: pass — 17 suites passed, 70 tests passed.
- Rủi ro còn lại: chưa kiểm thử thủ công trên browser/admin UI; working tree còn một số file ngoài phạm vi đã tồn tại/không liên quan nên không revert.

## 2026-07-03 — Codex (Đợt 5 cuối: refactor manage UI + dọn code chết + Vitest cho ad)
- V12: refactor gọn `ad/src/components/manage.jsx` (tách `ImageCarouselSection` và `TextUpdateSection` cho các khối lặp), giữ nguyên endpoint/payload/shape API `/manages/`; KHÔNG đụng `be/components/manage.js`.
- V13: xóa component chết `ad/src/components/iporderdetail.jsx` (bản gốc) sau khi grep xác nhận chỉ còn import bản đang dùng `ad/src/components/iporder/iporderdetail.jsx`. V14: xóa `fe/backup_ui_original/` sau khi grep xác nhận `fe/src` không import.
- V15: set up Vitest + Testing Library + jsdom cho `ad/`, thêm script test, thêm `ad/src/components/RoleGuard.test.jsx`. Kết quả `cd ad; npm test`: pass — 1 file pass, 3 tests pass.
- Verify: `cd ad; npm run build`: pass (có warning chunk lớn của Vite); `cd fe; npm run build`: pass (có warning eslint/Browserslist/CRA cũ). Không đụng business logic, không đụng route backend.

## 2026-07-03 — Claude (fix nhỏ: thiếu credentials khi gọi API admin ở stationuser)
- `ad/src/components/stationuser.jsx`: thêm `credentials: "include"` cho `fetchStations` (GET /stations) và `handleRemoveStation` (PUT /users/stations) — hai chỗ này thiếu cookie nên bị 401, trang không load được danh sách trạm. Bug có sẵn, không do Đợt 4. Build ad pass; chưa mở browser xác minh lại.

## 2026-07-03 — Codex (Đợt 4 UI: role-gate route admin client-side)
- Thêm `ad/src/components/RoleGuard.jsx`: fetch `/users/profile` bằng cookie httpOnly (`credentials: "include"`), hiển thị loading `CircularProgress`, admin/superadmin bypass, thiếu quyền thì toast và điều hướng `/product`, lỗi auth thì về `/login`.
- `ad/src/App.jsx`: bọc route trực tiếp cho bán hàng (`order_management`), nhập hàng (`iporder_management`), xuất hàng (`eporder_management`), và admin-only (`/account`, `/zalo`); giữ nguyên cấu trúc `<ProtectedRoute>` bao ngoài.
- `ad/src/components/protectedroute.jsx`: bỏ hardcoded role gate riêng cho `/account`, chỉ còn kiểm tra đăng nhập chung; `ad/src/layout/sidebar.jsx` xóa comment/hash debug và log superadmin.
- LƯU Ý: đây chỉ là client-side UX/defense-in-depth, không thay thế phân quyền backend. Kết quả `cd ad; npm run build`: pass.
- Rủi ro còn lại: chưa mở browser kiểm chứng thủ công staff/admin vào URL trực tiếp; Vite vẫn cảnh báo chunk JS lớn sau minify.

## 2026-07-03 — Codex (Đợt 3: dọn mojibake/log + mở rộng test)
- V11: bỏ emoji trong console.log/console.error ở `be/index.js`, `mailer.js`, `zaloService.js` và các component; xóa log debug ồn (`socket.onAny`, `server:hello`, debug product/voice); sửa mojibake chắc nghĩa trong `mailer.js`, `storagehistory.js`, message trùng mã sản phẩm.
- V10: thêm test cho `cart.js`, `iporder.js`, `eporder.js`, `storagehistory.js` trong `be/tests/` (cookie-agent, tự dọn dữ liệu); test nghiệp vụ trừ kho eporder đủ/thiếu hàng và lọc `noteType` storagehistory.
- Hoãn test `chat.js`, `zalo.js`, `activitylog.js`, `manage.js`: cần mock socket/OAuth-Zalo/upload-file hoặc test harness riêng, không bịa test cho route phụ thuộc ngoài.
- Kết quả `cd be; npm test`: fail thật — 13 suites pass / 3 suites fail, 63 tests pass / 4 tests fail; 4 suite mới pass 7/7. Fail còn lại là pre-existing (`recover`, `api_product`, `voice_query_normalizer`).
- Rủi ro còn lại: một số prompt AI/text dài trong `product.js` còn cần review encoding thủ công riêng để tránh đổi hành vi nhận diện.

## 2026-07-03 — Codex (Đợt 2 backend: authenticateUser tra DB, trust proxy, cookie same-domain, dọn CORS, bỏ auto-sync boot)
- `be/components/user.js`: authenticateUser nay tra DB, 401 nếu user bị xóa, lấy role tươi; giữ nguyên shape req.user. getCookieOptions bỏ nhánh localtunnel, dùng secure=req.secure + sameSite 'lax' (FE/BE cùng miền).
- `be/index.js`: trust proxy đổi true -> 1 (hợp Nginx 1 hop, chống spoof X-Forwarded-For); CORS bỏ nhánh tunnel Cloudflare/loca.lt, giữ LAN 192.168.
- `be/index.js`: bỏ khối auto-sync tổng tiền IpOrder/EpOrder + adjusted chạy mỗi lần boot (thừa với PM2 reload).
- Thêm test user-bị-xóa-token-cũ trong `be/tests/order.test.js`. Kết quả `cd be; npm test`: fail thật — 9 suites pass / 3 suites fail, 56 tests pass / 4 tests fail.
- Rủi ro/ghi nhớ khi deploy: Nginx PHẢI có `proxy_set_header X-Forwarded-Proto $scheme;` nếu không req.secure luôn false và cookie không set được trên HTTPS. Chưa test login HTTPS thật.

## 2026-07-03 — Codex (Đợt 2: log kho đơn bán online)
- Thêm trường `note` (default "") vào schema `StorageHistory`; thêm nhánh lọc `ban_online` và loại đơn bán online khỏi lọc nhap_don/xuat_don trong `be/components/storagehistory.js`.
- `be/components/order.js` route `PUT /update-order/:_id`: khi đơn chuyển "Completed" ghi StorageHistory xuất kho (quantity âm, note "Đơn hàng bán online"); khi hoàn tác ghi bản nhập lại (quantity dương, note "Hoàn tác đơn bán online"). Ghi log bọc try/catch, không chặn luồng; logic trừ kho/purchaseCount cũ giữ nguyên.
- `ad/src/components/history.jsx`: cột Ghi chú ưu tiên hiển thị `note`, thêm mục lọc "Đơn hàng bán online", mã đơn bán online để dạng text tránh link chết.
- Thêm test complete/revert đơn trong `be/tests/order.test.js`. Kết quả `cd be; npm test`: fail thật — 9 suites pass / 3 suites fail, 55 tests pass / 4 tests fail; `cd ad; npm run build`: pass.
- Rủi ro còn lại: UI chưa mở browser kiểm chứng thực tế; các fail backend còn lại là pre-existing ở `api_product`, `voice_query_normalizer`, `recover`.

## 2026-07-03 — Codex (Đợt 1 security)
- Vá IDOR đơn hàng trong `be/components/order.js`: thêm `authenticateUser` cho `GET /orders/:_id`, guard chính chủ/admin/superadmin/staff cho GET/PUT/DELETE, thêm test cookie-agent trong `be/tests/order.test.js`.
- Dọn interceptor chết trong `fe/src/components/api.js`: bỏ `_retry` và `/users/refresh-token`, giữ redirect login khi lỗi auth; không đổi cấu hình XSRF.
- Siết CORS tối thiểu trong `be/index.js` bằng cách bỏ `origin === 'null'`, giữ localhost/LAN/tunnel demo; sửa doc FE env `REACT_APP_BACK_END` trong `AGENT.md`.
- Kết quả `cd be; npm test`: fail thật — 9 suites pass / 3 suites fail, 54 tests pass / 4 tests fail; riêng `npx jest tests/order.test.js --runInBand --detectOpenHandles --forceExit` pass 5/5.
- Rủi ro còn lại: chưa mở browser kiểm chứng luồng ad/fe; các fail hiện tại nằm ở `api_product`, `voice_query_normalizer`, `recover`, không thuộc phần order security vừa vá.

## 2026-07-03 — Claude
- Thiết lập bộ tài liệu điều phối: `CLAUDE.md` (trỏ `@AGENT.md`), cập nhật `AGENT.md` (mục 8 skills + mục 11–13 build/API/testing), copy 13 skill vào `.claude/skills/`.
- Gộp tinh túy 5 file báo cáo cũ (AUDIT 06-22, AUDIT 06-29, QA_REPORT, BAO_CAO QA 06-30, BAO_CAO so sánh) thành `PROJECT_STATE.md` + seed `CHANGELOG.md` này, rồi xóa 5 file cũ.
- Chưa chạy lại test/build trong phiên này — các con số trong PROJECT_STATE là từ báo cáo cũ, đánh dấu "chưa verify".

---

## Trước 2026-07-03 (tóm tắt từ git log + các báo cáo đã gộp)
- 2026-06-30: QA tổng thể (Codex) — BE Jest 32/32 pass, FE/Admin build pass, admin lint còn ~149 lỗi; phát hiện 5 nhóm product.code trùng ở DB `test`; readiness 7.2/10.
- 2026-06-29: Audit lần 2 — autologin chuyển sang secure token; `npm test` đã sửa xanh; còn tồn nhiều issue security HIGH (H1–H10) và tồn kho.
- 2026-06-22: Audit lần 1 (multi-agent) — xác lập điểm mạnh bảo mật cốt lõi + chịu tải ~7000 req/s.
- Các commit gần nhất (xem `git log`): tối ưu UI admin/header, sticky headers, role-based access, AI voice search, unique product code.
