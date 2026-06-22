import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Alert, Grid, Card, CardContent, Typography } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";

const apiUrl = process.env.REACT_APP_BACK_END;

const StationDisplay = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [stationName, setStationName] = useState("");
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
        // Gọi sản phẩm để lấy danh sách section có trong trạm
        const res = await fetch(`${apiUrl}/stations/public/${code}`);
        if (!res.ok) throw new Error("Không tìm thấy trạm");
        const data = await res.json();
        setStationName(data.stationName || "");
        const productIds = data.productId || [];

        if (productIds.length === 0) {
          setSections([]);
          setLoading(false);
          return;
        }

        // Gọi API để lấy thông tin sản phẩm
        const resProduct = await fetch(`${apiUrl}/products/fetch-by-ids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: productIds })
        });
        const dataProduct = await resProduct.json();
        const products = dataProduct.products || [];

        // Lấy danh sách section duy nhất có trong sản phẩm
        const sectionSet = new Set();
        products.forEach(p => {
          if (p.display !== false && p.section) {
            sectionSet.add(p.section);
          }
        });

        const uniqueSections = Array.from(sectionSet);

        // Gọi API để lấy imgUrl tương ứng
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
  }, [code]);

  const handleClick = (sectionName) => {
    navigate(`/station/${code}/${sectionName}`);
  };

  if (loading) return <Box mt={4} textAlign="center"><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ backgroundColor: "#ebf6fe", padding: 3, minHeight: "100vh" }}>
      <div style={{ maxWidth: "1800px", margin: "auto" }}>
        {stationName && (
          <Typography
            variant="h4"
            sx={{
              fontWeight: "bold",
              color: "#1e3a8a",
              mb: 4,
              textAlign: "left",
              textTransform: "uppercase",
              fontFamily: "'Outfit', 'Roboto', sans-serif",
              position: "relative",
              display: "inline-block",
              paddingBottom: "8px",
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "80px",
                height: "4px",
                backgroundColor: "#3b82f6",
                borderRadius: "2px",
              }
            }}
          >
            {stationName}
          </Typography>
        )}
        <Grid container spacing={2}>
          {sections.map((section, index) => (
            <Grid item key={index} xs={12} sm={6} md={6} lg={6} xl={6}>
              <Card
                onClick={() => handleClick(section.name)}
                sx={{
                  height: "300px",
                  backgroundImage: `url(${section.imgUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow: "none",
                  cursor: "pointer",
                  transition: "filter 0.3s ease",
                  "&:hover": { filter: "brightness(1.1)" },
                  textTransform: "uppercase"
                }}
              >
                <CardContent
                  sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                  }}
                >
                  <Typography variant="h5" align="center" color="#fff">
                    {section.name}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </div>
    </Box>
  );
};

export default StationDisplay;
