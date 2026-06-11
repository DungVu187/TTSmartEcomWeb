
import React, { useState, useEffect, useCallback } from "react";
import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Select,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import moment from "moment";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrderContext } from "../context/ordercontext";
import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogCartItems, setDialogCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogLoading, setDialogLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: "Tất cả",
    payment: "Tất cả",
    state: "Processing",
    phone: "",
    name: "",
    id: location.state?.orderId || "",
    startDate: "",
    endDate: "",
  });
  const { setOrderChanged } = useOrderContext();
  const socket = io(apiUrl, { withCredentials: true });

  // Hàm gọi API chung
  const apiFetch = async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Lỗi ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };

  // Lấy danh sách đơn hàng
  const fetchOrders = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      const queryFilters = {
        ...filters,
        status: filters.status === "Tất cả" ? "" : filters.status,
        payment: filters.payment === "Tất cả" ? "" : filters.payment,
        state: filters.state === "Tất cả" ? "" : filters.state,
      };

      const query = new URLSearchParams({
        page: currentPage,
        limit: rowsPerPage,
        ...queryFilters,
      }).toString();

      const data = await apiFetch(`${apiUrl}/orders?${query}`);
      if (data) {
        const formattedOrders = data.orders.map((order) => ({
          ...order,
          createdAt: moment(order.createdAt).format("HH:mm [ngày] DD-MM-YYYY"),
        }));
        setOrders(formattedOrders);
        setTotalOrders(data.total);
      }
      setLoading(false);
    },
    [filters, rowsPerPage]
  );

  // Cập nhật đơn hàng
  const updateOrder = async (_id, field, value) => {
    setConfirmAction({ _id, field, value, type: "update" });
    setIsConfirmDialogOpen(true);
  };

  // Xác nhận cập nhật hoặc hủy
  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    const { _id, field, value, type } = confirmAction;
    try {
      if (type === "update") {
        const result = await apiFetch(`${apiUrl}/orders/update-order/${_id}`, {
          method: "PUT",
          body: JSON.stringify({ field, value }),
        });

        if (result?.success) {
          setOrders((prev) =>
            prev.map((order) =>
              order._id === _id ? { ...order, [field]: value } : order
            )
          );
          toast.success(
            `Cập nhật ${
              field === "status" ? "trạng thái" : "thanh toán"
            } thành công`
          );

          // 🔄 Trigger cập nhật Sidebar
          setOrderChanged((prev) => !prev);
        }
      } else if (type === "cancel") {
        const result = await apiFetch(`${apiUrl}/orders/${_id}`, {
          method: "PUT",
          body: JSON.stringify({ state: "Cancelled" }),
        });

        if (result) {
          setOrders((prev) => prev.filter((order) => order._id !== _id));
          setIsDialogOpen(false);
          toast.success("Hủy đơn hàng thành công");

          // 🔄 Trigger cập nhật Sidebar
          setOrderChanged((prev) => !prev);
        }
      }
    } finally {
      setIsConfirmDialogOpen(false);
      setConfirmAction(null);
    }
  };

  // Lấy chi tiết đơn hàng
  const fetchOrderDetails = async (order) => {
    setDialogLoading(true);
    try {
      const productIds = order.cartItems.map((item) => item.productId);
      const result = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
        method: "POST",
        body: JSON.stringify({ ids: productIds }),
      });

      if (result?.success) {
        const cartItemsWithDetails = order.cartItems.map((item, index) => {
          const product =
            result.products.find((p) => p._id === item.productId) || {};
          const variant = product.variant?.[item.variantIndex] || {};
          return {
            name: product.name || "N/A",
            brand: product.brand || "N/A",
            variant: {
              price: variant.price || 0,
              imgUrl: variant.imgUrl || "",
            },
            quantity: item.quantity,
          };
        });
        setDialogCartItems(cartItemsWithDetails);
        setSelectedOrder(order);
        setIsDialogOpen(true);
      }
    } catch (error) {
      toast.error("Lỗi khi lấy chi tiết đơn hàng");
    }
    setDialogLoading(false);
  };

  // Xử lý tìm kiếm với debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders(1);
      setPage(0);
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [filters.phone, filters.id, fetchOrders]);

  // Xử lý orderId từ location.state
  useEffect(() => {
    if (location.state?.orderId) {
      setFilters((prev) => ({ ...prev, id: location.state.orderId }));
    }
  }, [location.state]);

  useEffect(() => {
  const handleOrderCreated = (data) => {
    toast.success("📦 Có đơn hàng mới!");
    fetchOrders(1); // Cập nhật danh sách
    setOrderChanged((prev) => !prev); // Thông báo cho Sidebar
  };

  const handleOrderCancelled = (data) => {
    toast("🚫 Một đơn hàng vừa bị hủy", { icon: "⚠️" });
    fetchOrders(1);
    setOrderChanged((prev) => !prev);
  };

  socket.on("order_created", handleOrderCreated);
  socket.on("order_cancelled", handleOrderCancelled);

  return () => {
    socket.off("order_created", handleOrderCreated);
    socket.off("order_cancelled", handleOrderCancelled);
  };
}, [fetchOrders, setOrderChanged]);

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Xử lý phân trang
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Mở dialog chi tiết
  const openDialog = (order) => {
    fetchOrderDetails(order);
  };

  // Đóng dialog chi tiết
  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedOrder(null);
    setDialogCartItems([]);
  };

  // Hủy đơn hàng
  const cancelOrder = (_id) => {
    setConfirmAction({ _id, type: "cancel" });
    setIsConfirmDialogOpen(true);
  };

  // Lấy nhãn trạng thái
  const getStatusLabel = (status) => {
    switch (status) {
      case "Processing":
        return "Đang xử lý";
      case "Delivering":
        return "Đang giao";
      case "Completed":
        return "Hoàn thành";
      default:
        return status;
    }
  };

  // Lấy màu trạng thái
  const getStatusColor = (status) => {
    switch (status) {
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

  // Lấy trạng thái tiếp theo
  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case "Processing":
        return "Delivering";
      case "Delivering":
        return "Completed";
      default:
        return currentStatus; // Không cho phép quay lại Processing
    }
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={3}>
        <CircularProgress />
        <Typography mt={2}>Đang tải danh sách đơn hàng...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" mb={3}>
        Quản lý đơn hàng
      </Typography>

      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            label="Trạng thái"
            size="small"
          >
            <MenuItem value="Tất cả">Tất cả</MenuItem>
            <MenuItem value="Processing">Đang xử lý</MenuItem>
            <MenuItem value="Delivering">Đang giao</MenuItem>
            <MenuItem value="Completed">Hoàn thành</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Thanh toán</InputLabel>
          <Select
            name="payment"
            value={filters.payment}
            onChange={handleFilterChange}
            label="Thanh toán"
            size="small"
          >
            <MenuItem value="Tất cả">Tất cả</MenuItem>
            <MenuItem value="true">Đã thanh toán</MenuItem>
            <MenuItem value="false">Chưa thanh toán</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Tình trạng</InputLabel>
          <Select
            name="state"
            value={filters.state}
            onChange={handleFilterChange}
            label="Tình trạng"
            size="small"
          >
            <MenuItem value="Processing">Đang chờ</MenuItem>
            <MenuItem value="Cancelled">Đã hủy</MenuItem>
          </Select>
        </FormControl>

        <TextField
          name="phone"
          label="Số điện thoại"
          value={filters.phone}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          sx={{ width: 200 }}
        />

        <TextField
          name="name"
          label="Tên người dùng"
          value={filters.name}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          sx={{ width: 200 }}
        />

        <TextField
          name="id"
          label="Mã đơn hàng"
          value={filters.id}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          sx={{ width: 235 }}
        />

        <TextField
          name="startDate"
          label="Từ ngày"
          type="date"
          value={filters.startDate}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />

        <TextField
          name="endDate"
          label="Đến ngày"
          type="date"
          value={filters.endDate}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Mã đơn hàng</TableCell>
              <TableCell align="center">Số điện thoại</TableCell>
              <TableCell align="center">Tên người dùng</TableCell>
              <TableCell align="center">Tổng tiền</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell align="center">Thanh toán</TableCell>
              <TableCell align="center">Tạo lúc</TableCell>
              <TableCell align="center">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order._id}>
                <TableCell align="center">{order._id}</TableCell>
                <TableCell align="center">{order.userPhone}</TableCell>
                <TableCell align="center">{order.userName || "N/A"}</TableCell>
                <TableCell align="center">
                  {Number(order.total).toLocaleString("vi-VN")} ₫
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getStatusLabel(order.status)}
                    color={getStatusColor(order.status)}
                    onClick={() =>
                      updateOrder(
                        order._id,
                        "status",
                        getNextStatus(order.status)
                      )
                    }
                    clickable
                    sx={{
                      cursor:
                        order.status === "Completed" ? "default" : "pointer",
                    }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={order.payment ? "Đã thanh toán" : "Chưa thanh toán"}
                    color={order.payment ? "success" : "error"}
                    onClick={() =>
                      updateOrder(order._id, "payment", !order.payment)
                    }
                    clickable
                  />
                </TableCell>
                <TableCell align="center">{order.createdAt}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => openDialog(order)}
                  >
                    Chi tiết
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalOrders}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết đơn hàng {selectedOrder?._id}</DialogTitle>
        <DialogContent>
          {dialogLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : selectedOrder ? (
            <Box>
              <Typography mb={2}>
                Số điện thoại: {selectedOrder.userPhone}
              </Typography>
              <Typography mb={2}>
                Tổng tiền: {Number(selectedOrder.total).toLocaleString("vi-VN")}{" "}
                ₫
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center">Hình ảnh</TableCell>
                      <TableCell align="center">Tên sản phẩm</TableCell>
                      <TableCell align="center">Thương hiệu</TableCell>
                      <TableCell align="center">Số lượng</TableCell>
                      <TableCell align="center">Giá</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dialogCartItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell align="center">
                          {item.variant.imgUrl ? (
                            <img
                              src={item.variant.imgUrl}
                              alt={item.name}
                              style={{
                                width: 50,
                                height: 50,
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell align="center">{item.name}</TableCell>
                        <TableCell align="center">{item.brand}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="center">
                          {Number(item.variant.price).toLocaleString("vi-VN")} ₫
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Typography>Không có dữ liệu</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="error"
            onClick={() => cancelOrder(selectedOrder?._id)}
            disabled={
              selectedOrder?.status === "Completed" ||
              selectedOrder?.state === "Cancelled"
            }
          >
            Hủy đơn hàng
          </Button>
          <Button variant="outlined" onClick={closeDialog}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
      >
        <DialogTitle>Xác nhận hành động</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc chắn muốn{" "}
            {confirmAction?.type === "cancel"
              ? "hủy đơn hàng này"
              : `cập nhật ${
                  confirmAction?.field === "status"
                    ? "trạng thái"
                    : "thanh toán"
                }`}
            ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmDialogOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmAction}
          >
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Orders;
