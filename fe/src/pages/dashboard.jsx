import React, { useState, useEffect, useRef } from "react";
import "./styles/dashboard.css";
import { Link, useLocation } from "react-router-dom";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay, FreeMode } from "swiper/modules";
import { Box, Typography, Container } from "@mui/material";
import { useLanguage } from "../context/languagecontext.jsx";

const apiUrl = process.env.REACT_APP_BACK_END;

function Dashboard() {
  const { t } = useLanguage();
  const [manageData, setManageData] = useState(null);
  const [products, setProducts] = useState([]);
  const [overViewImg, setOverViewImg] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loadingManageData, setLoadingManageData] = useState(true);
  const [loadingOverViewImg, setLoadingOverViewImg] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [error, setError] = useState(null);
  const imgRef = useRef(null);
  const [height, setHeight] = useState("auto");
  const location = useLocation();

  useEffect(() => {
    const updateHeight = () => {
      if (imgRef.current) {
        setHeight(imgRef.current.offsetWidth * 0.5);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    // Reset state để fetch lại từ đầu
    setManageData(null);
    setProducts([]);
    setOverViewImg([]);
    setPartners([]);
    setLoadingManageData(true);
    setLoadingOverViewImg(true);
    setLoadingPartners(true);
    setError(null);

    const fetchManageData = async () => {
      try {
        const response = await fetch(`${apiUrl}/manages/`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success) {
          setManageData(data.data);
          setOverViewImg(data.data.overViewImg || []);
          setPartners(data.data.partners || []);
          // Fetch sản phẩm dựa trên productId từ các section
          await fetchProductsByIds(data.data);
        } else {
          setError("Invalid data from /manages/: " + data.message);
        }
      } catch (err) {
        console.error("Manage Data Error:", err.message);
        setError((prev) => (prev ? `${prev}, Manage: ${err.message}` : `Manage: ${err.message}`));
      } finally {
        setLoadingManageData(false);
        setLoadingOverViewImg(false);
        setLoadingPartners(false);
      }
    };

    const fetchProductsByIds = async (manageData) => {
      try {
        // Lấy tất cả productId từ các section có display: true và >= 5 sản phẩm
        const allProductIds = [
          ...(manageData?.section1?.display && (manageData.section1.productId?.length >= 5) ? manageData.section1.productId : []),
          ...(manageData?.section2?.display && (manageData.section2.productId?.length >= 5) ? manageData.section2.productId : []),
          ...(manageData?.section3?.display && (manageData.section3.productId?.length >= 5) ? manageData.section3.productId : []),
          ...(manageData?.section4?.display && (manageData.section4.productId?.length >= 5) ? manageData.section4.productId : []),
          ...(manageData?.section5?.display && (manageData.section5.productId?.length >= 5) ? manageData.section5.productId : []),
          ...(manageData?.section6?.display && (manageData.section6.productId?.length >= 5) ? manageData.section6.productId : []),
          ...(manageData?.section7?.display && (manageData.section7.productId?.length >= 5) ? manageData.section7.productId : []),
          ...(manageData?.section8?.display && (manageData.section8.productId?.length >= 5) ? manageData.section8.productId : []),
          ...(manageData?.section9?.display && (manageData.section9.productId?.length >= 5) ? manageData.section9.productId : []),
          ...(manageData?.section10?.display && (manageData.section10.productId?.length >= 5) ? manageData.section10.productId : []),
        ];
        if (allProductIds.length > 0) {
          const response = await fetch(`${apiUrl}/products/fetch-by-ids`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: allProductIds }),
          });
          const result = await response.json();
          if (result.success) {
            setProducts(result.products);
          } else {
            setError(result.message || "Lỗi khi lấy sản phẩm");
          }
        }
      } catch (error) {
        console.error("Error fetching products by IDs:", error);
        setError((prev) => (prev ? `${prev}, Products: ${error.message}` : `Products: ${error.message}`));
      }
    };

    fetchManageData();
  }, [location.pathname]);

  if (error) return <p>{t("error_prefix")}{error}</p>;

  const SectionDisplayComponent = ({ sectionData, sectionName }) => {
    // Không hiển thị nếu display: false hoặc số lượng sản phẩm < 5
    if (!sectionData.display || sectionData.productId.length < 5) return null;

    const sectionProducts = sectionData.productId
      .map((id) => products.find((p) => p._id === id))
      .filter((p) => p); // Lọc bỏ undefined (nếu có)

    return sectionProducts.length > 0 ? (
      <div className="dashboard-best-selling-display">
        <div className="dashboard-best-selling-header">
          <span className="line" />
          <p>{t(sectionData.name || sectionName)}</p>
          <span className="line" />
        </div>
        <div className="dashboard-best-selling-container">
          <Swiper
            modules={[Navigation, FreeMode]}
            spaceBetween={20}
            slidesPerView={5}
            navigation={{ enabled: true }}
            loop={sectionProducts.length >= 5}
            freeMode={{ enabled: false }}
            breakpoints={{
              1024: { slidesPerView: 5 },
              768: { slidesPerView: 4 },
              0: { slidesPerView: "auto", navigation: { enabled: false }, freeMode: { enabled: true } },
            }}
          >
            {sectionProducts.map((product) => (
              <SwiperSlide
                key={product._id}
                style={{
                  backgroundColor: "white",
                  borderRadius: "5px",
                  width: "180px",
                }}
              >
                <div className="dashboard-best-selling-section">
                  <Link
                    className="dashboard-best-selling-link"
                    to={`/product/${product._id}`}
                  >
                    {product.variant?.length > 0 ? (
                      <img
                        loading="lazy"
                        src={product.variant[0].imgUrl}
                        alt={product.name}
                      />
                    ) : (
                      <img
                        loading="lazy"
                        src="/fallback-image.jpg"
                        alt="Không có ảnh"
                      />
                    )}
                  </Link>
                  <Typography
                    variant="body2"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {product.name}
                  </Typography>
                  <small
                    style={{
                      color: "rgb(255, 123, 0)",
                      fontWeight: "700",
                    }}
                  >
                    {product.variant?.length > 0
                      ? Number(product.variant[0].price).toLocaleString("vi-VN") + " vnđ"
                      : t("price_unavailable")}
                  </small>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    ) : null;
  };

  return (
    <div style={{ width: "100%", backgroundColor: "rgb(235, 246, 254)", paddingBottom: "3rem" }}>
      <div style={{ maxWidth: "1920px", margin: "0 auto" }}>
        {/* Banner với Swiper */}
        {loadingOverViewImg ? (
          <p>{t("loading_banner")}</p>
        ) : (
          <Swiper
            modules={[Pagination, Autoplay]}
            pagination={{ clickable: true }}
            autoplay={{ delay: 2500, disableOnInteraction: false }}
            loop={overViewImg.length > 1}
            spaceBetween={0}
            slidesPerView={1}
            style={{ aspectRatio: 16 / 5 }}
          >
            {overViewImg.length > 0 ? (
              overViewImg.map((imgUrl, index) => (
                <SwiperSlide key={index}>
                  <img
                    loading="lazy"
                    className="dashboard-banner"
                    src={imgUrl}
                    alt={`Banner ${index}`}
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 5,
                      objectFit: "fill",
                    }}
                  />
                </SwiperSlide>
              ))
            ) : (
              <SwiperSlide>
                <img
                  loading="lazy"
                  className="dashboard-banner"
                  src="/fallback-image.jpg"
                  alt="Fallback banner"
                  style={{ width: "100%", height, objectFit: "cover" }}
                />
              </SwiperSlide>
            )}
          </Swiper>
        )}

        <div className="dashboard-main-container">
          {loadingManageData ? (
            <p>{t("loading_sections")}</p>
          ) : manageData ? (
            <>
              <SectionDisplayComponent sectionData={manageData.section1} sectionName="Section 1" />
              <SectionDisplayComponent sectionData={manageData.section2} sectionName="Section 2" />
              <SectionDisplayComponent sectionData={manageData.section3} sectionName="Section 3" />
              <SectionDisplayComponent sectionData={manageData.section4} sectionName="Section 4" />
              <SectionDisplayComponent sectionData={manageData.section5} sectionName="Section 5" />
              <SectionDisplayComponent sectionData={manageData.section6} sectionName="Section 6" />
              <SectionDisplayComponent sectionData={manageData.section7} sectionName="Section 7" />
              <SectionDisplayComponent sectionData={manageData.section8} sectionName="Section 8" />
              <SectionDisplayComponent sectionData={manageData.section9} sectionName="Section 9" />
              <SectionDisplayComponent sectionData={manageData.section10} sectionName="Section 10" />
            </>
          ) : (
            <></>
          )}

          {/* Đối tác */}
          {loadingPartners ? (
            <p>{t("loading_partners")}</p>
          ) : partners.length > 0 ? (
            <Container
              maxWidth="lg"
              sx={{
                py: 4,
                backgroundColor: "white",
                borderRadius: "8px",
                boxShadow: "5px 0 5px rgba(0, 0, 0, 0.1)",
              }}
            >
              <Typography
                variant="h5"
                component="h2"
                align="center"
                gutterBottom
                sx={{ fontWeight: "bold", color: "#06295a" }}
              >
                {t("partners")}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Swiper
                  allowTouchMove={false}
                  modules={[Autoplay]}
                  autoplay={{ delay: 2000, disableOnInteraction: false }}
                  loop={partners.length >= 5}
                  spaceBetween={20}
                  slidesPerView={5}
                  breakpoints={{
                    1024: { slidesPerView: 5 },
                    768: { slidesPerView: 3 },
                    0: { slidesPerView: 2 },
                  }}
                >
                  {partners.map((imgUrl, index) => (
                    <SwiperSlide key={index}>
                      <Box
                        component="img"
                        src={imgUrl}
                        alt={`Partner ${index}`}
                        sx={{
                          width: "200px",
                          height: "100px",
                          objectFit: "fill",
                          borderRadius: 1,
                        }}
                      />
                    </SwiperSlide>
                  ))}
                </Swiper>
              </Box>
            </Container>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;