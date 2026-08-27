const { TireOrder } = require('../models/tireorder');

const hasProductReference = (productId) => TireOrder.exists({ 'vehicles.assignments.productId': productId });
const hasVariantReference = (productId, variantId) => TireOrder.exists({ vehicles: { $elemMatch: { assignments: { $elemMatch: { productId, variantId } } } } });

module.exports = { hasProductReference, hasVariantReference };
