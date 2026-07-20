const parseProductNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isContactOnlyVariant = (variant) => {
  if (!variant) return true;
  if (variant.contactForPrice === true) return true;
  if (Number(variant.earn) === 0) return true;

  return (
    parseProductNumber(variant.price) <= 0 ||
    parseProductNumber(variant.quantityForSale) <= 0
  );
};

export const formatVariantPrice = (variant, suffix = "VNĐ") => {
  if (isContactOnlyVariant(variant)) return "Liên hệ";
  const formattedPrice = parseProductNumber(variant.price).toLocaleString("vi-VN");
  return suffix ? `${formattedPrice} ${suffix}` : formattedPrice;
};
