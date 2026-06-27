const { execSync } = require('child_process');

console.log("=================================================");
console.log("   BẮT ĐẦU KIỂM THỬ CHỊU TẢI (LOAD/STRESS TEST)  ");
console.log("   Target URL: http://localhost:5000/products   ");
console.log("=================================================\n");

const runTest = (connections, duration, name) => {
    console.log(`\n>>> [Kịch bản: ${name}] Đang chạy với ${connections} kết nối đồng thời trong ${duration} giây...`);
    try {
        const cmd = `npx autocannon -c ${connections} -d ${duration} --latency --json http://localhost:5000/products`;
        const output = execSync(cmd, { encoding: 'utf-8' });
        const result = JSON.parse(output);

        console.log(`   + Tổng số request đã gửi: ${result.requests.sent}`);
        console.log(`   + Tốc độ trung bình (Req/Sec): ${result.requests.average} req/s`);
        console.log(`   + Băng thông trung bình: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
        console.log(`   + Độ trễ trung bình (Avg Latency): ${result.latency.average} ms`);
        console.log(`   + Độ trễ 50% (P50 Latency): ${result.latency.p50} ms`);
        console.log(`   + Độ trễ 90% (P90 Latency): ${result.latency.p90} ms`);
        console.log(`   + Độ trễ 99% (P99 Latency): ${result.latency.p99} ms`);
        console.log(`   + Số request lỗi/timeout: ${result.errors + result.timeouts}`);
        console.log("-------------------------------------------------");
        return result;
    } catch (error) {
        console.error("Lỗi khi chạy autocannon:", error.message);
        return null;
    }
};

// Chạy tuần tự các cấp độ tải
const level1 = runTest(10, 10, "Tải thường - Baseline");
const level2 = runTest(100, 10, "Tải cao - Stress Test");
const level3 = runTest(300, 10, "Tải cực hạn - Peak Test");

console.log("\n=================================================");
console.log("           TỔNG HỢP KẾT QUẢ KIỂM THỬ             ");
console.log("=================================================");
console.log("| Cấu hình tải  | Kết nối | Tốc độ (Req/Sec) | Độ trễ TB (Latency) | Lỗi |");
console.log("|---------------|---------|------------------|---------------------|-----|");
if (level1) console.log(`| Tải thường    | 10      | ${level1.requests.average.toFixed(1)}            | ${level1.latency.average} ms              | ${level1.errors + level1.timeouts}   |`);
if (level2) console.log(`| Tải cao       | 100     | ${level2.requests.average.toFixed(1)}            | ${level2.latency.average} ms              | ${level2.errors + level2.timeouts}   |`);
if (level3) console.log(`| Tải cực hạn   | 300     | ${level3.requests.average.toFixed(1)}            | ${level3.latency.average} ms              | ${level3.errors + level3.timeouts}   |`);
console.log("=================================================\n");
console.log("Kiểm thử hoàn tất! Dữ liệu chi tiết đã được in ở trên.");
