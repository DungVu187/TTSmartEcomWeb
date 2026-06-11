import React from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Rating,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

function Item({ product }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/product/${product._id}`);
  };

  return (
    <Card
      onClick={handleClick}
      style={{ cursor: "pointer" }}
      sx={{
        transition: "0.3s",
        "&:hover": {
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.2)",
        },
        width: "300px", // Giữ chiều rộng của Card
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardMedia
        component="img"
        sx={{
          width: "100%",
          height: "200px",
          objectFit: "contain",
        }}
        image={product.variant[0]?.imgUrl || "placeholder.jpg"}
        alt={product.name}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.name}
        </Typography>
        <Rating name="rating" value={product.averageReviews} readOnly />
        <Typography variant="body2" color="text.secondary">
          {product.variant?.[0]?.price
            ? Number(product.variant[0].price).toLocaleString("vi-VN") + "VNĐ"
            : product.variant?.[0]
            ? "Liên hệ"
          : "Chưa có giá"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hãng: {product.brand}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default Item;
