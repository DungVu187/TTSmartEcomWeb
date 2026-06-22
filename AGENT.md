# HƯỚNG DẪN CỐT LÕI CHO AI AGENT (AGENT.MD)

Tệp này chứa các chỉ thị quan trọng, kiến trúc hệ thống và quy tắc phát triển mà mọi AI Agent (như Claude, Gemini, ChatGPT, Cursor, v.v.) **bắt buộc phải tuân thủ** khi làm việc trên dự án này.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ (TECH STACK)

Dự án **TTSmartEcomWeb** là một hệ thống e-commerce quản lý các trạm thông minh (Smart Stations) bao gồm 3 phần chính:

### A. Admin Dashboard (`ad/`)
- **Công nghệ**: React 18, Vite, Material UI (MUI) & Joy UI, `@mui/x-data-grid`, `@dnd-kit` (drag and drop), React Router Dom v7, Socket.io-client.
- **Mục đích**: Giao diện quản trị viên quản lý trạm, sản phẩm, đơn hàng, người dùng, lịch sử xuất/nhập kho.

### B. Client Frontend (`fe/`)
- **Công nghệ**: React 18, Create React App (`react-scripts`), Material UI, FontAwesome, Swiper, Lenis (Smooth Scroll), Socket.io-client, Axios.
- **Mục đích**: Giao diện người dùng cuối hiển thị thông tin trạm, mua sản phẩm, giỏ hàng, đặt hàng, chat hỗ trợ.

### C. Backend API Server (`be/`)
- **Công nghệ**: Node.js, Express, MongoDB (Mongoose), Socket.io (realtime), Nodemailer, Winston (logging), Helmet, Express Rate Limit, CSRF Protection.
- **Mục đích**: Xử lý API, thanh toán, quản lý Zalo OA/Zalo Service, thông tin đơn hàng, cơ sở dữ liệu.

---

## 2. CẤU TRÚC API (ROUTE MAP)

Tất cả API mount trên backend với prefix tương ứng:

| Prefix | File | Mô tả |
|---|---|---|
| `/users` | `be/components/user.js` | Auth, quản lý tài khoản, phân quyền |
| `/products` | `be/components/product.js` | Sản phẩm |
| `/orders` | `be/components/order.js` | Đơn hàng |
| `/carts` | `be/components/cart.js` | Giỏ hàng (lưu trên User doc) |
| `/stations` | `be/components/station.js` | Trạm thông minh |
| `/manages` | `be/components/manage.js` | Quản lý kho |
| `/iporders` | `be/components/iporder.js` | Đơn nhập kho |
| `/eporders` | `be/components/eporder.js` | Đơn xuất kho |
| `/histories` | `be/components/storagehistory.js` | Lịch sử kho |
| `/chips` | `be/components/chip.js` | Tags/chips sản phẩm |
| `/chat` | `be/components/chat.js` | Chat hỗ trợ khách hàng |
| `/zalo` | `be/components/zalo.js` | Cấu hình & OAuth Zalo OA |

---

## 3. XÁC THỰC & PHÂN QUYỀN (AUTH FLOW)

> **QUAN TRỌNG**: Toàn bộ xác thực dùng `httpOnly` cookie, **KHÔNG dùng Authorization header hay Bearer token**.

### Cơ chế JWT
- Token lưu trong cookie tên `authToken`, `httpOnly: true`
- Ký bằng `JWT_SECRET`, thời hạn **12 giờ** (`maxAge: 43_200_000 ms`)
- Cookie `secure: true` khi request qua HTTPS/localtunnel; `sameSite: 'none'` khi secure, `'lax'` khi không
- JWT payload chứa: `{ userId, email, phone, name, role, functions, permissions }`

### 3 middleware xác thực trong `be/components/user.js`
| Middleware | Mô tả |
|---|---|
| `authenticateAdmin` | Verify JWT + DB lookup + reject nếu role là `customer` |
| `authenticateUser` | Verify JWT + attach payload vào `req.user` (không DB lookup) |
| `checkPermission(requiredPermission)` | Verify JWT + DB lookup + check `user.permissions[]`; role `admin` tự bypass |

### Phân quyền Role
| Role | Quyền |
|---|---|
| `admin` | Toàn quyền, bypass mọi `checkPermission` |
| `staff` | Có `functions[]` (vd: `order_management`) và `permissions[]` (vd: `read_order`, `update_order`) |
| `customer` | Chỉ dùng user-facing routes, bị chặn tại admin routes |

---

## 4. CÁC MODEL MONGODB (SCHEMAS)

### User
| Field | Type | Ghi chú |
|---|---|---|
| `phone` | String | required, unique — **dùng làm login identifier** |
| `email` | String | lowercase |
| `name` | String | |
| `password` | String | bcrypt hashed tự động qua pre-save hook |
| `role` | String | enum: `admin`, `staff`, `customer`; default `customer` |
| `functions` | [String] | tags chức năng của staff |
| `permissions` | [String] | quyền chi tiết của staff |
| `cart` | Array | `{ productId, quantity, variantIndex, status }` |
| `orderTemplate` | Array | `{ displayName, products:[{productId, quantity}] }` |
| `station` | [String] | danh sách stationId được giao |
| `addresses` | Array | `{ label, receiverName, receiverPhone, addressDetail, isDefault }` |
| `logInString` | String | chuỗi đăng nhập tùy chỉnh |

### Station
| Field | Type | Ghi chú |
|---|---|---|
| `stationName` | String | |
| `stationCode` | String | required — doubles as `inviteCode` (virtual field) |
| `location` | String | |
| `imgUrl` | String | |
| `allowPublicSignup` | Boolean | default true |
| `productId` | [String] | danh sách product IDs thuộc trạm |

Virtual: `inviteCode` trả về `stationCode`. Helper: `findStationByInviteCode(inviteCode)`.

### Order
| Field | Type | Ghi chú |
|---|---|---|
| `orderCode` | String | unique, auto-increment qua Counter model |
| `userPhone` | String | required |
| `userName` | String | |
| `cartItems` | Array | `{ productId, variantIndex, quantity }` |
| `total` | Number | required |
| `status` | String | enum: `Processing`, `Delivering`, `Completed`; default `Processing` |
| `state` | String | enum: `Processing`, `Cancelled`; default `Processing` |
| `payment` | Boolean | default false |

### ZaloConfig (single-document)
| Field | Type | Ghi chú |
|---|---|---|
| `appId` | String | Zalo App ID |
| `secretKey` | String | Zalo Secret Key (ẩn khi trả về client) |
| `oaId` | String | Official Account ID |
| `recipientUserId` | String | Zalo user ID nhận thông báo đơn hàng |
| `accessToken` | String | OAuth access token |
| `refreshToken` | String | OAuth refresh token |
| `expiresAt` | Date | thời điểm hết hạn access token |

> Giỏ hàng **không có Collection riêng** — lưu trực tiếp vào `user.cart[]`.

---

## 5. SOCKET.IO REALTIME EVENTS

`io` instance được attach vào `app` qua `app.set('io', io)` để các component khác (vd: `order.js`) có thể dùng.

### Server lắng nghe (client emit)
| Event | Payload | Mô tả |
|---|---|---|
| `join_chat` | `{ sessionId }` | Join room `room_<sessionId>` |
| `occupy_session` | `{ sessionId, adminName }` | Khóa session cho admin |
| `leave_session` | `{ sessionId }` | Giải phóng session |
| `send_msg` | `{ sessionId, senderPhone, senderName, senderRole, message }` | Gửi tin, lưu DB, broadcast |
| `disconnect` | — | Tự động giải phóng session đang chiếm giữ |

### Server emit về client
| Event | Scope | Mô tả |
|---|---|---|
| `active_supports_list` | socket cá nhân | Gửi map session đang bị chiếm khi kết nối |
| `server:hello` | socket cá nhân | Handshake xác nhận kết nối |
| `session_occupied` | `io.emit` (broadcast) | Thông báo session bị khóa |
| `session_released` | `io.emit` (broadcast) | Thông báo session được giải phóng |
| `receive_msg` | room `room_<sessionId>` | Tin nhắn mới trong phòng chat |
| `admin_notify_msg` | `io.emit` (broadcast) | Notify tất cả admin có tin nhắn mới |

---

## 6. TÍCH HỢP ZALO OA

### Luồng OAuth (Authorization Code Flow)
1. Admin lưu `appId` + `secretKey` + `oaId` + `recipientUserId` qua `POST /zalo/settings`
2. Admin lấy URL OAuth qua `GET /zalo/auth-url`
3. Server build: `https://oauth.zalo.me/v4/oa/permission?app_id=...&redirect_uri=.../zalo/callback&state=zalo_link`
4. Sau khi user chấp thuận, Zalo redirect về `GET /zalo/callback?code=...&oa_id=...`
5. Server đổi code lấy token tại `https://oauth.zalo.me/v4/oa/access_token`
6. Lưu `accessToken`, `refreshToken`, `expiresAt` vào `ZaloConfig`
7. Redirect trình duyệt về `FRONTEND_URL/admin/zalo?link=success`

### Gửi tin nhắn (`be/zaloService.js`)
- Endpoint: `POST https://openapi.zalo.me/v2.0/oa/message/cs`
- Header: `access_token: <accessToken>`
- Auto-refresh token khi hết hạn hoặc còn dưới 15 phút
- Khi `ZALO_DEMO_MODE=true`: bỏ qua API call, chỉ `console.log` (dùng khi dev)

### Thông báo đơn hàng mới
- Được trigger từ `order.js` khi tạo đơn hàng mới
- Dữ liệu: `{ orderId, userPhone, userName, total, createdAt }`
- Format tiền VND, ngày giờ theo locale `vi-VN` timezone `Asia/Ho_Chi_Minh`
- Nhận thông báo: `ZaloConfig.recipientUserId`

---

## 7. BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

### Backend (`be/.env`)
| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `PORT` | Không | Port server, mặc định `5000` |
| `NODE_ENV` | Không | `development` / `production` / `test` |
| `FRONTEND_URL` | Có | Origin frontend cho CORS và redirect Zalo OAuth |
| `ADDRESS` | Có | URL public (Cloudflare Tunnel) dùng cho CORS và Zalo callback URI |
| `JWT_SECRET` | Có | Khóa ký JWT, phải đủ mạnh và bảo mật |
| `DB_PASSWORD` | Không | Password MongoDB (khai báo nhưng URI hiện dùng localhost không password) |
| `RATE_LIMIT_WINDOW_MS` | Không | Cửa sổ rate limit, mặc định 15 phút |
| `RATE_LIMIT_MAX` | Không | Số request tối đa/cửa sổ, mặc định `100` |
| `PUBLIC_SIGNUP_ENABLED` | Không | `"true"` cho phép đăng ký công khai không cần admin |
| `ZALO_DEMO_MODE` | Không | `"true"` để mock Zalo API khi dev/test |

### Frontend Admin (`ad/.env`)
| Biến | Mô tả |
|---|---|
| `VITE_API_URL` | Base URL của backend API (vd: `http://localhost:5000`) |

### Frontend Client (`fe/.env`)
| Biến | Mô tả |
|---|---|
| `REACT_APP_API_URL` | Base URL của backend API |

---

## 8. QUY TẮC CỐT LÕI: TUÂN THỦ AI AGENT SKILLS

Thư mục `/skills` ở gốc dự án chứa các bộ hướng dẫn thiết kế và phát triển chất lượng cao giúp tránh các lối mòn thiết kế rập khuôn của AI.

> **BẮT BUỘC**: Khi thực hiện bất kỳ thay đổi nào liên quan đến giao diện (UI) hoặc cấu trúc mã nguồn, AI Agent phải đọc `SKILL.md` tương ứng trong `/skills` **trước khi viết code**.

### Các skill cần áp dụng theo ngữ cảnh

| Skill | File | Khi nào dùng |
|---|---|---|
| `design-taste-frontend` | `/skills/design-taste-frontend/SKILL.md` | Mọi thay đổi UI mới |
| `redesign-existing-projects` | `/skills/redesign-existing-projects/SKILL.md` | Nâng cấp giao diện đã có |
| `high-end-visual-design` | `/skills/high-end-visual-design/SKILL.md` | Typography, màu sắc, layout tổng thể |
| `gpt-taste` | `/skills/gpt-taste/SKILL.md` | GSAP animation, cấu trúc trang AIDA, bento grid |
| `image-to-code` | `/skills/image-to-code/SKILL.md` | Chuyển mockup/ảnh thành code |
| `full-output-enforcement` | `/skills/full-output-enforcement/SKILL.md` | **Luôn áp dụng** — cấm cắt code, cấm placeholder |

> **`full-output-enforcement` là bắt buộc cho mọi tác vụ viết code.** Không được viết `// ... rest of code`, `// TODO`, hay bất kỳ dạng placeholder nào. Phải xuất toàn bộ file hoàn chỉnh.

---

## 9. NGUYÊN TẮC VIẾT CODE & SỬA ĐỔI

1. **Bảo toàn Business Logic**: Giữ nguyên toàn bộ comment cũ và hàm xử lý nghiệp vụ nếu không thuộc phạm vi chỉnh sửa yêu cầu.
2. **Không Emoji**: Tuyệt đối không thêm emoji vào mã nguồn, comment hoặc text giao diện, trừ khi có yêu cầu rõ ràng.
3. **Clean Code & Responsive**: Viết mã sạch, chia tách component hợp lý, responsive tốt cho cả Mobile và Desktop.
4. **Không comment thừa**: Chỉ comment khi lý do tồn tại của đoạn code không tự giải thích được từ tên biến/hàm.
5. **Security**:
   - Backend: luôn kiểm tra JWT, validate đầu vào, log lỗi bằng Winston.
   - Không để lộ `secretKey` hay `JWT_SECRET` trong response.
   - Tất cả route admin phải qua `authenticateAdmin` hoặc `authenticateUser` + `checkPermission`.
6. **Performance**: Frontend hạn chế re-render thừa, tối ưu hiệu ứng chuyển động tránh giật lag.
7. **Auth pattern**: Không dùng `localStorage` hay `sessionStorage` cho token — đã dùng `httpOnly` cookie, giữ nhất quán.
8. **Giỏ hàng**: Cart không có collection riêng — luôn thao tác qua `user.cart[]` trên User model.

---

## 10. QUY ƯỚC GIT

- **Branch mặc định**: `main`
- **Branch tính năng**: `feature/<tên-tính-năng>` (vd: `feature/zalo-integration`)
- **Commit**: viết bằng tiếng Việt hoặc tiếng Anh, mô tả rõ phạm vi thay đổi
- Trước khi merge vào `main`, kiểm tra không có `console.log` debug còn sót lại
