import React, { useState, useContext } from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Rating,
  Box,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { ShopContext } from "../context/shopcontext";

function Item({ product }) {
  const navigate = useNavigate();
  const { addToCart } = useContext(ShopContext);
  const [quantity, setQuantity] = useState(1);

  const handleClick = () => {
    navigate(`/product/${product._id}`);
  };

  const handleAddToCartClick = (e) => {
    e.stopPropagation();
    addToCart(product._id, 0, quantity);
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
        {/* Số lượng tồn hiển thị chữ màu đen rõ ràng */}
        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, mt: 0.5 }}>
          Số lượng tồn: {product.variant?.[0]?.quantityForSale ?? 0}
        </Typography>

        {/* Bộ chọn số lượng & nút thêm nhanh vào giỏ hàng */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 2,
          }}
          onClick={(e) => e.stopPropagation()} // Ngăn sự kiện click lan truyền lên Card
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ccc",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
              style={{
                border: "none",
                background: "#f0f0f0",
                padding: "4px 8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              -
            </button>
            <span style={{ padding: "0 10px", fontSize: "0.9rem", minWidth: "20px", textAlign: "center" }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((prev) => prev + 1)}
              style={{
                border: "none",
                background: "#f0f0f0",
                padding: "4px 8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              +
            </button>
          </Box>

          <IconButton
            color="primary"
            onClick={handleAddToCartClick}
            sx={{
              backgroundColor: "primary.main",
              color: "white",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
              borderRadius: "4px",
              padding: "6px",
            }}
          >
            <ShoppingCartIcon fontSize="small" />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default Item;
