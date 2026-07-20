import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./styles/dashboard.css";
import { ShopContext } from "../context/shopcontext";
import HomeCategoryIcon from "../components/homecategoryicon";
import SafeProductImage from "../components/safeproductimage";
import { getCategoryIcon, normalizeTypeName } from "../utils/homecategoryicons";
import { formatVariantPrice, isContactOnlyVariant } from "../utils/productpricing";

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

const buildAutomaticCategories = (types) =>
  types.slice(0, 9).map((type, index) => ({
    id: type._id || `automatic-category-${index}`,
    label: type.Type,
    type: type.Type,
    link: "",
    icon: type.icon || getCategoryIcon(type.Type),
    image: "",
    showSidebar: true,
    showQuick: index < 8,
  }));

const resolveCategoryLink = (category) => {
  const customLink = (category?.link || "").trim();
  if (customLink) return customLink;
  const type = (category?.type || "").trim();
  return type ? `/product?type=${encodeURIComponent(type)}` : "/product";
};

function HomeCategoryLink({ category, className, children }) {
  const href = resolveCategoryLink(category);
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link className={className} to={href}>{children}</Link>;
}

const resolveSectionLink = (name, types) => {
  const cleanName = (name || "").trim().toLowerCase();
  if (!cleanName) return "/product";
  const matchedType = types.find((t) => (t.Type || "").trim().toLowerCase() === cleanName);
  if (matchedType) {
    return `/product?type=${encodeURIComponent(matchedType.Type)}`;
  }
  return "/product";
};

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
          fetch(`${apiUrl}/products/types`, { cache: "no-store" }),
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
            credentials: "include",
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

  const homeCategories = useMemo(() => {
    const config = manageData?.homeCategoryConfig;
    if (config?.configured) {
      return (Array.isArray(config.items) ? config.items : [])
        .filter((item) => item?.label && (item?.type || item?.link))
        .map((item, index) => {
          const matchedType = types.find(
            (type) => normalizeTypeName(type.Type) === normalizeTypeName(item.type),
          );
          return {
            id: item.id || `configured-category-${index}`,
            label: item.label,
            type: item.type || "",
            link: item.link || "",
            icon: item.icon || matchedType?.icon || getCategoryIcon(item.type),
            image: item.image || "",
            showSidebar: item.showSidebar !== false,
            showQuick: item.showQuick !== false,
          };
        });
    }
    return buildAutomaticCategories(types);
  }, [manageData?.homeCategoryConfig, types]);
  const sidebarCategories = homeCategories.filter((category) => category.showSidebar);
  const quickCategories = homeCategories.filter((category) => category.showQuick);
  const hasSidebarCategories = (
    manageData?.homeCategoryConfig?.configured
      ? manageData.homeCategoryConfig.showSidebar !== false
      : true
  ) && sidebarCategories.length > 0;
  const showQuickCategories = (
    manageData?.homeCategoryConfig?.configured
      ? manageData.homeCategoryConfig.showQuickCategories !== false
      : true
  ) && quickCategories.length > 0;
  const sidebarTitle = manageData?.homeCategoryConfig?.configured
    ? manageData.homeCategoryConfig.sidebarTitle || "Danh mục sản phẩm"
    : "Danh mục sản phẩm";
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
        <section className={`home-hero-grid${hasSidebarCategories ? "" : " home-hero-grid--without-categories"}`}>
          {hasSidebarCategories && (
            <aside className="home-category-panel">
              <div className="home-category-title">
                <i className="fa-solid fa-list" /> {sidebarTitle}
              </div>
              <div className="home-category-list">
                {sidebarCategories.map((category) => (
                  <HomeCategoryLink key={category.id} category={category}>
                    <span><HomeCategoryIcon icon={category.icon} />{category.label}</span>
                    <i className="fa-solid fa-angle-right" />
                  </HomeCategoryLink>
                ))}
              </div>
              <Link className="home-category-all" to="/product">
                <i className="fa-solid fa-border-all" /> Xem tất cả danh mục
              </Link>
            </aside>
          )}

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

        {showQuickCategories && (
          <section className="home-quick-categories" aria-label="Danh mục nổi bật">
            {quickCategories.map((category) => {
              const matchingProduct = category.type
                ? products.find((product) => product.type?.trim() === category.type.trim())
                : null;
              const image = category.image || matchingProduct?.variant?.[0]?.imgUrl || "";
              return (
                <HomeCategoryLink key={category.id} category={category}>
                  <div className="home-quick-category-image">
                    {image ? (
                      <img src={resolveImageUrl(image)} alt="" />
                    ) : (
                      <HomeCategoryIcon icon={category.icon} />
                    )}
                  </div>
                  <span>{category.label}</span>
                </HomeCategoryLink>
              );
            })}
            <Link className="home-quick-category-more" to="/product">
              <div className="home-quick-category-image"><i className="fa-solid fa-border-all" /></div>
              <span>Xem tất cả</span>
            </Link>
          </section>
        )}

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
                  const canPurchase = !isContactOnlyVariant(variant);
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
                          {formatVariantPrice(variant, "đ")}
                        </div>
                        <div className="home-product-actions">
                          <button
                            type="button"
                            disabled={!canPurchase}
                            onClick={() => canPurchase && addToCart(product._id, 0, 1)}
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
                  const canPurchase = !isContactOnlyVariant(variant);
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
                          {formatVariantPrice(variant, "đ")}
                        </div>
                        <div className="home-product-actions">
                          <button
                            type="button"
                            disabled={!canPurchase}
                            onClick={() => canPurchase && addToCart(product._id, 0, 1)}
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

      </div>
    </main>
  );
}

export default Dashboard;
