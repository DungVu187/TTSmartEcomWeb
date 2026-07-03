# CHANGELOG — TTSmartEcomWeb

> **File CHỈ NỐI THÊM (append-only).** Mỗi phiên làm việc ghi 3–5 dòng: đã làm gì, kết quả kiểm thử, rủi ro còn lại.
> KHÔNG ghi diff chi tiết ở đây — chi tiết nằm trong `plan-bangiao-*.md` của từng việc. Hiện trạng mới nhất xem `PROJECT_STATE.md`.
> Ghi mục mới nhất LÊN TRÊN CÙNG (mới → cũ).

---

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
