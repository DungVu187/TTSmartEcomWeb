import React, { useEffect, useState, useContext } from "react";
import { Grid, Typography, Button, Box, Rating, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { 
  WorkspacePremiumOutlined, 
  LocalShippingOutlined, 
  CachedOutlined, 
  SupportAgentOutlined, 
  ArrowForward, 
  ShoppingCartOutlined 
} from "@mui/icons-material";
import { ShopContext } from "../context/shopcontext";

const apiUrl = process.env.REACT_APP_BACK_END;

const MainPage = () => {
  const [sections, setSections] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const navigate = useNavigate();
  const { addToCart } = useContext(ShopContext);

  useEffect(() => {
    // Load categories / sections
    fetch(`${apiUrl}/chips/section-doc`)
      .then((res) => res.json())
      .then((data) => {
        const fullSections = data.Section || [];
        const filtered = fullSections.filter((sec) => sec.imgUrl);
        const sorted = filtered.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        setSections(sorted);
      })
      .catch((error) => {
        console.error("Lỗi khi fetch section-doc:", error);
      });

    // Load top purchased products
    fetch(`${apiUrl}/products/top-purchased`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFeaturedProducts(data);
        }
      })
      .catch((error) => {
        console.error("Lỗi khi fetch top products:", error);
      });
  }, []);

  const handleClick = (sectionName) => {
    navigate(`/section/${sectionName}`);
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "4rem" }}>
      {/* 1. Hero Banner Section */}
      <Box
        sx={{
          position: "relative",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          py: { xs: 8, md: 12 },
          px: 3,
          textAlign: "center",
          overflow: "hidden",
          mb: 6,
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.15) 0%, transparent 50%)",
            pointerEvents: "none",
          }
        }}
      >
        <Box sx={{ maxWidth: "800px", margin: "auto", position: "relative", zIndex: 1 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "2.2rem", md: "3.5rem" },
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              mb: 2,
              background: "linear-gradient(to right, #ffffff, #93c5fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Tự Động Hóa & Giải Pháp Trạm Trộn Thông Minh
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: { xs: "1rem", md: "1.25rem" },
              color: "#94a3b8",
              fontWeight: 400,
              mb: 4,
              maxWidth: "700px",
              mx: "auto",
              lineHeight: 1.6
            }}
          >
            TTSMART chuyên thiết kế, chế tạo hệ thống tự động hóa, dây chuyền sản xuất vật liệu xây dựng và phát triển phần mềm quản lý trạm trộn bê tông (TTSmartBP) hàng đầu Việt Nam.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="contained"
              onClick={() => {
                const element = document.getElementById("featured-categories");
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }}
              sx={{
                bgcolor: "#2563eb",
                hover: { bgcolor: "#1d4ed8" },
                px: 4,
                py: 1.5,
                borderRadius: "30px",
                fontWeight: 600,
                textTransform: "none",
                fontSize: "1rem",
                boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.3)",
              }}
            >
              Xem danh mục sản phẩm
            </Button>
            <Button
              variant="outlined"
              href="tel:0813158383"
              sx={{
                color: "#ffffff",
                borderColor: "rgba(255,255,255,0.3)",
                "&:hover": {
                  borderColor: "#ffffff",
                  bgcolor: "rgba(255,255,255,0.05)"
                },
                px: 4,
                py: 1.5,
                borderRadius: "30px",
                fontWeight: 600,
                textTransform: "none",
                fontSize: "1rem"
              }}
            >
              Liên hệ tư vấn trạm
            </Button>
          </Box>
        </Box>
      </Box>

      <div style={{ maxWidth: "1600px", margin: "auto", padding: "0 16px" }}>
        {/* 2. Lưới Danh Mục Thiết Bị (Category Grid) */}
        <Box id="featured-categories" sx={{ mb: 8 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              textAlign: "center",
              mb: 1,
              letterSpacing: "-0.01em",
              color: "#0f172a"
            }}
          >
            Danh Mục Linh Kiện & Trạm Trộn
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: "center", color: "#64748b", mb: 5, maxWidth: "600px", mx: "auto" }}
          >
            Lựa chọn hệ thống trạm trộn bê tông thông minh và các cụm cảm biến đo lường chính xác cao.
          </Typography>

          <Grid container spacing={3}>
            {sections.map((section, index) => (
              <Grid item key={index} xs={12} sm={6} md={4}>
                <Paper
                  className="glass-panel"
                  onClick={() => handleClick(section.name)}
                  sx={{
                    height: "360px",
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover .category-image": {
                      transform: "scale(1.08)",
                      filter: "brightness(0.9)"
                    },
                    "&:hover .category-footer": {
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      borderColor: "#2563eb",
                    }
                  }}
                >
                  {/* Background Image */}
                  <Box
                    className="category-image"
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundImage: `url(${section.imgUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      transition: "transform 0.5s ease",
                      zIndex: 1,
                    }}
                  />
                  {/* Category Footer Panel */}
                  <Box
                    className="category-footer"
                    sx={{
                      position: "relative",
                      zIndex: 2,
                      m: 2,
                      p: 2.5,
                      bgcolor: "rgba(255, 255, 255, 0.75)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.4)",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: "1rem",
                        color: "#0f172a",
                        letterSpacing: "0.05em"
                      }}
                    >
                      {section.name}
                    </Typography>
                    <ArrowForward sx={{ color: "#2563eb" }} />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* 3. Sản Phẩm Nổi Bật (Featured Products Section) */}
        {featuredProducts.length > 0 && (
          <Box sx={{ mb: 8 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                textAlign: "center",
                mb: 1,
                letterSpacing: "-0.01em",
                color: "#0f172a"
              }}
            >
              Sản Phẩm Bán Chạy Nhất
            </Typography>
            <Typography
              variant="body1"
              sx={{ textAlign: "center", color: "#64748b", mb: 5, maxWidth: "600px", mx: "auto" }}
            >
              Các module điện tử và linh kiện trạm được đối tác tin dùng hàng đầu.
            </Typography>

            <Grid container spacing={3}>
              {featuredProducts.slice(0, 4).map((product) => {
                const firstVariant = product.variant?.[0] || {};
                return (
                  <Grid item key={product._id} xs={12} sm={6} md={3}>
                    <Paper
                      className="glass-panel"
                      sx={{
                        p: 2,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        overflow: "hidden"
                      }}
                    >
                      {/* Product Image */}
                      <Box
                        onClick={() => navigate(`/product/${product._id}`)}
                        sx={{
                          height: "180px",
                          borderRadius: "10px",
                          overflow: "hidden",
                          bgcolor: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          mb: 2,
                          p: 1,
                          "&:hover img": {
                            transform: "scale(1.06)"
                          }
                        }}
                      >
                        <img
                          src={firstVariant.imgUrl || "placeholder.jpg"}
                          alt={product.name}
                          style={{
                            maxHeight: "100%",
                            maxWidth: "100%",
                            objectFit: "contain",
                            transition: "transform 0.3s ease"
                          }}
                        />
                      </Box>

                      {/* Brand Info Tag */}
                      <Box sx={{ mb: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            bgcolor: "#eff6ff",
                            color: "#2563eb",
                            fontWeight: 600,
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

                      {/* Product Title */}
                      <Typography
                        variant="h6"
                        onClick={() => navigate(`/product/${product._id}`)}
                        sx={{
                          fontWeight: 700,
                          fontSize: "1.05rem",
                          lineHeight: 1.4,
                          color: "#0f172a",
                          cursor: "pointer",
                          mb: 1,
                          flexGrow: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          "&:hover": {
                            color: "#2563eb"
                          }
                        }}
                      >
                        {product.name}
                      </Typography>

                      {/* Rating stars */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                        <Rating
                          value={product.averageReviews || 5}
                          precision={0.5}
                          readOnly
                          size="small"
                        />
                        <Typography variant="caption" sx={{ color: "#64748b" }}>
                          ({product.reviewCount || 0})
                        </Typography>
                      </Box>

                      {/* Price & Add to Cart button */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="body1" sx={{ fontWeight: 800, color: "#1e293b", fontSize: "1.1rem" }}>
                          {Number(firstVariant.price).toLocaleString("vi-VN")} đ
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={() => addToCart(product._id, 0)}
                          sx={{
                            minWidth: "auto",
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            p: 0,
                            bgcolor: "#2563eb",
                            "&:hover": {
                              bgcolor: "#1d4ed8"
                            }
                          }}
                        >
                          <ShoppingCartOutlined sx={{ fontSize: "1.2rem", color: "#fff" }} />
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* 4. Banner Cam Kết Chất Lượng (Trust Badges Section) */}
        <Box sx={{ mt: 8 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <WorkspacePremiumOutlined sx={{ fontSize: "3rem", color: "#2563eb", mb: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  100% Chính Hãng
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.5 }}>
                  Cam kết linh kiện nhập khẩu nguyên chiếc, đầy đủ hóa đơn chứng từ.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <LocalShippingOutlined sx={{ fontSize: "3rem", color: "#2563eb", mb: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Giao Hàng Toàn Quốc
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.5 }}>
                  Đóng gói cẩn thận, vận chuyển hỏa tốc đảm bảo tiến độ công trình.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <CachedOutlined sx={{ fontSize: "3rem", color: "#2563eb", mb: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  3 Ngày Đổi Trả
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.5 }}>
                  Đổi trả linh hoạt và hoàn tiền nếu linh kiện phát sinh lỗi từ nhà sản xuất.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <SupportAgentOutlined sx={{ fontSize: "3rem", color: "#2563eb", mb: 2 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
                  Hỗ Trợ Kỹ Thuật 24/7
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.5 }}>
                  Đội ngũ kỹ sư giàu kinh nghiệm tư vấn lắp đặt và vận hành trạm trộn.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </div>
    </div>
  );
};

export default MainPage;
