// Test DB-free cho tính năng từ vựng voice có thể sửa qua admin.
// Không phụ thuộc MongoDB: chỉ kiểm tra các hàm thuần + vòng đời cache runtime
//   defaults -> defaultsToDoc -> docToVocabPayload -> refreshVoiceVocab -> nhận diện.
// Bằng chứng cốt lõi: admin thêm 1 hãng/alias mới thì normalizeVoiceQueryResult
// nhận diện được ngay, không cần restart server.

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

// Sau mỗi test, nạp lại vocab mặc định để không rò rỉ trạng thái sang test khác
// trong cùng file (refreshVoiceVocab ghi đè biến module-level trong product.js).
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
        // brandAliases tuple [name, [aliases]] -> { name, aliases }
        const omron = doc.brandAliases.find(b => b.name === 'Omron');
        expect(omron).toBeTruthy();
        expect(omron.aliases).toEqual(expect.arrayContaining(['om ron']));
        // typeAliases tuple [type, keyword, [aliases]] -> { type, keyword, aliases }
        const aptomat = doc.typeAliases.find(t => t.type === 'Aptomat');
        expect(aptomat.keyword).toBe('Aptomat');
        expect(aptomat.aliases).toEqual(expect.arrayContaining(['at to mat']));
        // intentAliases tuple [intent, label, [aliases]] -> { intent, label, aliases }
        const addToCart = doc.intentAliases.find(i => i.intent === 'add_to_cart');
        expect(addToCart.label).toBe('Thêm');
        expect(addToCart.aliases).toEqual(expect.arrayContaining(['them vao']));
        // codeMap giữ nguyên các trường
        const s7 = doc.codeMap.find(c => c.code === 'S7-1200');
        expect(s7).toMatchObject({ brand: 'Siemens', type: 'PLC', compact: 's71200' });
    });
});

describe('docToVocabPayload', () => {
    it('round-trip defaultsToDoc -> docToVocabPayload trả lại shape tuple gốc', () => {
        const payload = docToVocabPayload(defaultsToDoc());
        expect(payload.brands).toContain('Siemens');
        // brandAliases về lại [name, [aliases]]
        const omron = payload.brandAliases.find(([name]) => name === 'Omron');
        expect(omron[1]).toEqual(expect.arrayContaining(['om ron']));
        // typeAliases về lại [type, keyword, [aliases]]
        const aptomat = payload.typeAliases.find(([type]) => type === 'Aptomat');
        expect(aptomat[2]).toEqual(expect.arrayContaining(['at to mat']));
        // intentAliases về lại [intent, label, [aliases]]
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

        // Admin thêm hãng "Fuji" + cách đọc "phu ji"
        const doc = defaultsToDoc();
        doc.brands.push('Fuji');
        doc.brandAliases.push({ name: 'Fuji', aliases: ['phu ji', 'fu ji'] });
        refreshVoiceVocab(docToVocabPayload(doc));

        // Sau khi refresh: nhận diện được ngay
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
