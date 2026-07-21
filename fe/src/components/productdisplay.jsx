import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Box,
  Button,
  Paper,
  Rating,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import VerifiedIcon from "@mui/icons-material/Verified";
import BeenhereIcon from "@mui/icons-material/Beenhere";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useLanguage } from "../context/languagecontext.jsx";
import { ShopContext } from "../context/shopcontext";
import { formatVariantPrice, isContactOnlyVariant } from "../utils/productpricing";
import SafeProductImage from "./safeproductimage";
import "./style/productdisplay.css";

const apiUrl = process.env.REACT_APP_BACK_END;

const withImageVersion = (url, version) => {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "1")}`;
};

const variantFilterLabels = {
  color: "Màu sắc",
  shape: "Hình dạng",
  frame: "Khung",
  buttonCount: "Số nút",
};

function ProductDisplay() {
  const { t } = useLanguage();
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(ShopContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ comment: "", rating: 5 });
  const [userReview, setUserReview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedTab, setSelectedTab] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [filters, setFilters] = useState({
    color: "",
    shape: "",
    frame: "",
    buttonCount: "",
  });

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/users/profile`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(true);
        setUserEmail(data.email);
      } else {
        setIsLoggedIn(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setIsLoggedIn(false);
      setUserEmail(null);
    }
  }, []);

  const fetchProduct = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/products/${productId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setProduct(data);
      setSelectedVariant(data.variant?.[0] || null);
      setSelectedVariantIndex(0);
      setQty(1);
      setFilters({ color: "", shape: "", frame: "", buttonCount: "" });
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Không thể tải thông tin sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/products/${productId}/review`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setReviews(data);
      const currentUserReview = data.find((review) => review.email === userEmail);
      setUserReview(currentUserReview || null);
      setNewReview(currentUserReview
        ? { comment: currentUserReview.comment, rating: currentUserReview.rating }
        : { comment: "", rating: 5 });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Không thể tải đánh giá sản phẩm");
    }
  }, [productId, userEmail]);

  useEffect(() => {
    fetchUserProfile();
    fetchProduct();
  }, [fetchUserProfile, fetchProduct]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!product?.type) {
      setRelatedProducts([]);
      return undefined;
    }

    let active = true;
    const fetchRelatedProducts = async () => {
      try {
        const query = new URLSearchParams({ type: product.type, display: "true", limit: "8" });
        const response = await fetch(`${apiUrl}/products?${query.toString()}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (active) {
          setRelatedProducts(
            (data.products || []).filter((item) => item._id !== productId).slice(0, 5)
          );
        }
      } catch (error) {
        console.error("Error fetching related products:", error);
        if (active) setRelatedProducts([]);
      }
    };

    fetchRelatedProducts();
    return () => { active = false; };
  }, [product?.type, productId]);

  const activeValues = useMemo(() => {
    if (!product?.variant) return {};
    return product.variant.reduce((values, variant) => {
      const matches = Object.entries(filters).every(
        ([key, value]) => !value || variant[key] === value
      );
      if (matches) {
        Object.keys(filters).forEach((key) => {
          if (!values[key]) values[key] = new Set();
          if (variant[key]) values[key].add(variant[key]);
        });
      }
      return values;
    }, {});
  }, [filters, product]);

  if (loading) {
    return <div className="product-detail-status">{t("loading_product_details")}</div>;
  }

  if (!product) {
    return <div className="product-detail-status">{t("product_not_found")}</div>;
  }

  const updateVariant = (newFilters, filterKey) => {
    const matchingVariant = product.variant.find(
      (variant) =>
        (!newFilters.color || variant.color === newFilters.color) &&
        (!newFilters.shape || variant.shape === newFilters.shape) &&
        (!newFilters.frame || variant.frame === newFilters.frame) &&
        (!newFilters.buttonCount || variant.buttonCount === newFilters.buttonCount)
    );

    if (!matchingVariant) {
      toast.error("Sản phẩm không tồn tại");
      newFilters[filterKey] = "";
    } else {
      setSelectedVariant(matchingVariant);
      setSelectedVariantIndex(product.variant.indexOf(matchingVariant));
    }
    setFilters(newFilters);
  };

  const handleFilterChange = (filterName, value) => {
    const updatedFilters = {
      ...filters,
      [filterName]: value === filters[filterName] ? "" : value,
    };
    updateVariant(updatedFilters, filterName);
  };

  const redirectToLogin = () => {
    toast.error(t("login_to_add_cart"));
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 1000);
  };

  const handleAddToCart = async () => {
    if (!isLoggedIn) return redirectToLogin();
    if (selectedVariant) await addToCart(productId, selectedVariantIndex, qty);
    return undefined;
  };

  const handleBuyNow = async () => {
    if (!isLoggedIn) return redirectToLogin();
    if (selectedVariant) {
      await addToCart(productId, selectedVariantIndex, qty);
      navigate("/cart");
    }
    return undefined;
  };

  const handleReviewSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!isLoggedIn) {
        toast.error(t("login_to_review"));
        setTimeout(() => {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }, 1000);
        return;
      }

      const url = userReview
        ? `${apiUrl}/products/${productId}/review/${userReview._id}`
        : `${apiUrl}/products/${productId}/review/create`;
      const response = await fetch(url, {
        method: userReview ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReview),
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t("session_expired"));
          setTimeout(() => {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }, 1000);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { review } = await response.json();
      if (userReview) {
        setReviews((current) => current.map((item) => item._id === userReview._id ? review : item));
        toast.success(t("review_updated"));
      } else {
        setReviews((current) => [...current, review]);
        toast.success(t("review_submitted"));
      }
      setUserReview(review);
      fetchProduct();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error(t("failed_to_submit_review"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (isSubmitting || !userReview) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/products/${productId}/review/${userReview._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t("session_expired"));
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setReviews((current) => current.filter((review) => review._id !== userReview._id));
      setUserReview(null);
      setNewReview({ comment: "", rating: 0 });
      toast.success(t("review_deleted"));
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error(t("failed_to_delete_review"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSpecifications = Boolean(product.specifications?.trim());
  const technicalDocuments = Array.isArray(product.documents)
    ? product.documents.filter((document) => document?.url?.trim())
    : [];
  const hasLegacyInfoDoc = Boolean(
    product.infoDoc &&
    (product.infoDoc.manual?.trim() || product.infoDoc.dataSheet?.trim() ||
      product.infoDoc.catalog?.trim() || product.infoDoc.others?.trim())
  );
  const hasInfoDoc = technicalDocuments.length > 0 || hasLegacyInfoDoc;
  const detailTabs = [
    { key: "description", label: t("product_description") },
    ...(hasSpecifications ? [{ key: "specifications", label: t("specifications") }] : []),
    ...(hasInfoDoc ? [{ key: "documents", label: t("reference_documents") }] : []),
    { key: "reviews", label: `${t("rating")} (${reviews.length})` },
  ];
  const currentTab = detailTabs[selectedTab]?.key || "description";
  const isOutOfStock = Number(selectedVariant?.quantityForSale || 0) <= 0;
  const isContactOnly = isContactOnlyVariant(selectedVariant);
  const productImage = withImageVersion(selectedVariant?.imgUrl, product.updatedAt || product._id);
  const variantRows = [
    ["Mã sản phẩm", product.code],
    ["Hãng sản xuất", product.brand],
    ["Loại sản phẩm", product.type],
    ["Màu sắc", selectedVariant?.color],
    ["Hình dạng", selectedVariant?.shape],
    ["Khung", selectedVariant?.frame],
    ["Số nút", selectedVariant?.buttonCount],
  ].filter(([, value]) => value);

  return (
    <main className="product-detail-page">
      <div className="product-detail-shell">
        <nav className="product-detail-breadcrumb" aria-label="Breadcrumb">
          <Link to="/"><i className="fa-solid fa-house" /> {t("home")}</Link>
          <i className="fa-solid fa-angle-right" />
          <Link to="/product">{t("products")}</Link>
          {product.type && <><i className="fa-solid fa-angle-right" /><Link to={`/product?type=${encodeURIComponent(product.type)}`}>{product.type}</Link></>}
          <i className="fa-solid fa-angle-right" />
          <span>{product.name}</span>
        </nav>

        <section className="product-detail-hero">
          <div className="product-gallery-card">
            <div className="product-gallery-layout">
              <div className="product-gallery-main">
                <SafeProductImage src={productImage} alt={product.name} className="product-main-canvas" />
                <div className="product-gallery-benefits">
                  <span><i className="fa-solid fa-expand" /> Ảnh thật 100%</span>
                  <span><i className="fa-solid fa-shield-halved" /> Bảo hành chính hãng</span>
                  <span><i className="fa-solid fa-rotate" /> Đổi trả theo chính sách</span>
                </div>
              </div>
            </div>
          </div>

          <div className="product-purchase-card">
            <div className="product-brand-label">{product.brand || "TTSmart"}</div>
            <h1>{product.name}</h1>
            <div className="product-rating-line">
              <strong>{Number(product.averageReviews || 0).toFixed(1)}</strong>
              <Rating value={Number(product.averageReviews || 0)} readOnly precision={0.5} size="small" />
              <span>({product.reviewCount || reviews.length} đánh giá)</span>
              <i />
              <span>Đã bán {product.purchaseCount || 0}</span>
            </div>
            <div className="product-price-line">
              <strong>{formatVariantPrice(selectedVariant)}</strong>
              <span className={isOutOfStock ? "is-out" : "is-in"}>{isOutOfStock ? t("out_of_stock_val") : "Còn hàng"}</span>
            </div>
            <p className="product-vat-note">Giá chưa bao gồm VAT</p>

            {variantRows.length > 0 && (
              <div className="product-summary-list">
                {variantRows.map(([label, value]) => <div key={label}><span>{label}:</span><strong>{value}</strong></div>)}
              </div>
            )}

            <div className="product-variant-filters">
              {Object.entries(variantFilterLabels).map(([key, label]) => {
                const values = Array.from(activeValues[key] || []).filter(Boolean);
                if (values.length === 0) return null;
                return (
                  <div className="product-variant-filter" key={key}>
                    <span>{label}</span>
                    <div>{values.map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={filters[key] === value ? "is-active" : ""}
                        onClick={() => handleFilterChange(key, value)}
                      >{value}</button>
                    ))}</div>
                  </div>
                );
              })}
            </div>

            <div className="product-quantity-row">
              <span>{t("quantity")}:</span>
              <div className="product-detail-quantity">
                <button type="button" onClick={() => setQty((current) => Math.max(1, current - 1))}>−</button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((current) => current + 1)}>+</button>
              </div>
              <small>{isContactOnly ? t("contact_only_product") : `Còn ${selectedVariant.quantityForSale} sản phẩm`}</small>
            </div>

            {isContactOnly ? (
              <Button className="product-contact-stock-button" variant="contained" href="tel:0913158383" startIcon={<SmartphoneIcon />}>
                0913 158 383
              </Button>
            ) : (
              <div className="product-primary-actions">
                <Button variant="contained" onClick={handleAddToCart} startIcon={<ShoppingCartIcon />}>{t("add_to_cart")}</Button>
                <Button variant="outlined" onClick={handleBuyNow}><i className="fa-solid fa-bolt" /> Mua ngay</Button>
              </div>
            )}

            <div className="product-contact-actions">
              <a href="tel:0813158383"><i className="fa-solid fa-phone" /> Gọi ngay 0813.15.83.83</a>
              <a href="https://zalo.me/0813158383" target="_blank" rel="noreferrer"><i className="fa-regular fa-comment-dots" /> Chat Zalo</a>
              <a href="mailto:ttsmart.ltd@gmail.com"><i className="fa-regular fa-envelope" /> Gửi email</a>
            </div>
          </div>

          <aside className="product-service-column">
            <div className="product-service-card">
              <h2>{t("customer_support")}</h2>
              <a href="tel:0813158383"><SmartphoneIcon /> Đường dây nóng&nbsp; 0813.15.83.83</a>
              <a href="https://zalo.me/0813158383" target="_blank" rel="noreferrer"><img src="/icons8-zalo.svg" alt="" /> {t("contact_zalo")}</a>
              <a href="mailto:ttsmart.ltd@gmail.com"><MailOutlineIcon /> {t("send_email")}</a>
              <Link to="/policy"><HelpOutlineIcon /> {t("faqs")}</Link>
            </div>
            <div className="product-service-card">
              <h2>Cam kết từ TTSmart</h2>
              <span><VerifiedIcon /> {t("genuine_100")}</span>
              <span><BeenhereIcon /> {t("genuine_warranty_label")}</span>
              <span><UndoOutlinedIcon /> {t("return_3_days")}</span>
              <span><i className="fa-solid fa-truck-fast" /> Giao hàng toàn quốc</span>
              <span><i className="fa-solid fa-headset" /> Hỗ trợ kỹ thuật 24/7</span>
            </div>
          </aside>
        </section>

        {relatedProducts.length > 0 && (
          <section className="related-products-card">
            <div className="related-products-heading"><h2>Sản phẩm liên quan</h2><Link to={`/product?type=${encodeURIComponent(product.type || "")}`}>Xem tất cả</Link></div>
            <div className="related-products-grid">
              {relatedProducts.map((item) => {
                const variant = item.variant?.[0] || {};
                const inStock = Number(variant.quantityForSale || 0) > 0;
                return (
                  <Link className="related-product" to={`/product/${item._id}`} key={item._id}>
                    <SafeProductImage
                      src={withImageVersion(variant.imgUrl, item.updatedAt || item._id)}
                      alt={item.name}
                      className="related-product-canvas"
                    />
                    <div><h3>{item.name}</h3><strong>{formatVariantPrice(variant)}</strong><Rating value={Number(item.averageReviews || 0)} readOnly size="small" /><span className={`related-product-status ${inStock ? "is-in" : "is-out"}`}>{inStock ? "Còn hàng" : t("out_of_stock_val")}</span></div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="product-detail-tabs-card">
          <Tabs value={selectedTab} onChange={(_event, value) => setSelectedTab(value)} variant="scrollable" scrollButtons="auto">
            {detailTabs.map((tab) => <Tab key={tab.key} label={tab.label} />)}
          </Tabs>
          <div className="product-tab-content">
            {currentTab === "description" && (
              <div className="product-description-content">
                {product.description && <section><h2>{t("product_description")}</h2><p>{product.description}</p></section>}
                {product.features && <section><h2>{t("features")}</h2><p>{product.features}</p></section>}
                {product.operatingMethod && <section><h2>{t("operating_method")}</h2><p>{product.operatingMethod}</p></section>}
                {product.advantages && <section><h2>{t("advantages")}</h2><p>{product.advantages}</p></section>}
                {!product.description && !product.features && !product.operatingMethod && !product.advantages && <p>Thông tin sản phẩm đang được cập nhật.</p>}
              </div>
            )}

            {currentTab === "specifications" && (
              <ul className="product-specification-list">
                {product.specifications.split("\n").filter((line) => line.trim()).map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            )}

            {currentTab === "documents" && (
              <div className="product-document-links">
                {technicalDocuments.length > 0 ? (
                  technicalDocuments.map((document, index) => (
                    <a
                      key={document._id || `${document.url}-${index}`}
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className={`fa-regular ${document.sourceType === "file" ? "fa-file-pdf" : "fa-file-lines"}`} />
                      {document.label?.trim() || (document.sourceType === "file" ? "Tài liệu PDF" : "Tài liệu kỹ thuật")}
                    </a>
                  ))
                ) : (
                  <>
                    {product.infoDoc.manual?.trim() && <a href={product.infoDoc.manual} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-lines" /> Manual</a>}
                    {product.infoDoc.dataSheet?.trim() && <a href={product.infoDoc.dataSheet} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-lines" /> Data sheet</a>}
                    {product.infoDoc.catalog?.trim() && <a href={product.infoDoc.catalog} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-lines" /> Catalog</a>}
                    {product.infoDoc.others?.trim() && <a href={product.infoDoc.others} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-lines" /> {t("other_documents")}</a>}
                  </>
                )}
              </div>
            )}

            {currentTab === "reviews" && (
              <div className="product-reviews-layout">
                <div className="product-review-list">
                  {reviews.filter((review) => review.email !== userEmail).length > 0
                    ? reviews.filter((review) => review.email !== userEmail).map((review) => (
                      <Paper key={review._id} elevation={0} className="product-review-item">
                        <strong>{review.email}</strong><Rating value={review.rating} readOnly size="small" /><p>{review.comment}</p>
                      </Paper>
                    ))
                    : <Typography>{t("no_reviews_yet")}</Typography>}
                </div>
                <Box component="form" className="product-review-form" onSubmit={(event) => { event.preventDefault(); handleReviewSubmit(); }}>
                  <Typography fontWeight={700}>{userReview ? t("update_review") : t("submit_review")}</Typography>
                  <Rating value={newReview.rating} onChange={(_event, value) => setNewReview({ ...newReview, rating: value || 0 })} />
                  <TextField label={t("comment")} multiline rows={4} value={newReview.comment} onChange={(event) => setNewReview({ ...newReview, comment: event.target.value })} fullWidth />
                  <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? t("processing") : userReview ? t("update_review") : t("submit_review")}</Button>
                  {userReview && <Button variant="outlined" color="error" onClick={handleDeleteReview} disabled={isSubmitting}>{t("delete_review")}</Button>}
                </Box>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="product-mobile-action-bar">
        <a className="product-mobile-action-link" href="https://zalo.me/0813158383" target="_blank" rel="noreferrer">
          <i className="fa-regular fa-comment-dots" />
          <span>Chat</span>
        </a>
        <a className="product-mobile-action-link" href="tel:0813158383">
          <i className="fa-solid fa-phone" />
          <span>Gọi</span>
        </a>
        {isContactOnly ? (
          <a className="product-mobile-contact-button" href="tel:0913158383">
            Liên hệ báo giá
          </a>
        ) : (
          <>
            <button type="button" className="product-mobile-cart-button" onClick={handleAddToCart} disabled={isOutOfStock}>
              Thêm vào giỏ
            </button>
            <button type="button" className="product-mobile-buy-button" onClick={handleBuyNow} disabled={isOutOfStock}>
              Mua ngay
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default ProductDisplay;
