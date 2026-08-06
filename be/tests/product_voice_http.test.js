const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const { User } = require('../models/user');
const { buildVoiceSystemPrompt } = require('../services/productVoiceQuery');

const DATABASE_URL = 'mongodb://localhost:27017/EcomTest';
const VOICE_USER_PHONE = '0975000038';
const VALID_AUDIO = Buffer.from('voice-audio-fixture');

let voiceAgent;
let originalGeminiApiKey;

const createGeminiResponse = (text) => ({
    ok: true,
    json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
    }),
});

beforeAll(async () => {
    originalGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'voice-http-test-key';
    await mongoose.connect(DATABASE_URL);
    await User.deleteMany({ phone: VOICE_USER_PHONE });
    await User.create({
        phone: VOICE_USER_PHONE,
        password: 'password123',
        name: 'Voice HTTP User',
        role: 'customer',
    });
    voiceAgent = request.agent(app);
    const loginResponse = await voiceAgent
        .post('/users/login')
        .send({ phone: VOICE_USER_PHONE, password: 'password123' });
    expect(loginResponse.status).toBe(200);
});

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(async () => {
    if (originalGeminiApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
    } else {
        process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
    await User.deleteMany({ phone: VOICE_USER_PHONE });
    await mongoose.disconnect();
});

describe('Product voice HTTP integration', () => {
    it.each([
        ['audio/webm', 'audio/webm'],
        ['application/octet-stream', 'audio/mp4'],
    ])('keeps the audio request and response contract for %s', async (contentType, expectedMimeType) => {
        const geminiResult = {
            transcript: 'tìm plc siemens',
            keyword: 'PLC Siemens',
            filters: { brand: 'Siemens', type: 'PLC', code: null },
        };
        const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
            createGeminiResponse(JSON.stringify(geminiResult)),
        );

        const response = await voiceAgent
            .post('/products/voice-query')
            .attach('audio', VALID_AUDIO, {
                filename: 'query.webm',
                contentType,
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: 1,
            transcript: 'tìm plc siemens',
            keyword: 'PLC',
            intent: 'search_product',
            filters: { brand: 'Siemens', type: 'PLC', code: null },
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [requestUrl, requestOptions] = fetchSpy.mock.calls[0];
        expect(requestUrl).toContain('/models/gemini-2.5-pro:generateContent?key=voice-http-test-key');
        expect(requestOptions.method).toBe('POST');
        expect(requestOptions.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(requestOptions.signal).toBeDefined();
        expect(typeof requestOptions.signal.aborted).toBe('boolean');
        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.contents[0].parts[0].text).toBe(buildVoiceSystemPrompt());
        expect(requestBody.contents[0].parts[1].inlineData).toEqual({
            mimeType: expectedMimeType,
            data: VALID_AUDIO.toString('base64'),
        });
    });

    it('falls through HTTP and network errors in model order, then stops after success', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const fetchSpy = jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce({
                ok: false,
                text: async () => 'quota exceeded',
            })
            .mockRejectedValueOnce(new Error('temporary network error'))
            .mockResolvedValueOnce(createGeminiResponse(JSON.stringify({
                transcript: 'tìm plc siemens',
                keyword: 'PLC Siemens',
                filters: { brand: 'Siemens', type: 'PLC', code: null },
            })));

        const response = await voiceAgent
            .post('/products/voice-query')
            .attach('audio', VALID_AUDIO, {
                filename: 'query.webm',
                contentType: 'audio/webm',
            });

        expect(response.status).toBe(200);
        expect(response.body.keyword).toBe('PLC');
        expect(fetchSpy.mock.calls.map(([requestUrl]) => (
            requestUrl.match(/\/models\/([^:]+):generateContent/)?.[1]
        ))).toEqual([
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
        ]);
    });

    it('returns the legacy generic 500 envelope after all seven models fail', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Gemini unavailable'));

        const response = await voiceAgent
            .post('/products/voice-query')
            .attach('audio', VALID_AUDIO, {
                filename: 'query.webm',
                contentType: 'audio/webm',
            });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            success: 0,
            message: 'Đã xảy ra lỗi khi phân tích giọng nói bằng AI: Lỗi server',
            error: 'Lỗi server',
        });
        expect(fetchSpy).toHaveBeenCalledTimes(7);
    });

    it('keeps successful non-JSON Gemini text as the fallback voice query', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(global, 'fetch').mockResolvedValueOnce(
            createGeminiResponse('tìm plc siemens'),
        );

        const response = await voiceAgent
            .post('/products/voice-query')
            .attach('audio', VALID_AUDIO, {
                filename: 'query.webm',
                contentType: 'audio/webm',
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: 1,
            transcript: 'tìm plc siemens',
            keyword: 'plc',
            intent: 'search_product',
            filters: { brand: 'Siemens', type: 'PLC', code: null },
        });
    });

    it('keeps the text-query normalization envelope without calling Gemini', async () => {
        const fetchSpy = jest.spyOn(global, 'fetch');

        const response = await voiceAgent
            .post('/products/voice-query-text')
            .send({ text: 'tìm plc siemens nhé' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: 1,
            transcript: 'tìm plc siemens nhé',
            keyword: 'plc',
            intent: 'search_product',
            filters: { brand: 'Siemens', type: 'PLC', code: null },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns the history Excel intent from a text Voice command', async () => {
        const fetchSpy = jest.spyOn(global, 'fetch');

        const response = await voiceAgent
            .post('/products/voice-query-text')
            .send({ text: 'xuất excel lịch sử nhập đơn hôm nay' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: 1,
            transcript: 'xuất excel lịch sử nhập đơn hôm nay',
            intent: 'export_history',
            historyExport: { direction: 'import', datePreset: 'today' },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns a specific history date range from a text Voice command', async () => {
        const response = await voiceAgent
            .post('/products/voice-query-text')
            .send({
                text: 'xuất excel lịch sử xuất kho từ ngày 01/08/2026 tới ngày 05/08/2026'
            });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: 1,
            intent: 'export_history',
            historyExport: {
                direction: 'export',
                datePreset: 'custom',
                startDate: '2026-08-01',
                endDate: '2026-08-05',
            },
        });
    });

    it('keeps the text-query validation error contract', async () => {
        const response = await voiceAgent
            .post('/products/voice-query-text')
            .send({ text: '   ' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: 0,
            message: 'Vui lòng nhập câu tìm kiếm.',
        });
    });

    it.each([
        ['missing', undefined],
        ['placeholder', 'YOUR_GEMINI_API_KEY_HERE'],
    ])('keeps the %s Gemini API-key validation contract', async (label, apiKey) => {
        const previousApiKey = process.env.GEMINI_API_KEY;
        if (apiKey === undefined) {
            delete process.env.GEMINI_API_KEY;
        } else {
            process.env.GEMINI_API_KEY = apiKey;
        }
        const fetchSpy = jest.spyOn(global, 'fetch');

        try {
            const response = await voiceAgent
                .post('/products/voice-query')
                .attach('audio', VALID_AUDIO, {
                    filename: 'query.webm',
                    contentType: 'audio/webm',
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: 0,
                message: 'Vui lòng cấu hình GEMINI_API_KEY hợp lệ trong file be/.env trước khi sử dụng tính năng này.',
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            process.env.GEMINI_API_KEY = previousApiKey;
        }
    });

    it('keeps the missing-audio validation contract when the API key is valid', async () => {
        const response = await voiceAgent.post('/products/voice-query');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: 0,
            message: 'Không nhận được file âm thanh nào.',
        });
    });

    it('keeps text voice query authentication on the route facade', async () => {
        const response = await request(app)
            .post('/products/voice-query-text')
            .send({ text: 'tìm plc' });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Access denied, no token provided');
    });
});
