require("dotenv").config();
const mongoose = require("mongoose");
const { sendZaloOrderNotification } = require("../zaloService");

const dbName = process.env.DB_NAME || "Ecom";
const mongoUri = `mongodb://localhost:27017/${dbName}`;

console.log(`📡 Đang kết nối tới Database: ${mongoUri}...`);

mongoose.connect(mongoUri)
  .then(async () => {
    console.log("✅ Kết nối Database thành công!");
    
    // Giả lập thông tin đơn hàng để test
    const testOrder = {
      orderId: "TEST_ORDER_12345",
      userPhone: "0987654321",
      userName: "Khách Hàng Thử Nghiệm Zalo",
      total: 1550000, // 1.550.000 đ
      createdAt: new Date(),
    };

    console.log("🔄 Đang chuẩn bị gửi thông báo Zalo...");
    console.log("-----------------------------------------");
    console.log(testOrder);
    console.log("-----------------------------------------");

    await sendZaloOrderNotification(testOrder);

    console.log("🏁 Hoàn thành chạy test script. Nhấn Ctrl+C để thoát.");
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối Database hoặc lỗi thực thi:", err);
    process.exit(1);
  });
