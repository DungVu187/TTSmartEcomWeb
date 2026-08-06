// Nguồn từ vựng mặc định cho tính năng tìm kiếm bằng giọng nói.
//
// Đây là NGUỒN SỰ THẬT DUY NHẤT cho cả 2 nhánh xử lý trong product.js:
//   1. Nhánh regex fallback (dùng cho text mode và khi Gemini parse lỗi):
//      SEARCH_STOPWORDS, VOICE_BRANDS, VOICE_TYPES, VOICE_BRAND_ALIASES,
//      VOICE_TYPE_ALIASES, detectVoiceCode.
//   2. Nhánh Gemini (voice thật): 2 dòng danh sách thương hiệu/loại + khối
//      alias gợi ý trong system prompt được SINH ĐỘNG từ chính dữ liệu này.
//
// Muốn dạy AI thêm 1 hãng/1 cách đọc lóng mới: chỉ cần sửa ở đây, cả 2 nhánh
// đều học được (Giai đoạn 2 sẽ cho phép sửa qua trang admin, seed lần đầu từ file này).
//
// LƯU Ý: giá trị dưới đây copy NGUYÊN VĂN từ các hằng số cũ trong product.js
// để refactor không làm đổi hành vi (91 test phải pass y như trước).

// Các từ dẫn/nghi vấn thường đứng đầu hoặc cuối câu nói, không phải thực thể sản phẩm.
// Chỉ bóc khi nằm ở BIÊN (đầu/cuối) để không cắt nhầm từ giữa cụm mô tả.
const stopwords = [
    'tim', 'kiem', 'timkiem', 'cho', 'toi', 'xem', 'gia', 'la', 'bao', 'nhieu',
    'con', 'hang', 'khong', 'co', 'san', 'pham', 'sanpham', 'giup', 'minh',
    'cai', 'chiec', 'the', 'nao', 'oi', 'nhe', 'nha', 'vay', 'hoi', 'kiem'
];

const brands = [
    'Airtac', 'Autonics', 'Chaofan', 'Delta', 'Frecon', 'Giga', 'Goldcup',
    'Haitima', 'Hanyoung', 'Idec', 'Keli', 'Kinco', 'Mitsubishi', 'Nass',
    'Omron', 'Parker', 'STNC', 'SangA', 'Sangjin', 'Schneider', 'Selec',
    'Siemens', 'Taiwan', 'VEICHI'
];

const types = [
    'Aptomat', 'Biến tần', 'Biến áp cách ly', 'Bảo Vệ Mất, Ngược Pha',
    'Bộ lọc khí', 'Contactor', 'Cảm biến', 'Cầu Đấu', 'Dây điện', 'Loadcell',
    'Lọc bụi', 'Nguồn', 'Nút Nhấn', 'PLC', 'Phụ kiện khí nén', 'Relay Nhiệt',
    'Relay Thời Gian', 'Relay Trung Gian', 'TI', 'Van khí nén', 'Van điện từ',
    'Xy lanh khí nén', 'Đèn', 'Đồng Hồ'
];

// Mỗi phần tử: [tên chuẩn, [các cách đọc lóng đã bỏ dấu]]
const brandAliases = [
    ['Siemens', ['siemens', 'simens', 'xi men', 'si men']],
    ['Mitsubishi', ['mitsubishi', 'mit su bi shi', 'mit subishi', 'mit su']],
    ['Omron', ['omron', 'om ron', 'om rong']],
    ['VEICHI', ['veichi', 've chi', 'v e i c h i']],
    ['Autonics', ['autonics', 'au tonics', 'en to net']],
    ['Schneider', ['schneider', 'schnider', 's nai der']],
    ['Delta', ['delta', 'den ta']],
    ['Idec', ['idec', 'i dec']],
    ['Kinco', ['kinco', 'kin co']],
    ['Airtac', ['airtac', 'air tac']],
    ['Parker', ['parker', 'pa ker']],
    ['Selec', ['selec', 'se leck']],
    ['Hanyoung', ['hanyoung', 'han young']],
    ['Haitima', ['haitima', 'hai ti ma']],
    ['Frecon', ['frecon', 'fre con']],
    ['STNC', ['stnc', 's t n c']],
    ['SangA', ['sanga', 'sang a']],
    ['Sangjin', ['sangjin', 'sang jin']],
    ['Goldcup', ['goldcup', 'gold cup']],
    ['Chaofan', ['chaofan', 'chao fan']],
    ['Giga', ['giga', 'gi ga']],
    ['Keli', ['keli', 'ke li']],
    ['Nass', ['nass', 'nas']],
    ['Taiwan', ['taiwan', 'dai loan']]
];

// Mỗi phần tử: [tên loại chuẩn, keyword tìm kiếm, [các cách gọi dân dã đã bỏ dấu]]
const typeAliases = [
    ['Aptomat', 'Aptomat', ['at', 'at to mat', 'ap to mat', 'aptomat', 'cau dao tu dong']],
    ['Contactor', 'Contactor', ['khoi', 'khoi dong tu', 'cong tac to', 'contactor']],
    ['Biến tần', 'biến tần', ['bien tan', 'inverter', 'bo bien tan']],
    ['Cảm biến', 'cảm biến', ['cam bien', 'sensor', 'thiet bi cam bien']],
    ['Nút Nhấn', 'nút nhấn', ['nut nhan', 'nut bam']],
    ['Nguồn', 'nguồn', ['nguon', 'nguon to ong', 'nguon xung']],
    ['PLC', 'PLC', ['plc', 'bo dieu khien', 'bo lap trinh']],
    ['Relay Trung Gian', 'relay trung gian', ['ro le trung gian', 'relay trung gian']],
    ['Relay Thời Gian', 'relay thời gian', ['ro le thoi gian', 'relay thoi gian', 'timer']],
    ['Relay Nhiệt', 'relay nhiệt', ['ro le nhiet', 'relay nhiet']],
    ['TI', 'TI', ['ti']],
    ['Đèn', 'đèn', ['den bao', 'den chi thi', 'den']],
    ['Xy lanh khí nén', 'xy lanh', ['xi lanh khi nen', 'xy lanh khi nen', 'ty ben']]
];

// Mã model đặc thù thuộc duy nhất một hãng. detectVoiceCode duyệt danh sách này:
//   - patterns: các regex (dạng chuỗi, không cờ) test trên chuỗi đã bỏ dấu (normalized),
//     gồm cả biến thể số đọc tiếng Việt ("s7 muoi hai tram").
//   - compact: chuỗi con test trên bản đã bỏ hết khoảng trắng.
// Giữ y hệt logic cũ để không đổi hành vi.
const codeMap = [
    { code: 'FX3U', keyword: 'FX3U', brand: 'Mitsubishi', type: 'PLC', patterns: ['\\bfx\\s*3\\s*u\\b'], compact: 'fx3u' },
    { code: 'FX5U', keyword: 'FX5U', brand: 'Mitsubishi', type: 'PLC', patterns: ['\\bfx\\s*5\\s*u\\b'], compact: 'fx5u' },
    { code: 'S7-1200', keyword: 'S7-1200', brand: 'Siemens', type: 'PLC', patterns: ['\\bs\\s*7\\s*[- ]?\\s*1200\\b', '\\bs7\\s*muoi\\s*hai\\s*tram\\b'], compact: 's71200' },
    { code: 'S7-1500', keyword: 'S7-1500', brand: 'Siemens', type: 'PLC', patterns: ['\\bs\\s*7\\s*[- ]?\\s*1500\\b', '\\bs7\\s*muoi\\s*lam\\s*tram\\b'], compact: 's71500' },
    { code: 'GPC1202', keyword: 'khớp nối GPC1202', brand: null, type: null, patterns: ['\\bg\\s*p\\s*c\\s*[- ]?\\s*1202\\b', '\\bgpc\\s*muoi\\s*hai\\s*khong\\s*hai\\b'], compact: 'gpc1202' }
];

// Mỗi phần tử: [intentId, nhãn hiển thị, [các cách nói đã bỏ dấu]]
const intentAliases = [
    ['search_product', 'Tìm kiếm', ['tim', 'kiem', 'tra', 'tra cuu', 'xem', 'coi', 'luc', 'tim kiem', 'search']],
    ['add_to_cart', 'Thêm', ['them', 'bo sung', 'cho them', 'them vao', 'add', 'cho vao', 'nap them']],
    ['update_item', 'Sửa', ['sua', 'cap nhat', 'chinh', 'chinh sua', 'doi', 'thay doi', 'edit', 'update']],
    ['delete_item', 'Xóa', ['xoa', 'bo', 'loai bo', 'huy', 'xoa bo', 'delete', 'remove']],
    ['export_history', 'Xuất Excel lịch sử', ['xuat excel lich su', 'xuat file excel lich su', 'tai excel lich su']]
];

module.exports = {
    stopwords,
    brands,
    types,
    brandAliases,
    typeAliases,
    codeMap,
    intentAliases
};
