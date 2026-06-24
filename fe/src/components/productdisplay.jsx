import React, { useState, useEffect, useContext, useCallback } from "react";
import { useLanguage } from "../context/languagecontext.jsx";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ShopContext } from "../context/shopcontext";
import "./style/productdisplay.css";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Rating,
  Tabs,
  Tab,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import VerifiedIcon from "@mui/icons-material/Verified";
import BeenhereIcon from "@mui/icons-material/Beenhere";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";

const ProductDisplay = () => {
  const { t } = useLanguage();
  const { productId } = useParams();
  const { addToCart } = useContext(ShopContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({
    comment: "",
    rating: 5,
  });
  const [userReview, setUserReview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qty, setQty] = useState(1);

  const [filters, setFilters] = useState({
    color: "",
    shape: "",
    frame: "",
    buttonCount: "",
  });

  const [selectedTab, setSelectedTab] = useState(0);

  const updateVariant = (newFilters, filterKey) => {
    const matchingVariant = product.variant.find(
      (v) =>
        (!newFilters.color || v.color === newFilters.color) &&
        (!newFilters.shape || v.shape === newFilters.shape) &&
        (!newFilters.frame || v.frame === newFilters.frame) &&
        (!newFilters.buttonCount || v.buttonCount === newFilters.buttonCount)
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

  const getActiveValues = () => {
    return product.variant.reduce((activeValues, variant) => {
      const isMatching = Object.entries(filters).every(
        ([key, value]) => !value || variant[key] === value
      );

      if (isMatching) {
        Object.keys(filters).forEach((key) => {
          if (!activeValues[key]) {
            activeValues[key] = new Set();
          }
          activeValues[key].add(variant[key]);
        });
      }
      return activeValues;
    }, {});
  };

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACK_END}/users/profile`, {
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
      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/products/${productId}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProduct(data);
      setSelectedVariant(data.variant[0]);
      setSelectedVariantIndex(0);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Không thể tải thông tin sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/products/${productId}/review`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setReviews(data);

      const currentUserReview = data.find((review) => review.email === userEmail);
      setUserReview(currentUserReview || null);

      if (currentUserReview) {
        setNewReview({
          comment: currentUserReview.comment,
          rating: currentUserReview.rating,
        });
      } else {
        setNewReview({ comment: "", rating: 5 });
      }
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

  if (loading) {
    return <p>{t("loading_product_details")}</p>;
  }

  if (!product) {
    return <p>{t("product_not_found")}</p>;
  }

  const activeValues = getActiveValues();

  const handleAddToCart = () => {
    if (!isLoggedIn) {
      toast.error(t("login_to_add_cart"));
      setTimeout(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 1000);
      return;
    }
    if (selectedVariant) {
      addToCart(productId, selectedVariantIndex, qty);
    }
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
        ? `${process.env.REACT_APP_BACK_END}/products/${productId}/review/${userReview._id}`
        : `${process.env.REACT_APP_BACK_END}/products/${productId}/review/create`;

      const method = userReview ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
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
        setReviews((prevReviews) =>
          prevReviews.map((r) => (r._id === userReview._id ? review : r))
        );
        toast.success(t("review_updated"));
      } else {
        setReviews((prevReviews) => [...prevReviews, review]);
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/products/${productId}/review/${userReview._id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

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
      setReviews((prevReviews) =>
        prevReviews.filter((review) => review._id !== userReview._id)
      );
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

  const hasSpecifications = product.specifications?.trim();
  const hasInfoDoc =
    product.infoDoc &&
    (product.infoDoc.manual?.trim() ||
      product.infoDoc.dataSheet?.trim() ||
      product.infoDoc.catalog?.trim() ||
      product.infoDoc.others?.trim());

  return (
    <div style={{ backgroundColor: "rgb(235, 246, 254)", padding: "3rem 0", minHeight: '100vh' }}>
      <div
        className="more-huge-container"
        style={{
          maxWidth: "1920px",
          margin: "auto",
          width: "full",
          display: "flex",
          gap: "2rem",
          justifyContent: "center",
        }}
      >
        <div className="huge-container" style={{ width: "764px" }}>
          <div className="produt-display-main-container">
            <div>
              <img
                src={selectedVariant?.imgUrl}
                alt={t("image")}
                style={{
                  width: "450px",
                  aspectRatio: 3 / 2,
                  borderRadius: "5px",
                  backgroundColor: "white",
                  padding: "1rem 0",
                  objectFit: "contain",
                }}
              />
            </div>
            <div
              className="product-main-info"
              style={{
                width: "230px",
                backgroundColor: "white",
                borderRadius: "5px",
                display: "flex",
                flexDirection: "column",
                padding: "0 1rem 1rem",
              }}
            >
              <div style={{ flex: 1, textAlign: "left", padding: "1rem" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <h1 style={{ margin: 0 }}>{product.name}</h1>
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: "400",
                      color: "#555",
                    }}
                  >
                    ({product.purchaseCount})
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Rating
                    name="rating"
                    value={product.averageReviews}
                    readOnly
                  />
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: "400",
                      color: "#555",
                    }}
                  >
                    ({product.reviewCount})
                  </span>
                </div>
                <p style={{ fontWeight: 500 }}>{product.code}</p>
                <p className="product-display-price">
                  {Number(selectedVariant?.price).toLocaleString("vi-VN")} VND
                </p>
                {(selectedVariant?.quantityForSale || 0) <= 0 ? (
                  <>
                    <p style={{ color: "#d32f2f", fontWeight: "bold", margin: "5px 0 0 0" }}>
                      {t("out_of_stock")}
                    </p>
                    {/* Nút liên hệ cuộc gọi (Chỉ hiển thị khi hết hàng) */}
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      href="tel:0913158383"
                      startIcon={<SmartphoneIcon />}
                      sx={{
                        width: "100%",
                        mt: 1,
                        textTransform: "none",
                        fontWeight: "bold",
                      }}
                    >
                      0913 158 383
                    </Button>
                  </>
                ) : (
                  <p style={{ margin: "5px 0 0 0", color: "#333", fontSize: "0.95rem", fontWeight: "bold" }}>
                    {t("quantity_left")}{selectedVariant.quantityForSale}
                  </p>
                )}
                <p style={{ margin: "5px 0" }}>{product.type}</p>
              </div>

              {/* Bộ chọn số lượng */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  mb: 2,
                  mt: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t("quantity")}:
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    type="button"
                    style={{
                      border: "none",
                      background: "#f0f0f0",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    -
                  </button>
                  <span style={{ padding: "0 10px", fontSize: "0.95rem", minWidth: "20px", textAlign: "center" }}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((prev) => prev + 1)}
                    type="button"
                    style={{
                      border: "none",
                      background: "#f0f0f0",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    +
                  </button>
                </Box>
              </Box>

              <Button
                variant="contained"
                color="primary"
                onClick={handleAddToCart}
                startIcon={<ShoppingCartIcon />}
                sx={{
                  width: "90%",
                  margin: "0 auto 10px",
                }}
              >
                {t("add_to_cart")}
              </Button>
            </div>
          </div>
          {product?.description && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                {t("product_description")}
              </Typography>
              <Typography>{product.description}</Typography>
            </Box>
          )}
          <Box>
            {(hasSpecifications || hasInfoDoc) && (
              <>
                <Tabs
                  value={selectedTab}
                  onChange={(event, newValue) => setSelectedTab(newValue)}
                  sx={{
                    backgroundColor: "white",
                    borderTopLeftRadius: "5px",
                    borderTopRightRadius: "5px",
                  }}
                >
                  {hasSpecifications && <Tab label={t("specifications")} />}
                  {hasInfoDoc && <Tab label={t("reference_documents")} />}
                </Tabs>
                {selectedTab === 0 && hasSpecifications && (
                  <Box className="box">
                    <ul>
                      {product.specifications
                        .split("\n")
                        .filter((line) => line.trim() !== "")
                        .map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                    </ul>
                  </Box>
                )}
                {selectedTab === 1 && hasInfoDoc && (
                  <Box className="box">
                    {product.infoDoc.manual && product.infoDoc.manual.trim() !== "" && (
                      <Typography>
                        <a
                          href={product.infoDoc.manual}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Manual
                        </a>
                      </Typography>
                    )}
                    {product.infoDoc.dataSheet && product.infoDoc.dataSheet.trim() !== "" && (
                      <Typography>
                        <a
                          href={product.infoDoc.dataSheet}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Data sheet
                        </a>
                      </Typography>
                    )}
                    {product.infoDoc.catalog && product.infoDoc.catalog.trim() !== "" && (
                      <Typography>
                        <a
                          href={product.infoDoc.catalog}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Catalog
                        </a>
                      </Typography>
                    )}
                    {product.infoDoc.others && product.infoDoc.others.trim() !== "" && (
                      <Typography>
                        <a
                          href={product.infoDoc.others}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("other_documents")}
                        </a>
                      </Typography>
                    )}
                  </Box>
                )}
              </>
            )}
          </Box>
          {product?.features && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                {t("features")}
              </Typography>
              <Typography>{product.features}</Typography>
            </Box>
          )}
          {product?.operatingMethod && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                {t("operating_method")}
              </Typography>
              <Typography>{product.operatingMethod}</Typography>
            </Box>
          )}
          {product?.advantages && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                {t("advantages")}
              </Typography>
              <Typography>{product.advantages}</Typography>
            </Box>
          )}
          <Box className="box" sx={{ margin: "1rem 0" }}>
            <Typography variant="h6" gutterBottom>
              {t("rating")}
            </Typography>
            {reviews.filter((review) => review.email !== userEmail).length > 0 ? (
              reviews
                .filter((review) => review.email !== userEmail)
                .map((review, index) => (
                  <Paper
                    key={index}
                    elevation={3}
                    sx={{ padding: 2, marginBottom: 2 }}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      Email: {review.email}
                    </Typography>
                    <Typography>
                      <Rating name="rating" value={review.rating} readOnly />
                    </Typography>
                    <Typography>
                      <strong>Comment:</strong> {review.comment}
                    </Typography>
                  </Paper>
                ))
            ) : (
              <Typography>{t("no_reviews_yet")}</Typography>
            )}
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleReviewSubmit();
              }}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
              }}
            >
              <Box>
                <Typography gutterBottom>{t("rating")}:</Typography>
                <Rating
                  name="rating"
                  value={newReview.rating}
                  onChange={(e, newValue) =>
                    setNewReview({ ...newReview, rating: newValue || 0 })
                  }
                  precision={1}
                  max={5}
                />
              </Box>
              <TextField
                label={t("comment")}
                multiline
                rows={4}
                value={newReview.comment}
                onChange={(e) =>
                  setNewReview({ ...newReview, comment: e.target.value })
                }
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t("processing")
                  : userReview
                    ? t("update_review")
                    : t("submit_review")}
              </Button>
              {userReview && (
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDeleteReview}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("processing") : t("delete_review")}
                </Button>
              )}
            </Box>
          </Box>
        </div>
        <div style={{ color: "#1976d2" }}>
          <div className="sidebox-container">
            <div className="sidebox">
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {t("customer_support")}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <SmartphoneIcon sx={{ width: 15, height: 15 }} />
                <a
                  href="tel:+8413158383"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {t("hotline")}
                </a>
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <img src="/icons8-zalo.svg" alt="Zalo" width={15} height={15} />
                {t("contact_zalo")}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <MailOutlineIcon sx={{ width: 15, height: 15 }} />
                {t("send_email")}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <HelpOutlineIcon sx={{ width: 15, height: 15 }} />
                {t("faqs")}
              </Typography>
            </div>
            <div className="sidebox">
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {t("return_warranty")}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <VerifiedIcon sx={{ width: 15, height: 15 }} />
                {t("genuine_100")}
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <BeenhereIcon sx={{ width: 15, height: 15 }} />
                {t("genuine_warranty_label")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <UndoOutlinedIcon sx={{ width: 15, height: 15 }} />{t("return_3_days")}
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDisplay;