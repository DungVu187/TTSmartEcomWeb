const voiceVocabDefaults = require('../config/voiceVocab.defaults');
const { removeVietnameseTones } = require('../utils/textNormalization');
const { registerVoiceVocabRefresher } = require('./voiceVocabRuntime');

// Các từ dẫn/nghi vấn thường đứng đầu hoặc cuối câu nói, không phải thực thể sản phẩm.
// Chỉ bóc khi nằm ở BIÊN (đầu/cuối) để không cắt nhầm từ giữa cụm mô tả.
// Khởi tạo từ nguồn chung (voiceVocab.defaults). refreshVoiceVocab() có thể nạp
// lại từ DB khi admin sửa qua trang quản trị mà không cần restart.
let SEARCH_STOPWORDS = new Set(voiceVocabDefaults.stopwords);

// Bóc stopword ở đầu và cuối chuỗi tìm kiếm, trả về mảng token thực thể còn lại.
function stripSearchStopwords(search) {
    const raw = String(search || '').split(/\s+/).filter(Boolean);
    let start = 0;
    while (start < raw.length && SEARCH_STOPWORDS.has(removeVietnameseTones(raw[start]).toLowerCase())) {
        start++;
    }
    let tokens = raw.slice(start);
    while (tokens.length > 0 && SEARCH_STOPWORDS.has(removeVietnameseTones(tokens[tokens.length - 1]).toLowerCase())) {
        tokens = tokens.slice(0, -1);
    }
    return tokens;
}

// Khởi tạo từ nguồn chung (voiceVocab.defaults). Dùng `let` để refreshVoiceVocab()
// nạp lại được từ DB khi admin sửa qua trang quản trị mà không cần restart server.
let VOICE_BRANDS = voiceVocabDefaults.brands.slice();
let VOICE_TYPES = voiceVocabDefaults.types.slice();
let VOICE_BRAND_ALIASES = voiceVocabDefaults.brandAliases.map(([b, a]) => [b, a.slice()]);
let VOICE_TYPE_ALIASES = voiceVocabDefaults.typeAliases.map(([t, k, a]) => [t, k, a.slice()]);
let VOICE_CODE_MAP = voiceVocabDefaults.codeMap.map(c => ({ ...c, patterns: (c.patterns || []).slice() }));
let VOICE_INTENT_ALIASES = voiceVocabDefaults.intentAliases.map(([id, label, a]) => [id, label, (a || []).slice()]);
const VALID_INTENTS = ['search_product', 'add_to_cart', 'update_item', 'delete_item'];

// Nạp lại toàn bộ từ vựng voice lúc runtime (Giai đoạn 2 gọi khi admin sửa qua DB).
// Chỉ ghi đè nhóm nào được truyền vào; nhóm thiếu giữ nguyên giá trị hiện tại.
// Nhờ vậy cả nhánh regex fallback lẫn prompt Gemini (sinh động từ các biến này)
// đều dùng vocab mới ngay, không cần restart server.
function applyVoiceVocab(vocab = {}) {
    if (Array.isArray(vocab.stopwords)) {
        SEARCH_STOPWORDS = new Set(vocab.stopwords);
    }
    if (Array.isArray(vocab.brands)) {
        VOICE_BRANDS = vocab.brands.slice();
    }
    if (Array.isArray(vocab.types)) {
        VOICE_TYPES = vocab.types.slice();
    }
    if (Array.isArray(vocab.brandAliases)) {
        VOICE_BRAND_ALIASES = vocab.brandAliases.map(([b, a]) => [b, (a || []).slice()]);
    }
    if (Array.isArray(vocab.typeAliases)) {
        VOICE_TYPE_ALIASES = vocab.typeAliases.map(([t, k, a]) => [t, k, (a || []).slice()]);
    }
    if (Array.isArray(vocab.codeMap)) {
        VOICE_CODE_MAP = vocab.codeMap.map(c => ({ ...c, patterns: (c.patterns || []).slice() }));
    }
    if (Array.isArray(vocab.intentAliases)) {
        VOICE_INTENT_ALIASES = vocab.intentAliases.map(([id, label, a]) => [id, label, (a || []).slice()]);
    }
}

registerVoiceVocabRefresher(applyVoiceVocab);

function normalizeVoiceText(str) {
    return removeVietnameseTones(String(str || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function phraseRegex(phrase) {
    const escaped = normalizeVoiceText(phrase)
        .split(' ')
        .filter(Boolean)
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+');
    return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, 'i');
}

function detectVoiceCode(text) {
    const normalized = normalizeVoiceText(text);
    const compact = normalized.replace(/\s+/g, '');

    // Duyệt danh sách mã model (VOICE_CODE_MAP) theo thứ tự: khớp nếu bất kỳ
    // pattern nào (test trên chuỗi đã bỏ dấu) khớp, hoặc compact chứa chuỗi con.
    for (const entry of VOICE_CODE_MAP) {
        const patternHit = (entry.patterns || []).some(p => new RegExp(p, 'i').test(normalized));
        const compactHit = entry.compact ? compact.includes(entry.compact) : false;
        if (patternHit || compactHit) {
            return {
                code: entry.code,
                keyword: entry.keyword,
                brand: entry.brand ?? null,
                type: entry.type ?? null
            };
        }
    }

    const rawMatch = String(text || '').match(/\b([A-Za-z]{1,5})[-\s]?(\d{2,5})([A-Za-z]{0,3})\b/);
    if (rawMatch) {
        const code = `${rawMatch[1]}${rawMatch[2]}${rawMatch[3] || ''}`.toUpperCase();
        if (!VOICE_BRANDS.some(brand => brand.toUpperCase() === code)) {
            return { code, keyword: code, brand: null, type: null };
        }
    }

    return null;
}

function findVoiceBrand(text) {
    const normalized = normalizeVoiceText(text);

    for (const brand of VOICE_BRANDS) {
        if (phraseRegex(brand).test(normalized)) {
            return brand;
        }
    }

    for (const [brand, aliases] of VOICE_BRAND_ALIASES) {
        if (aliases.some(alias => phraseRegex(alias).test(normalized))) {
            return brand;
        }
    }

    return null;
}

function findVoiceType(text) {
    const normalized = normalizeVoiceText(text);

    if (/\bh\s*m\s*i\b/.test(normalized) || phraseRegex('man hinh hmi').test(normalized) || phraseRegex('man hinh cam ung').test(normalized)) {
        return { type: null, keyword: /\bh\s*m\s*i\b/.test(normalized) ? 'HMI' : 'màn hình' };
    }

    for (const [type, keyword, aliases] of VOICE_TYPE_ALIASES) {
        if (aliases.some(alias => phraseRegex(alias).test(normalized))) {
            return { type, keyword };
        }
    }

    return { type: null, keyword: null };
}

function detectVoiceIntent(text) {
    const normalized = normalizeVoiceText(text);

    for (const [intentId, , aliases] of VOICE_INTENT_ALIASES) {
        if (!VALID_INTENTS.includes(intentId)) continue;
        if ((aliases || []).some(alias => phraseRegex(alias).test(normalized))) {
            return intentId;
        }
    }

    return 'search_product';
}

function cleanVoiceKeyword(keyword, brand) {
    let cleaned = String(keyword || '').trim();
    if (!cleaned || !brand) return cleaned;

    const aliases = [brand, ...(VOICE_BRAND_ALIASES.find(([name]) => name === brand)?.[1] || [])];
    for (const alias of aliases) {
        cleaned = cleaned.replace(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
}

function normalizeVoiceQueryResult(raw = {}) {
    const filters = raw.filters && typeof raw.filters === 'object' ? raw.filters : {};
    const transcript = String(raw.transcript || '').trim();
    const probeText = [transcript, raw.keyword, filters.code].filter(Boolean).join(' ');

    const codeInfo = detectVoiceCode(probeText);
    const brandProbeText = transcript || String(raw.keyword || '');

    // Ưu tiên brand suy ra từ mã máy rồi tới regex quét trên transcript; chỉ dùng brand
    // do Gemini đưa (filters.brand) khi không có transcript, tránh brand "ảo" AI tự thêm
    const rawBrand = VOICE_BRANDS.includes(filters.brand) ? filters.brand : null;
    const detectedBrand = findVoiceBrand(brandProbeText);
    const brand = codeInfo?.brand || detectedBrand || (!transcript ? rawBrand : null);

    // Ưu tiên Type từ Gemini AI, nếu không có mới dùng Regex
    const typeInfo = findVoiceType(probeText);
    const rawType = VOICE_TYPES.includes(filters.type) ? filters.type : null;
    const type = rawType || codeInfo?.type || typeInfo.type;

    const code = codeInfo?.code || (typeof filters.code === 'string' && filters.code.trim() ? filters.code.trim().toUpperCase() : null);

    // Ưu tiên mã máy nhận diện được (S7-1200, FX3U,...) để ánh xạ tìm kiếm chính
    // xác; nếu không có mã mới dùng keyword do Gemini đưa, cuối cùng mới tới regex type
    let keyword = '';
    if (codeInfo?.keyword) {
        keyword = codeInfo.keyword;
    } else if (typeof raw.keyword === 'string' && raw.keyword.trim() !== '') {
        keyword = raw.keyword.trim();
    } else if (typeInfo.keyword !== null) {
        keyword = typeInfo.keyword;
    }

    return {
        transcript,
        keyword: cleanVoiceKeyword(keyword, brand || rawBrand),
        intent: VALID_INTENTS.includes(raw.intent) ? raw.intent : detectVoiceIntent(transcript),
        filters: {
            brand,
            type,
            code
        }
    };
}

function buildVoiceSystemPrompt() {
    return `Bạn là trợ lý ảo thông minh phụ trách quản lý kho hàng của công ty thiết bị điện/thiết bị tự động hóa TTSmart.
Hãy nghe file âm thanh được cung cấp (giọng nói tiếng Việt của người dùng) và thực hiện 2 nhiệm vụ:
1. Ghi lại chính xác (transcribe) những gì người dùng đã nói (giữ nguyên tiếng Việt có dấu, viết hoa các từ cần thiết như Siemens, Mitsubishi, GPC1202, S7-1200, FX3U,...).
2. Phân tích ý định (intent) của người dùng để trích xuất ra từ khóa tìm kiếm chính (keyword) và các bộ lọc (filters) thích hợp, tối ưu hóa cho tất cả các cách gọi khác nhau của người dùng.

CƠ SỞ DỮ LIỆU ĐANG CÓ SẴN CÁC THƯƠNG HIỆU (BRANDS) VÀ LOẠI SẢN PHẨM (TYPES) SAU:
- Thương hiệu khả dụng: ${VOICE_BRANDS.map(b => `'${b}'`).join(', ')}
- Loại sản phẩm khả dụng: ${VOICE_TYPES.map(t => `'${t}'`).join(', ')}

BẢNG ÁNH XẠ CÁCH ĐỌC LÓNG (tự động cập nhật khi admin thêm từ mới; cách đọc đã bỏ dấu):
- Thương hiệu: ${VOICE_BRAND_ALIASES.map(([b, a]) => `${a.map(x => `"${x}"`).join('/')} -> ${b}`).join('; ')}
- Loại sản phẩm: ${VOICE_TYPE_ALIASES.map(([t, , a]) => `${a.map(x => `"${x}"`).join('/')} -> ${t}`).join('; ')}
- Ý định: ${VOICE_INTENT_ALIASES.map(([id, , a]) => `${a.map(x => `"${x}"`).join('/')} -> ${id}`).join('; ')}

Quy tắc phân tách và xử lý từ khóa:
- Intent chỉ được là một trong các giá trị: ${VALID_INTENTS.map(i => `"${i}"`).join(', ')}. Nếu người dùng chỉ hỏi/xem/tra cứu sản phẩm thì dùng "search_product". Nếu câu là lệnh thêm vào giỏ thì dùng "add_to_cart"; lệnh sửa/cập nhật thì dùng "update_item"; lệnh xóa/bỏ/hủy thì dùng "delete_item". Dù intent là thêm/sửa/xóa, vẫn phải trích xuất keyword và filters như bình thường; không tự thực hiện thao tác giỏ hàng hay đơn hàng.
- Khớp đúng Thương hiệu (filters.brand): Nếu người dùng nhắc tới tên thương hiệu, bạn PHẢI ánh xạ chính xác về một trong những thương hiệu khả dụng ở trên (Ví dụ: "siemens" -> "Siemens", "mit su bi shi" -> "Mitsubishi", "ôm ron" -> "Omron", "vê chi" -> "VEICHI", "en tơ nét" -> "Autonics"). Nếu câu nói không chứa tên thương hiệu, "filters.brand" bắt buộc phải là null (Tuyệt đối KHÔNG tự ý gán bừa thương hiệu mặc định).
- Khớp đúng Loại sản phẩm (filters.type): Ánh xạ từ khóa về một trong các loại sản phẩm khả dụng ở danh sách trên.
  + Nếu nhắc đến: "át", "át tô mát", "áp tô mát", "aptomat", "cầu dao tự động" -> filters.type: "Aptomat", keyword: "Aptomat".
  + Nếu nhắc đến: "khởi", "khởi động từ", "công tắc tơ", "contactor" -> filters.type: "Contactor", keyword: "Contactor".
  + Nếu nhắc đến: "biến tần", "inverter", "bộ biến tần" -> filters.type: "Biến tần", keyword: "biến tần".
  + Nếu nhắc đến: "cảm biến", "sensor", "thiết bị cảm biến" -> filters.type: "Cảm biến", keyword: "cảm biến".
  + Nếu nhắc đến: "nút nhấn", "nút bấm" -> filters.type: "Nút Nhấn", keyword: "nút nhấn".
  + Nếu nhắc đến: "nguồn", "nguồn tổ ong", "nguồn xung" -> filters.type: "Nguồn", keyword: "nguồn".
  + Nếu nhắc đến: "bộ điều khiển", "bộ lập trình", "plc" -> filters.type: "PLC", keyword: "PLC".
  + Nếu nhắc đến: "rơ le trung gian", "relay trung gian" -> filters.type: "Relay Trung Gian", keyword: "relay trung gian".
  + Nếu nhắc đến: "rơ le thời gian", "relay thời gian", "timer" -> filters.type: "Relay Thời Gian", keyword: "relay thời gian".
  + Nếu nhắc đến: "rơ le nhiệt", "relay nhiệt" -> filters.type: "Relay Nhiệt", keyword: "relay nhiệt".
  + Nếu nhắc đến: "ti" -> filters.type: "TI", keyword: "TI".
  + Nếu nhắc đến: "đèn báo", "đèn chỉ thị", "đèn" -> filters.type: "Đèn", keyword: "đèn".
  + Nếu nhắc đến: "xi lanh khí nén", "ty ben" -> filters.type: "Xy lanh khí nén", keyword: "xy lanh".
- Trường hợp Đặc biệt:
  + Màn hình / HMI: Vì trong danh mục sản phẩm của hệ thống KHÔNG có loại "HMI" (các màn hình HMI đang được xếp vào loại "PLC" hoặc loại khác), nên nếu người dùng nói "HMI", "màn hình HMI", "màn hình cảm ứng", bạn phải đặt "filters.type" là null và đặt "keyword" là "HMI" hoặc "màn hình" để tìm kiếm theo tên chuỗi văn bản.
- Tách biệt tên thương hiệu: Nếu người dùng nhắc cả loại và hãng (ví dụ: "tìm plc siemens"), bạn PHẢI tách thương hiệu ra đưa vào "filters.brand" (ví dụ: "Siemens"), và đưa loại sản phẩm vào "keyword" (ví dụ: "PLC") đồng thời loại bỏ tên hãng khỏi "keyword" để tránh việc tìm kiếm chuỗi trong cơ sở dữ liệu bị lỗi.
- Chỉ gán "filters.brand" tự động khi người dùng đọc mã/model thiết bị đặc thù thuộc về duy nhất một hãng (ví dụ: "S7-1200" hoặc "S7-1500" -> hãng "Siemens"; "FX3U" hoặc "FX5U" -> hãng "Mitsubishi").
- Giữ lại thông số kỹ thuật chi tiết: Nếu câu nói chứa tên model và các thông số chi tiết (ví dụ: "SM1231 8 AI RTD", "S7-1200 1214C", "FX3U 16MR"), bạn PHẢI trích xuất mã dòng sản phẩm chính vào "filters.code" (ví dụ: "SM1231", "S7-1200", "FX3U"), nhưng đối với trường "keyword", bạn bắt buộc PHẢI giữ nguyên toàn bộ tên model kèm thông số chi tiết đó (ví dụ: "SM1231 8 AI RTD") để backend có thể đối sánh chính xác.
- Giữ lại thuộc tính mô tả chi tiết: Nếu người dùng đọc kèm mô tả cụ thể (ví dụ: "nút đỏ", "nút đỏ không đèn", "nút nhấn màu xanh", "relay nhiệt mười tám a", "rơ le nhiệt 18A"), bạn PHẢI giữ nguyên cụm từ mô tả chi tiết đó làm "keyword" (ví dụ: "nút đỏ", "nút đỏ không đèn", "nút nhấn màu xanh", "relay nhiệt 18A"), TUYỆT ĐỐI không được rút ngắn keyword thành tên loại sản phẩm chung chung (như "nút nhấn" hoặc "relay nhiệt") vì hệ thống cần từ khóa chi tiết để lọc sản phẩm theo màu sắc/dòng điện.


Ví dụ cụ thể:
1. Người dùng nói: "tìm plc siemens"
-> transcript: "tìm plc siemens", keyword: "PLC", intent: "search_product", filters: { brand: "Siemens", type: "PLC", code: null }

2. Người dùng nói: "tìm bộ lập trình mitsubishi"
-> transcript: "tìm bộ lập trình mitsubishi", keyword: "PLC", intent: "search_product", filters: { brand: "Mitsubishi", type: "PLC", code: null }

3. Người dùng nói: "giá màn hình hmi delta"
-> transcript: "giá màn hình hmi delta", keyword: "HMI", intent: "search_product", filters: { brand: "Delta", type: null, code: null }

4. Người dùng nói: "tìm plc"
-> transcript: "tìm plc", keyword: "PLC", intent: "search_product", filters: { brand: null, type: "PLC", code: null }

5. Người dùng nói: "tìm cảm biến omron"
-> transcript: "tìm cảm biến omron", keyword: "cảm biến", intent: "search_product", filters: { brand: "Omron", type: "Cảm biến", code: null }

6. Người dùng nói: "khớp nối gpc mười hai không hai còn hàng không"
-> transcript: "khớp nối gpc mười hai không hai còn hàng không", keyword: "khớp nối GPC1202", intent: "search_product", filters: { brand: null, type: null, code: "GPC1202" }

7. Người dùng nói: "cho tôi xem sản phẩm của hãng siemens"
-> transcript: "cho tôi xem sản phẩm của hãng siemens", keyword: "", intent: "search_product", filters: { brand: "Siemens", type: null, code: null }

8. Người dùng nói: "tìm thiết bị s7 mười hai trăm"
-> transcript: "tìm thiết bị s7 mười hai trăm", keyword: "S7-1200", intent: "search_product", filters: { brand: "Siemens", type: "PLC", code: "S7-1200" }

9. Người dùng nói: "fx3u còn hàng không"
-> transcript: "fx3u còn hàng không", keyword: "FX3U", intent: "search_product", filters: { brand: "Mitsubishi", type: "PLC", code: "FX3U" }

10. Người dùng nói: "thêm biến tần omron"
-> transcript: "thêm biến tần omron", keyword: "biến tần", intent: "add_to_cart", filters: { brand: "Omron", type: "Biến tần", code: null }

11. Người dùng nói: "cập nhật plc siemens"
-> transcript: "cập nhật plc siemens", keyword: "PLC", intent: "update_item", filters: { brand: "Siemens", type: "PLC", code: null }

12. Người dùng nói: "xóa fx3u"
-> transcript: "xóa fx3u", keyword: "FX3U", intent: "delete_item", filters: { brand: "Mitsubishi", type: "PLC", code: "FX3U" }

Định dạng phản hồi BẮT BUỘC là một đối tượng JSON trực tiếp (không nằm trong thẻ markdown và không có văn bản giải thích đi kèm):
{
  "transcript": "...",
  "keyword": "...",
  "intent": "search_product | add_to_cart | update_item | delete_item",
  "filters": {
    "brand": null,
    "type": null,
    "code": null
  }
}
`;
}

module.exports = {
    applyVoiceVocab,
    stripSearchStopwords,
    normalizeVoiceQueryResult,
    buildVoiceSystemPrompt,
};
