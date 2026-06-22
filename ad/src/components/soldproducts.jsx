
import React, { useState, useEffect, useCallback } from "react";
import {
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
  DialogContent,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";

const apiUrl = import.meta.env.VITE_API_URL;

const SoldProducts = () => {
  const [soldProducts, setSoldProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProductOrders, setSelectedProductOrders] = useState([]);
  const [selectedProductName, setSelectedProductName] = useState("");
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    payment: "Tất cả",
    startDate: moment().startOf("month").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
    productName: "",
  });

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

  // Lấy danh sách sản phẩm đã bán
  const fetchSoldProducts = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      try {
        const queryParams = {
          page: currentPage,
          limit: rowsPerPage,
          search: filters.productName,
          status: "Completed", // Chỉ lấy các đơn hàng đã giao thành công (Completed)
          state: "Processing", // Chỉ lấy các đơn hàng đang hoạt động (không bị hủy)
        };

        if (filters.payment !== "Tất cả") queryParams.payment = filters.payment;
        if (filters.startDate) queryParams.startDate = filters.startDate;
        if (filters.endDate) queryParams.endDate = filters.endDate;

        const query = new URLSearchParams(queryParams).toString();
        const data = await apiFetch(`${apiUrl}/orders?${query}`);
        if (!data) return;

        const orders = data.orders || [];
        const productMap = new Map();

        orders.forEach((order) => {
          if (!order.cartItems) return;
          order.cartItems.forEach((item) => {
            const key = `${item.productId}-${item.variantIndex}`;
            if (productMap.has(key)) {
              productMap.get(key).quantity += item.quantity;
              productMap.get(key).orders.push({
                orderId: order._id,
                phone: order.userPhone,
                quantity: item.quantity,
                createdAt: order.createdAt,
              });
            } else {
              productMap.set(key, {
                productId: item.productId,
                variantIndex: item.variantIndex,
                quantity: item.quantity,
                orders: [
                  {
                    orderId: order._id,
                    phone: order.userPhone,
                    quantity: item.quantity,
                    createdAt: order.createdAt,
                  },
                ],
              });
            }
          });
        });

        const productIds = Array.from(productMap.values()).map((p) => p.productId);
        const productsData = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
          method: "POST",
          body: JSON.stringify({ ids: productIds }),
        });

        if (!productsData?.success) {
          throw new Error("Không thể lấy chi tiết sản phẩm");
        }

        const productsWithDetails = Array.from(productMap.entries()).map(([key, product]) => {
          const productData = productsData.products.find((p) => p._id === product.productId) || {};
          const variant = productData.variant?.[product.variantIndex] || {};
          return {
            productId: product.productId,
            name: productData.name || "N/A",
            brand: productData.brand || "N/A",
            code: productData.code || "N/A",
            quantity: product.quantity,
            orders: product.orders.map((order) => ({
              ...order,
              createdAt: moment(order.createdAt).format("HH:mm [ngày] DD-MM-YYYY"),
            })),
            variant: {
              buttonCount: variant.buttonCount || 0,
              imgUrl: variant.imgUrl || "",
              price: variant.price || 0,
            },
          };
        });

        setSoldProducts(productsWithDetails);
        setTotalProducts(data.totalProducts || productsWithDetails.length);
      } catch (error) {
        toast.error("Lỗi khi lấy danh sách sản phẩm đã bán");
      } finally {
        setLoading(false);
      }
    },
    [filters, rowsPerPage, navigate]
  );

  // Debounce tìm kiếm productName
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSoldProducts(1);
      setPage(0);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [filters.productName, fetchSoldProducts]);

  // Lấy dữ liệu khi thay đổi page hoặc rowsPerPage
  useEffect(() => {
    fetchSoldProducts(page + 1);
  }, [page, rowsPerPage, fetchSoldProducts]);

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Xử lý tìm kiếm
  const handleSearch = () => {
    if (filters.startDate && filters.endDate && moment(filters.startDate).isAfter(filters.endDate)) {
      toast.error("Ngày bắt đầu không thể lớn hơn ngày kết thúc");
      return;
    }
    fetchSoldProducts(1);
    setPage(0);
    toast.success("Tìm kiếm sản phẩm thành công");
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
  const handleProductClick = (product) => {
    setSelectedProductOrders(product.orders);
    setSelectedProductName(product.name);
    setOpenDialog(true);
  };

  // Đóng dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProductOrders([]);
    setSelectedProductName("");
  };

  // Xem chi tiết đơn hàng
  const handleViewOrder = (orderId) => {
    navigate("/order", { state: { orderId } });
    setOpenDialog(false);
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={3}>
        <CircularProgress />
        <Typography mt={2}>Đang tải danh sách sản phẩm...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" mb={3}>
        Quản lý sản phẩm đã bán
      </Typography>

      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          name="productName"
          label="Tên sản phẩm"
          value={filters.productName}
          onChange={handleFilterChange}
          variant="outlined"
          size="small"
          sx={{ width: 200 }}
        />

        <FormControl sx={{ minWidth: 150 }}>
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
        <Button variant="contained" color="primary" onClick={handleSearch}>
          Tìm kiếm
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Hình ảnh</TableCell>
              <TableCell align="center">Tên sản phẩm</TableCell>
              <TableCell align="center">Mã sản phẩm</TableCell>
              <TableCell align="center">Thương hiệu</TableCell>
              <TableCell align="center">Tổng số lượng</TableCell>
              <TableCell align="center">Giá</TableCell>
              <TableCell align="center">Tổng giá</TableCell>
              <TableCell align="center">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {soldProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product, index) => (
              <TableRow key={index}>
                <TableCell align="center">
                  {product.variant?.[0]?.imgUrl ? (
  <img
    src={product.variant?.[0]?.imgUrl}
    alt={product.name || "Sản phẩm"}
    style={{ width: 50, height: 50, objectFit: "cover" }}
  />
) : (
  "N/A"
)}
                </TableCell>
                <TableCell align="center">{product.name}</TableCell>
                <TableCell align="center">{product.code}</TableCell>
                <TableCell align="center">{product.brand}</TableCell>
                <TableCell align="center">{product.quantity}</TableCell>
                <TableCell align="center">{Number(product.variant.price).toLocaleString("vi-VN")} ₫</TableCell>
                <TableCell align="center">
                  {(product.quantity * product.variant.price).toLocaleString("vi-VN")} ₫
                </TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleProductClick(product)}
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
        count={totalProducts}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Đơn hàng chứa sản phẩm: {selectedProductName}</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="center">Mã đơn hàng</TableCell>
                  <TableCell align="center">Số điện thoại</TableCell>
                  <TableCell align="center">Số lượng</TableCell>
                  <TableCell align="center">Ngày đặt</TableCell>
                  <TableCell align="center">Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedProductOrders.map((order, index) => (
                  <TableRow key={index}>
                    <TableCell align="center">{order.orderId}</TableCell>
                    <TableCell align="center">{order.phone}</TableCell>
                    <TableCell align="center">{order.quantity}</TableCell>
                    <TableCell align="center">{order.createdAt}</TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleViewOrder(order.orderId)}
                      >
                        Xem đơn hàng
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SoldProducts;