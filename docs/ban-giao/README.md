# Bộ tài liệu bàn giao TTSmartEcomWeb

## 1. Mục đích

Bộ tài liệu này phục vụ người tiếp nhận dự án sau khi kết thúc giai đoạn phát triển hiện tại. Nội dung trả lời năm câu hỏi chính:

1. Người dùng và quản trị viên sử dụng hệ thống như thế nào?
2. Cài đặt, triển khai và rollback server ra sao?
3. Cần kiểm thử những gì trước mỗi lần phát hành?
4. Server đang được tổ chức thế nào và phải bảo trì theo lịch nào?
5. Source code đã đủ sạch để bàn giao chưa, còn nợ kỹ thuật gì?

## 2. Phạm vi và mốc audit

- Ngày audit: `2026-07-15`, múi giờ `Asia/Bangkok`.
- Branch tại thời điểm audit: `dev`.
- Commit nền: `2bad06d`.
- Audit được thực hiện trên working tree hiện tại, bao gồm các thay đổi chưa commit. Trước khi phát hành phải tạo commit/release tag rõ ràng và chạy lại toàn bộ checklist.
- Không ghi giá trị secret từ các file `.env` vào tài liệu.

## 3. Danh mục tài liệu

| Tài liệu | Đối tượng đọc | Nội dung chính |
|---|---|---|
| [Hướng dẫn sử dụng](HUONG_DAN_SU_DUNG.md) | Khách hàng, admin, staff, người đào tạo | Luồng sử dụng theo vai trò, quy tắc thao tác kho và xử lý sự cố thường gặp |
| [Triển khai và vận hành](TRIEN_KHAI_VAN_HANH.md) | DevOps, backend developer, người quản trị server | Kiến trúc runtime, env, build, reverse proxy, service, backup, rollback và runbook |
| [Test plan](TEST_PLAN.md) | QA, developer, người duyệt release | Baseline hiện tại, ma trận test tự động/thủ công, tiêu chí vào/ra và báo cáo release |
| [Bảo trì và chất lượng source](BAO_TRI_VA_CHAT_LUONG_SOURCE.md) | Tech lead, maintainer, chủ dự án | Đánh giá maintainability, nợ kỹ thuật, lịch bảo trì và lộ trình làm sạch |

## 4. Kết luận điều hành

| Hạng mục | Đánh giá | Kết luận |
|---|---|---|
| Chức năng chính | Khá đầy đủ | Có sản phẩm, đơn bán, nhập/xuất kho, trạm, phân quyền, AI scan và tích hợp thông báo |
| Backend test | Chưa xanh hoàn toàn | 243/245 test pass; còn hai lỗi nghiệp vụ tồn kho |
| Admin test/build | Tốt có cảnh báo | 49/49 test pass; lint 0 lỗi/30 warning; production build pass |
| Website khách hàng | Thiếu lớp bảo vệ regression | Build pass có warning; chưa có test tự động |
| Triển khai production | Chưa hoàn chỉnh | Không có CI/CD, process manager, reverse proxy, health endpoint hoặc cấu hình log production trong repo |
| Dữ liệu và backup | Có nền tảng nhưng chưa đủ | Có script `mongodump` Windows, nhưng hardcode đường dẫn/default DB và chưa chứng minh restore/off-host định kỳ |
| Chất lượng source | Bàn giao được có điều kiện | Cấu trúc ba app rõ, nhưng còn file rất lớn, source legacy, warning và cấu hình vận hành chưa chuẩn hóa |

Quyết định khuyến nghị: chỉ phát hành production sau khi hoàn tất toàn bộ mục P0 trong [Bảo trì và chất lượng source](BAO_TRI_VA_CHAT_LUONG_SOURCE.md#4-danh-sách-ưu-tiên).

## 5. Nguồn sự thật khi tiếp nhận

Khi tài liệu mâu thuẫn với nhau, dùng thứ tự ưu tiên sau:

1. Code và test tại release tag đang triển khai.
2. Bộ tài liệu trong `docs/ban-giao/` có cùng ngày release.
3. `BUG_TRACKING.md` cho danh sách lỗi đang theo dõi.
4. `PROJECT_STATE.md` và `CHANGELOG.md` để tham khảo lịch sử; không dùng số test cũ làm tiêu chí release.

## 6. Checklist bàn giao con người

- [ ] Bàn giao tài khoản `superadmin` bằng kênh an toàn; không gửi mật khẩu trong Git/chat công khai.
- [ ] Bàn giao quyền quản trị domain, TLS, DNS và reverse proxy.
- [ ] Bàn giao quyền MongoDB, vị trí backup, khóa mã hóa backup và tài liệu restore.
- [ ] Bàn giao các secret của JWT, Gmail, Gemini, Zalo và Telegram qua secret manager.
- [ ] Bàn giao tài khoản/owner của Zalo OA và Telegram Bot.
- [ ] Ghi rõ server, hệ điều hành, IP private/public, port, firewall và người trực vận hành.
- [ ] Chạy một buổi restore backup và một buổi rollback release có người tiếp nhận tham gia.
- [ ] Chốt danh sách issue mở, owner và thời hạn xử lý.
