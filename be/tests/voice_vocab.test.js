// Kiểm thử không cần cơ sở dữ liệu cho tính năng quản lý từ vựng giọng nói.
// Chỉ kiểm tra các hàm thuần và vòng đời bộ nhớ đệm khi ứng dụng đang chạy.
// Luồng kiểm thử đi từ dữ liệu mặc định, dữ liệu lưu trữ, dữ liệu nạp lại đến bước nhận diện.
// Trường hợp cốt lõi: khi quản trị viên thêm hãng hoặc tên gọi mới, hệ thống phải nhận diện ngay mà không cần khởi động lại.

const {
    normalizeVoiceQueryResult,
    refreshVoiceVocab,
    stripSearchStopwords
} = require('../components/product');
const {
    defaultsToDoc,
    docToVocabPayload
} = require('../components/voicevocab');
const voiceVocabDefaults = require('../config/voiceVocab.defaults');

// Sau mỗi ca kiểm thử, nạp lại từ vựng mặc định để không rò rỉ trạng thái sang ca khác
// trong cùng tệp; `refreshVoiceVocab` ghi đè biến cấp mô-đun trong `product.js`.
afterEach(() => {
    refreshVoiceVocab({
        stopwords: voiceVocabDefaults.stopwords,
        brands: voiceVocabDefaults.brands,
        types: voiceVocabDefaults.types,
        brandAliases: voiceVocabDefaults.brandAliases,
        typeAliases: voiceVocabDefaults.typeAliases,
        intentAliases: voiceVocabDefaults.intentAliases,
        codeMap: voiceVocabDefaults.codeMap
    });
});

describe('defaultsToDoc', () => {
    it('chuyển defaults (dạng tuple) sang shape object cho DB', () => {
        const doc = defaultsToDoc();
        expect(doc.brands).toContain('Omron');
        expect(doc.types).toContain('PLC');
        // Chuyển tên gọi khác của hãng từ bộ giá trị `[name, [aliases]]` sang đối tượng `{ name, aliases }`.
        const omron = doc.brandAliases.find(b => b.name === 'Omron');
        expect(omron).toBeTruthy();
        expect(omron.aliases).toEqual(expect.arrayContaining(['om ron']));
        // Chuyển tên gọi khác của loại từ bộ giá trị sang đối tượng có loại, từ khóa và các tên thay thế.
        const aptomat = doc.typeAliases.find(t => t.type === 'Aptomat');
        expect(aptomat.keyword).toBe('Aptomat');
        expect(aptomat.aliases).toEqual(expect.arrayContaining(['at to mat']));
        // Chuyển tên gọi khác của ý định từ bộ giá trị sang đối tượng có ý định, nhãn và các tên thay thế.
        const addToCart = doc.intentAliases.find(i => i.intent === 'add_to_cart');
        expect(addToCart.label).toBe('Thêm');
        expect(addToCart.aliases).toEqual(expect.arrayContaining(['them vao']));
        // Bảng ánh xạ mã giữ nguyên các trường.
        const s7 = doc.codeMap.find(c => c.code === 'S7-1200');
        expect(s7).toMatchObject({ brand: 'Siemens', type: 'PLC', compact: 's71200' });
    });
});

describe('docToVocabPayload', () => {
    it('round-trip defaultsToDoc -> docToVocabPayload trả lại shape tuple gốc', () => {
        const payload = docToVocabPayload(defaultsToDoc());
        expect(payload.brands).toContain('Siemens');
        // Chuyển tên gọi khác của hãng trở lại bộ giá trị `[name, [aliases]]`.
        const omron = payload.brandAliases.find(([name]) => name === 'Omron');
        expect(omron[1]).toEqual(expect.arrayContaining(['om ron']));
        // Chuyển tên gọi khác của loại trở lại bộ giá trị gồm loại, từ khóa và các tên thay thế.
        const aptomat = payload.typeAliases.find(([type]) => type === 'Aptomat');
        expect(aptomat[2]).toEqual(expect.arrayContaining(['at to mat']));
        // Chuyển tên gọi khác của ý định trở lại bộ giá trị gồm ý định, nhãn và các tên thay thế.
        const addToCart = payload.intentAliases.find(([intent]) => intent === 'add_to_cart');
        expect(addToCart[1]).toBe('Thêm');
        expect(addToCart[2]).toEqual(expect.arrayContaining(['them vao']));
    });
});

describe('refreshVoiceVocab áp dụng vocab mới lúc runtime', () => {
    it('nhận diện được hãng mới sau khi admin thêm brand + alias', () => {
        // Trước khi thêm: "phu ji" chưa phải hãng nào -> brand null
        expect(normalizeVoiceQueryResult({
            transcript: 'tim bien tan phu ji',
            keyword: 'biến tần',
            filters: {}
        }).filters.brand).toBeNull();

        // Quản trị viên thêm hãng "Fuji" và cách đọc "phu ji".
        const doc = defaultsToDoc();
        doc.brands.push('Fuji');
        doc.brandAliases.push({ name: 'Fuji', aliases: ['phu ji', 'fu ji'] });
        refreshVoiceVocab(docToVocabPayload(doc));

        // Sau khi làm mới từ vựng, hệ thống nhận diện được ngay.
        const result = normalizeVoiceQueryResult({
            transcript: 'tim bien tan phu ji',
            keyword: 'biến tần',
            filters: {}
        });
        expect(result.filters.brand).toBe('Fuji');
    });

    it('nhận diện loại sản phẩm mới qua alias vừa thêm', () => {
        const doc = defaultsToDoc();
        doc.types.push('Bộ đếm');
        doc.typeAliases.push({ type: 'Bộ đếm', keyword: 'bộ đếm', aliases: ['bo dem', 'counter'] });
        refreshVoiceVocab(docToVocabPayload(doc));

        const result = normalizeVoiceQueryResult({
            transcript: 'tim counter',
            keyword: '',
            filters: {}
        });
        expect(result.filters.type).toBe('Bộ đếm');
    });

    it('nhận diện mã model mới qua codeMap vừa thêm', () => {
        const doc = defaultsToDoc();
        doc.codeMap.push({
            code: 'CP1E',
            keyword: 'CP1E',
            brand: 'Omron',
            type: 'PLC',
            patterns: ['\\bcp\\s*1\\s*e\\b'],
            compact: 'cp1e'
        });
        refreshVoiceVocab(docToVocabPayload(doc));

        const result = normalizeVoiceQueryResult({
            transcript: 'tim cp1e',
            keyword: 'cp1e',
            filters: {}
        });
        expect(result.filters.code).toBe('CP1E');
        expect(result.filters.brand).toBe('Omron');
        expect(result.filters.type).toBe('PLC');
    });

    it('nhận diện intent mặc định nhưng không làm đổi keyword/filter', () => {
        refreshVoiceVocab(docToVocabPayload(defaultsToDoc()));

        const addResult = normalizeVoiceQueryResult({
            transcript: 'them bien tan omron',
            keyword: 'bien tan',
            filters: {}
        });
        expect(addResult.intent).toBe('add_to_cart');
        expect(addResult.keyword).toBe('bien tan');
        expect(addResult.filters.brand).toBe('Omron');

        const searchResult = normalizeVoiceQueryResult({
            transcript: 'tim plc',
            keyword: 'PLC',
            filters: {}
        });
        expect(searchResult.intent).toBe('search_product');
    });

    it('nhận diện intent mới ngay sau khi refreshVoiceVocab từ docToVocabPayload', () => {
        const doc = defaultsToDoc();
        const addToCart = doc.intentAliases.find(i => i.intent === 'add_to_cart');
        addToCart.aliases.push('mua giup');
        refreshVoiceVocab(docToVocabPayload(doc));

        const result = normalizeVoiceQueryResult({
            transcript: 'mua giup plc siemens',
            keyword: 'PLC',
            filters: {}
        });
        expect(result.intent).toBe('add_to_cart');
        expect(result.filters.brand).toBe('Siemens');
    });

    it('thêm stopword mới thì bị bóc khỏi câu tìm kiếm', () => {
        // Trước: "shop" không phải stopword -> giữ lại
        expect(stripSearchStopwords('shop van dien')).toEqual(['shop', 'van', 'dien']);

        const doc = defaultsToDoc();
        doc.stopwords.push('shop');
        refreshVoiceVocab(docToVocabPayload(doc));

        // Sau: "shop" ở biên bị bóc
        expect(stripSearchStopwords('shop van dien')).toEqual(['van', 'dien']);
    });
});
