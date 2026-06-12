
import React, { useState, useEffect } from "react";
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
  Pagination,
  CircularProgress,
  Alert,
  Typography,
  Box,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import moment from "moment";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL;

const EpOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});
  const [productDetails, setProductDetails] = useState({});
  const [orderTemplates, setOrderTemplates] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [filterOrderName, setFilterOrderName] = useState("");
  const [filterUserName, setFilterUserName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const navigate = useNavigate();

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
      setError(err.message);
      return null;
    }
  };

  // Hàm lấy danh sách đơn xuất
  const fetchOrders = async (page = 1) => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      page,
      orderName: filterOrderName,
      userName: filterUserName,
      status: filterStatus === "all" ? "" : filterStatus,
      startDate: filterStartDate,
      endDate: filterEndDate,
    }).toString();

    const data = await apiFetch(`${apiUrl}/eporders/orders?${queryParams}`, {
      method: "GET",
    });

    if (data) {
      setOrders(data.orders || []);
      setPagination(data.pagination || {});
      setCurrentPage(data.pagination?.currentPage || 1);
    }
    setLoading(false);
  };

  // Hàm lấy danh sách mẫu hóa đơn
  const fetchOrderTemplates = async () => {
    const data = await apiFetch(`${apiUrl}/users/order-templates`, {
      method: "GET",
    });
    if (data) {
      setOrderTemplates(data.orderTemplates || []);
    }
  };

  // Hàm lấy chi tiết sản phẩm
  const fetchProductDetails = async (productIds) => {
    if (!productIds || productIds.length === 0) return {};
    const result = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
      method: "POST",
      body: JSON.stringify({ ids: productIds }),
    });
    return (
      result?.products.reduce((acc, product) => {
        acc[product._id] = product;
        return acc;
      }, {}) || {}
    );
  };

  // Hàm mở rộng chi tiết sản phẩm
  const handleExpandClick = async (orderId) => {
    if (expandedRows[orderId]) {
      setExpandedRows({ ...expandedRows, [orderId]: false });
      return;
    }

    const order = orders.find((o) => o._id === orderId);
    const productsToFetch = order.productList
      .filter((p) => p.quantityEx < p.quantity)
      .map((p) => p.productId);

    if (productsToFetch.length > 0 && !productDetails[orderId]) {
      const products = await fetchProductDetails(productsToFetch);
      setProductDetails((prev) => ({
        ...prev,
        [orderId]: products,
      }));
    }

    setExpandedRows({ ...expandedRows, [orderId]: true });
  };

  // Hàm tạo đơn xuất mới (trắng)
  const handleCreateNewOrder = async () => {
    const result = await apiFetch(`${apiUrl}/eporders/orders`, {
      method: "POST",
      body: JSON.stringify({ userName: "admin", productList: [] }),
    });

    if (result) {
      toast.success("Tạo đơn xuất mới thành công");
      navigate(`/exportorder/${result._id}`);
    }
  };

  // Hàm tạo đơn xuất từ mẫu
  const handleCreateOrderFromTemplate = async (template) => {
    const productIds = template.products.map((p) => p.productId);
    const productDetails = await fetchProductDetails(productIds);

    const productList = template.products.map((p) => {
      const product = productDetails[p.productId];
      const importPrice = product?.variant?.[0]?.importPrice || "0";
      return {
        productId: p.productId,
        quantity: p.quantity,
        price: importPrice,
        unit: "cái",
        status: false,
        quantityEx: 0,
        note: "",
      };
    });

    const result = await apiFetch(`${apiUrl}/eporders/orders`, {
      method: "POST",
      body: JSON.stringify({
        orderName: template.displayName || "Đơn xuất từ mẫu",
        productList,
      }),
    });

    if (result) {
      toast.success(`Tạo đơn xuất từ mẫu "${template.displayName}" thành công`);
      navigate(`/exportorder/${result._id}`);
    }
  };

  // Hàm tạo mẫu hóa đơn mới
  const handleCreateNewTemplate = async () => {
    const result = await apiFetch(`${apiUrl}/users/order-templates`, {
      method: "POST",
      body: JSON.stringify({
        displayName: "Mẫu_1",
        products: [],
      }),
    });

    if (result) {
      toast.success("Tạo mẫu hóa đơn mới thành công");
      navigate(`/exportordertemplate/${result.index}`);
    }
  };

  // Hàm chọn mẫu để chỉnh sửa
  const handleSelectTemplate = (index) => {
    navigate(`/exportordertemplate/${index}`);
    handleCloseDialog();
  };

  // Hàm mở/đóng dialog
  const handleOpenDialog = () => setOpenDialog(true);
  const handleCloseDialog = () => setOpenDialog(false);
  const handleOpenCreateDialog = () => {
    fetchOrderTemplates();
    setOpenCreateDialog(true);
  };
  const handleCloseCreateDialog = () => setOpenCreateDialog(false);

  const handleUpdateOrderStatus = async (order) => {
    if (order.status) {
      toast("Đơn hàng này đã hoàn thành");
      return;
    }

    if (
      !window.confirm(
        "Bạn có chắc muốn hoàn thành đơn hàng này? Tất cả sản phẩm còn thiếu sẽ được xuất kho."
      )
    ) {
      return;
    }

    try {
      // 🔹 Tính số lượng còn thiếu cho từng sản phẩm TRƯỚC khi gọi API
      const missingQuantities = order.productList.map((product) => ({
        productId: product.productId,
        missingQty: product.quantity - product.quantityEx, // cần xuất thêm
      }));

      // 1. Cập nhật status đơn hàng và set quantityEx = quantity
      const res = await fetch(
        `${apiUrl}/eporders/orders/${order._id}/setStatusAndQuantity`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: true }),
        }
      );

      const data = await res.json(); // ✅ parse JSON trước

      if (!res.ok) {
        toast.error(data.message || "Có lỗi xảy ra"); // ✅ dùng message từ backend
        return;
      }

      const updatedOrder = data;

      // 2. Cập nhật tồn kho cho từng sản phẩm (trừ kho)
      for (const item of missingQuantities) {
        if (item.missingQty > 0) {
          await fetch(`${apiUrl}/products/${item.productId}/0`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ quantity: -item.missingQty }), // trừ kho
          });
        }
      }

      toast.success(data.message || "Cập nhật trạng thái & trừ kho thành công");
      fetchOrders(currentPage); // reload danh sách
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Có lỗi xảy ra");
    }
  };

  // Tải danh sách đơn xuất và mẫu hóa đơn khi component mount
  useEffect(() => {
    fetchOrders(1);
    fetchOrderTemplates();
  }, []);

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={2}>
        <CircularProgress />
        <Typography mt={2}>Đang tải đơn xuất...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">Lỗi: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
          Quản lý đơn xuất
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleOpenDialog}
          >
            Mẫu hóa đơn
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenCreateDialog}
          >
            Tạo đơn mới
          </Button>
        </Box>
      </Box>

      {/* Bộ lọc */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          mb: 2,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <TextField
          label="Tên hóa đơn"
          value={filterOrderName}
          onChange={(e) => setFilterOrderName(e.target.value)}
          size="small"
          sx={{ width: "200px", minWidth: "120px", flex: { xs: "1 1 150px", sm: "none" } }}
        />
        <TextField
          label="Tên người tạo"
          value={filterUserName}
          onChange={(e) => setFilterUserName(e.target.value)}
          size="small"
          sx={{ width: "200px", minWidth: "120px", flex: { xs: "1 1 150px", sm: "none" } }}
        />
        <TextField
          select
          label="Trạng thái"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          size="small"
          sx={{ width: "150px", minWidth: "110px", flex: { xs: "1 1 120px", sm: "none" } }}
          SelectProps={{ native: true }}
        >
          <option value="all">Tất cả</option>
          <option value="true">Hoàn thành</option>
          <option value="false">Chưa hoàn thành</option>
        </TextField>
        <TextField
          label="Từ ngày"
          type="date"
          value={filterStartDate}
          onChange={(e) => setFilterStartDate(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: "150px", minWidth: "130px", flex: { xs: "1 1 130px", sm: "none" } }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: "150px", minWidth: "130px", flex: { xs: "1 1 130px", sm: "none" } }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setCurrentPage(1);
            fetchOrders(1);
          }}
          sx={{ height: "40px", minWidth: "80px", flexShrink: 0 }}
        >
          Lọc
        </Button>
      </Box>

      {/* Dialog danh sách mẫu hóa đơn (chỉnh sửa mẫu) */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Danh sách mẫu hóa đơn</DialogTitle>
        <DialogContent>
          {orderTemplates.length > 0 ? (
            orderTemplates.map((template, index) => (
              <Button
                key={template._id}
                variant="outlined"
                fullWidth
                sx={{ mb: 1 }}
                onClick={() => handleSelectTemplate(index)}
              >
                {template.displayName || "Mẫu không tên"}
              </Button>
            ))
          ) : (
            <Typography>Chưa có mẫu hóa đơn nào</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleCreateNewTemplate}
          >
            Thêm mẫu mới
          </Button>
          <Button onClick={handleCloseDialog} color="error">
            Hủy
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog tạo đơn mới với mẫu */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog}>
        <DialogTitle>Chọn mẫu hóa đơn để tạo đơn</DialogTitle>
        <DialogContent>
          {orderTemplates.length > 0 ? (
            orderTemplates.map((template, index) => (
              <Button
                key={template._id}
                variant="outlined"
                fullWidth
                sx={{ mb: 1 }}
                onClick={() => {
                  handleCreateOrderFromTemplate(template);
                  handleCloseCreateDialog();
                }}
              >
                {template.displayName || `Mẫu ${index + 1}`}
              </Button>
            ))
          ) : (
            <Typography>Chưa có mẫu hóa đơn nào</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleCreateNewOrder();
              handleCloseCreateDialog();
            }}
          >
            Tạo đơn trắng
          </Button>
          <Button onClick={handleCloseCreateDialog} color="error">
            Hủy
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center"></TableCell>
              <TableCell align="center">Tên hóa đơn</TableCell>
              <TableCell align="center">Tên người tạo</TableCell>
              <TableCell align="center">Số lượng sản phẩm</TableCell>
              <TableCell align="center">Tổng giá</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell align="center">Ngày tạo</TableCell>
              <TableCell align="center"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => {
              const hasMissingProducts = order.productList.some(
                (p) => p.quantityEx < p.quantity
              );

              return (
                <React.Fragment key={order._id}>
                  <TableRow hover>
                    <TableCell align="center">
                      <IconButton
                        onClick={() =>
                          !order.status && handleExpandClick(order._id)
                        }
                        sx={{
                          pointerEvents: order.status ? "none" : "auto",
                          opacity: order.status ? 0.5 : 1,
                        }}
                      >
                        <ExpandMoreIcon
                          sx={{
                            transform: expandedRows[order._id]
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">
                      {order.orderName || "N/A"}
                    </TableCell>
                    <TableCell align="center">
                      {order.userName || "N/A"}
                    </TableCell>
                    <TableCell align="center">
                      {order.productList?.length || 0} sản phẩm
                    </TableCell>
                    <TableCell align="center">
                      {Number(order.total || 0).toLocaleString("vi-VN")} VNĐ
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={order.status}
                        color="success"
                        readOnly
                        onChange={() => {
                          if (!order.status) handleUpdateOrderStatus(order);
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {moment(order.createdAt).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => navigate(`/exportorder/${order._id}`)}
                      >
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                  {hasMissingProducts && (
                    <TableRow>
                      <TableCell
                        style={{ paddingBottom: 0, paddingTop: 0 }}
                        colSpan={8}
                      >
                        <Collapse
                          in={expandedRows[order._id]}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box
                            sx={{
                              margin: 1,
                              width: "90%",
                              marginLeft: "auto",
                            }}
                          >
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Tên</TableCell>
                                  <TableCell>Hình ảnh</TableCell>
                                  <TableCell>Hãng</TableCell>
                                  <TableCell>Số lượng còn thiếu</TableCell>
                                  <TableCell>Ghi chú</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {order.productList
                                  .filter((p) => p.quantityEx < p.quantity)
                                  .map((product) => {
                                    const productDetail =
                                      productDetails[order._id]?.[
                                        product.productId
                                      ];
                                    return (
                                      <TableRow key={product.productId}>
                                        <TableCell>
                                          {productDetail?.name || "Đang tải..."}
                                        </TableCell>
                                        <TableCell>
                                         {productDetail?.variant?.[0]?.imgUrl ? (
  <img
    src={productDetail.variant?.[0]?.imgUrl}
    alt={productDetail?.name || "Sản phẩm"}
    style={{ width: 50, height: 50, objectFit: "cover" }}
  />
) : (
  "N/A"
)}
                                        </TableCell>
                                        <TableCell>
                                          {productDetail?.brand || "N/A"}
                                        </TableCell>
                                        <TableCell>
                                          {product.quantity -
                                            product.quantityEx}
                                        </TableCell>
                                        <TableCell>
                                          {product.note || "Không có"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination
            count={pagination.totalPages}
            page={currentPage}
            onChange={(event, newPage) => {
              setCurrentPage(newPage);
              fetchOrders(newPage);
            }}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default EpOrders;
