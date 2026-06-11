import React, { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
const apiUrl = process.env.REACT_APP_BACK_END;

const Intro = () => {
  const [introduction, setIntroduction] = useState("");

  // Fetch dữ liệu introduction từ API khi component mount
  useEffect(() => {
    const fetchIntroduction = async () => {
      try {
        const response = await fetch(`${apiUrl}/manages/`, {
          headers: {
            "Content-Type": 'application/json',
          },
        });
        const result = await response.json();
        if (result.success) {
          setIntroduction(result.data.introduction || "Chưa có nội dung giới thiệu");
        }
      } catch (error) {
        console.error("Error fetching introduction:", error);
        setIntroduction("Lỗi khi tải dữ liệu");
      }
    };

    fetchIntroduction();
  }, []);

  // Hàm xử lý định dạng văn bản
  const formatIntroduction = (text) => {
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
          Giới thiệu
        </Typography>
        <Box>{formatIntroduction(introduction)}</Box>
      </Box>
    </div>
  );
};

export default Intro;