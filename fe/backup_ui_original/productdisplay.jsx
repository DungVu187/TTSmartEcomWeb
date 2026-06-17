import React, { useState, useEffect, useContext, useCallback } from "react";
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
    if (userEmail) {
      fetchReviews();
    }
  }, [userEmail, fetchReviews]);

  if (loading) {
    return <p>Loading product details...</p>;
  }

  if (!product) {
    return <p>Product not found.</p>;
  }

  const activeValues = getActiveValues();

  const handleAddToCart = () => {
    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!");
      setTimeout(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 1000);
      return;
    }
    if (selectedVariant) {
      addToCart(productId, selectedVariantIndex);
    }
  };

  const handleReviewSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!isLoggedIn) {
        toast.error("Vui lòng đăng nhập để đánh giá sản phẩm!");
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
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
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
        toast.success("Đã cập nhật đánh giá");
      } else {
        setReviews((prevReviews) => [...prevReviews, review]);
        toast.success("Đánh giá sản phẩm thành công");
      }

      setUserReview(review);
      fetchProduct();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Không thể gửi đánh giá");
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
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
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
      toast.success("Đánh giá đã được xóa!");
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Không thể xóa đánh giá");
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
    <div style={{ padding: "3rem 16px", minHeight: '100vh', boxSizing: 'border-box' }}>
      <div
        className="more-huge-container"
        style={{
          maxWidth: "1400px",
          margin: "auto",
          width: "100%",
          display: "flex",
          gap: "2rem",
          justifyContent: "center",
          flexWrap: "wrap"
        }}
      >
        <div className="huge-container" style={{ width: "850px", maxWidth: "100%" }}>
          <div className="produt-display-main-container" style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            {/* Left Column: Product Image Gallery */}
            <Paper
              className="glass-panel"
              sx={{
                flex: "1 1 450px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#ffffff",
                p: 2,
                borderRadius: "16px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
              }}
            >
              <img
                src={selectedVariant?.imgUrl}
                alt={product.name}
                style={{
                  width: "100%",
                  maxHeight: "360px",
                  objectFit: "contain",
                }}
              />
            </Paper>

            {/* Right Column: Product Core Info */}
            <Paper
              className="glass-panel"
              sx={{
                flex: "1 1 320px",
                p: 3,
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div style={{ textAlign: "left" }}>
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      bgcolor: "#eff6ff",
                      color: "#2563eb",
                      fontWeight: 700,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}
                  >
                    {product.brand}
                  </Typography>
                </Box>
                
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
                  {product.name}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Rating
                    name="rating"
                    value={product.averageReviews || 5}
                    precision={0.5}
                    readOnly
                    size="small"
                  />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    Lượt mua: {product.purchaseCount} | Đánh giá: ({product.reviewCount || 0})
                  </Typography>
                </Box>

                <Typography variant="subtitle2" sx={{ color: "#64748b", fontWeight: 600, mb: 1 }}>
                  Mã hàng: {product.code}
                </Typography>

                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2563eb", mb: 2 }}>
                  {Number(selectedVariant?.price).toLocaleString("vi-VN")} đ
                </Typography>

                <Typography variant="body2" sx={{ color: "#475569", mb: 3 }}>
                  Loại sản phẩm: <strong>{product.type}</strong>
                </Typography>

                {/* Phân loại sản phẩm (Variant Selector) */}
                {["color", "shape", "frame", "buttonCount"].some(
                  (filterKey) => product.variant && product.variant.some((v) => v[filterKey])
                ) && (
                  <div className="product-filters">
                    {["color", "shape", "frame", "buttonCount"].map(
                      (filterKey) => {
                        const options = Array.from(
                          new Set(product.variant.map((v) => v[filterKey]))
                        ).filter(Boolean);
                        if (options.length === 0) return null;
                        
                        const labelMap = {
                          color: "Màu sắc",
                          shape: "Hình dạng",
                          frame: "Khung vỏ",
                          buttonCount: "Số nút bấm"
                        };
                        
                        return (
                          <div key={filterKey} className="filter-group" style={{ marginBottom: "12px" }}>
                            <span className="filter-label" style={{ display: "block", marginBottom: "6px" }}>
                              {labelMap[filterKey] || filterKey}
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {options.map((option) => {
                                const isActive = filters[filterKey] === option;
                                const isMatching = activeValues[filterKey]?.has(option);
                                let chipClass = "filter-chip";
                                if (isActive) chipClass += " active-filter";
                                if (!isMatching && !isActive) chipClass += " inactive-filter";
                                
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => handleFilterChange(filterKey, option)}
                                    className={chipClass}
                                    disabled={!isMatching && !isActive}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="contained"
                onClick={handleAddToCart}
                startIcon={<ShoppingCartIcon />}
                sx={{
                  width: "100%",
                  bgcolor: "#2563eb",
                  "&:hover": {
                    bgcolor: "#1d4ed8"
                  },
                  py: 1.5,
                  borderRadius: "8px",
                  fontWeight: 700,
                  textTransform: "none",
                  fontSize: "1rem",
                  mt: 3,
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
                }}
              >
                Thêm vào giỏ hàng
              </Button>
            </Paper>
          </div>
          {product?.description && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                Mô tả sản phẩm
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
                  {hasSpecifications && <Tab label="Thông số kỹ thuật" />}
                  {hasInfoDoc && <Tab label="Tài liệu tham khảo" />}
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
                          Tài liệu khác
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
                Tính năng
              </Typography>
              <Typography>{product.features}</Typography>
            </Box>
          )}
          {product?.operatingMethod && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                Cách hoạt động
              </Typography>
              <Typography>{product.operatingMethod}</Typography>
            </Box>
          )}
          {product?.advantages && (
            <Box className="box">
              <Typography variant="h6" gutterBottom>
                Ưu điểm
              </Typography>
              <Typography>{product.advantages}</Typography>
            </Box>
          )}
          <Box className="box" sx={{ margin: "1rem 0" }}>
            <Typography variant="h6" gutterBottom>
              Đánh giá
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
              <Typography>Chưa có đánh giá nào</Typography>
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
                <Typography gutterBottom>Rating:</Typography>
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
                label="Bình luận"
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
                  ? "Đang xử lý..."
                  : userReview
                  ? "Cập nhật đánh giá"
                  : "Gửi đánh giá"}
              </Button>
              {userReview && (
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDeleteReview}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang xử lý..." : "Xóa đánh giá"}
                </Button>
              )}
            </Box>
          </Box>
        </div>
        <div style={{ color: "#1976d2" }}>
          <div className="sidebox-container">
            <div className="sidebox">
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Chăm sóc khách hàng
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <SmartphoneIcon sx={{ width: 15, height: 15 }} />
                <a
                  href="tel:0813158383"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  Đường dây nóng
                </a>
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <img src="/icons8-zalo.svg" alt="Zalo" width={15} height={15} />
                Liên hệ qua Zalo
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <MailOutlineIcon sx={{ width: 15, height: 15 }} />
                Gửi Email
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <HelpOutlineIcon sx={{ width: 15, height: 15 }} />
                Vấn đề thường gặp
              </Typography>
            </div>
            <div className="sidebox">
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Đổi trả & Bảo hành
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <VerifiedIcon sx={{ width: 15, height: 15 }} />
                100% Chính hãng
              </Typography>
              <Typography
                variant="body2"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <BeenhereIcon sx={{ width: 15, height: 15 }} />
                Tem bảo hành chính hãng
              </Typography>
              <Typography
                variant="body2"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <UndoOutlinedIcon sx={{ width: 15, height: 15 }} />3 ngày đổi
                trả
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDisplay;