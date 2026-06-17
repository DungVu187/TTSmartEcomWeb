import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Pagination,
  Tabs,
  Tab,
  Box,
} from "@mui/material";
import toast from "react-hot-toast";
import moment from "moment";

const apiUrl = process.env.REACT_APP_BACK_END;

const MyOrder = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedState, setSelectedState] = useState(""); // Trạng thái đơn hàng đang lọc ("" là tất cả)
  const ordersPerPage = 10;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${apiUrl}/users/profile`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          toast.error("Bạn chưa đăng nhập! Vui lòng đăng nhập để xem đơn hàng.");
          setLoading(false);
        }
      } catch (error) {
        setIsLoggedIn(false);
        toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const queryState = selectedState ? `&state=${selectedState}` : "";
        const response = await fetch(
          `${apiUrl}/orders/userOrders?${queryState}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (response.status === 404) {
          setOrders([]);
          setTotalPages(1);
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
            setTimeout(() => {
              window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }, 1000);
            return;
          }
          throw new Error(data.message || "Lỗi không xác định");
        }

        // Thực hiện phân trang ở client-side vì backend trả về tất cả đơn hàng
        const allOrders = data.orders || [];
        const total = allOrders.length;
        const calculatedTotalPages = Math.max(1, Math.ceil(total / ordersPerPage));

        // Cắt mảng lấy trang hiện tại
        const startIndex = (page - 1) * ordersPerPage;
        const endIndex = startIndex + ordersPerPage;
        const paginatedOrders = allOrders.slice(startIndex, endIndex);

        const updatedOrders = await Promise.all(
          paginatedOrders.map(async (order) => {
            const updatedCartItems = await Promise.all(
              order.cartItems.map(async (item) => {
                try {
                  const productRes = await fetch(
                    `${apiUrl}/products/${item.productId}`,
                    {
                      credentials: "include",
                    }
                  );
                  const productData = await productRes.json();
                  const variant = productData.variant[item.variantIndex] || {};

                  return {
                    ...item,
                    productName: productData.name,
                    productBrand: productData.brand,
                    productImage: variant.imgUrl,
                    productPrice: variant.price,
                    productColor: variant.color,
                    productShape: variant.shape,
                    productFrame: variant.frame,
                    productButtonCount: variant.buttonCount,
                  };
                } catch (err) {
                  console.error("Lỗi khi lấy sản phẩm:", err);
                  return { ...item, productName: "Không tìm thấy sản phẩm" };
                }
              })
            );
            return { ...order, cartItems: updatedCartItems };
          })
        );

        setOrders(updatedOrders);
        setTotalPages(calculatedTotalPages);
      } catch (err) {
        setError(err.message);
        toast.error(`Lỗi khi tải đơn hàng: ${err.message}`);
        setTotalPages(1); // Đặt mặc định để tránh NaN
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [page, isLoggedIn, selectedState]);

  const cancelOrder = async (orderId) => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`${apiUrl}/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "Cancelled" }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          setTimeout(() => {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }, 1000);
          return;
        }
        throw new Error(data.message || "Hủy đơn hàng thất bại!");
      }

      toast.success("Hủy đơn hàng thành công!");
      setOrders((prevOrders) =>
        prevOrders.filter((order) => order._id !== orderId)
      );
      setOpenDialog(false);
      setOpenCancelDialog(false);
    } catch (error) {
      toast.error(`Lỗi khi hủy đơn hàng: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenDialog = (order) => {
    setSelectedOrder(order);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setSelectedOrder(null);
    setOpenDialog(false);
  };

  const handleOpenCancelDialog = () => {
    setOpenCancelDialog(true);
  };

  const handleCloseCancelDialog = () => {
    setOpenCancelDialog(false);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "Processing":
        return "Đang xử lý";
      case "Delivering":
        return "Đang giao hàng";
      case "Completed":
        return "Hoàn thành";
      case "Cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Processing":
        return "warning";
      case "Delivering":
        return "info";
      case "Completed":
        return "success";
      case "Cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getEmptyMessage = () => {
    switch (selectedState) {
      case "Processing":
        return "Không có đơn hàng nào đang xử lý.";
      case "Delivering":
        return "Không có đơn hàng nào đang được giao.";
      case "Completed":
        return "Không có đơn hàng nào đã hoàn thành.";
      case "Cancelled":
        return "Không có đơn hàng nào bị hủy.";
      default:
        return "Bạn chưa có đơn hàng nào.";
    }
  };

  return (
    <div style={{ backgroundColor: 'rgb(235, 246, 254)', width: '100%', padding: '2rem 16px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <Container sx={{ minHeight: "80vh", textAlign: "center", width: '100%' }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Danh sách đơn hàng
        </Typography>

        {isLoggedIn && (
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={selectedState}
              onChange={(e, newValue) => {
                setSelectedState(newValue);
                setPage(1);
              }}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="trạng thái đơn hàng"
              sx={{
                '& .MuiTab-root': {
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '1rem',
                }
              }}
            >
              <Tab label="Tất cả" value="" />
              <Tab label="Đang xử lý" value="Processing" />
              <Tab label="Đang giao hàng" value="Delivering" />
              <Tab label="Hoàn thành" value="Completed" />
              <Tab label="Đã hủy" value="Cancelled" />
            </Tabs>
          </Box>
        )}

        {loading && <CircularProgress />}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && !isLoggedIn && (
          <Typography>Đăng nhập để xem danh sách đơn hàng.</Typography>
        )}
        {!loading && isLoggedIn && orders.length === 0 && (
          <Typography sx={{ my: 4, color: "text.secondary" }}>{getEmptyMessage()}</Typography>
        )}

        {!loading && isLoggedIn && orders.length > 0 && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">
                      <strong>Mã đơn</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Ngày đặt</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Sản phẩm</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Tổng tiền</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Thanh toán</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Trạng thái</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order._id}
                      onClick={() => handleOpenDialog(order)}
                      style={{ cursor: "pointer" }}
                      hover
                    >
                      <TableCell>{order._id}</TableCell>
                      <TableCell align="center">
                        {moment(order.createdAt).format("DD/MM/YYYY HH:mm")}
                      </TableCell>
                      <TableCell align="center">
                        {order.cartItems.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "8px",
                            }}
                          >
                            <Avatar
                              src={
                                item.productImage ||
                                "https://via.placeholder.com/50"
                              }
                              alt={item.productName}
                              sx={{ width: 56, height: 56 }}
                            />
                            <div>
                              <Typography variant="body1">
                                <strong>{item.productName}</strong>
                              </Typography>
                              <Typography variant="body2">
                                Số lượng: {item.quantity}
                              </Typography>
                            </div>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell align="center">
                        {order.total.toLocaleString()} VND
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={
                            order.payment ? "Đã thanh toán" : "Chưa thanh toán"
                          }
                          color={order.payment ? "success" : "error"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(order.status)}
                          color={getStatusColor(order.status)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                variant="outlined"
                color="primary"
                size="large"
              />
            </div>
          </>
        )}

        <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth>
          <DialogTitle>Chi tiết đơn hàng</DialogTitle>
          <DialogContent>
            {selectedOrder && (
              <>
                <Typography>
                  <strong>Mã đơn hàng:</strong> {selectedOrder._id}
                </Typography>
                <Typography>
                  <strong>Ngày đặt:</strong>{" "}
                  {moment(selectedOrder.createdAt).format("DD/MM/YYYY HH:mm")}
                </Typography>
                <Typography>
                  <strong>Tổng tiền:</strong>{" "}
                  {selectedOrder.total.toLocaleString()} VND
                </Typography>
                <Typography>
                  <strong>Trạng thái:</strong> {getStatusLabel(selectedOrder.status)}
                </Typography>

                <Typography variant="h6" gutterBottom>
                  Danh sách sản phẩm:
                </Typography>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell align="center">
                          <strong>Hình ảnh</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>Tên sản phẩm</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>Thuộc tính</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>Số lượng</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.cartItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell align="center">
                            <Avatar
                              src={item.productImage}
                              alt={item.productName}
                              sx={{ width: 56, height: 56 }}
                            />
                          </TableCell>
                          <TableCell align="center">{item.productName}</TableCell>
                          <TableCell align="center">
                            {[
                              item.productColor,
                              item.productShape,
                              item.productFrame,
                              item.productButtonCount,
                            ]
                              .filter(Boolean)
                              .join(" + ")}
                          </TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleOpenCancelDialog}
              color="error"
              variant="contained"
              disabled={
                isCancelling ||
                selectedOrder?.status === "Completed" ||
                selectedOrder?.status === "Delivering"
              }
            >
              Hủy đơn hàng
            </Button>
            <Button onClick={handleCloseDialog} color="primary">
              Đóng
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openCancelDialog} onClose={handleCloseCancelDialog}>
          <DialogTitle>Xác nhận hủy đơn hàng</DialogTitle>
          <DialogContent>
            <Typography>
              Bạn có chắc chắn muốn hủy đơn hàng{" "}
              <strong>{selectedOrder?._id}</strong> không?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCancelDialog} color="primary">
              Không
            </Button>
            <Button
              onClick={() => cancelOrder(selectedOrder._id)}
              color="error"
              variant="contained"
              disabled={isCancelling}
            >
              {isCancelling ? "Đang xử lý..." : "Hủy đơn hàng"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default MyOrder;