// Thiết lập biến môi trường cho Jest TRƯỚC khi require các module.
// Quan trọng: `index.js` chỉ kết nối MongoDB và lắng nghe yêu cầu khi `NODE_ENV !== 'test'`.
// Đặt NODE_ENV=test ở đây để require('../index') không chiếm port 5000 và
// không connect DB thật (test file tự connect tới DB test EcomTest).
process.env.NODE_ENV = 'test';
