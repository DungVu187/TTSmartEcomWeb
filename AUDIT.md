# TỔNG KẾT KIỂM TRA DỰ ÁN — TTSmartEcomWeb
> Ngày kiểm tra: 2026-06-22 | Công cụ: Claude Code multi-agent audit (14 agents)

---

## ĐIỂM MẠNH

- **Bcrypt** hash password (cost 10) qua pre-save hook — không lưu plaintext
- **HttpOnly cookie** cho JWT — ngăn XSS đánh cắp token qua `localStorage`
- **Rate limiting** áp dụng đúng cho `/register`, `/login`, `/change-password`
- **Generic error message** khi login thất bại — ngăn user enumeration
- **`authenticateAdmin` tra DB** — phát hiện user đã bị xóa, không tin JWT blindly
- **Address CRUD** scope theo owner đúng chuẩn
- **Zalo notification có `.catch()`** — không crash request khi Zalo fail
- **Không cho phép tự gán role cao** khi đăng ký
- **Cấu trúc route tách component** rõ ràng, dễ đọc

---

## BẢO MẬT

### CRITICAL

**SEC-C1 — AES key lộ trong frontend bundle**
- File: `ad/src/components/stationuser.jsx`, `fe/src/pages/login.jsx`
- `VITE_AES_KEY` / `REACT_APP_AES_KEY` bị bundle vào JS client — ai cũng thấy qua DevTools. `login.jsx` còn gửi song song cả chuỗi mã hóa lẫn password plaintext → mã hóa vô nghĩa hoàn toàn
- **Fix:** Xóa toàn bộ logic CryptoJS/AES phía client. Dùng HTTPS bảo vệ transit

**SEC-C2 — `POST /autologin-token` không có xác thực**
- File: `be/components/autolog.js:35`
- Ai biết số điện thoại đều có thể lấy token đăng nhập của user đó. Không cần JWT, không cần gì cả
- **Fix:** Thêm `authenticateAdmin` middleware vào route — 1 dòng code

**SEC-C3 — Autologin token không bao giờ hết hạn**
- File: `be/components/autolog.js` schema
- Không có `expiresAt`, không có MongoDB TTL index → token tồn tại vĩnh viễn
- **Fix:** Thêm `expiresAt` field + TTL index `{ expireAfterSeconds: 0 }`

**SEC-C4 — Zalo OAuth callback không có auth + không kiểm tra CSRF state**
- File: `be/components/zalo.js:92`
- `GET /zalo/callback` không có middleware guard. `state` hardcode `"zalo_link"` và không được verify trong callback
- **Fix:** Thêm `authenticateAdmin`; generate random state bằng `crypto.randomBytes(16)`, lưu vào signed cookie, verify khi callback

### HIGH

| # | Vấn đề | File | Fix nhanh |
|---|---|---|---|
| H1 | Autologin token lưu plaintext + truyền qua URL query string (bị log) | `autolog.js` | Lưu `SHA-256(token)` vào DB; gửi qua POST body |
| H2 | Socket.IO không xác thực — ai cũng `send_msg` với `senderRole` tùy ý | `be/index.js` | Thêm `socket.use()` middleware verify JWT |
| H3 | `total` đơn hàng do client tự gửi, không được server recalculate | `order.js:212,254` | Server tính lại từ DB price × quantity |
| H4 | `POST /autologin-token/revoke` không cần quyền — ai cũng revoke token người khác | `autolog.js:98` | Thêm `authenticateAdmin` |
| H5 | Cancel/delete đơn hàng không check ownership — user A xóa đơn user B | `order.js` | `if (order.userPhone !== req.user.phone && role !== 'admin') 403` |
| H6 | `trust proxy: true` không giới hạn — spoof `X-Forwarded-For` bypass rate limit | `be/index.js:25` | Đổi thành `app.set('trust proxy', 1)` |
| H7 | CORS chấp nhận `origin === 'null'` và mọi tunnel subdomain | `be/index.js:47-50` | Whitelist cứng; tunnel chỉ khi `NODE_ENV=development` |
| H8 | Staff qua được `authenticateAdmin` → có thể tự nâng quyền | `user.js` | Thêm `if (role !== 'admin') return 403` trong handler |
| H9 | Helmet tắt CSP và HSTS | `be/index.js:164` | Bỏ `contentSecurityPolicy: false` và `hsts: false` |

### MEDIUM

| # | Vấn đề | Fix |
|---|---|---|
| M1 | `secure` cookie flag dựa vào `Origin` header do client gửi | Dùng `NODE_ENV === 'production'` |
| M2 | HTML email dùng template literal không escape → XSS email | Tạo `escapeHtml()` wrap tất cả values |
| M3 | Zalo `secretKey`, `accessToken`, `refreshToken` lưu plaintext MongoDB | AES-256-GCM với server-side key từ env |
| M4 | `oa_id` từ Zalo callback ghi đè config mà không cảnh báo | So sánh với config trước khi persist |
| M5 | `GET /order/:id` và `GET /processing-count` không cần auth | Thêm middleware xác thực |

---

## CHẤT LƯỢNG CODE — BACKEND

### Critical

**BE-C1 — Không có MongoDB transaction cho multi-document writes**
- File: `be/components/order.js` — create, update, delete, cancel
- Server crash giữa chừng → inventory bị deduct không rollback → mất hàng thực tế
- **Fix:** Wrap trong `mongoose.startSession()` + `session.withTransaction()`

**BE-C2 — Typo `require` thay vì `required` trong cartItems schema**
- File: `be/components/order.js` schema
- Mongoose bỏ qua `require: true` → `productId`, `variantIndex`, `quantity` không bắt buộc thực tế
- **Fix:** Đổi tất cả `require:` → `required:`

**BE-C3 — `npm test` luôn fail dù Jest đã cài**
- File: `be/package.json`
- Script là stub `echo "Error: no test specified" && exit 1` — 7 file test tồn tại nhưng không chạy được
- **Fix:** Đổi thành `"jest --testPathPattern=tests/ --runInBand --forceExit"`

### High

| # | Vấn đề | File | Fix |
|---|---|---|---|
| H1 | Inventory dual-counter (`quantityForSale`/`quantityInStorage`) không reconcile — cancel sau complete không restore đúng | `order.js` | Xác định rõ state machine; test covering cancel-after-complete |
| H2 | JWT không có revocation — logout chỉ xóa cookie client, token vẫn valid 12h | `user.js` | Kiểm tra `logInString` trong `authenticateUser` hoặc Redis blacklist |
| H3 | `authenticateAdmin` blacklist `customer` thay vì whitelist — role mới tự bypass | `user.js:153` | `!['admin', 'staff'].includes(user.role)` |
| H4 | `fetch` Zalo API không kiểm tra `response.ok` — 429/503 gây JSON parse crash | `zaloService.js:45,104` | `if (!response.ok) throw new Error(...)` |
| H5 | MongoDB connection failure không dừng server | `be/index.js:179` | `.catch(err => { logger.error(err); process.exit(1); })` |
| H6 | `csurf` deprecated + không dùng nhưng vẫn cài (có unpatched DoS) | `be/package.json` | Xóa `csurf`; dùng `csrf-csrf` |
| H7 | `express-rate-limit` không áp dụng global — nhiều endpoint không được bảo vệ | `be/index.js` | Thêm `app.use(rateLimit(...))` trước tất cả routes |

### Medium

| # | Vấn đề | File |
|---|---|---|
| M1 | Race condition concurrent cart requests — read-modify-write không atomic | `cart.js` |
| M2 | `config.save()` fail sau token refresh → memory vs DB out-of-sync | `zaloService.js:53` |
| M3 | `stationCode` không có `unique: true` index | `station.js` schema |
| M4 | `rotate-invite` endpoint không làm gì — dead feature, `crypto` import chết | `station.js:240` |
| M5 | `GET /all-users` trả về full document kể cả `logInString`, `permissions` | `user.js` |
| M6 | ZaloConfig single-document không có unique constraint | `zalo.js` |
| M7 | Thiếu `express-mongo-sanitize` — NoSQL injection qua query params | `be/index.js` |
| M8 | `sendNewOrderNotification` thiếu `.catch()` — Zalo có nhưng email thì không | `order.js:293` |
| M9 | `io.emit()` không có null-guard — socket chưa init thì crash sau DB write | `order.js:197,313,458,502` |

### Low

| # | Vấn đề |
|---|---|
| L1 | `removeFromCart`/`clearCart` dùng POST thay vì DELETE (REST semantics) |
| L2 | `require('./station')` trong route handler thay vì module top-level |
| L3 | `DB_PASSWORD` khai báo nhưng không dùng trong MongoDB URI |
| L4 | File ảnh station không bị xóa khi xóa station document |
| L5 | Multer không có `fileFilter` và `limits.fileSize` — upload bất kỳ file gì |

---

## CHẤT LƯỢNG CODE — FRONTEND

### Critical

**FE-C1 — Socket tạo mới mỗi render trong `orders.jsx`**
- File: `ad/src/components/orders.jsx:60`
- `const socket = io(...)` trong component body → mỗi render = 1 connection mới không bao giờ disconnect → connection leak nghiêm trọng
- **Fix:** `const socketRef = useRef(null)` + init trong `useEffect` + cleanup `socketRef.current?.disconnect()`

**FE-C2 — `toast.warn` không tồn tại trong react-hot-toast**
- File: `ad/src/components/iporderdetail.jsx:601`
- Gây `TypeError` crash component tại runtime
- **Fix:** Đổi thành `toast("...", { icon: "⚠️" })`

**FE-C3 — Ảnh không hiển thị do sai data shape**
- File: `ad/src/components/soldproducts.jsx`, `iporderdetail.jsx`, `ipordertemplate.jsx`
- Truy cập `product.variant?.[0]?.imgUrl` nhưng data shape thực tế khác → ảnh luôn broken

**FE-C4 — `addToCart` thiếu tham số `quantity`**
- File: `fe/src/components/stationdisplaydetail.jsx:218`
- `addToCart(product._id, 0)` — thiếu argument thứ 3 → quantity = `undefined`

### High

| # | Vấn đề | File |
|---|---|---|
| H1 | Double fetch on mount — 2 `useEffect` cùng trigger `fetchProducts` | `products.jsx` |
| H2 | `TablePagination count` tính sai — proxy calculation drift | `products.jsx:1098` |
| H3 | `enrichOrderData` gọi API mỗi keystroke — 1 fetch/ký tự gõ | `iporderdetail.jsx:622` |
| H4 | Context `value` object không memoize → toàn bộ consumer tree re-render | `shopcontext.jsx:138` |
| H5 | Auth state không centralize — 3-4 component độc lập mỗi cái tự fetch `/users/profile` | `navbar`, `cart`, `myorder`, `station` |
| H6 | Tab index logic sai — nội dung không hiển thị khi chỉ có `hasInfoDoc` | `productdisplay.jsx:522` |
| H7 | Email user hiển thị công khai trong reviews — privacy violation | `productdisplay.jsx` |
| H8 | Nút thêm giỏ hàng không check out-of-stock | `item.jsx`, `productdisplay.jsx` |

### Medium

| # | Vấn đề |
|---|---|
| M1 | `window.location.href` thay vì `useNavigate` — phá SPA model, full page reload (6 chỗ) |
| M2 | `key={index}` trên dynamic lists khắp codebase — reconciliation sai khi reorder/delete |
| M3 | `myorder.jsx` tạo URL `?&state=...` (leading `&` malformed) |
| M4 | Pagination `myorder.jsx` fetch server-side rồi slice client-side — double pagination broken |
| M5 | `moment.js` được dùng — large deprecated lib, nên dùng `date-fns` hoặc `Intl` native |
| M6 | Số điện thoại hardcode 3 chỗ với format khác nhau (`0913 158 383` vs `0913158383`) |
| M7 | `getActiveValues` không memoize — nested loop mỗi render |
| M8 | 2 cơ chế auth song song: cookie vs `auth-token` header từ `sessionStorage` |
| M9 | `debounceTimeout` ref khai báo nhưng không dùng — `stationuser.jsx:56` |
| M10 | `isMobile` khai báo nhưng không dùng — `station.jsx (admin):21` |

### Low

| # | Vấn đề |
|---|---|
| L1 | `action="javascript:void(0)"` trên form — dùng `onSubmit={e => e.preventDefault()}` |
| L2 | `handleDeleteBrand` reset `typeName` thay vì `brandName` — copy-paste bug |
| L3 | `copyToClipboard` dùng `document.execCommand('copy')` đã deprecated |
| L4 | Typo CSS class `"produt-display-main-container"` (thiếu chữ `c`) — `productdisplay.jsx:325` |
| L5 | `width: "full"` trong inline style — không phải CSS value hợp lệ |

---

## UX / TRẢI NGHIỆM NGƯỜI DÙNG

| # | Vấn đề | Fix |
|---|---|---|
| UX-1 | API fail → blank screen hoặc spinner vĩnh viễn | Thêm error state + nút Retry |
| UX-2 | `alert()` / `window.confirm()` native dùng ở 8+ chỗ | Thay bằng MUI `Dialog` (pattern đã có trong `orders.jsx`) |
| UX-3 | Không có loading indicator khi mutation in-flight | Disable button + spinner trong thời gian request |
| UX-4 | Duplicate feedback: inline error + toast cùng lúc trong login | Chọn 1 pattern duy nhất |
| UX-5 | "Quên mật khẩu" là dead feature nhưng vẫn clickable | Ẩn hoặc tooltip "Đang phát triển" |
| UX-6 | Delay 1 giây hardcode sau login không có lý do UX | Navigate ngay sau toast success |
| UX-7 | Xóa station/đơn hàng không có undo | Confirmation dialog + cân nhắc soft-delete |
| UX-8 | Debounce 1000ms quá chậm cho search | Đổi thành 350ms |
| UX-9 | User vừa đăng review liền thấy "Chưa có đánh giá" do bị filter email | Hiển thị review của mình riêng thay vì filter |
| UX-10 | Nút "Xóa giỏ hàng" và "Đặt hàng" đặt gần nhau | Tách xa về layout |
| UX-11 | Button "Hủy" trong order dialog ambiguous — hủy dialog hay hủy đơn? | Đổi thành "Đóng" vs "Xác nhận hủy" |
| UX-12 | Badge count hiển thị 2 lần khi sidebar mở rộng | Ẩn badge parent khi expanded |
| UX-13 | Click ảnh để upload không có affordance visual | Thêm hover overlay + icon camera |

---

## HIỆU NĂNG

| # | Vấn đề | Fix |
|---|---|---|
| P1 | 3 sequential fetch trong `stationdisplaydetail.jsx` — 2+3 có thể song song | `Promise.all([fetch2(), fetch3()])` |
| P2 | Full User document load chỉ để update `cart[]` | `findOneAndUpdate` với `$push`/`$pull`/`$set` |
| P3 | N×M fetches trong `myorder.jsx` — 10 đơn × 5 sản phẩm = 50 requests | Collect unique IDs, gọi 1 lần `POST /products/fetch-by-ids` |
| P4 | `fetchSoldProducts` double-trigger khi filter thay đổi | Tách filter state khỏi `useCallback` dependency |
| P5 | Context value object mới mỗi render | `useMemo` cho value, `useCallback` cho functions |
| P6 | `getCartItemCount()` gọi 2 lần trong cùng render navbar | Cache vào const |
| P7 | Cart stock check loop dùng `for...of await` — sequential | `Promise.all(items.map(...))` |
| P8 | Không có `AbortController` trong fetch effects navbar | Cleanup `controller.abort()` trong useEffect return |
| P9 | `Item` component không có `React.memo` — re-render toàn list mỗi lần parent update | `export default React.memo(Item)` |

---

## KIỂM THỬ

**Trạng thái hiện tại: broken**

- `npm test` luôn fail — script là stub `echo "Error: no test specified" && exit 1`
- Jest ^30 và Supertest ^7 đã cài nhưng không được wire vào npm test script
- 7 file test tồn tại (`register`, `auth`, `user`, `order`, `product`, `api_product`, `test_zalo_send`) không chạy được
- Không có test frontend (zero file trong `ad/` và `fe/`)
- Không có CI pipeline, không có `.env.example`

**Fix tối thiểu:**
```
be/package.json:  "test": "jest --testPathPattern=tests/ --runInBand --forceExit"
be/jest.config.js: { testEnvironment: "node" }
be/tests/setup.js: connect/disconnect MongoDB test DB
be/.env.example:  tất cả required variables + comment
```

---

## TOP 10 ƯU TIÊN CẦN LÀM NGAY

| # | Vấn đề | Tác động | Fix nhanh |
|---|---|---|---|
| 1 | `POST /autologin-token` không auth | **Chiếm tài khoản bất kỳ user** | Thêm `authenticateAdmin` — 1 dòng |
| 2 | AES key lộ trong bundle client | Mã hóa vô nghĩa, key public | Xóa toàn bộ CryptoJS frontend |
| 3 | `total` đơn hàng do client gửi | Mua hàng với giá 0đ | Server recalculate từ DB price |
| 4 | MongoDB transaction thiếu cho order | Inventory leak không rollback | Wrap trong `session.withTransaction()` |
| 5 | `npm test` broken | Không có safety net regression | 1 dòng script + `jest.config.js` |
| 6 | Socket connection leak trong `orders.jsx` | Memory leak, flood server connections | `useRef` + `useEffect` cleanup |
| 7 | CSRF state Zalo OAuth không verify | Hijack Zalo integration | `crypto.randomBytes` + signed cookie |
| 8 | Ownership check thiếu trên cancel/delete order | User A xóa đơn user B | Guard `userPhone !== req.user.phone` |
| 9 | `toast.warn` crash runtime | Component crash khi dùng tính năng | Đổi thành `toast(..., { icon: "⚠️" })` |
| 10 | Helmet CSP/HSTS tắt + CORS quá rộng | XSS không bị chặn browser-level | Bỏ `contentSecurityPolicy: false`; whitelist CORS cứng |

---

## TỔNG SỐ VẤN ĐỀ

| Mức độ | Bảo mật | Backend | Frontend | Tổng |
|---|---|---|---|---|
| Critical | 4 | 3 | 4 | **11** |
| High | 9 | 7 | 8 | **24** |
| Medium | 5 | 9 | 10 | **24** |
| Low | — | 5 | 5 | **10** |
| UX/Perf | — | — | 22 | **22** |
| **Tổng** | **18** | **24** | **49** | **91** |
