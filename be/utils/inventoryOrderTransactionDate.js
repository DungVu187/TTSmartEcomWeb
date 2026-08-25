class InventoryOrderTransactionDateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InventoryOrderTransactionDateError';
    this.statusCode = 400;
  }
}

function parseInventoryOrderTransactionDate(value) {
  if (value === undefined) return undefined;

  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    throw new InventoryOrderTransactionDateError('Ng\u00e0y th\u1ef1c t\u1ebf kh\u00f4ng h\u1ee3p l\u1ec7.');
  }

  const transactionDate = new Date(value);
  if (Number.isNaN(transactionDate.getTime())) {
    throw new InventoryOrderTransactionDateError('Ng\u00e0y th\u1ef1c t\u1ebf kh\u00f4ng h\u1ee3p l\u1ec7.');
  }

  return transactionDate;
}

module.exports = {
  InventoryOrderTransactionDateError,
  parseInventoryOrderTransactionDate,
};
