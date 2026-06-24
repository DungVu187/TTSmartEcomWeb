import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/languagecontext.jsx";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Avatar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const apiUrl = process.env.REACT_APP_BACK_END;

const Station = () => {
  const { t } = useLanguage();
  const [stationIds, setStationIds] = useState([]);
  const [stationMap, setStationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
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
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isLoggedIn) {
    return <Typography align="center" mt={4}>{t("login_to_view_stations", "Bạn cần đăng nhập để hiển thị danh sách trạm.")}</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (stationIds.length === 0) {
    return <Typography>{t("no_stations_yet", "Không có trạm nào")}</Typography>;
  }

  return (
    <div style={{ backgroundColor: '#ebf6fe', minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: '1800px', margin: 'auto' }}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>{t("station_image", "Ảnh trạm")}</strong></TableCell>
                <TableCell><strong>{t("station_name", "Tên trạm")}</strong></TableCell>
                <TableCell><strong>{t("station_code", "Mã trạm")}</strong></TableCell>
                <TableCell><strong>{t("product_count", "Số sản phẩm")}</strong></TableCell>
                <TableCell><strong>{t("location", "Vị trí")}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationIds.map((id) => {
                const station = stationMap[id];
                if (!station) return null;
                return (
                  <TableRow
                    key={id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/station/${station.inviteCode || station.stationCode}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                        <Avatar
                          src={station.imgUrl}
                          alt="Ảnh trạm"
                          variant="rounded"
                          sx={{ width: 64, height: 48 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{station.stationName}</TableCell>
                    <TableCell>{station.stationCode}</TableCell>
                    <TableCell>{station.productId?.length || 0}</TableCell>
                    <TableCell>{station.location || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
};

export default Station;
