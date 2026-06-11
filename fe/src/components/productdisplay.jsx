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
        window.location.href = "/login";
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
          window.location.href = "/login";
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
            window.location.href = "/login";
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
            window.location.href = "/login";
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
                alt="Ảnh sản phẩm"
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
                <p>{product.type}</p>
                {/* Phần filter variant bị comment, giữ nguyên */}
                {/* <div className="product-filters">
                  {["color", "shape", "frame", "buttonCount"].some(
                    (filterKey) => product.variant.some((v) => v[filterKey])
                  ) && (
                    <div className="product-filters">
                      {["color", "shape", "frame", "buttonCount"].map(
                        (filterKey) => {
                          const options = Array.from(
                            new Set(product.variant.map((v) => v[filterKey]))
                          ).filter(Boolean);
                          if (options.length === 0) return null;
                          return (
                            <div key={filterKey} className="filter-group">
                              {options.map((option) => (
                                <button
                                  key={option}
                                  onClick={() =>
                                    handleFilterChange(filterKey, option)
                                  }
                                  className={`${
                                    filters[filterKey] === option
                                      ? "active-filter"
                                      : ""
                                  } ${
                                    activeValues[filterKey]?.has(option)
                                      ? "matching-filter"
                                      : "inactive-filter"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div> */}
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddToCart}
                startIcon={<ShoppingCartIcon />}
                sx={{
                  width: "90%",
                  margin: "auto",
                }}
              >
                Thêm vào giỏ hàng
              </Button>
            </div>
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
                  href="tel:+8413158383"
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