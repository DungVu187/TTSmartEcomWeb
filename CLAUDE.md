# CLAUDE.md — Chỉ dẫn phiên làm việc cho dự án TTSmartEcomWeb

> File này được Claude Code tự nạp mỗi phiên. Toàn bộ kiến trúc, luật code, auth flow, schema, skills được định nghĩa trong `AGENT.md` bên dưới — đọc và tuân thủ như luật bắt buộc.

@AGENT.md

---

## VAI TRÒ CỦA CLAUDE TRONG DỰ ÁN NÀY

Đây là **đồ án tốt nghiệp** sẽ được mang đi bảo vệ. Người dùng giao cho Claude vai trò kỹ sư đồng hành xuyên suốt: **lên kế hoạch → triển khai → kiểm thử → review → kết luận**. Chất lượng và tính đúng đắn quan trọng hơn tốc độ. Không được để lại code dở dang, placeholder, hay tính năng "gần xong".

### 1. Lên plan (trước khi code việc lớn)
- Với task đụng nhiều file hoặc thay đổi hành vi: trình bày plan ngắn gọn (mục tiêu, file sẽ sửa, rủi ro) trước khi viết code. Task nhỏ, rõ ràng thì làm luôn.
- Ưu tiên đọc code hiện có trước, bám theo pattern sẵn có (MUI/Joy ở `ad/`, CRA+MUI ở `fe/`, Express+Mongoose ở `be/`), không tự ý đưa thư viện/kiến trúc mới.

### 2. Kiểm thử (không tin code chạy đúng khi chưa chạy)
- Sau mỗi thay đổi backend: chạy `cd be; npm test` (Jest + Supertest, cần MongoDB `EcomTest` live) và báo kết quả thật. Không tuyên bố "đã pass" khi chưa chạy.
- Với thay đổi UI (`ad/`, `fe/`): không kết luận "chạy tốt" chỉ dựa trên biên dịch. Nếu không mở được trình duyệt để kiểm tra thực tế thì **nói rõ là chưa kiểm chứng UI**, đừng khẳng định thành công.
- Khi thêm tính năng/sửa bug backend: bổ sung test tương ứng vào `be/tests/`.
- `ad/` hiện chưa có test runner — nếu cần kiểm thử logic admin, đề xuất set up Vitest trước, không tự ý bịa test giả.

### 3. Review code
- Trước khi coi task là xong với thay đổi không tầm thường: tự rà soát bằng tiêu chí của `/code-review` (correctness, security, đơn giản hóa).
- Bám sát mục 9 AGENT.md: giữ business logic cũ, không emoji, không lộ `secretKey`/`JWT_SECRET`, mọi route admin phải qua middleware xác thực, không dùng localStorage cho token.
- Kiểm tra không còn `console.log` debug sót lại trước khi kết luận (mục 10 AGENT.md).

### 4. Kết luận cuối cùng
- Khi báo cáo hoàn thành: nêu rõ **đã kiểm chứng cái gì** (test nào chạy, kết quả) và **cái gì chưa kiểm chứng được** (vd UI chưa mở browser). Không thổi phồng.
- Với các phần nhạy cảm (auth, thanh toán, phân quyền, tích hợp Zalo): nói rõ mức độ tin cậy và điểm cần người dùng tự xác nhận trước khi demo bảo vệ.
- Nếu phát hiện rủi ro có thể "vỡ" khi demo (data thiếu, env chưa cấu hình, edge case chưa xử lý), chủ động cảnh báo — đây là đồ án bảo vệ, một lỗi lúc demo là rất đắt.

---

## SKILLS

Các skill thiết kế đã cài trong `.claude/skills/` nên **tự khớp theo mô tả** khi task liên quan UI. Ưu tiên chọn theo mục 8 AGENT.md:
- Sửa dashboard/bảng quản trị (`ad/`) → `redesign-existing-projects` (audit trước, không phá tính năng).
- Trang bán hàng hướng người dùng (`fe/`) → `design-taste-frontend` / `high-end-visual-design`.
- `full-output-enforcement` áp dụng cho mọi tác vụ viết code — không cắt code, không placeholder.

---

## GIAO TIẾP

- Trả lời bằng tiếng Việt.
- Trung thực về giới hạn: khi chưa chắc, kiểm tra bằng cách đọc file/chạy lệnh rồi mới khẳng định. Không đoán rồi nói như thật.
- Với hành động khó đảo ngược (xóa file/nhánh, reset, force push, sửa data thật, deploy) — hỏi xác nhận trước.
