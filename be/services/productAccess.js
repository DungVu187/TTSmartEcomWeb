const mongoose = require("mongoose");

const PRIVILEGED_PRODUCT_ROLES = new Set(["superadmin", "admin", "staff"]);

class ProductAccessError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = "ProductAccessError";
    this.statusCode = statusCode;
  }
}

const normalizeStationIds = (user) =>
  Array.from(
    new Set(
      (Array.isArray(user?.station) ? user.station : [])
        .map((stationId) => String(stationId || "").trim())
        .filter(Boolean)
    )
  );

const getCustomerStationProductIds = async (user, { stationId } = {}) => {
  if (!user || user.role !== "customer") return null;

  const assignedStationIds = normalizeStationIds(user);
  if (assignedStationIds.length === 0) return null;

  const requestedStationId = String(stationId || "").trim();
  let stationFilter;

  if (requestedStationId && requestedStationId !== "Tất cả") {
    if (!assignedStationIds.includes(requestedStationId)) {
      throw new ProductAccessError("Bạn không có quyền truy cập trạm này.");
    }
    if (!mongoose.Types.ObjectId.isValid(requestedStationId)) {
      throw new ProductAccessError("Mã trạm không hợp lệ.", 400);
    }
    stationFilter = { _id: requestedStationId };
  } else {
    const validStationIds = assignedStationIds.filter((value) =>
      mongoose.Types.ObjectId.isValid(value)
    );
    if (validStationIds.length === 0) return new Set();
    stationFilter = { _id: { $in: validStationIds } };
  }

  const Station = mongoose.model("Station");
  const stations = await Station.find(stationFilter).select("productId").lean();
  const productIds = stations.flatMap((station) =>
    Array.isArray(station.productId) ? station.productId : []
  );

  return new Set(productIds.map((productId) => String(productId)));
};

const buildProductVisibilityFilter = async (user, options = {}) => {
  const filter = {};
  const isPrivileged = PRIVILEGED_PRODUCT_ROLES.has(user?.role);

  if (!isPrivileged) {
    filter.display = true;
  }

  const allowedProductIds = await getCustomerStationProductIds(user, options);
  if (allowedProductIds instanceof Set) {
    filter._id = { $in: Array.from(allowedProductIds) };
  }

  return { filter, allowedProductIds };
};

const combineProductFilters = (...filters) => {
  const activeFilters = filters.filter(
    (filter) => filter && typeof filter === "object" && Object.keys(filter).length > 0
  );

  if (activeFilters.length === 0) return {};
  if (activeFilters.length === 1) return activeFilters[0];
  return { $and: activeFilters };
};

module.exports = {
  ProductAccessError,
  buildProductVisibilityFilter,
  combineProductFilters,
  getCustomerStationProductIds,
};
