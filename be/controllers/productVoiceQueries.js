const {
    buildVoiceSystemPrompt,
    normalizeVoiceQueryResult,
    stripSearchStopwords,
} = require('../services/productVoiceQuery');

async function queryProductsByVoice(req, res) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.status(400).json({
                success: 0,
                message: 'Vui lòng cấu hình GEMINI_API_KEY hợp lệ trong file be/.env trước khi sử dụng tính năng này.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: 0, message: 'Không nhận được file âm thanh nào.' });
        }

        const base64Audio = req.file.buffer.toString('base64');
        let mimeType = req.file.mimetype || 'audio/webm';
        if (mimeType === 'application/octet-stream') {
            mimeType = 'audio/mp4'; // Safari fallback
        }

        const systemPrompt = buildVoiceSystemPrompt();

        const modelsToTry = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-flash-latest',
            'gemini-flash-lite-latest'
        ];

        const callGeminiWithModel = async (modelName) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            try {
                const res = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: systemPrompt },
                                    {
                                        inlineData: {
                                            mimeType: mimeType,
                                            data: base64Audio
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });
                return res;
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error(`Kết nối tới Gemini API (${modelName}) bị quá thời gian (Timeout 25s).`);
                }
                throw fetchErr;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        let geminiRes = null;
        let lastError = null;

        for (const model of modelsToTry) {
            try {
                const res = await callGeminiWithModel(model);
                if (res.ok) {
                    geminiRes = res;
                    break;
                } else {
                    const errText = await res.text();
                    console.warn(`[voice-query] Model ${model} lỗi:`, errText);
                    lastError = new Error(`Lỗi từ Gemini API (${model}): ${errText}`);
                }
            } catch (err) {
                console.warn(`[voice-query] Lỗi model ${model}:`, err.message);
                lastError = err;
            }
        }

        if (!geminiRes) {
            throw lastError || new Error("Không thể kết nối đến bất kỳ model Gemini nào.");
        }

        const geminiData = await geminiRes.json();
        let textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) {
            throw new Error('Không nhận được dữ liệu phân tích từ Gemini.');
        }

        textResult = textResult.trim();
        textResult = textResult.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        let resultObj;
        try {
            const match = textResult.match(/\{[\s\S]*\}/);
            resultObj = match ? JSON.parse(match[0]) : JSON.parse(textResult);
        } catch (parseErr) {
            console.warn("[voice-query] Không parse được JSON phản hồi từ Gemini:", textResult);
            // Fallback: dùng toàn bộ transcript/text làm keyword
            const fallbackResult = normalizeVoiceQueryResult({
                transcript: textResult,
                keyword: textResult.replace(/^(tìm|cho tôi hỏi|là bao nhiêu)\s*/gi, '').trim(),
                filters: { brand: null, type: null, code: null }
            });
            return res.json({
                success: 1,
                ...fallbackResult
            });
        }

        const normalizedResult = normalizeVoiceQueryResult(resultObj);
        res.json({
            success: 1,
            ...normalizedResult
        });

    } catch (error) {
        console.error('Lỗi khi phân tích giọng nói bằng AI:', error);
        res.status(500).json({
            success: 0,
            message: `Đã xảy ra lỗi khi phân tích giọng nói bằng AI: ${"Lỗi server"}`,
            error: "Lỗi server"
        });
    }
}

async function queryProductsByVoiceText(req, res) {
    try {
        const text = String(req.body?.text || '').trim();
        if (!text) {
            return res.status(400).json({ success: 0, message: 'Vui lòng nhập câu tìm kiếm.' });
        }

        // Bản text không qua Gemini nên phải tự bóc động từ/stopword ("tìm", "cho tôi xem"...)
        // để keyword không dính chữ dẫn. Voice thật thì Gemini đã bóc sẵn.
        const strippedTokens = stripSearchStopwords(text);
        const cleanedKeyword = strippedTokens.length > 0 ? strippedTokens.join(' ') : text;

        const normalizedResult = normalizeVoiceQueryResult({
            transcript: text,
            keyword: cleanedKeyword,
            filters: { brand: null, type: null, code: null }
        });

        res.json({
            success: 1,
            ...normalizedResult
        });
    } catch (error) {
        console.error('Lỗi khi phân tích câu tìm kiếm dạng chữ:', error);
        res.status(500).json({
            success: 0,
            message: `Đã xảy ra lỗi khi phân tích câu tìm kiếm: ${"Lỗi server"}`
        });
    }
}

module.exports = {
    queryProductsByVoice,
    queryProductsByVoiceText,
};
