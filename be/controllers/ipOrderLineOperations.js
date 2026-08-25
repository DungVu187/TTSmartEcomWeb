const { IpOrder } = require('../models/iporder');
const { Product } = require('../models/product');
const { StorageHistory } = require('../models/storagehistory');
const {
  applyStockAdjustments,
  isVersionConflict,
  rollbackOrThrow,
} = require('../services/inventory');

const toQuantity = (value) => Number(value) || 0;

const createRouteError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAppliedQuantity = (productItem) => {
  const progress = toQuantity(productItem.quantityRe);
  if (
    productItem.stockAppliedQuantity === undefined ||
    productItem.stockAppliedQuantity === null
  ) {
    return progress;
  }
  const applied = Number(productItem.stockAppliedQuantity);
  if (!Number.isFinite(applied) || applied < 0 || applied > progress) {
    throw createRouteError(409, 'Dữ liệu số lượng đã cộng kho của dòng nhập không hợp lệ.');
  }
  return applied;
};

async function deleteIpOrderLine(req, res) {
  try {
    const order = await IpOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const index = parseInt(req.params.productIndex);
    if (!Number.isInteger(index) || index < 0 || index >= order.productList.length) {
      return res.status(400).json({ message: 'Invalid product index' });
    }
    const productItem = order.productList[index];
    const appliedQuantity = getAppliedQuantity(productItem);
    let appliedAdjustments = [];
    let historyEntry = null;

    if (appliedQuantity > 0) {
      const product = await Product.findById(productItem.productId)
        .select('name variant._id variant.quantityForSale variant.quantityInStorage');
      if (!product) {
        throw createRouteError(404, `Product ${productItem.productId} not found`);
      }
      const variant = product.variant[0];
      if (!variant) {
        throw createRouteError(400, 'Sản phẩm không có biến thể');
      }

      appliedAdjustments = await applyStockAdjustments([{
        productId: product._id,
        variantIndex: 0,
        expectedVariantId: variant._id,
        quantityInStorageDelta: -appliedQuantity,
        quantityForSaleDelta: -appliedQuantity,
      }]);
      historyEntry = {
        productId: product._id,
        productName: product.name,
        quantity: -appliedQuantity,
        userName: req.user?.name,
        orderId: order._id.toString(),
        orderName: order.orderName,
        note: 'Hoàn tác nhập kho khi xóa sản phẩm khỏi đơn nhập',
        source: 'order_line_manual',
        transactionDate: order.transactionDate || new Date(),
      };
    }
    order.productList.splice(index, 1);

    const allRemainingLinesCompleted = order.productList.length > 0 &&
      order.productList.every((item) => item.status);
    order.status = allRemainingLinesCompleted;
    order.completedAt = allRemainingLinesCompleted
      ? order.completedAt || new Date()
      : null;

    order.total = order.productList
      .reduce((sum, item) => {
        const priceNum = parseFloat(
          item.price?.replace(/\./g, '').replace(',', '.') || 0
        );
        return sum + priceNum * (item.quantity || 0);
      }, 0)
      .toString();

    let updatedOrder;
    try {
      updatedOrder = await order.save();
    } catch (error) {
      await rollbackOrThrow(appliedAdjustments, error);
    }

    if (historyEntry) {
      try {
        await new StorageHistory(historyEntry).save();
      } catch (error) {
        console.error('StorageHistory error (iporder line deletion):', error.message);
      }
    }
    res.json(updatedOrder);
  } catch (error) {
    res.status(error?.statusCode || (isVersionConflict(error) ? 409 : 400))
      .json({ message: error.message });
  }
}

async function reorderIpOrderLines(req, res) {
  try {
    const order = await IpOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { productList } = req.body;
    if (!Array.isArray(productList)) {
      return res
        .status(400)
        .json({ message: 'productList must be an array' });
    }

    const isValid = productList.every(
      (item) =>
        item.productId &&
        typeof item.price === 'string' &&
        typeof item.unit === 'string' &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 0 &&
        typeof item.quantityRe === 'number' &&
        Number.isFinite(item.quantityRe) &&
        item.quantityRe >= 0 &&
        item.quantityRe <= item.quantity &&
        typeof item.status === 'boolean'
    );

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid productList format' });
    }

    const toLineKey = (item) => JSON.stringify({
      productId: String(item.productId),
      price: item.price || '',
      unit: item.unit || '',
      quantity: Number(item.quantity),
      quantityRe: Number(item.quantityRe),
      status: Boolean(item.status),
      note: item.note || '',
      vat: item.vat || '',
    });
    const countLines = (items) => items.reduce((counts, item) => {
      const key = toLineKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
    const currentCounts = countLines(order.productList);
    const reorderedCounts = countLines(productList);
    const isSameLines = currentCounts.size === reorderedCounts.size &&
      [...currentCounts.entries()].every(
        ([key, count]) => reorderedCounts.get(key) === count
      );
    if (!isSameLines) {
      return res.status(400).json({
        message: 'API sắp xếp chỉ được thay đổi thứ tự sản phẩm.',
      });
    }

    const currentLineBuckets = order.productList.reduce((buckets, item) => {
      const key = toLineKey(item);
      const bucket = buckets.get(key) || [];
      bucket.push(item);
      buckets.set(key, bucket);
      return buckets;
    }, new Map());
    order.productList = productList.map((item) => {
      const currentLine = currentLineBuckets.get(toLineKey(item)).shift();
      return currentLine.toObject();
    });

    order.total = order.productList
      .reduce((sum, item) => {
        const priceNum = parseFloat(
          item.price?.replace(/\./g, '').replace(',', '.') || 0
        );
        return sum + priceNum * (item.quantity || 0);
      }, 0)
      .toString();

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = {
  deleteIpOrderLine,
  reorderIpOrderLines,
};
