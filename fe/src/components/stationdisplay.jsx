import React, { useEffect, useState } from "react";
import { CircularProgress, Alert } from "@mui/material";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../context/languagecontext.jsx";
import "./style/stationdisplay.css";

const apiUrl = process.env.REACT_APP_BACK_END || "";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${apiUrl}${url}`;
};

const getSectionIcon = (sectionName) => {
  const name = String(sectionName || "").toLowerCase().trim();
  if (name.includes("tủ điện") || name.includes("tủ điều khiển") || name.includes("cabinet")) {
    return "fa-solid fa-table-cells-large";
  }
  if (name.includes("trạm trộn") || name.includes("mixer") || name.includes("bê tông")) {
    return "fa-solid fa-truck-moving";
  }
  if (name.includes("silo") || name.includes("bồn") || name.includes("cụm silo")) {
    return "fa-solid fa-database";
  }
  return "fa-solid fa-gears";
};

const getSectionSubtitle = (sectionName) => {
  const name = String(sectionName || "").toLowerCase().trim();
  if (name.includes("tủ điện") || name.includes("tủ điều khiển") || name.includes("cabinet")) {
    return "Hệ thống điều khiển và giám sát toàn bộ trạm";
  }
  if (name.includes("trạm trộn") || name.includes("mixer") || name.includes("bê tông")) {
    return "Hệ thống trộn và cấp liệu bê tông";
  }
  if (name.includes("silo") || name.includes("bồn") || name.includes("cụm silo")) {
    return "Hệ thống silo chứa và cấp liệu";
  }
  return "Hệ thống thiết bị chuyên dụng của trạm";
};

const StationDisplay = () => {
  const { t } = useLanguage();
  const { code } = useParams();
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [stationName, setStationName] = useState("");
  const [sectionCounts, setSectionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (code) {
      sessionStorage.setItem("activeStationCode", code);
    }
  }, [code]);

  useEffect(() => {
    const fetchStationSections = async () => {
      try {
        const res = await fetch(`${apiUrl}/stations/public/${code}`);
        if (!res.ok) throw new Error("failed_to_get_station_info");
        const data = await res.json();
        setStationName(data.stationName || "");
        const productIds = data.productId || [];

        if (productIds.length === 0) {
          setSections([]);
          setSectionCounts({});
          setLoading(false);
          return;
        }

        const resProduct = await fetch(`${apiUrl}/products/fetch-by-ids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: productIds })
        });
        const dataProduct = await resProduct.json();
        const products = dataProduct.products || [];

        // Count products per section
        const counts = {};
        const sectionSet = new Set();
        products.forEach(p => {
          if (p.display !== false && p.section) {
            sectionSet.add(p.section);
            counts[p.section] = (counts[p.section] || 0) + 1;
          }
        });

        setSectionCounts(counts);
        const uniqueSections = Array.from(sectionSet);

        // Fetch section image URLs
        const resImages = await fetch(`${apiUrl}/chips/sections/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: uniqueSections })
        });

        const imageData = await resImages.json();

        const resultSections = uniqueSections.map((name) => ({
          name,
          imgUrl: imageData[name] || ""
        }));

        setSections(resultSections);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStationSections();
  }, [code, t]);

  const handleClick = (sectionName) => {
    navigate(`/station/${code}/${sectionName}`);
  };

  if (loading) {
    return (
      <div className="station-detail-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="station-detail-container" style={{ padding: "40px" }}>
        <Alert severity="error">{t(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="station-detail-container">
      {/* Header Banner */}
      <section className="station-detail-header-banner">
        <div className="station-detail-header-banner-pattern" />
        
        <div className="station-detail-breadcrumbs">
          <Link to="/station">Trạm của tôi</Link>
          <span className="separator">›</span>
          <span>{stationName}</span>
        </div>

        <div className="station-detail-title-wrapper">
          <h1 className="station-detail-title">{stationName}</h1>
        </div>
      </section>

      {/* Main Bento grid content */}
      <section className="station-detail-content-shell">
        <div className="station-detail-grid">
          {sections.map((section, index) => {
            const hasPhoto = !!section.imgUrl;
            const iconClass = getSectionIcon(section.name);
            const subtitle = getSectionSubtitle(section.name);
            const count = sectionCounts[section.name] || 0;
            
            return (
              <div
                key={index}
                className={`station-detail-card ${hasPhoto ? "has-photo" : "no-photo"}`}
                style={hasPhoto ? { backgroundImage: `url(${resolveImageUrl(section.imgUrl)})` } : {}}
                onClick={() => handleClick(section.name)}
              >
                <div className="station-detail-card-content">
                  
                  {/* Top: Icon Badge */}
                  <div className="station-detail-card-icon-badge">
                    <i className={iconClass} />
                  </div>

                  {/* Bottom: Text and Action row */}
                  <div className="station-detail-card-bottom">
                    <div className="station-detail-card-text">
                      <h2 className="station-detail-card-title">{t(section.name)}</h2>
                      <p className="station-detail-card-subtitle">{t(subtitle)}</p>
                    </div>

                    <div className="station-detail-card-action-row">
                      <span className="station-detail-card-count-badge">
                        <i className="fa-solid fa-cube" /> {count} thiết bị
                      </span>
                      
                      <button className="station-detail-card-btn" type="button">
                        <i className="fa-solid fa-arrow-right" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default StationDisplay;
