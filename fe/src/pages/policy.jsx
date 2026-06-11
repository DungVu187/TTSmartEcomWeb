import React, { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
const apiUrl = process.env.REACT_APP_BACK_END;

const Policy = () => {
  const [policy, setPolicy] = useState("");

  // Fetch dữ liệu policy từ API khi component mount
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await fetch(`${apiUrl}/manages/`, {
          headers: {
            "Content-Type": 'application/json',
          },
        });
        const result = await response.json();
        if (result.success) {
          setPolicy(result.data.mainPolicy || "Chưa có chính sách");
        }
      } catch (error) {
        console.error("Error fetching policy:", error);
        setPolicy("Lỗi khi tải dữ liệu");
      }
    };

    fetchPolicy();
  }, []);  

  // Hàm xử lý định dạng văn bản
  const formatPolicy = (text) => {
    if (!text) return null;

    // Tách các đoạn văn bằng ký tự xuống dòng (\n)
    const paragraphs = text.split("\n").filter((line) => line.trim() !== "");

    return paragraphs.map((paragraph, index) => {
      const isHeading = /^\d+\.\s/.test(paragraph.trim());
      
      if (isHeading) {
        return (
          <Typography
            key={index}
            variant="body1"
            sx={{
              fontWeight: "bold", // In đậm đề mục
              marginBottom: "1rem",
            }}
          >
            {paragraph}
          </Typography>
        );
      } else {
        return (
          <Typography
            key={index}
            variant="body1"
            sx={{
              textIndent: "2rem", // Lui đầu dòng cho đoạn văn
              marginBottom: "1rem",
            }}
          >
            {paragraph}
          </Typography>
        );
      }
    });
  };

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "rgb(235, 246, 254)",
        minHeight: "500px",
        display: "flex",
      }}
    >
      <Box
        sx={{
          maxWidth: "1920px",
          width: "80%",
          padding: 4,
          backgroundColor: "white",
          margin: "2rem auto",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Typography variant="h5" gutterBottom align="center">
          Chính sách
        </Typography>
        <Box>{formatPolicy(policy)}</Box>
      </Box>
    </div>
  );
};

export default Policy;