import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./styles/dashboard.css";
import solution1 from "../assets/solution/solution1.jpg";
import solution2 from "../assets/solution/solution2.jpg";
import solution3 from "../assets/solution/solution3.jpg";
import { ShopContext } from "../context/shopcontext";
import SafeProductImage from "../components/safeproductimage";

const apiUrl = process.env.REACT_APP_BACK_END || "";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${apiUrl}${url}`;
};

const getVersionedImageUrl = (url, version) => {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "1")}`;
};

const DEFAULT_BRANDS = [
  { label: "SIEMENS", query: "Siemens" },
  { label: "Schneider Electric", query: "Schneider" },
  { label: "LS ELECTRIC", query: "LS Electric" },
  { label: "OMRON", query: "Omron" },
  { label: "MITSUBISHI", query: "Mitsubishi" },
  { label: "ABB", query: "ABB" },
];

const resolveSectionLink = (name, types) => {
  const cleanName = (name || "").trim().toLowerCase();
  if (!cleanName) return "/product";
  const matchedType = types.find((t) => (t.Type || "").trim().toLowerCase() === cleanName);
  if (matchedType) {
    return `/product?type=${encodeURIComponent(matchedType.Type)}`;
  }
  return "/product";
};

const solutionCards = [
  { title: "Giải pháp trạm trộn bê tông", image: `${apiUrl}/images/manage_1783154141653.jpg` },
  { title: "Giải pháp tủ điện công nghiệp", image: solution1 },
  { title: "Giải pháp tự động hóa", image: solution2 },
  { title: "Giải pháp IoT - Giám sát", image: solution3 },
];

const projectCards = [
  { title: "Nhà máy bê tông Minh Đức", location: "Hà Nội", image: `${apiUrl}/images/manage_1783154141653.jpg` },
  { title: "Trạm trộn Xuân Mai", location: "Hòa Bình", image: `${apiUrl}/images/manage_1782370772347.jpg` },
  { title: "Nhà máy bê tông Hồng Hà", location: "Hưng Yên", image: `${apiUrl}/images/manage_1742375659876.jpg` },
  { title: "Dự án tự động hóa nhà máy", location: "Toàn quốc", image: solution2 },
];

const articleCards = [
  { date: "25/05/2024", title: "Hướng dẫn chọn PLC phù hợp cho trạm trộn bê tông", image: `${apiUrl}/images/manage_1742375659876.jpg` },
  { date: "20/05/2024", title: "So sánh biến tần Siemens G120 và G120X", image: solution1 },
  { date: "15/05/2024", title: "Giải pháp giám sát trạm trộn từ xa qua IoT", image: solution3 },
  { date: "10/05/2024", title: "Các lỗi thường gặp khi sử dụng HMI", image: solution2 },
];

function SectionHeader({ title, href = "/product" }) {
  return (
    <div className="home-section-heading">
      <h2>{title}</h2>
      <Link to={href}>Xem tất cả <i className="fa-solid fa-angle-right" /></Link>
    </div>
  );
}

function Dashboard() {
  const location = useLocation();
  const { addToCart } = useContext(ShopContext);
  const [manageData, setManageData] = useState(null);
  const [products, setProducts] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadHomeData = async () => {
      setLoading(true);
      try {
        const [manageResponse, typeResponse] = await Promise.all([
          fetch(`${apiUrl}/manages/`, { cache: "no-store" }),
          fetch(`${apiUrl}/chips/types`, { cache: "no-store" }),
        ]);

        const manageResult = await manageResponse.json();
        const typeResult = await typeResponse.json();
        const nextManageData = manageResult?.success ? manageResult.data : null;

        if (!active) return;
        setManageData(nextManageData);
        setTypes(Array.isArray(typeResult) ? typeResult : typeResult?.value || []);
        const activeSections = Object.keys(nextManageData || {})
          .filter((key) => /^section(1[0-1]|[1-9])$/.test(key) && nextManageData[key]?.display);
        
        const productIds = Array.from(new Set(
          activeSections.flatMap((key) => nextManageData[key]?.productId || [])
        ));

        if (productIds.length > 0) {
          const productResponse = await fetch(`${apiUrl}/products/fetch-by-ids`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: productIds }),
          });
          const productResult = await productResponse.json();
          if (active) setProducts(productResult?.success ? productResult.products || [] : []);
        } else if (active) {
          setProducts([]);
        }
      } catch (error) {
        console.error("Không thể tải dữ liệu trang chủ:", error);
        if (active) {
          setManageData(null);
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadHomeData();
    return () => { active = false; };
  }, [location.pathname]);

  const heroImages = useMemo(() => {
    const images = (manageData?.overViewImg || []).map(resolveImageUrl).filter(Boolean).reverse();
    return images.length > 0 ? images : [`${apiUrl}/images/manage_1783154141653.jpg`];
  }, [manageData]);

  const visibleTypes = types.slice(0, 9);
  const featuredBrands = useMemo(() => {
    if (manageData?.partners && Array.isArray(manageData.partners) && manageData.partners.length > 0) {
      return manageData.partners.map((partner) => ({ label: partner, query: partner }));
    }
    return DEFAULT_BRANDS;
  }, [manageData?.partners]);

  const section1Products = useMemo(() => {
    if (!manageData?.section1) return [];
    return (manageData.section1.productId || [])
      .map((id) => products.find((p) => p._id === id))
      .filter(Boolean);
  }, [manageData?.section1, products]);

  const specialSections = useMemo(() => {
    const list = [];
    for (let i = 2; i <= 11; i++) {
      const key = `section${i}`;
      const sec = manageData?.[key];
      if (sec && sec.display !== false) {
        const secProducts = (sec.productId || [])
          .map((id) => products.find((p) => p._id === id))
          .filter(Boolean);
        if (secProducts.length >= 5) {
          list.push({
            key,
            name: sec.name,
            image: sec.image,
            products: secProducts.slice(0, 5), // Lấy tối đa đúng 5 sản phẩm
          });
        }
      }
    }
    return list;
  }, [manageData, products]);

  return (
    <main className="customer-home">
      <div className="home-shell">
        <section className="home-hero-grid">
          <aside className="home-category-panel">
            <div className="home-category-title">
              <i className="fa-solid fa-list" /> Danh mục sản phẩm
            </div>
            <div className="home-category-list">
              {visibleTypes.map((type, index) => (
                <Link key={type._id || index} to={`/product?type=${encodeURIComponent(type.Type)}`}>
                  <span><i className={`fa-solid ${["fa-microchip", "fa-toggle-on", "fa-gauge-high", "fa-desktop", "fa-bolt", "fa-wave-square", "fa-plug", "fa-gears", "fa-boxes-stacked"][index % 9]}`} />{type.Type}</span>
                  <i className="fa-solid fa-angle-right" />
                </Link>
              ))}
            </div>
            <Link className="home-category-all" to="/product">
              <i className="fa-solid fa-border-all" /> Xem tất cả danh mục
            </Link>
          </aside>

          <div className="home-hero-slider">
            <Swiper
              modules={[Pagination, Autoplay]}
              pagination={{ clickable: true }}
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              loop={heroImages.length > 1}
            >
              {heroImages.map((image, index) => (
                <SwiperSlide key={`${image}-${index}`}>
                  <div className="home-hero-slide" style={{ backgroundImage: `url(${image})` }}>
                    <div className="home-hero-overlay" />
                    <div className="home-hero-copy">
                      <p className="home-hero-eyebrow">TTSMART INDUSTRIAL SOLUTIONS</p>
                      <h1>Giải pháp thiết bị<br /><span>cho trạm trộn bê tông</span></h1>
                      <ul>
                        <li><i className="fa-regular fa-circle-check" /> Chính hãng - Chất lượng</li>
                        <li><i className="fa-regular fa-circle-check" /> Tư vấn kỹ thuật chuyên sâu</li>
                        <li><i className="fa-regular fa-circle-check" /> Bảo hành chính hãng</li>
                      </ul>
                      <div className="home-hero-actions">
                        <Link className="home-primary-button" to="/product">Khám phá ngay</Link>
                        <Link className="home-secondary-button" to="/product"><i className="fa-regular fa-file-lines" /> Tải catalogue</Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </section>

        <section className="home-quick-categories" aria-label="Danh mục nổi bật">
          {visibleTypes.slice(0, 8).map((type, index) => {
            const matchingProduct = products.find((product) => product.type?.trim() === type.Type?.trim()) || products[index % Math.max(products.length, 1)];
            return (
              <Link key={type._id || index} to={`/product?type=${encodeURIComponent(type.Type)}`}>
                <div className="home-quick-category-image">
                  {matchingProduct?.variant?.[0]?.imgUrl ? (
                    <img src={resolveImageUrl(matchingProduct.variant[0].imgUrl)} alt="" />
                  ) : (
                    <i className="fa-solid fa-microchip" />
                  )}
                </div>
                <span>{type.Type}</span>
              </Link>
            );
          })}
          <Link className="home-quick-category-more" to="/product">
            <div className="home-quick-category-image"><i className="fa-solid fa-border-all" /></div>
            <span>Xem tất cả</span>
          </Link>
        </section>

        {section1Products.length >= 6 && manageData?.section1?.display !== false && (
          <section className="home-section">
            <SectionHeader title={manageData?.section1?.name || "Sản phẩm bán chạy"} />
            {loading ? (
              <div className="home-loading-row">Đang tải sản phẩm...</div>
            ) : (
              <Swiper
                modules={[Autoplay]}
                spaceBetween={16}
                slidesPerView={1}
                loop={section1Products.length > 1}
                autoplay={{
                  delay: 3000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                breakpoints={{
                  480: { slidesPerView: 2 },
                  768: { slidesPerView: 3 },
                  1024: { slidesPerView: 4 },
                  1280: { slidesPerView: 5 },
                  1440: { slidesPerView: 6 },
                }}
                className="home-product-swiper"
              >
                {section1Products.map((product) => {
                  const variant = product.variant?.[0] || {};
                  const inStock = Number(variant.quantityForSale || 0) > 0;
                  return (
                    <SwiperSlide key={product._id}>
                      <article className="home-product-card" style={{ height: "100%", margin: "2px" }}>
                        <Link className="home-product-image" to={`/product/${product._id}`}>
                          <SafeProductImage
                            src={getVersionedImageUrl(variant.imgUrl, product.updatedAt || product._id)}
                            alt={product.name}
                            className="home-product-canvas"
                          />
                        </Link>
                        <div className="home-product-brand">{product.brand || "TTSmart"}</div>
                        <Link className="home-product-name" to={`/product/${product._id}`}>{product.name}</Link>
                        <div className="home-product-rating"><span>★★★★★</span> <small>({product.reviewCount || 0})</small></div>
                        <div className="home-product-price">
                          {Number(variant.price) > 0 ? `${Number(variant.price).toLocaleString("vi-VN")} đ` : "Liên hệ"}
                        </div>
                        <div className="home-product-actions">
                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={() => inStock && addToCart(product._id, 0, 1)}
                            aria-label={`Thêm ${product.name} vào giỏ hàng`}
                          >
                            <i className="fa-solid fa-cart-shopping" />
                          </button>
                          <button type="button" aria-label="Thêm vào yêu thích"><i className="fa-regular fa-heart" /></button>
                        </div>
                      </article>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            )}
          </section>
        )}

        <section className="home-trust-strip">
          {[
            ["fa-certificate", "Hàng chính hãng", "Cam kết 100% chính hãng"],
            ["fa-shield-halved", "Bảo hành uy tín", "Bảo hành chính hãng"],
            ["fa-truck-fast", "Giao hàng toàn quốc", "Giao nhanh - Đúng hẹn"],
            ["fa-headset", "Hỗ trợ 24/7", "Tư vấn kỹ thuật miễn phí"],
          ].map(([icon, title, text]) => (
            <div key={title}><i className={`fa-solid ${icon}`} /><span><strong>{title}</strong><small>{text}</small></span></div>
          ))}
        </section>

        {manageData?.displayPartners !== false && (
          <section className="home-section home-brand-section">
            <SectionHeader title="Thương hiệu nổi bật" />
            <div className="home-brand-grid">
              {featuredBrands.map((brand, index) => (
                <Link key={brand.label} to={`/product?brand=${encodeURIComponent(brand.query)}`}>
                  <strong className={`brand-tone-${(index % 6) + 1}`}>{brand.label}</strong>
                  <small>{brand.label}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 10 mục đặc biệt */}
        {specialSections.map((sec) => (
          <section key={sec.key} className="home-category-row">
            {/* Khối trái cố định */}
            <div className={`category-highlight-card ${sec.image ? "has-image" : ""}`}>
              <div className="highlight-image-box">
                {sec.image ? (
                  <img src={resolveImageUrl(sec.image)} alt={sec.name} className="highlight-img" />
                ) : (
                  <div className="highlight-img-placeholder"><i className="fa-solid fa-microchip" /></div>
                )}
              </div>
              <div className="highlight-info-group">
                <h3 className="highlight-title">{sec.name || "Danh mục"}</h3>
                <Link to={resolveSectionLink(sec.name, types)} className="highlight-more-btn">
                  Xem thêm
                </Link>
              </div>
            </div>

            {/* Khối phải trượt Swiper */}
            <div className="category-slider-wrapper">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                spaceBetween={16}
                slidesPerView={1}
                loop={sec.products.length > 1}
                autoplay={{
                  delay: 4000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                breakpoints={{
                  480: { slidesPerView: 2 },
                  768: { slidesPerView: 3 },
                  1024: { slidesPerView: 4 },
                  1280: { slidesPerView: 5 },
                }}
                className="home-category-swiper"
              >
                {sec.products.map((product) => {
                  const variant = product.variant?.[0] || {};
                  const inStock = Number(variant.quantityForSale || 0) > 0;
                  return (
                    <SwiperSlide key={product._id}>
                      <article className="home-product-card" style={{ height: "100%", margin: "2px" }}>
                        <Link className="home-product-image" to={`/product/${product._id}`}>
                          <SafeProductImage
                            src={getVersionedImageUrl(variant.imgUrl, product.updatedAt || product._id)}
                            alt={product.name}
                            className="home-product-canvas"
                          />
                        </Link>
                        <div className="home-product-brand">{product.brand || "TTSmart"}</div>
                        <Link className="home-product-name" to={`/product/${product._id}`}>{product.name}</Link>
                        
                        {/* Thông số kỹ thuật chi tiết */}
                        <div className="home-product-specs">
                          <div><span>Loại sản phẩm:</span> <strong>{product.type || "N/A"}</strong></div>
                          <div><span>Cụm:</span> <strong>{product.section || "N/A"}</strong></div>
                          <div><span>Thiết bị:</span> <strong>{product.value || "N/A"}</strong></div>
                        </div>

                        <div className="home-product-price">
                          {Number(variant.price) > 0 ? `${Number(variant.price).toLocaleString("vi-VN")} đ` : "Liên hệ"}
                        </div>
                        <div className="home-product-actions">
                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={() => inStock && addToCart(product._id, 0, 1)}
                            aria-label={`Thêm ${product.name} vào giỏ hàng`}
                          >
                            <i className="fa-solid fa-cart-shopping" />
                          </button>
                          <button type="button" aria-label="Thêm vào yêu thích"><i className="fa-regular fa-heart" /></button>
                        </div>
                      </article>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>
          </section>
        ))}

        <section className="home-section">
          <SectionHeader title="Giải pháp của chúng tôi" href="/introduction" />
          <div className="home-editorial-grid home-solution-grid">
            {solutionCards.map((card) => (
              <article key={card.title} className="home-image-card">
                <img src={card.image} alt={card.title} loading="lazy" />
                <div className="home-image-card-overlay"><h3>{card.title}</h3><span>Xem chi tiết <i className="fa-solid fa-arrow-right" /></span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <SectionHeader title="Dự án tiêu biểu" href="/introduction" />
          <div className="home-editorial-grid home-project-grid">
            {projectCards.map((card) => (
              <article key={card.title} className="home-project-card">
                <img src={card.image} alt={card.title} loading="lazy" />
                <h3>{card.title}</h3><p>{card.location}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section" id="tin-tuc">
          <div className="home-section-heading"><h2>Tin tức & bài viết</h2><span className="home-static-section-link">Xem tất cả <i className="fa-solid fa-angle-right" /></span></div>
          <div className="home-editorial-grid home-article-grid">
            {articleCards.map((card) => (
              <article key={card.title} className="home-article-card">
                <img src={card.image} alt={card.title} loading="lazy" />
                <small>{card.date}</small><h3>{card.title}</h3><span>Xem chi tiết <i className="fa-solid fa-arrow-right" /></span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default Dashboard;
