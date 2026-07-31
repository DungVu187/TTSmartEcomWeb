const {
    applyVoiceVocab,
    buildVoiceSystemPrompt,
    normalizeVoiceQueryResult,
    stripSearchStopwords
} = require('../services/productVoiceQuery');
const voiceVocabDefaults = require('../config/voiceVocab.defaults');

const cloneDefaultVoiceVocab = () => ({
    stopwords: voiceVocabDefaults.stopwords.slice(),
    brands: voiceVocabDefaults.brands.slice(),
    types: voiceVocabDefaults.types.slice(),
    brandAliases: voiceVocabDefaults.brandAliases.map(([brand, aliases]) => [
        brand,
        aliases.slice()
    ]),
    typeAliases: voiceVocabDefaults.typeAliases.map(([type, keyword, aliases]) => [
        type,
        keyword,
        aliases.slice()
    ]),
    codeMap: voiceVocabDefaults.codeMap.map(entry => ({
        ...entry,
        patterns: (entry.patterns || []).slice()
    })),
    intentAliases: voiceVocabDefaults.intentAliases.map(([intent, label, aliases]) => [
        intent,
        label,
        (aliases || []).slice()
    ])
});

beforeEach(() => {
    applyVoiceVocab(cloneDefaultVoiceVocab());
});

afterAll(() => {
    applyVoiceVocab(cloneDefaultVoiceVocab());
});

describe('productVoiceQuery service contract', () => {
    it('keeps the facade normalizer and boundary-stopword behavior', () => {
        expect(stripSearchStopwords('tim plc siemens nhe')).toEqual(['plc', 'siemens']);
        expect(stripSearchStopwords('plc tim siemens')).toEqual(['plc', 'tim', 'siemens']);

        expect(normalizeVoiceQueryResult({
            transcript: 'tim plc siemens',
            keyword: 'PLC Siemens',
            filters: { brand: 'Omron', type: 'PLC', code: null }
        })).toEqual({
            transcript: 'tim plc siemens',
            keyword: 'PLC',
            intent: 'search_product',
            filters: { brand: 'Siemens', type: 'PLC', code: null }
        });
    });

    it('applies refreshed vocab to the live normalizer state', () => {
        const vocab = cloneDefaultVoiceVocab();
        vocab.stopwords.push('shopplease');
        vocab.brands.push('Northstar');
        vocab.types.push('Pulse Counter');
        vocab.brandAliases.push(['Northstar', ['north star voice']]);
        vocab.typeAliases.push([
            'Pulse Counter',
            'pulse counter',
            ['pulse counter voice']
        ]);

        const addToCartIntent = vocab.intentAliases.find(([intent]) => intent === 'add_to_cart');
        addToCartIntent[2].push('stash item voice');

        applyVoiceVocab(vocab);

        expect(stripSearchStopwords('shopplease control valve')).toEqual(['control', 'valve']);
        expect(normalizeVoiceQueryResult({
            transcript: 'stash item voice pulse counter voice north star voice',
            keyword: 'pulse counter voice north star voice',
            filters: {}
        })).toMatchObject({
            keyword: 'pulse counter voice',
            intent: 'add_to_cart',
            filters: {
                brand: 'Northstar',
                type: 'Pulse Counter',
                code: null
            }
        });
    });

    it('rebuilds the system prompt from current vocab after every refresh', () => {
        const brand = 'ContractBrandZXQ';
        const brandAlias = 'contract brand spoken zxq';
        const type = 'ContractTypeZXQ';
        const typeAlias = 'contract type spoken zxq';
        const intentAlias = 'contract intent spoken zxq';
        const initialPrompt = buildVoiceSystemPrompt();
        const vocab = cloneDefaultVoiceVocab();

        expect(initialPrompt).not.toContain(brand);
        expect(initialPrompt).not.toContain(type);
        expect(initialPrompt).not.toContain(brandAlias);
        expect(initialPrompt).not.toContain(typeAlias);
        expect(initialPrompt).not.toContain(intentAlias);

        vocab.brands.push(brand);
        vocab.types.push(type);
        vocab.brandAliases.push([brand, [brandAlias]]);
        vocab.typeAliases.push([type, 'contract type keyword zxq', [typeAlias]]);
        const addToCartIntent = vocab.intentAliases.find(([intent]) => intent === 'add_to_cart');
        addToCartIntent[2].push(intentAlias);

        applyVoiceVocab(vocab);

        const refreshedPrompt = buildVoiceSystemPrompt();
        expect(refreshedPrompt).not.toBe(initialPrompt);
        expect(refreshedPrompt).toContain(brand);
        expect(refreshedPrompt).toContain(type);
        expect(refreshedPrompt).toContain(brandAlias);
        expect(refreshedPrompt).toContain(typeAlias);
        expect(refreshedPrompt).toContain(intentAlias);

        applyVoiceVocab(cloneDefaultVoiceVocab());

        const resetPrompt = buildVoiceSystemPrompt();
        expect(resetPrompt).toBe(initialPrompt);
        expect(resetPrompt).not.toContain(brand);
        expect(resetPrompt).not.toContain(type);
        expect(resetPrompt).not.toContain(brandAlias);
        expect(resetPrompt).not.toContain(typeAlias);
        expect(resetPrompt).not.toContain(intentAlias);
    });
});
