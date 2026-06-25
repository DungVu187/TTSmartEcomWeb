import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
import { useLanguage } from "../context/languagecontext.jsx";

const apiUrl = process.env.REACT_APP_BACK_END;

const MyOrder = () => {
  const { t } = useLanguage();
  const location = useLocation();
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
  const [selectedState, setSelectedState] = useState(() => {
    return sessionStorage.getItem("myorder_active_tab") || "";
  });
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
          toast.error(t("login_to_view_orders"));
          setLoading(false);
        }
      } catch (error) {
        setIsLoggedIn(false);
        toast.error(t("error_occurred"));
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
            toast.error(t("session_expired"));
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
        toast.error(`${t("error_loading_orders")}${err.message}`);
        setTotalPages(1); // Đặt mặc định để tránh NaN
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [page, isLoggedIn, selectedState]);

  useEffect(() => {
    if (orders.length > 0 && location.state?.autoOpenOrderId) {
      const foundOrder = orders.find(
        (order) => order._id === location.state.autoOpenOrderId
      );
      if (foundOrder) {
        handleOpenDialog(foundOrder);
        // Clear state to prevent dialog reopening on tab changes or browser back
        window.history.replaceState(null, "");
      }
    }
  }, [orders, location.state]);

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
          toast.error(t("session_expired"));
          setTimeout(() => {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }, 1000);
          return;
        }
        throw new Error(data.message || t("cancel_order_failed"));
      }

      toast.success(t("cancel_order_success"));
      setOrders((prevOrders) =>
        prevOrders.filter((order) => order._id !== orderId)
      );
      setOpenDialog(false);
      setOpenCancelDialog(false);
    } catch (error) {
      toast.error(`${t("cancel_order_failed")} ${error.message}`);
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

  const getStatusLabel = (order) => {
    if (!order) return "";
    if (order.state === "Cancelled") {
      return t("cancelled");
    }
    switch (order.status) {
      case "Processing":
        return t("state_processing");
      case "Delivering":
        return t("delivering");
      case "Completed":
        return t("completed");
      default:
        return order.status;
    }
  };

  const getStatusColor = (order) => {
    if (!order) return "default";
    if (order.state === "Cancelled") {
      return "error";
    }
    switch (order.status) {
      case "Processing":
        return "warning";
      case "Delivering":
        return "info";
      case "Completed":
        return "success";
      default:
        return "default";
    }
  };

  const getEmptyMessage = () => {
    switch (selectedState) {
      case "Processing":
        return t("no_processing_orders");
      case "Delivering":
        return t("no_delivering_orders");
      case "Completed":
        return t("no_completed_orders");
      case "Cancelled":
        return t("no_cancelled_orders");
      default:
        return t("no_orders_yet");
    }
  };

  return (
    <div style={{ backgroundColor: 'rgb(235, 246, 254)', width: '100%', padding: '2rem 16px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <Container sx={{ minHeight: "80vh", textAlign: "center", width: '100%' }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          {t("orders_list")}
        </Typography>

        {isLoggedIn && (
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={selectedState}
              onChange={(e, newValue) => {
                setSelectedState(newValue);
                setPage(1);
                sessionStorage.setItem("myorder_active_tab", newValue);
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
              <Tab label={t("all")} value="" />
              <Tab label={t("state_processing")} value="Processing" />
              <Tab label={t("delivering")} value="Delivering" />
              <Tab label={t("completed")} value="Completed" />
              <Tab label={t("cancelled")} value="Cancelled" />
            </Tabs>
          </Box>
        )}

        {loading && <CircularProgress />}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && !isLoggedIn && (
          <Typography>{t("login_to_view_orders_table")}</Typography>
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
                      <strong>{t("order_code")}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{t("order_date")}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{t("product_name")}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{t("total_money")}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{t("payment")}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>{t("status")}</strong>
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
                                {t("quantity")}: {item.quantity}
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
                            order.payment ? t("paid") : t("unpaid")
                          }
                          color={order.payment ? "success" : "error"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(order)}
                          color={getStatusColor(order)}
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
          <DialogTitle>{t("order_details")}</DialogTitle>
          <DialogContent>
            {selectedOrder && (
              <>
                <Typography>
                  <strong>{t("order_code_label")}</strong> {selectedOrder._id}
                </Typography>
                <Typography>
                  <strong>{t("order_date")}:</strong>{" "}
                  {moment(selectedOrder.createdAt).format("DD/MM/YYYY HH:mm")}
                </Typography>
                <Typography>
                  <strong>{t("total_money")}:</strong>{" "}
                  {selectedOrder.total.toLocaleString()} VND
                </Typography>
                <Typography>
                  <strong>{t("status")}:</strong> {getStatusLabel(selectedOrder)}
                </Typography>

                <Typography variant="h6" gutterBottom>
                  {t("product_list")}
                </Typography>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell align="center">
                          <strong>{t("image")}</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>{t("product_name")}</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>{t("attributes")}</strong>
                        </TableCell>
                        <TableCell align="center">
                          <strong>{t("quantity")}</strong>
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
                selectedOrder?.state === "Cancelled" ||
                selectedOrder?.status === "Completed" ||
                selectedOrder?.status === "Delivering"
              }
            >
              {t("cancel_order")}
            </Button>
            <Button onClick={handleCloseDialog} color="primary">
              {t("close")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openCancelDialog} onClose={handleCloseCancelDialog}>
          <DialogTitle>{t("confirm_cancel_order")}</DialogTitle>
          <DialogContent>
            <Typography>
              {t("confirm_cancel_order_msg").replace("{id}", selectedOrder?._id || "")}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCancelDialog} color="primary">
              {t("no")}
            </Button>
            <Button
              onClick={() => cancelOrder(selectedOrder._id)}
              color="error"
              variant="contained"
              disabled={isCancelling}
            >
              {isCancelling ? t("processing") : t("cancel_order")}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default MyOrder;