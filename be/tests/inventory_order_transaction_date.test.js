const {
  InventoryOrderTransactionDateError,
  parseInventoryOrderTransactionDate,
} = require('../utils/inventoryOrderTransactionDate');

describe('inventory order transaction date', () => {
  it('parses a supplied actual import/export date', () => {
    const result = parseInventoryOrderTransactionDate('2026-08-10T09:30:00.000Z');

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-08-10T09:30:00.000Z');
  });

  it('leaves an omitted date for the schema default', () => {
    expect(parseInventoryOrderTransactionDate(undefined)).toBeUndefined();
  });

  it('rejects malformed actual dates', () => {
    expect(() => parseInventoryOrderTransactionDate('not-a-date'))
      .toThrow(InventoryOrderTransactionDateError);
  });
});
