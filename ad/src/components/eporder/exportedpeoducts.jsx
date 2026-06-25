
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  TablePagination,
  CircularProgress,
  Box,
  Typography,
} from "@mui/material";
import moment from "moment";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || "";

const ExportedProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProductOrders, setSelectedProductOrders] = useState([]);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    productName: "",
    startDate: moment().startOf("month").format("YYYY-MM-DD"),
    endDate: moment().format("YYYY-MM-DD"),
  });

  // Hàm gọi API chung với xử lý lỗi
  const apiFetch = async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        credentials: "include", // Gửi cookie authToken
      });

      if (response.status === 401 || response.status === 403) {
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Yêu cầu thất bại");
      }

      return await response.json();
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };

  // Hàm lấy danh sách sản phẩm đã xuất
  const fetchProducts = async (currentPage = 1, customFilters = {}) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: rowsPerPage,
        ...(customFilters.startDate && { startDate: customFilters.startDate }),
        ...(customFilters.endDate && { endDate: customFilters.endDate }),
      }).toString();

      const data = await apiFetch(`${apiUrl}/eporders/orders?${queryParams}`, {
        method: "GET",
      });

      if (!data) {
        setProducts([]);
        setFilteredProducts([]);
        setTotalProducts(0);
        setLoading(false);
        return;
      }

      const orders = data.orders || [];
      const productMap = new Map();
      orders.forEach((order) => {
        order.productList.forEach((item) => {
          if (item.quantityEx > 0) {
            const key = item.productId;
            if (productMap.has(key)) {
              productMap.get(key).quantityEx += item.quantityEx;
              productMap.get(key).orders.push({
                orderId: order._id,
                orderName: order.orderName,
                userName: order.userName,
                quantityEx: item.quantityEx,
                status: item.status,
                createdAt: order.createdAt,
              });
            } else {
              productMap.set(key, {
                productId: item.productId,
                quantityEx: item.quantityEx,
                orders: [
                  {
                    orderId: order._id,
                    orderName: order.orderName,
                    userName: order.userName,
                    quantityEx: item.quantityEx,
                    status: item.status,
                    createdAt: order.createdAt,
                  },
                ],
              });
            }
          }
        });
      });

      const productIds = Array.from(productMap.keys());
      let productsWithDetails = [];

      if (productIds.length > 0) {
        const productDetails = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
          method: "POST",
          body: JSON.stringify({ ids: productIds }),
        });

        productsWithDetails = Array.from(productMap.entries()).map(([key, product]) => {
          const productData = productDetails?.products.find((p) => p._id === key) || {};
          return {
            productId: product.productId,
            name: productData.name || "N/A",
            brand: productData.brand || "N/A",
            code: productData.code || "N/A",
            quantityEx: product.quantityEx,
            orders: product.orders,
            variant: productData.variant?.[0] || {},
          };
        });
      }

      setProducts(productsWithDetails);

      const filtered = customFilters.productName
        ? productsWithDetails.filter((product) =>
            product.name.toLowerCase().includes(customFilters.productName.toLowerCase())
          )
        : productsWithDetails;
      setFilteredProducts(filtered);
      setTotalProducts(filtered.length);
    } catch (error) {
      toast.error("Lỗi khi lấy danh sách sản phẩm đã xuất");
    }
    setLoading(false);
  };

  // Hàm xử lý thay đổi bộ lọc
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Hàm tìm kiếm với debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (filters.startDate && filters.endDate && moment(filters.startDate).isAfter(filters.endDate)) {
        toast.error("Ngày bắt đầu không thể lớn hơn ngày kết thúc");
        return;
      }
      fetchProducts(1, filters);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [filters.productName]);

  // Hàm tìm kiếm thủ công
  const handleSearch = () => {
    if (filters.startDate && filters.endDate && moment(filters.startDate).isAfter(filters.endDate)) {
      toast.error("Ngày bắt đầu không thể lớn hơn ngày kết thúc");
      return;
    }
    setPage(0);
    fetchProducts(1, filters);
    toast.success("Tìm kiếm thành công");
  };

  // Hàm thay đổi trang
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Hàm thay đổi số dòng mỗi trang
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Hàm mở dialog chi tiết sản phẩm
  const handleProductClick = (product) => {
    setSelectedProductOrders(product.orders);
    setSelectedProductName(product.name);
    setOpenDialog(true);
  };

  // Hàm đóng dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProductOrders([]);
    setSelectedProductName("");
  };

  // Hàm xem chi tiết đơn hàng
  const handleViewOrder = (orderId) => {
    navigate(`/exportorder/${orderId}`);
    setOpenDialog(false);
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={2}>
        <CircularProgress />
        <Typography mt={2}>Đang tải sản phẩm đã xuất...</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <div className="sticky-header">
        <Typography variant="h5" gutterBottom>
          Danh sách sản phẩm đã xuất
        </Typography>

        {/* Bộ lọc */}
        <Box display="flex" gap={2} mb={2}>
          <TextField
            name="productName"
            label="Tên sản phẩm"
            value={filters.productName}
            onChange={handleFilterChange}
            variant="outlined"
            size="small"
            sx={{ width: "200px" }}
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
            sx={{ width: "150px" }}
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
            sx={{ width: "150px" }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSearch}
            size="small"
          >
            Tìm kiếm
          </Button>
        </Box>
      </div>

      {/* Bảng sản phẩm */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Hình ảnh</TableCell>
              <TableCell align="center">Tên sản phẩm</TableCell>
              <TableCell align="center">Mã sản phẩm</TableCell>
              <TableCell align="center">Thương hiệu</TableCell>
              <TableCell align="center">Tổng số lượng đã xuất</TableCell>
              <TableCell align="center">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((product) => (
                <TableRow key={product.productId}>
                  <TableCell align="center">
                    {product.variant?.imgUrl ? (
                      <img
                        src={product.variant?.imgUrl}
                        alt={product.name || "Sản phẩm"}
                        style={{ width: 50, height: 50, objectFit: "cover" }}
                      />
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell align="center">{product.name}</TableCell>
                  <TableCell align="center">{product.code || "N/A"}</TableCell>
                  <TableCell align="center">{product.brand || "N/A"}</TableCell>
                  <TableCell align="center">{product.quantityEx}</TableCell>
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

      {/* Phân trang */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalProducts}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Dialog đơn hàng */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Đơn hàng chứa sản phẩm: {selectedProductName}</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="center">Tên hóa đơn</TableCell>
                  <TableCell align="center">Người tạo</TableCell>
                  <TableCell align="center">Số lượng đã xuất</TableCell>
                  <TableCell align="center">Trạng thái</TableCell>
                  <TableCell align="center">Ngày tạo</TableCell>
                  <TableCell align="center">Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedProductOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell align="center">{order.orderName || "Không có tên"}</TableCell>
                    <TableCell align="center">{order.userName || "N/A"}</TableCell>
                    <TableCell align="center">{order.quantityEx}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={order.status}
                        color="success"
                        sx={{ pointerEvents: "none" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {moment(order.createdAt).format("HH:mm [ngày] DD-MM-YYYY")}
                    </TableCell>
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

export default ExportedProducts;
