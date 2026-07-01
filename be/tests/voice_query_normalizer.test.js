const { normalizeVoiceQueryResult } = require('../components/product');

describe('voice query normalizer', () => {
  it('clears hallucinated brand when transcript does not mention a brand', () => {
    expect(normalizeVoiceQueryResult({
      transcript: 'tìm plc',
      keyword: 'PLC Siemens',
      filters: { brand: 'Siemens', type: 'PLC', code: null }
    })).toEqual({
      transcript: 'tìm plc',
      keyword: 'PLC',
      intent: 'search_product',
      filters: { brand: null, type: 'PLC', code: null }
    });
  });

  it('extracts brand and type from common product requests', () => {
    expect(normalizeVoiceQueryResult({
      transcript: 'tìm cảm biến ôm ron',
      keyword: 'cảm biến',
      filters: {}
    })).toMatchObject({
      keyword: 'cảm biến',
      filters: { brand: 'Omron', type: 'Cảm biến', code: null }
    });
  });

  it('keeps HMI as keyword without forcing a type', () => {
    expect(normalizeVoiceQueryResult({
      transcript: 'giá màn hình hmi delta',
      keyword: 'HMI',
      filters: {}
    })).toMatchObject({
      keyword: 'HMI',
      filters: { brand: 'Delta', type: null, code: null }
    });
  });

  it('maps special spoken model codes to deterministic filters', () => {
    expect(normalizeVoiceQueryResult({
      transcript: 'tìm thiết bị s7 mười hai trăm',
      keyword: 'thiết bị',
      filters: {}
    })).toMatchObject({
      keyword: 'S7-1200',
      filters: { brand: 'Siemens', type: 'PLC', code: 'S7-1200' }
    });

    expect(normalizeVoiceQueryResult({
      transcript: 'fx3u còn hàng không',
      keyword: 'fx3u',
      filters: {}
    })).toMatchObject({
      keyword: 'FX3U',
      filters: { brand: 'Mitsubishi', type: 'PLC', code: 'FX3U' }
    });

    expect(normalizeVoiceQueryResult({
      transcript: 'khớp nối gpc mười hai không hai còn hàng không',
      keyword: 'khớp nối',
      filters: {}
    })).toMatchObject({
      keyword: 'khớp nối GPC1202',
      filters: { brand: null, type: null, code: 'GPC1202' }
    });
  });
});
