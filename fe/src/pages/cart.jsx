import React, { useContext, useEffect, useState } from "react";
import { ShopContext } from "../context/shopcontext";
import {
  Box,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  IconButton,
  Container,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Delete, Add, Remove } from "@mui/icons-material";
import "./styles/cart.css";
import { toast } from "react-hot-toast";

function Cart() {
  const {
    cartItems,
    updateCartItem,
    removeFromCart,
    clearCart,
    updateCartItemStatus,
  } = useContext(ShopContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [openClearDialog, setOpenClearDialog] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACK_END}/users/profile`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  const handleClearItems = () => {
    setOpenClearDialog(true);
  };

  const confirmClearItems = () => {
    clearCart();
    setOpenClearDialog(false);
  };

  const cancelClearItems = () => {
    setOpenClearDialog(false);
  };

  let totalPrice = 0;
  cartItems.forEach((item) => {
    if (item.status) {
      const product = products.find((p) => p._id === item.productId);
      if (product) {
        const variant = product.variant[item.variantIndex];
        if (variant && variant.price) {
          totalPrice += variant.price * item.quantity;
        }
      }
    }
  });

  const createOrder = async () => {
    if (isCreatingOrder) return;
    setIsCreatingOrder(true);

    try {
      if (!isLoggedIn) {
        toast.error("Bạn cần phải đăng nhập để đặt hàng");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        return;
      }

      const selectedItems = cartItems.filter((item) => item.status);
      if (selectedItems.length === 0) {
        toast.error("Bạn chưa chọn sản phẩm nào để đặt hàng!");
        return;
      }

      // Kiểm tra số lượng tồn kho trước khi đặt hàng
      for (const item of selectedItems) {
        const productRes = await fetch(
          `${process.env.REACT_APP_BACK_END}/products/${item.productId}`,
          {
            credentials: "include",
          }
        );
        const productData = await productRes.json();
        const variant = productData.variant[item.variantIndex];
        if (variant.quantityForSale < item.quantity) {
          toast.error(
            `Không đủ hàng cho sản phẩm ${productData.name}, chỉ còn ${variant.quantityForSale} sản phẩm.`
          );
          return;
        }
      }

      let total = 0;
      selectedItems.forEach((item) => {
        const product = products.find((p) => p._id === item.productId);
        if (product) {
          const variant = product.variant[item.variantIndex];
          if (variant && variant.price) {
            total += variant.price * item.quantity;
          }
        }
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACK_END}/orders/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cartItems: selectedItems,
            total,
          }),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          setTimeout(() => {
            window.location.href = "/login";
          }, 1000);
          return;
        }
        throw new Error(data.message || "Đặt hàng thất bại!");
      }

      toast.success("Đặt hàng thành công");
      await fetchProducts(); // Cập nhật lại danh sách sản phẩm
      // Xóa các sản phẩm đã đặt khỏi giỏ hàng
      selectedItems.forEach((item) => {
        removeFromCart(item.productId, item.variantIndex);
      });
    } catch (error) {
      console.error("Lỗi khi đặt hàng:", error);
      toast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại sau!");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productPromises = cartItems.map((item) => {
        const productId = item.productId;
        return fetch(`${process.env.REACT_APP_BACK_END}/products/${productId}`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .catch((err) => {
            console.error("Error fetching product:", err);
            return null;
          });
      });

      const fetchedProducts = await Promise.all(productPromises);
      setProducts(fetchedProducts.filter((product) => product !== null));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Không thể tải thông tin sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cartItems.length > 0) {
      fetchProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [cartItems]);

  if (loading) {
    return (
      <Container sx={{ display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <div style={{ width: '100%', backgroundColor: 'rgb(235, 246, 254)', padding: '3rem 0', minHeight: '100vh' }}>
      <Container sx={{ backgroundColor: 'white', margin: 'auto', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)', padding: '2rem 0' }}>
        <h1>Giỏ hàng</h1>
        {cartItems.length === 0 ? (
          <Typography variant="body1">
            Giỏ hàng của bạn hiện tại trống.
          </Typography>
        ) : (
          <List>
            <ListItem
              sx={{
                display: "flex",
                alignItems: "center",
                fontWeight: "bold",
                bgcolor: "grey.100",
                py: 1,
              }}
            >
              <Box sx={{ width: 40 }} />
              <Box sx={{ width: 56 }} />
              <Box
                sx={{
                  flexGrow: 1,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 2,
                  marginLeft: "2rem",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", gridColumn: "1 / 2" }}
                >
                  Sản phẩm
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", gridColumn: "2 / 3" }}
                >
                  Giá
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", gridColumn: "3 / 4" }}
                >
                  Thuộc tính
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", width: 120, margin: "0 -1rem 0 2rem" }}
              >
                Số lượng
              </Typography>
              <Box sx={{ width: 40 }} />
            </ListItem>

            {cartItems.map((item, index) => {
              const product = products.find((p) => p._id === item.productId);
              if (!product) {
                return (
                  <ListItem key={`${item.productId}-${item.variantIndex}`}>
                    <ListItemText primary="Không tìm thấy thông tin sản phẩm." />
                  </ListItem>
                );
              }

              const variant = product.variant[item.variantIndex];

              return (
                <ListItem
                  key={`${product._id}-${item.variantIndex}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    opacity: item.status ? 1 : 0.5,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  <Checkbox
                    checked={item.status}
                    onChange={() => {
                      updateCartItemStatus(
                        item.productId,
                        item.variantIndex,
                        !item.status
                      );
                    }}
                  />
                  <ListItemAvatar>
                    <Avatar
                      src={variant?.imgUrl || "placeholder.jpg"}
                      alt={product.name}
                      sx={{ width: 56, height: 56 }}
                    />
                  </ListItemAvatar>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 2,
                      alignItems: "center",
                      flexGrow: 1,
                      margin: "0 0 0 2rem",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: "bold", gridColumn: "1 / 2" }}
                    >
                      {product.name}
                    </Typography>
                    <Typography variant="body2" sx={{ gridColumn: "2 / 3" }}>
                      {Number(variant?.price).toLocaleString("vi-VN")} vnđ
                    </Typography>
                    <Typography sx={{ gridColumn: "3 / 4", display: "grid" }}>
                      {[
                        variant?.color,
                        variant?.shape,
                        variant?.frame,
                        variant?.buttonCount,
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                    </Typography>
                  </Box>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton
                      onClick={() => {
                        const newQuantity = item.quantity - 1;
                        if (newQuantity >= 1) {
                          updateCartItem(
                            item.productId,
                            item.variantIndex,
                            newQuantity
                          );
                        }
                      }}
                      disabled={item.quantity <= 1}
                    >
                      <Remove />
                    </IconButton>
                    <TextField
                      size="small"
                      type="number" value={item.quantity}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value, 10);
                        if (!isNaN(newValue) && newValue >= 1) {
                          updateCartItem(
                            item.productId,
                            item.variantIndex,
                            newValue
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const parsedValue = parseInt(e.target.value, 10);
                        const product = products.find(
                          (p) => p._id === item.productId
                        );
                        const variant = product?.variant[item.variantIndex];

                        if (!parsedValue || parsedValue < 1) {
                          updateCartItem(item.productId, item.variantIndex, 1);
                          toast.error("Số lượng tối thiểu là 1!");
                        } else if (parsedValue > variant?.quantityForSale) {
                          updateCartItem(
                            item.productId,
                            item.variantIndex,
                            variant.quantityForSale
                          );
                          toast.error(
                            `Số lượng tối đa là ${variant?.quantityForSale}`
                          );
                        }
                      }}
                      inputProps={{
                        min: 1,
                        style: { textAlign: "center", width: 20 },
                      }}
                      sx={{
                        mx: 1,
                        "& input[type=number]::-webkit-inner-spin-button": {
                          display: "none",
                        },
                        "& input[type=number]::-webkit-outer-spin-button": {
                          display: "none",
                        },
                        "& input[type=number]": { MozAppearance: "textfield" },
                      }}
                    />
                    <IconButton
                      onClick={() => {
                        const product = products.find(
                          (p) => p._id === item.productId
                        );
                        const variant = product?.variant[item.variantIndex];
                        if (variant && item.quantity < variant.quantityForSale) {
                          updateCartItem(
                            item.productId,
                            item.variantIndex,
                            item.quantity + 1
                          );
                        } else {
                          toast.error(`Không còn đủ số lượng hàng để đặt thêm`);
                        }
                      }}
                    >
                      <Add />
                    </IconButton>
                  </div>
                  <IconButton
                    color="error"
                    onClick={() =>
                      removeFromCart(item.productId, item.variantIndex)
                    }
                  >
                    <Delete />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "baseline",
            color: "#555",
          }}
        >
          <h2>Tổng:</h2>
          <p style={{ fontWeight: "600", marginLeft: "10px" }}>
            {totalPrice.toLocaleString("vi-VN")} VND
          </p>
        </div>
        <div style={{ display: "grid", justifyContent: "end" }}>
          <Button
            variant="contained"
            color="error"
            size="small"
            sx={{ width: "130px", margin: "0 0 0 70px" }}
            onClick={handleClearItems}
            disabled={cartItems.length === 0}
          >
            Xóa giỏ hàng
          </Button>
          <Button
            variant="contained"
            size="large"
            sx={{ width: "200px", marginTop: 2 }}
            onClick={createOrder}
            disabled={isCreatingOrder || cartItems.length === 0}
          >
            {isCreatingOrder ? "Đang xử lý..." : "Đặt hàng"}
          </Button>
        </div>

        <Dialog open={openClearDialog} onClose={cancelClearItems}>
          <DialogTitle>Xác nhận xóa giỏ hàng</DialogTitle>
          <DialogContent>
            <Typography>
              Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng không?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelClearItems} color="primary">
              Hủy
            </Button>
            <Button
              onClick={confirmClearItems}
              color="error"
              variant="contained"
            >
              Xóa
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
}

export default Cart;