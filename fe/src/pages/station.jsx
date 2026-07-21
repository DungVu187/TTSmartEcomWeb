import React, { useEffect, useState, useMemo } from "react";
import { useLanguage } from "../context/languagecontext.jsx";
import { Link, useNavigate } from "react-router-dom";
import "./styles/station.css";
import concreteBannerBg from "../assets/concrete_station_banner_bg.png";

const apiUrl = process.env.REACT_APP_BACK_END || "";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${apiUrl}${url}`;
};

const Station = () => {
  const { t } = useLanguage();
  const [stationIds, setStationIds] = useState([]);
  const [stationMap, setStationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  
  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'grid'
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const authRes = await fetch(`${apiUrl}/users/profile`, {
          credentials: "include",
        });
        if (!authRes.ok) {
          setIsLoggedIn(false);
          setLoading(false);
          return;
        }

        setIsLoggedIn(true);

        const res = await fetch(`${apiUrl}/users/my-stations`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(t("failed_to_get_user_stations", "Không thể lấy trạm người dùng"));
        const data = await res.json();
        const ids = data.stations || [];
        setStationIds(ids);

        if (ids.length === 0) {
          setLoading(false);
          return;
        }

        const stationRes = await fetch(`${apiUrl}/stations/by-ids`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ ids }),
        });

        if (!stationRes.ok) throw new Error(t("failed_to_get_station_info", "Không thể lấy thông tin trạm"));
        const stations = await stationRes.json();

        const map = {};
        stations.forEach((s) => (map[s._id] = s));
        setStationMap(map);
      } catch (err) {
        console.error("❌ Lỗi khi tải dữ liệu:", err);
        setError(err.message || "Lỗi không xác định");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [t]);

  // Filter stations based on search term
  const filteredStations = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return stationIds
      .map((id) => stationMap[id])
      .filter(Boolean)
      .filter((s) => {
        if (!term) return true;
        return (
          s.stationName?.toLowerCase().includes(term) ||
          s.stationCode?.toLowerCase().includes(term) ||
          s.location?.toLowerCase().includes(term)
        );
      });
  }, [stationIds, stationMap, searchTerm]);

  const primaryStation = stationIds.map((id) => stationMap[id]).find(Boolean);

  if (loading) {
    return (
      <div className="station-page-container">
        <div className="station-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <div className="home-loading-row" style={{ width: "100%", padding: "40px" }}>Đang tải dữ liệu trạm...</div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="station-page-container">
        <div className="station-shell">
          <div className="station-login-box">
            <i className="fa-solid fa-lock" />
            <h2>Yêu cầu đăng nhập</h2>
            <p>Bạn cần đăng nhập bằng tài khoản khách hàng để truy cập và hiển thị danh sách các trạm của mình.</p>
            <Link className="station-login-btn" to={`/login?redirect=${encodeURIComponent("/station")}`}>Đăng nhập ngay</Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="station-page-container">
        <div className="station-shell">
          <div className="home-loading-row" style={{ color: "#ef4444", padding: "40px" }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: "28px", marginBottom: "12px" }} /><br />
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="station-page-container">
      <div className="station-shell">
        
        <section className="station-banner" style={{ backgroundImage: `url(${concreteBannerBg})` }}>
          <div className="station-banner-left">
            <div className="station-banner-eyebrow-container">
              <div className="station-banner-icon-badge">
                <i className="fa-solid fa-industry" />
              </div>
              <h1 className="station-banner-eyebrow-title">Trạm của tôi</h1>
            </div>
            {primaryStation && (
              <h2 className="station-banner-title">
                {primaryStation.stationName}
                {primaryStation.location ? ` - ${primaryStation.location}` : ""}
              </h2>
            )}
            <p style={{ marginTop: "12px" }}>Danh sách các trạm đã được gán cho tài khoản của bạn để quản lý và theo dõi.</p>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="station-stats-grid">
          <div className="station-stat-card">
            <div className="station-stat-icon-wrapper total">
              <i className="fa-solid fa-network-wired" />
            </div>
            <div className="station-stat-info">
              <span className="station-stat-label">Tổng số trạm</span>
              <span className="station-stat-number">{stationIds.length}</span>
              <span className="station-stat-subtext">Trạm đang hoạt động</span>
            </div>
          </div>
          
          <div className="station-stat-card">
            <div className="station-stat-icon-wrapper active">
              <i className="fa-solid fa-circle-check" />
            </div>
            <div className="station-stat-info">
              <span className="station-stat-label">Trạm hoạt động</span>
              <span className="station-stat-number">{stationIds.length}</span>
              <span className="station-stat-subtext">100% tổng số trạm</span>
            </div>
          </div>
          
          <div className="station-stat-card">
            <div className="station-stat-icon-wrapper maintenance">
              <i className="fa-solid fa-screwdriver-wrench" />
            </div>
            <div className="station-stat-info">
              <span className="station-stat-label">Trạm bảo trì</span>
              <span className="station-stat-number">0</span>
              <span className="station-stat-subtext">0% tổng số trạm</span>
            </div>
          </div>
          
          <div className="station-stat-card">
            <div className="station-stat-icon-wrapper stopped">
              <i className="fa-solid fa-circle-pause" />
            </div>
            <div className="station-stat-info">
              <span className="station-stat-label">Trạm dừng hoạt động</span>
              <span className="station-stat-number">0</span>
              <span className="station-stat-subtext">0% tổng số trạm</span>
            </div>
          </div>
        </section>

        {/* Main List Card */}
        <section className="station-list-section">
          
          {/* Header toolbar */}
          <div className="station-list-header">
            <div className="station-list-title-container">
              <h2 className="station-list-title">Danh sách trạm được gán</h2>
              <span className="station-list-count-badge">{filteredStations.length}</span>
            </div>
            
            <div className="station-list-actions">
              <div className="station-search-box">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                  type="text"
                  placeholder="Tìm kiếm trạm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="station-view-toggle">
                <button
                  type="button"
                  className={`station-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <i className="fa-solid fa-list" /> Danh sách
                </button>
                <button
                  type="button"
                  className={`station-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <i className="fa-solid fa-grip" /> Lưới
                </button>
              </div>
            </div>
          </div>

          {filteredStations.length === 0 ? (
            <div className="home-loading-row" style={{ padding: "40px" }}>
              Không tìm thấy trạm nào phù hợp.
            </div>
          ) : viewMode === "list" ? (
            /* Table list view */
            <>
              <div className="station-table-wrapper">
                <table className="station-custom-table">
                <thead>
                  <tr>
                    <th>Ảnh trạm</th>
                    <th>Tên trạm</th>
                    <th>Mã trạm</th>
                    <th>Số sản phẩm</th>
                    <th>Vị trí</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStations.map((station) => (
                    <tr
                      key={station._id}
                      onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                    >
                      <td>
                        <div className="station-table-img-container">
                          {station.imgUrl ? (
                            <img src={resolveImageUrl(station.imgUrl)} alt="" />
                          ) : (
                            <i className="fa-solid fa-industry" />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="station-name-cell">
                          <span className="station-name-primary">{station.stationName}</span>
                          <span className="station-name-secondary">{station.inviteCode || station.stationCode}</span>
                        </div>
                      </td>
                      <td>{station.stationCode}</td>
                      <td>
                        <span className="station-product-count-badge">
                          {station.productId?.length || 0}
                        </span>
                      </td>
                      <td>{station.location || "-"}</td>
                      <td>
                        <span className="station-status-pill active">
                          ● Hoạt động
                        </span>
                      </td>
                      <td>
                        <div className="station-action-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="station-btn-detail"
                            onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square" /> Xem chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              <div className="station-mobile-list">
                {filteredStations.map((station) => (
                  <button
                    type="button"
                    className="station-mobile-card"
                    key={station._id}
                    onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                  >
                    <span className="station-mobile-card-image">
                      {station.imgUrl ? (
                        <img src={resolveImageUrl(station.imgUrl)} alt="" />
                      ) : (
                        <i className="fa-solid fa-industry" />
                      )}
                    </span>
                    <span className="station-mobile-card-content">
                      <strong>{station.stationName}</strong>
                      <small>{station.inviteCode || station.stationCode}</small>
                      <span className="station-status-pill active">● Hoạt động</span>
                    </span>
                    <i className="fa-solid fa-angle-right station-mobile-card-arrow" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Grid bento view */
            <div className="station-grid-wrapper">
              {filteredStations.map((station) => (
                <div
                  className="station-grid-card"
                  key={station._id}
                  onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                >
                  <div className="station-grid-img-container">
                    {station.imgUrl ? (
                      <img src={resolveImageUrl(station.imgUrl)} alt="" />
                    ) : (
                      <i className="fa-solid fa-industry" />
                    )}
                    <div className="station-grid-status">
                      <span className="station-status-pill active">● Hoạt động</span>
                    </div>
                  </div>
                  
                  <div className="station-grid-content">
                    <h3 className="station-grid-title">{station.stationName}</h3>
                    <span className="station-grid-code">Mã: {station.stationCode}</span>
                    
                    <div className="station-grid-meta">
                      <div className="station-grid-meta-item">
                        <span className="station-grid-meta-label">Số sản phẩm</span>
                        <span className="station-grid-meta-value">{station.productId?.length || 0}</span>
                      </div>
                      <div className="station-grid-meta-item">
                        <span className="station-grid-meta-label">Vị trí</span>
                        <span className="station-grid-meta-value">{station.location || "-"}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="station-grid-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="station-btn-detail"
                      onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> Xem chi tiết
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Footer */}
          <div className="station-pagination-container">
            <span className="station-pagination-info">
              Hiển thị 1-{filteredStations.length} trong số {filteredStations.length} trạm
            </span>
            
            <div className="station-pagination-controls">
              <select className="station-page-select" defaultValue="10">
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
              </select>
              
              <div className="station-page-nav-wrapper">
                <button type="button" className="station-page-nav-btn" disabled>
                  <i className="fa-solid fa-angle-left" />
                </button>
                <button type="button" className="station-page-nav-btn active">1</button>
                <button type="button" className="station-page-nav-btn" disabled>
                  <i className="fa-solid fa-angle-right" />
                </button>
              </div>
            </div>
          </div>

        </section>
        
      </div>
    </div>
  );
};

export default Station;
