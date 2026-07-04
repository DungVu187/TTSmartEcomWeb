
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
  Autocomplete,
} from "@mui/material";
import moment from "moment";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrderContext } from "../context/ordercontext";
import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL;

const removeVietnameseTones = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

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
    startDate: moment().subtract(30, "days").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
  });
  const { setOrderChanged } = useOrderContext();
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [newOrderUserPhone, setNewOrderUserPhone] = useState("");
  const [newOrderUserName, setNewOrderUserName] = useState("");
  const [newOrderItems, setNewOrderItems] = useState([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const uniqueNames = React.useMemo(() => {
    const names = orders.map((o) => o.userName).filter(Boolean);
    return Array.from(new Set(names));
  }, [orders]);

  const uniquePhones = React.useMemo(() => {
    const phones = orders.map((o) => o.userPhone).filter(Boolean);
    return Array.from(new Set(phones));
  }, [orders]);

  const uniqueOrderCodes = React.useMemo(() => {
    const codes = orders.map((o) => o.orderCode).filter(Boolean);
    return Array.from(new Set(codes));
  }, [orders]);

  // Trạng thái bộ lọc đã được debounce
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // Effect để debounce bộ lọc (các trường phone, id, name cần debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

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
        ...debouncedFilters,
        status: debouncedFilters.status === "Tất cả" ? "" : debouncedFilters.status,
        payment: debouncedFilters.payment === "Tất cả" ? "" : debouncedFilters.payment,
        state: debouncedFilters.state === "Tất cả" ? "" : debouncedFilters.state,
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
          completedAt: order.completedAt 
            ? moment(order.completedAt).format("HH:mm [ngày] DD-MM-YYYY") 
            : (order.status === "Completed" ? moment(order.createdAt).format("HH:mm [ngày] DD-MM-YYYY") : ""),
        }));
        setOrders(formattedOrders);
        setTotalOrders(data.total);
      }
      setLoading(false);
    },
    [debouncedFilters, rowsPerPage]
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
            `Cập nhật ${field === "status" ? "trạng thái" : "thanh toán"
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
          fetchOrders(page + 1);
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

  // Trigger lấy đơn hàng khi page hoặc fetchOrders thay đổi
  useEffect(() => {
    fetchOrders(page + 1);
  }, [page, fetchOrders]);

  // Xử lý orderId từ location.state
  useEffect(() => {
    if (location.state?.orderId) {
      setFilters((prev) => ({ ...prev, id: location.state.orderId }));
      setPage(0);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isCreateOrderDialogOpen || !productSearch.trim()) {
      setProductOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setProductLoading(true);
      const query = new URLSearchParams({
        search: productSearch,
        limit: 20,
      }).toString();
      const data = await apiFetch(`${apiUrl}/products?${query}`);
      setProductOptions(data?.products || []);
      setProductLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [isCreateOrderDialogOpen, productSearch]);

  useEffect(() => {
    let socketUrl = apiUrl;
    let socketOptions = {
      withCredentials: true,
      transports: ["websocket", "polling"],
    };

    try {
      const parsedUrl = new URL(apiUrl, window.location.origin);
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        socketUrl = parsedUrl.origin;
        socketOptions.path = parsedUrl.pathname.replace(/\/$/, "") + "/socket.io";
      }
    } catch (e) {
      console.warn("Lỗi phân tích cú pháp apiUrl cho socket:", e);
    }

    const socket = io(socketUrl, socketOptions);

    const handleOrderCreated = (data) => {
      toast.success("📦 Có đơn hàng mới!");
      fetchOrders(page + 1); // Cập nhật trang hiện tại
      setOrderChanged((prev) => !prev); // Thông báo cho Sidebar
    };

    const handleOrderCancelled = (data) => {
      toast("🚫 Một đơn hàng vừa bị hủy", { icon: "⚠️" });
      fetchOrders(page + 1);
      setOrderChanged((prev) => !prev);
    };

    socket.on("order_created", handleOrderCreated);
    socket.on("order_cancelled", handleOrderCancelled);

    return () => {
      socket.off("order_created", handleOrderCreated);
      socket.off("order_cancelled", handleOrderCancelled);
      socket.disconnect();
    };
  }, [fetchOrders, page, setOrderChanged]);

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(0); // Reset về trang đầu tiên khi đổi bộ lọc
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

  const formatPrice = (price) => {
    const value = typeof price === "number"
      ? price
      : Number(String(price || "0").replace(/\./g, "").replace(",", ".")) || 0;
    return value.toLocaleString("vi-VN");
  };

  const getVariantPrice = (variant) => {
    if (!variant) return 0;
    return typeof variant.price === "number"
      ? variant.price
      : Number(String(variant.price || "0").replace(/\./g, "").replace(",", ".")) || 0;
  };

  const resetCreateOrderDialog = () => {
    setCustomerOptions([]);
    setProductSearch("");
    setProductOptions([]);
    setSelectedProduct(null);
    setSelectedVariantIndex(0);
    setSelectedQuantity(1);
    setNewOrderUserPhone("");
    setNewOrderUserName("");
    setNewOrderItems([]);
    setCreatingOrder(false);
  };

  const openCreateOrderDialog = async () => {
    setIsCreateOrderDialogOpen(true);
    setCustomerLoading(true);
    const data = await apiFetch(`${apiUrl}/orders/customer-suggestions`);
    setCustomerOptions(data?.customers || []);
    setCustomerLoading(false);
  };

  const closeCreateOrderDialog = () => {
    setIsCreateOrderDialogOpen(false);
    resetCreateOrderDialog();
  };

  const addProductToNewOrder = () => {
    if (!selectedProduct) return;
    const variant = selectedProduct.variant?.[selectedVariantIndex];
    const quantity = Number(selectedQuantity);

    if (!variant || !Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Số lượng không hợp lệ");
      return;
    }

    setNewOrderItems((prev) => [
      ...prev,
      {
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        variantIndex: selectedVariantIndex,
        variantColor: variant.color || variant.shape || "Default",
        unitPrice: getVariantPrice(variant),
        quantity,
      },
    ]);
    setSelectedProduct(null);
    setSelectedVariantIndex(0);
    setSelectedQuantity(1);
    setProductSearch("");
  };

  const removeNewOrderItem = (index) => {
    setNewOrderItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const createAdminOrder = async () => {
    if (!/^\d{10,11}$/.test(newOrderUserPhone) || newOrderItems.length === 0) {
      toast.error("Vui lòng nhập số điện thoại và sản phẩm hợp lệ");
      return;
    }

    setCreatingOrder(true);
    const result = await apiFetch(`${apiUrl}/orders/admin-create-order`, {
      method: "POST",
      body: JSON.stringify({
        userPhone: newOrderUserPhone,
        userName: newOrderUserName,
        items: newOrderItems.map((item) => ({
          productId: item.productId,
          variantIndex: item.variantIndex,
          quantity: item.quantity,
        })),
      }),
    });
    setCreatingOrder(false);

    if (result?.success) {
      toast.success("Tạo đơn hàng thành công");
      fetchOrders(page + 1);
      setOrderChanged((prev) => !prev);
      closeCreateOrderDialog();
    }
  };

  const newOrderSubtotal = newOrderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  // Lấy nhãn trạng thái
  const getStatusLabel = (order) => {
    if (!order) return "";
    if (order.state === "Cancelled") return "Đã hủy";
    switch (order.status) {
      case "Processing":
        return "Đang xử lý";
      case "Delivering":
        return "Đang giao";
      case "Completed":
        return "Hoàn thành";
      default:
        return order.status;
    }
  };

  // Lấy màu trạng thái
  const getStatusColor = (order) => {
    if (!order) return "default";
    if (order.state === "Cancelled") return "error";
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
      <div className="sticky-header">
        <Typography variant="h4" mb={3}>
          Quản lý đơn hàng bán
        </Typography>
        <Button variant="contained" onClick={openCreateOrderDialog} sx={{ mb: 2 }}>
          Tạo đơn hàng mới
        </Button>

        <Box 
          display="flex" 
          gap={2} 
          mb={2} 
          flexWrap="wrap"
          sx={{
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" }
          }}
        >
          <FormControl sx={{ minWidth: { xs: "100%", sm: 120 }, width: { xs: "100%", sm: 120 } }}>
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

          <FormControl sx={{ minWidth: { xs: "100%", sm: 120 }, width: { xs: "100%", sm: 120 } }}>
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

          <FormControl sx={{ minWidth: { xs: "100%", sm: 120 }, width: { xs: "100%", sm: 120 } }}>
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

          <Autocomplete
            freeSolo
            size="small"
            options={uniquePhones}
            value={filters.phone}
            onInputChange={(event, newInputValue) => {
              setFilters((prev) => ({ ...prev, phone: newInputValue }));
            }}
            onChange={(event, newValue) => {
              setFilters((prev) => ({ ...prev, phone: newValue || "" }));
            }}
            filterOptions={(options, state) => {
              const inputValue = removeVietnameseTones(state.inputValue);
              return options.filter((option) =>
                removeVietnameseTones(option).includes(inputValue)
              );
            }}
            sx={{ width: { xs: "100%", sm: 200 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Số điện thoại"
                placeholder="Nhập số điện thoại..."
                variant="outlined"
              />
            )}
          />

          <Autocomplete
            freeSolo
            size="small"
            options={uniqueNames}
            value={filters.name}
            onInputChange={(event, newInputValue) => {
              setFilters((prev) => ({ ...prev, name: newInputValue }));
            }}
            onChange={(event, newValue) => {
              setFilters((prev) => ({ ...prev, name: newValue || "" }));
            }}
            filterOptions={(options, state) => {
              const inputValue = removeVietnameseTones(state.inputValue);
              return options.filter((option) =>
                removeVietnameseTones(option).includes(inputValue)
              );
            }}
            sx={{ width: { xs: "100%", sm: 200 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tên người dùng"
                placeholder="Nhập tên..."
                variant="outlined"
              />
            )}
          />

          <Autocomplete
            freeSolo
            size="small"
            options={uniqueOrderCodes}
            value={filters.id}
            onInputChange={(event, newInputValue) => {
              setFilters((prev) => ({ ...prev, id: newInputValue }));
            }}
            onChange={(event, newValue) => {
              setFilters((prev) => ({ ...prev, id: newValue || "" }));
            }}
            filterOptions={(options, state) => {
              const inputValue = removeVietnameseTones(state.inputValue);
              return options.filter((option) =>
                removeVietnameseTones(option).includes(inputValue)
              );
            }}
            sx={{ width: { xs: "100%", sm: 235 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Mã đơn hàng"
                placeholder="Nhập mã đơn..."
                variant="outlined"
              />
            )}
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
            sx={{ width: { xs: "100%", sm: 150 } }}
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
            sx={{ width: { xs: "100%", sm: 150 } }}
          />
        </Box>
      </div>

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
              <TableCell align="center">Hoàn thành lúc</TableCell>
              <TableCell align="center">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order._id}>
                <TableCell align="center">{order.orderCode || order._id}</TableCell>
                <TableCell align="center">{order.userPhone}</TableCell>
                <TableCell align="center">{order.userName || "N/A"}</TableCell>
                <TableCell align="center">
                  {Number(order.total).toLocaleString("vi-VN")} ₫
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getStatusLabel(order)}
                    color={getStatusColor(order)}
                    onClick={() => {
                      if (order.state === "Cancelled" || order.status === "Completed") return;
                      updateOrder(
                        order._id,
                        "status",
                        getNextStatus(order.status)
                      );
                    }}
                    clickable={order.state !== "Cancelled" && order.status !== "Completed"}
                    sx={{
                      cursor:
                        order.state === "Cancelled" || order.status === "Completed" ? "default" : "pointer",
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
                <TableCell align="center">{order.completedAt || ""}</TableCell>
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

      <Dialog open={isCreateOrderDialogOpen} onClose={closeCreateOrderDialog} maxWidth="md" fullWidth>
        <DialogTitle>Tạo đơn hàng mới</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Box display="flex" gap={2} flexDirection={{ xs: "column", sm: "row" }}>
              <Autocomplete
                freeSolo
                loading={customerLoading}
                options={customerOptions}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : `${option.phone || ""} - ${option.name || ""}`
                }
                inputValue={newOrderUserPhone}
                onInputChange={(event, newInputValue) => setNewOrderUserPhone(newInputValue)}
                onChange={(event, newValue) => {
                  if (newValue && typeof newValue !== "string") {
                    setNewOrderUserPhone(newValue.phone || "");
                    setNewOrderUserName(newValue.name || "");
                  }
                }}
                sx={{ flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Số điện thoại"
                    required
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {customerLoading ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <TextField
                label="Tên khách hàng"
                value={newOrderUserName}
                onChange={(event) => setNewOrderUserName(event.target.value)}
                sx={{ flex: 1 }}
              />
            </Box>

            <Box display="flex" gap={2} flexDirection={{ xs: "column", md: "row" }} alignItems={{ md: "center" }}>
              <Autocomplete
                loading={productLoading}
                options={productOptions}
                value={selectedProduct}
                inputValue={productSearch}
                onInputChange={(event, newInputValue) => setProductSearch(newInputValue)}
                onChange={(event, newValue) => {
                  setSelectedProduct(newValue);
                  setSelectedVariantIndex(0);
                }}
                getOptionLabel={(option) =>
                  option ? `${option.name || ""}${option.code ? ` - ${option.code}` : ""}` : ""
                }
                sx={{ flex: 2, minWidth: 240 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tìm sản phẩm"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productLoading ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <FormControl sx={{ minWidth: 180 }} disabled={!selectedProduct}>
                <InputLabel>Phiên bản</InputLabel>
                <Select
                  value={selectedVariantIndex}
                  label="Phiên bản"
                  onChange={(event) => setSelectedVariantIndex(Number(event.target.value))}
                >
                  {(selectedProduct?.variant || []).map((variant, index) => (
                    <MenuItem key={index} value={index}>
                      {variant.color || variant.shape || `Variant ${index + 1}`} - {formatPrice(variant.price)} ₫
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Số lượng"
                type="number"
                value={selectedQuantity}
                onChange={(event) => setSelectedQuantity(event.target.value)}
                inputProps={{ min: 1 }}
                sx={{ width: { xs: "100%", md: 120 } }}
              />

              <Button variant="contained" onClick={addProductToNewOrder} disabled={!selectedProduct}>
                Thêm vào đơn
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tên sản phẩm</TableCell>
                    <TableCell>Phiên bản</TableCell>
                    <TableCell align="right">Đơn giá</TableCell>
                    <TableCell align="right">SL</TableCell>
                    <TableCell align="right">Thành tiền</TableCell>
                    <TableCell align="center">Xóa</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {newOrderItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">Chưa có sản phẩm</TableCell>
                    </TableRow>
                  ) : (
                    newOrderItems.map((item, index) => (
                      <TableRow key={`${item.productId}-${item.variantIndex}-${index}`}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.variantColor}</TableCell>
                        <TableCell align="right">{formatPrice(item.unitPrice)} ₫</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatPrice(item.unitPrice * item.quantity)} ₫</TableCell>
                        <TableCell align="center">
                          <Button color="error" onClick={() => removeNewOrderItem(index)}>
                            Xóa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box display="flex" justifyContent="space-between" flexDirection={{ xs: "column", sm: "row" }} gap={1}>
              <Typography>Tạm tính: {formatPrice(newOrderSubtotal)} ₫</Typography>
              <Typography color="text.secondary">Server sẽ tính lại tổng tiền cuối cùng.</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateOrderDialog}>Hủy</Button>
          <Button
            variant="contained"
            onClick={createAdminOrder}
            disabled={creatingOrder || !/^\d{10,11}$/.test(newOrderUserPhone) || newOrderItems.length === 0}
          >
            {creatingOrder ? "Đang tạo..." : "Tạo đơn"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết đơn hàng {selectedOrder?.orderCode || selectedOrder?._id}</DialogTitle>
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
              : `cập nhật ${confirmAction?.field === "status"
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
