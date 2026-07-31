let refreshHandler = null;
let pendingVocab = null;

const registerVoiceVocabRefresher = (handler) => {
  if (typeof handler !== "function") {
    throw new TypeError("Voice vocab refresher must be a function");
  }

  refreshHandler = handler;
  if (pendingVocab) {
    const vocab = pendingVocab;
    pendingVocab = null;
    refreshHandler(vocab);
  }
};

const refreshVoiceVocab = (vocab = {}) => {
  if (!refreshHandler) {
    pendingVocab = vocab;
    return false;
  }

  refreshHandler(vocab);
  return true;
};

module.exports = {
  refreshVoiceVocab,
  registerVoiceVocabRefresher,
};
