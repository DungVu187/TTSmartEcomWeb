const multer = require('multer');

const PRODUCT_VOICE_AUDIO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const voiceAudioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PRODUCT_VOICE_AUDIO_MAX_SIZE_BYTES },
    fileFilter: (req, file, callback) => {
        if (/^(audio\/|application\/octet-stream)/.test(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new Error('Chỉ chấp nhận file âm thanh.'));
        }
    },
});
const uploadVoiceAudio = voiceAudioUpload.single('audio');

module.exports = {
    PRODUCT_VOICE_AUDIO_MAX_SIZE_BYTES,
    uploadVoiceAudio,
};
