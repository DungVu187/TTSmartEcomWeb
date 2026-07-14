# CHANGELOG — TTSmartEcomWeb
> **File CHỈ NỐI THÊM (append-only).** Mỗi phiên làm việc ghi 3–5 dòng: đã làm gì, kết quả kiểm thử, rủi ro còn lại.
> KHÔNG ghi diff chi tiết ở đây — chi tiết nằm trong `plan-bangiao-*.md` của từng việc. Hiện trạng mới nhất xem `PROJECT_STATE.md`.
> Ghi mục mới nhất LÊN TRÊN CÙNG (mới → cũ).

---

## [F4-ui-fix2] Can deu cot checkbox bang cap quyen
- `ad/src/components/account.jsx`: them `colgroup` cho bang ma tran quyen.
- `ad/src/components/style/account.css`: dat cung width cho tat ca cot checkbox, gom ca cot `Day du`.
- Test/build: account test va Vite build pass.

---

## [F4-ui-fix] Noi rong bang ma tran cap quyen
- `ad/src/components/account.jsx`: doi dialog cap quyen sang `maxWidth="xl"` va gioi han width responsive de bang co them khong gian ngang.
- `ad/src/components/style/account.css`: toi uu table-layout, padding va do rong cot chuc nang de giam nhu cau keo ngang.
- Test/build: account test va Vite build deu pass.

---

## [F4-ui] Doi form cap quyen sang bang ma tran
- `ad/src/components/account.jsx`: them bang ma tran quyen theo module/action, co cot Day du va checkbox dependency ro rang.
- `ad/src/components/style/account.css`: bo cuc bang gon hon, header co dinh, cot chuc nang sticky va o khong co quyen duoc lam mo.
- Test: cap nhat account test theo checkbox co nhan, giu regression dependency va payload permission.

---

## [History-fix] Goi y bo loc lich su kho theo toan he thong
- `be/components/storagehistory.js`: them `GET /histories/filter-options` tra distinct `userName` va `orderName` tren toan bo StorageHistory.
- `ad/src/components/history.jsx`: hai o goi y Nguoi dung/Ten don hang dung options toan he thong, khong con phu thuoc cac dong dang hien thi.
- Test: bo sung regression cho endpoint filter-options.

---

## [F4-fix] An tai khoan cap cao hon trong Phan quyen
- `be/components/user.js`: `GET /users/all-users` loc danh sach theo cap role; admin khong nhan ve superadmin, superadmin van thay tat ca.
- `ad/src/components/account.jsx`: loc phong ve truoc khi render bang tai khoan trong muc Phan quyen.
- Test: backend role hierarchy cho `/users/all-users`; frontend account khong render row superadmin khi user hien tai la admin.

---

## [F4] Cây phân quyền chi tiết cho trang Phân quyền
- `ad/src/components/account.jsx`: thay bảng quyền cũ theo functions/read-update-delete bằng catalog động từ backend và cây quyền module.action.
- Thiết kế lại dialog theo MUI: lựa chọn role rõ ràng, module grid responsive, chip quyền có trạng thái chọn/disabled/dependency, chọn toàn bộ module.
- Admin hiển thị quyền cố định Phân quyền/Zalo/Lịch sử hoạt động dạng khóa; staff không thấy quyền fixed.
- Bỏ gửi/lưu functions ở giao diện; payload chỉ gửi permission grantable hợp lệ.
- Thêm account.css và test cây quyền: dependency, chọn tất cả, role hierarchy, payload.

---

## [F3] Sidebar hiển thị theo permission
- `ad/src/layout/sidebar.jsx`: dùng usePermissions thay vì tự fetch profile/functions.
- Ẩn/hiện toàn bộ menu theo quyền module.action; nhóm Khách - Trạm hiển thị submenu độc lập theo station.view/customer.view.
- Phân quyền, Zalo và Lịch sử hoạt động chỉ hiện admin/superadmin; Voice và Lịch sử kho theo quyền cấp được.
- Badge/socket đơn bán chỉ hoạt động khi có order.view.
- Thêm test Sidebar theo các tổ hợp quyền tiêu biểu; sửa lại toàn bộ text tiếng Việt bị mất dấu.

---

## [F2] RoleGuard theo permission va cap nhat route admin
- Viet lai `ad/src/components/RoleGuard.jsx` dung usePermissions (F1), prop requiredPermission (string hoac any-of array) va adminOnly, bo tu fetch profile.
- `App.jsx`: chuyen route sang quyen module.action (order/iporder/eporder/product/station/customer/storefront/history/voice), giu account/zalo/activity-log admin-only.
- Cap nhat RoleGuard.test.jsx theo API moi.
- Admin/superadmin van full access toi B6; guard chuan bi cho staff.

---

## [F1] Permission Context dung chung cho admin frontend
- Them `ad/src/context/permissioncontext.jsx`: fetch profile cookie mot lan, expose `can`, `canAny`, `canAll`, role flags va `refreshProfile`.
- `App.jsx`: boc toan bo admin Router bang `PermissionProvider`; chua doi Sidebar/RoleGuard/nut UI.
- Admin tam full access o frontend de dong bo `ADMIN_FULL_ACCESS=true`; se siet theo permissions sau B6.
- Them test context cho superadmin/admin/staff/unauthenticated va refresh profile.

---


## [B5] Validate catalog quyen va chuan bi reset staff
- `be/components/user.js`: bỏ sinh quyền legacy từ functions; chỉ lưu quyền grantable hợp lệ cho admin/staff và kiểm dependency Excel/Quét AI với quyền Sửa.
- Chặn key quyền cũ, key không tồn tại và admin-fixed trong payload; customer/superadmin luôn có permissions/functions rỗng.
- Thêm `be/scripts/reset-staff-permissions.js`: dry-run mặc định, chỉ reset staff khi chạy với `--apply`; chưa chạy migration trên dữ liệu thật.
- Thêm test validation tạo/cập nhật quyền, dependency và regression sửa customer không gửi permissions.
- Giữ `ADMIN_FULL_ACCESS=true`; chưa lật bypass admin (B6).

---

## [F5] Ẩn thao tác admin theo quyền chi tiết
- Hoàn tất gate UI bằng `usePermissions`/`can()` cho chi tiết sản phẩm, đơn nhập, đơn xuất và chi tiết trạm.
- Bảo toàn các gate đã có trên danh mục sản phẩm, chi tiết đơn bán, trạm và khách hàng.
- Thao tác ghi dữ liệu chỉ hiện khi có quyền create/edit/delete tương ứng; Excel và AI cần đồng thời edit cùng quyền bổ sung.
- Quyền xem giữ nguyên dữ liệu đọc, QR, tìm kiếm và dialog xem chi tiết.
- Thêm/cập nhật regression test cho các tổ hợp permission gate.

---

## [B4f-fix] Siết lịch sử hoạt động admin-only
- `be/components/activitylog.js`: đổi `GET /activity-logs` từ `authenticateAdmin` sang lazy `authenticateAdminOnly`.
- Giữ `activitylog.view` là quyền cố định admin/superadmin; staff không xem được lịch sử hoạt động.
- Test: admin 200, staff/customer 403, no-cookie 401 cho `/activity-logs`.

---

## [B4f] Sweep quyền cho station, customer, chip, storagehistory, voice
- `be/components/station.js`: thêm `station.view/create/edit/delete` cho route admin, giữ route public.
- `be/components/user.js` (route khách hàng): `customer.view/edit/delete/assign_station` + `customer.edit` cho rotate-token; giữ nguyên check phân cấp role nội bộ; không đụng account/permissions.
- `be/components/chip.js`: route thêm/xóa hãng/loại/cụm/value dùng `product.create`.
- `be/components/storagehistory.js`: `history.view` cho `GET /`, `GET /:id` và `update-ordername`.
- `be/components/voicevocab.js`: đổi `authenticateAdminOnly` sang `voice.manage` (cấp được cho staff).
- Test: `be/tests/authz_sweep_remainder.test.js` phủ staff có/thiếu quyền 200/403.

---

## [B4e] Sweep quyền storefront cho quản lý banner + hiển thị
- `be/components/manage.js`: đổi toàn bộ route ghi từ `update_product` sang `storefront.manage` (ảnh bìa, đối tác, giới thiệu, chính sách, section1-10).
- Giữ `GET /manages/` public không đổi.
- Test: staff có/thiếu `storefront.manage` (200/403), GET public vẫn 200.

---

## [B4d] Sweep quyền mới cho sản phẩm và scan AI chung
- `be/components/product.js`: đổi route admin từ `update_product`/`delete_product` sang `product.create`, `product.edit`, `product.delete`.
- `be/components/user.js`: thêm `checkAnyPermission()` và dùng cho `/products/scan-invoice` với `order.scan_ai`/`iporder.scan_ai`/`eporder.scan_ai`.
- Gắn `product.edit` cho dọn ảnh tạm; giữ các route GET/public product không đổi vì còn phục vụ storefront.
- Cập nhật test product/scan sang quyền mới và thêm regression staff thiếu quyền bị 403.

---

## [B4c] Sweep quyền mới cho đơn xuất hàng
- `be/components/eporder.js`: đổi route admin từ `read_eporder`/`update_eporder`/`delete_eporder` sang `eporder.view`, `eporder.create`, `eporder.edit`, `eporder.delete`.
- Gắn `eporder.edit` cho upload/xóa ảnh hóa đơn đơn xuất; Excel vẫn là quyền frontend, nhập Excel đi qua `eporder.edit`.
- Cập nhật test đơn xuất sang quyền mới và thêm regression staff thiếu quyền bị 403.
- Chưa xử lý scan AI chung `/products/scan-invoice` (để B4d).

---

## [B4b] Sweep quyền mới cho đơn nhập hàng
- `be/components/iporder.js`: đổi route admin từ `read_iporder`/`update_iporder`/`delete_iporder` sang `iporder.view`, `iporder.create`, `iporder.edit`, `iporder.delete`.
- Gắn `iporder.edit` cho upload/xóa ảnh hóa đơn đơn nhập; Excel vẫn là quyền frontend, nhập Excel đi qua `iporder.edit`.
- Cập nhật test đơn nhập sang quyền mới và thêm regression staff thiếu quyền bị 403.
- Chưa xử lý scan AI chung `/products/scan-invoice` (để B4d).

---

## [B4a] Sweep quyền mới cho đơn bán hàng
- `be/components/order.js`: đổi route admin từ `read_order`/`update_order` sang `order.view`, `order.create`, `order.edit` theo catalog B1.
- Giữ route user/customer-facing (`create-order`, `userOrders`, `/:id`) không đổi; Excel vẫn là quyền frontend, nhập Excel đi qua `order.edit`.
- Cập nhật test order admin sang quyền mới (`order.view/create/edit`) và thêm regression staff thiếu quyền bị 403.
- Chưa xử lý scan AI chung `/products/scan-invoice` (để B4d).

---

## [B3] Endpoint permission-catalog cho frontend
- `be/components/user.js`: thêm `GET /users/permission-catalog` (`authenticateAdminOnly`) trả `{ success, catalog, adminFixed }` từ `config/permissions`.
- Đặt route trước các route động `/:id` để không bị nuốt.
- Test: `be/tests/permission_catalog.test.js` (superadmin/admin 200, staff/customer 403, no-cookie 401, đủ 37 action, `adminFixed` đúng, `dependsOn` `order.excel` -> `order.edit`).
- Chưa đổi tên quyền route (B4).

---

## [B2] Lõi phân quyền tập trung + phân cấp tạo tài khoản
- `be/components/user.js`: thêm `hasPermission()` tập trung, cờ `ADMIN_FULL_ACCESS=true` giữ hành vi admin cũ tới B6, `checkPermission` gọi `hasPermission`.
- Phân cấp tạo tài khoản: staff chỉ tạo customer khi có `customer.create`; chặn staff tạo staff/admin; giữ nguyên admin/superadmin. Siết `/register` và `/admin-create`.
- Chưa đổi tên quyền route (B4), chưa gỡ bypass admin (B6).
- Test: `be/tests/authz_permission_core.test.js` phủ `hasPermission`, phân cấp tạo tài khoản và regression route quyền cũ.

---

## [B1] Thêm catalog phân quyền chi tiết
- Tạo `be/config/permissions.js`: nguồn chân lý cho hệ quyền `module.action`.
- Định nghĩa 9 module cấp được cho staff/admin và 3 module cố định admin (`account`, `zalo`, `activitylog`).
- Thêm dependency: `order`/`iporder`/`eporder` `.excel` và `.scan_ai` phụ thuộc `.edit`.
- Kèm hàm tiện ích: `getAllPermissions`, `getGrantablePermissions`, `getAdminFixedPermissions`, `isValidPermission`, `getPermissionLabel`, `getDependency`, `getCatalogForClient`.
- Chưa đụng `checkPermission`/route để dành cho bước B2, B3.

---

## 2026-07-07 — Codex (nâng cấp đầy đủ trang chi tiết đơn bán admin)
- `be/components/order.js`: bổ sung `images` cho đơn bán, API admin-draft/admin-detail/items/reorder/customer/images, upload/xóa ảnh hóa đơn riêng cho đơn bán với `multer` 5MB, fileFilter ảnh, tự tạo thư mục `upload/invoices`, xóa ảnh idempotent bằng `path.basename`; siết route ghi qua cookie auth + `update_order`, chặn sửa khi đơn `Completed`/`Cancelled`, không lộ stack ở lỗi 500.
- `ad/src/components/order/orderdetail.jsx`: mở rộng trang `/salesorder/:id` với Sao chép đơn, Xuất Excel, Nhập Excel + tải mẫu, Quét hóa đơn AI bản đơn bán, Thêm ảnh thủ công, dải ảnh đính kèm và lightbox; Excel/AI đều merge qua `/orders/:id/items` để tồn kho chỉ đổi theo logic đơn bán, không tạo sản phẩm mới/không sửa giá/không tăng kho.
- `ad/src/components/orders.jsx`, `ad/src/App.jsx`: danh sách đơn bán tạo draft rồi điều hướng sang trang chi tiết, mỗi dòng mở `/salesorder/:id`; dọn warning hook ở các file liên quan và giữ cookie `credentials: "include"`.
- `be/tests/sales_order_detail.test.js`: bổ sung regression cho ảnh đơn bán, upload thiếu file, xóa ảnh thiếu/query traversal/idempotent, khóa ảnh khi Completed/Cancelled, giữ các case draft/items/customer/Completed thiếu SĐT.
- Verify: `cd be && npm test` pass — 21 suites, 110 tests; `cd be && npm test -- sales_order_detail.test.js` pass — 11 tests; `cd ad && npm run build` pass (còn warning chunk lớn cũ của Vite); `cd ad && npx eslint src/components/order/orderdetail.jsx src/components/orders.jsx src/App.jsx` pass; `pm2 restart ttsmart-api` thành công, service online.
- Rủi ro còn lại: `cd ad && npm run lint -- ...` vẫn fail vì script chạy `eslint .` toàn repo và còn nhiều lỗi legacy ngoài phạm vi; chưa mở browser kiểm chứng UI thao tác thực tế, cần hard refresh admin để nạp bundle mới.

---

## 2026-07-07 — Claude (clone layout chi tiết đơn bán giống nhập/xuất + gộp nút + fix 404 deploy)
- Nguyên nhân 404 khi bấm tạo đơn/mở chi tiết: PM2 `ttsmart-api` chạy bản cũ trong bộ nhớ và `ad/dist` là bundle cũ chưa có route `/salesorder/:id`. Đã `npm run build` + `pm2 restart ttsmart-api`; sau restart `POST /orders/admin-draft` và `GET /orders/admin-detail/:id` trả 401 (route sống) thay vì 404.
- `ad/src/components/order/orderdetail.jsx`: viết lại clone bố cục `iporderdetail.jsx` — sticky-header, tiêu đề `Chi tiết đơn bán #orderCode` + Chip trạng thái, hàng Họ tên/SĐT người đặt + nút Lưu, hàng nút Thêm sản phẩm/Xóa đơn, bảng `DndContext` kéo-thả stickyHeader (cột Tên/Hình/Mã/Hãng/Giá/Số lượng/Thành tiền/Xóa), dialog Thêm sản phẩm tìm theo tên/mã, khóa sửa khi Completed/Cancelled. Bỏ AI/Excel/ảnh đính kèm theo yêu cầu.
- `ad/src/components/orders.jsx`: gộp còn 1 nút "Tạo đơn hàng mới" gọi `admin-draft` rồi sang `/salesorder/:id`; mỗi dòng chỉ còn 1 nút "Chi tiết" điều hướng trang chi tiết; dọn dialog tạo đơn cũ + dialog xem read-only + nút "Sửa chi tiết" trùng.
- `be/components/order.js`: `PUT /update-order/:_id` chặn hoàn thành đơn khi `userPhone` rỗng/sai định dạng (`^\d{10,11}$`) → 400. `be/tests/sales_order_detail.test.js`: thêm case chặn Completed thiếu SĐT rồi hoàn thành được sau khi lưu SĐT hợp lệ.
- Verify: `cd be && npm test` pass — 21 suites, 106 tests; `cd ad && npm run build` pass (còn warning chunk lớn cũ của Vite).
- Rủi ro còn lại: chưa mở browser kiểm chứng UI thực tế — cần hard refresh trình duyệt để nạp bundle mới. Đơn nháp rỗng tạo ra hiện ngay trong danh sách + tăng badge processing-count; bỏ dở giữa chừng sẽ để lại đơn rỗng (hệ quả của flow tạo-rỗng-rồi-điền giống nhập/xuất).

---


## 2026-07-07 — Codex (thêm màn hình chi tiết đơn bán hàng admin)
- `be/components/order.js`: thêm API admin cho draft/detail/items/reorder/customer của đơn bán hàng, tính lại total từ giá variant, cập nhật `quantityForSale`, khóa sửa khi đơn `Completed` hoặc `Cancelled`; nới `userPhone` mặc định rỗng cho đơn nháp.
- `ad/src/components/order/orderdetail.jsx`, `ad/src/App.jsx`, `ad/src/components/orders.jsx`: thêm trang `/salesorder/:id`, nút tạo đơn nhập chi tiết, nút sửa chi tiết, luồng thêm/sửa/xóa/kéo-thả sản phẩm và lưu thông tin người đặt bằng cookie `credentials: "include"`.
- `be/tests/sales_order_detail.test.js`: thêm regression cho tạo draft, thêm/sửa/xóa dòng, vượt tồn không đổi DB, validate/lưu số điện thoại.
- Verify: `cd be && npm test` pass — 21 suites, 105 tests; `cd ad && npm run build` pass. `cd ad && npm run lint` vẫn fail do lỗi legacy ngoài phạm vi (172 errors, 29 warnings); lint riêng các file đã sửa không có error, còn 2 warning hook cũ trong `orders.jsx`.
- Rủi ro còn lại: chưa kiểm chứng UI trực tiếp trên trình duyệt; không clone Xuất Excel và đã bỏ toàn bộ phần quét hóa đơn AI theo yêu cầu.

---

## 2026-07-07 — Antigravity (Hoàn tác trang tạo đơn bán hàng mới về trạng thái ban đầu)
- `be/components/order.js`: Khôi phục Schema và các API nguyên bản, loại bỏ các API CRUD admin order mới thêm.
- `ad/src/App.jsx`: Khôi phục các route cũ, loại bỏ route động `/order/:id`.
- `ad/src/components/orders.jsx`: Khôi phục lại Dialog tạo đơn bán hàng offline trực tiếp trên trang quản lý đơn, đổi sự kiện nút "Tạo đơn hàng mới" mở lại Dialog này.
- `ad/src/components/CreateSaleOrder.jsx` & `ad/src/components/SaleOrderDetail.jsx`: Xóa 2 file component trang tạo đơn mới.
- Verify: Chạy build lại thành công, PM2 backend restart thành công về code cũ.

---

## 2026-07-06 — Antigravity (Đồng bộ Đơn bán hàng trực tiếp trên DB giống Nhập/Xuất)
- `be/components/order.js`: Cập nhật Schema `orderSchema` (thêm price, unit, note, status, images, orderName) và bổ sung 10 API CRUD chi tiết đơn bán hàng dành cho admin (tạo nháp, get chi tiết, thêm/sửa/xóa sản phẩm, reorder, status hoàn thành...).
- `ad/src/components/SaleOrderDetail.jsx`: [NEW] Tạo component trang chi tiết đơn bán hàng online trực tiếp trên database bằng cách copy 100% logic và visual từ `ImportOrderDetail.jsx`.
- `ad/src/App.jsx`: Thay thế route tạo đơn `/order/create` bằng route động `/order/:id`.
- `ad/src/components/orders.jsx`: Cập nhật nút "Tạo đơn hàng mới" gọi API tạo đơn nháp trống rồi chuyển hướng sang `/order/:id`.
- Verify: Chạy build thành công.

## 2026-07-06 — Antigravity (Trang tạo đơn bán hàng mới riêng biệt)
- `ad/src/components/CreateSaleOrder.jsx`: [NEW] Tạo component trang tạo đơn bán hàng mới riêng biệt, thiết kế giao diện rộng 1 cột chuẩn hóa đồng bộ 100% giống hệt trang Nhập/Xuất hàng. Tích hợp đầy đủ các tính năng đi kèm: Kéo thả sắp xếp thứ tự sản phẩm bằng dnd-kit, Tải file mẫu Excel, Nhập danh sách sản phẩm từ file Excel (bằng ExcelJS), Xuất Excel đơn bán hàng, cho phép chỉnh sửa đơn giá (NumericFormat), đơn vị, số lượng, ghi chú và checkbox trạng thái trực tiếp trên dòng, gọi API `admin-create-order`.
- `ad/src/App.jsx`: Đăng ký Route `/order/create` bọc trong `RoleGuard` với quyền `order_management`.
- `ad/src/components/orders.jsx`: Sửa nút "Tạo đơn hàng mới" để điều hướng sang trang riêng `/order/create` thay vì mở popup Dialog, xóa bỏ code render Dialog cũ để dọn dẹp tài nguyên.
- Verify: Fix lỗi thiếu import (Dialog, DialogTitle, DialogContent, DialogActions, ArrowBackIcon, Autocomplete) và thiếu định nghĩa hàm handleDownloadTemplate gây crash màn hình trắng khi render trang tạo đơn hàng mới, chạy build lại thành công.

## 2026-07-06 — Antigravity (Ẩn thanh cuộn ngang phụ trên mobile)
- `ad/src/index.css`: Thêm CSS Media Query ẩn `.top-scrollbar-sticky` cho màn hình dưới 768px, khắc phục khoảng trống scrollbar ngang phụ thừa thãi khi xem bảng sản phẩm trên giao diện di động.
- Verify: Build lại thành công.

## 2026-07-06 — Codex (data-driven intent cho voice/text search)
- `be/config/voiceVocab.defaults.js`, `be/components/product.js`: thêm nhóm `intentAliases` cho 4 intent `search_product`, `add_to_cart`, `update_item`, `delete_item`; normalizer ưu tiên intent hợp lệ từ Gemini, nếu thiếu thì tự detect bằng alias trong transcript và vẫn giữ nguyên keyword/filter.
- `be/components/voicevocab.js`, `ad/src/components/voicevocab.jsx`: mở rộng trang/admin API `/voice-vocabs` để quản lý `intentAliases` giống các nhóm alias khác, dùng cookie auth hiện có và không nối hành động thật cho thêm/sửa/xóa giỏ hàng.
- `be/tests/voice_vocab.test.js`: thêm regression DB-free cho round-trip defaults/doc payload, detect intent mặc định, và refresh alias intent mới có hiệu lực ngay.
- Verify: `cd be && npm test` pass — 20 suites, 99 tests; `cd ad && npm run build` pass (còn warning chunk lớn cũ của Vite).
- Rủi ro còn lại: chưa mở browser kiểm thử thủ công tab admin mới; frontend hiện vẫn chỉ đọc dữ liệu tìm kiếm, chưa thực thi lệnh add/update/delete thật theo giọng nói.

## 2026-07-06 — Antigravity (Kiểm thử UI thực tế 4 màn hình nghi ngờ dùng token cũ)
- Màn hình Cấu hình Zalo (`/admin/zalo`): Xác nhận **FAIL** (lỗi tải dữ liệu) do file `ad/src/components/ZaloSettings.jsx` gửi custom header `"auth-token"` bị chặn bởi CORS preflight OPTIONS ở Backend (chỉ cho phép `Content-Type`, `Authorization`, `CSRF-Token`).
- Màn hình `/admin/importorder`, `/admin/orderedproducts`, `/admin/importordertemplate/0`: Xác nhận **OK** (tải dữ liệu bình thường) vì thực tế router `ad/src/App.jsx` nạp các component tương ứng từ thư mục con `ad/src/components/iporder/` đã dùng Cookie chuẩn (`credentials: "include"`, không gửi header `auth-token`). Các file nghi ngờ ngoài thư mục con chỉ là file thừa không sử dụng.
- Màn hình đối chứng Đơn hàng (`/admin/order`): Xác nhận **OK** (tải dữ liệu bình thường).
- Verify: Chạy script Puppeteer tự động hóa login admin (`0813158383` / `0813158383`) kiểm thử thực tế thành công.
- Rủi ro còn lại: File `ZaloSettings.jsx` cần loại bỏ custom header và dùng Cookie đồng bộ.

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
