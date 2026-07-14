# BUG TRACKING — TTSmartEcomWeb

> File kiểm soát bug của đợt audit/bug-sweep. Cập nhật mỗi khi fix xong một mục.
> Quy trình: assistant viết PROMPT cho Codex (Codex là người sửa code), review, chạy test rồi mới đánh dấu DONE.
> Ngày khởi tạo: 2026-07-13.

## Quy ước trạng thái
- `[x] DONE` — đã fix + đã kiểm chứng (test/UI). Ghi rõ kiểm chứng bằng gì.
- `[ ] TODO` — chưa fix, đã xác nhận còn tồn tại trong code.
- `[?] REVIEW` — cần rà lại xem còn tồn tại hay đã fix kèm nhóm khác.

---

## 1. CRITICAL — đã xong

- [x] **BUG-1** — Dashboard thiếu optional chaining gây crash khi data rỗng.
  - Kiểm chứng: test backend pass.
- [x] **BUG-2** — `ad/src/components/products.jsx` thiếu guard cho `setProducts` (mảng rỗng/undefined).
  - Kiểm chứng: test backend pass.
- [x] **BUG-3** — Dồn logic trừ/cộng kho về backend cho eporder + iporder (trước đây FE tự tính rồi gọi `/products/:id/0`).
  - Kiểm chứng: test backend 191/191 pass; đã bỏ hết lời gọi `/products/:id/0` phía FE (grep = 0).

---

## 2. Thay đổi hành vi kho (đã xong, theo yêu cầu)

- [x] **Checkbox hoàn thành = KHÓA MỘT CHIỀU** cho cả eporder + iporder.
  - Tick vào là khóa, không cho bỏ tích ngược (sếp chưa duyệt cho revert). Đã bỏ toàn bộ logic hoàn kho khi bỏ tích.
  - Nếu sau này sếp đồng ý cho untick: mở lại nhánh revert + bỏ `disabled` trên checkbox.
- [x] **Thêm field `source` (enum) vào StorageHistory** để tách 3 hành động trong đơn: gõ tay lẻ / tích hoàn thành SP lẻ / hoàn thành cả đơn.
  - Enum: `order_line_manual`, `order_line_complete`, `order_bulk_complete`, `product_manual`, `online_sale`, `online_sale_revert`; `default: undefined` để data cũ fallback theo `note`.
  - Bonus: vá lỗ hổng eporder bulk-complete trước đây KHÔNG ghi sổ kho.
  - Kiểm chứng: test backend 191/191 pass + có test riêng `storagehistory.test.js`.
- [x] **Nút xóa dòng đơn**: GIỮ NGUYÊN `disabled={product.quantityEx > 0}` — đây là logic gốc công ty (commit initial 6713f82), KHÔNG đổi.

---

## 3. Tính năng Telegram (Phase 1) — đã xong + kiểm chứng thật

- [x] **Thông báo đơn hàng mới qua Telegram Bot**.
  - Backend: `be/telegramService.js` + `be/components/telegram.js` (model + 6 route đều `authenticateAdminOnly`), mount `/telegram`, wire vào `order.js` sau Zalo có `.catch()`.
  - Frontend: `ad/src/components/TelegramSettings.jsx`, menu cha "Cấu hình tự động" (Zalo OA + Telegram tách riêng).
  - Bảo mật: không log token, GET /settings chỉ trả `botConfigured` (true/false), escapeHtml chống injection.
  - Kiểm chứng: test backend 194/194 pass + ĐÃ TEST THẬT — gửi thử OK, tạo đơn TSM-48 nhận noti đúng format (tổng tiền, trạm, thời gian vi-VN).
  - Sẵn cho Phase 2 (group HN/SG): chỉ cần thêm recipient qua UI với `type: group`, chatId âm — không phải sửa code.

---

## 4. HIGH — CHƯA FIX (đã xác nhận còn trong code 2026-07-13)

- [ ] **BUG-4** — `be/components/product.js` route `PUT /:id/:variantIndex` (~1448).
  - Vấn đề: `product.variant[index] = {...product.variant[index], ...variantData}` — spread subdoc Mongoose làm mất/ghi đè field kho (`quantityInStorage`, `quantityForSale`) khi `variantData` không kèm các field đó. Còn nguy cơ gán nhầm cả field nội bộ Mongoose.
  - Fix đề xuất: `Object.assign(product.variant[index], variantData)` hoặc gán từng field cho phép sửa; TUYỆT ĐỐI không đụng field kho ở route sửa variant.
  - Mức độ: cao — ghi sai tồn kho.

- [ ] **BUG-5** — spread subdoc ở `PUT /orders/:id/products/:productIndex`.
  - Vị trí: `be/components/eporder.js` (~586) và `be/components/iporder.js` (~570): `order.productList[i] = {...order.productList[i], ...req.body}`.
  - Vấn đề: spread subdoc mất field data của subdoc; hiện CHƯA vỡ vì FE gửi full object nhưng là bom hẹn giờ.
  - Fix đề xuất: dùng `.toObject()` trước khi spread, hoặc gán từng field.
  - Mức độ: cao (tiềm ẩn).

- [ ] **BUG-6** — Race condition trừ kho không atomic.
  - Vấn đề: hoàn thành đơn (xuất) + đơn bán online trừ cùng một variant đồng thời không atomic → có thể trừ đè, sai số lượng kho. Nguy hiểm nhất khi web nhiều người dùng đồng thời.
  - Fix đề xuất: dùng update atomic (`findOneAndUpdate` với điều kiện `$gte` số lượng + `$inc`) thay cho read-modify-save; đánh giá kỹ trước khi sửa vì đụng nhiều luồng.
  - Mức độ: cao — sai số liệu kho, khó phát hiện.

- [ ] **BUG-7** — `ad/src/components/stationdisplay.jsx` DataGrid (~535).
  - Vấn đề: dùng `pageSize={5}` / `rowsPerPageOptions` (API x-data-grid v5, v7 đã đổi sang `initialState.pagination.paginationModel` + `pageSizeOptions`) và không có chiều cao/`autoHeight` → bảng có thể không hiện hoặc cao 0px.
  - Fix đề xuất: bọc container có chiều cao cố định hoặc thêm `autoHeight`, đổi prop phân trang sang chuẩn v7.
  - Mức độ: trung bình (hiển thị) — nhưng dễ vỡ lúc demo.

---

## 5. MEDIUM / LOW — cần rà lại (từ bug-sweep, chưa xác nhận trạng thái hiện tại)

> Các mục dưới ghi nhận từ đợt sweep trước; MỘT SỐ có thể đã được fix kèm nhóm CRITICAL. Cần verify code hiện tại trước khi ra prompt.

- [?] **BUG-8** — Cart tính tổng ra `NaN` khi price/quantity không hợp lệ.
- [?] **BUG-9** — `variantIndex` mismatch kiểu (string vs number) khi so sánh/tra cứu.
- [?] **BUG-10** — iporder complete cộng kho (khả năng đã xử trong BUG-3, cần xác nhận).
- [?] **BUG-11** — `products.jsx` double-fetch (gọi API 2 lần khi mount).
- [?] **BUG-12** — Pagination `count`/`totalPages` lệch khi có bộ lọc.
- [?] **BUG-13..18** — các mục còn lại trong transcript sweep (chưa trích xuất chi tiết). Cần đọc lại transcript/khảo sát code khi tới lượt.

---

## 6. Việc về DATA (đụng data thật — phải hỏi kỹ + backup TRƯỚC khi chạy)

- [ ] **Migrate `source` cho lịch sử kho cũ**: bản ghi StorageHistory cũ không có `source`, không tách được 3 loại trong đơn. Muốn chuẩn hóa phải đoán từ `note`. Data cũ HIỆN vẫn hiển thị đúng qua fallback + option lọc cũ (không mất mát) — chưa gấp.
- [ ] **Dọn rác dòng `quantity: 0`**: các bản ghi StorageHistory số lượng 0 sinh từ bug cũ (bấm ô đã tích). Bug đã bị chặn phát sinh mới; dòng cũ vẫn còn trong DB.

---

## 7. Chưa kiểm chứng UI (cần bấm browser trước demo/lên production)

- [ ] Tick hoàn thành đơn nhập/xuất → kho đổi đúng chiều, ô khóa lại.
- [ ] Bấm lại ô đã tích → KHÔNG sinh dòng StorageHistory `0`.
- [ ] Trang Lịch sử kho: lọc từng option mới đúng nhóm; data cũ vẫn hiện.
- [ ] Trang StationDisplay: bảng DataGrid có hiện sản phẩm không (liên quan BUG-7).

---

## 8. Checklist ENV production (không phải code — dễ vỡ nhất khi rời localhost)

- [ ] MongoDB: đổi từ `localhost` không password sang DB thật CÓ auth.
- [ ] `JWT_SECRET`: chuỗi mạnh thật (không dùng giá trị dev).
- [ ] `NODE_ENV=production`; cookie `secure: true` chỉ chạy khi có HTTPS thật.
- [ ] `ADDRESS` / `FRONTEND_URL`: trỏ domain thật (CORS + Zalo callback + redirect).
- [ ] `TELEGRAM_BOT_TOKEN` đã có trong `be/.env` (KHÔNG commit — `.env` đã trong `.gitignore`).
- [ ] Dọn `debug.log` (log crashpad, không phải file dự án) khỏi git trước khi commit.
