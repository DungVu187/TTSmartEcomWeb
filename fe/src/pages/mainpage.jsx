import React, { useEffect, useState } from "react";
import { Card, CardContent, Grid, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

const apiUrl = process.env.REACT_APP_BACK_END;

const MainPage = () => {
  const [sections, setSections] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${apiUrl}/chips/section-doc`)
      .then((res) => res.json())
      .then((data) => {
        const fullSections = data.Section || [];
        const filtered = fullSections.filter((sec) => sec.imgUrl); // Chỉ lấy section có ảnh
        const sorted = filtered.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        setSections(sorted);
      })
      .catch((error) => {
        console.error("Lỗi khi fetch section-doc:", error);
      });
  }, []);

  const handleClick = (sectionName) => {
    navigate(`/section/${sectionName}`);
  };

  return (
    <div style={{ backgroundColor: "#ebf6fe", padding: 16, minHeight: "100vh" }}>
      <div style={{ maxWidth: "1800px", margin: "auto" }}>
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
                  "&:hover": {
                    filter: "brightness(1.1)",
                  },
                  textTransform: 'uppercase'
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
    </div>
  );
};

export default MainPage;
