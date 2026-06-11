
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

const IpOrders = () => {
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

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams({
        page,
        orderName: filterOrderName,
        userName: filterUserName,
        status: filterStatus === "all" ? "" : filterStatus,
        startDate: filterStartDate,
        endDate: filterEndDate,
      }).toString();

      const response = await fetch(`${apiUrl}/iporders/orders?${queryParams}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Bạn không có quyền thực hiện thao tác này");
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || {});
      setCurrentPage(data.pagination?.currentPage || 1);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderTemplates = async () => {
    try {
      const response = await fetch(`${apiUrl}/users/order-templates`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      if (!response.ok) throw new Error("Lỗi khi lấy danh sách mẫu hóa đơn");
      const data = await response.json();
      setOrderTemplates(data.orderTemplates || []);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi lấy danh sách mẫu hóa đơn");
    }
  };

  const fetchProductDetails = async (productIds) => {
    try {
      const response = await fetch(`${apiUrl}/products/fetch-by-ids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ids: productIds }),
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return {};
      }

      if (!response.ok) throw new Error("Lỗi khi lấy thông tin sản phẩm");
      const result = await response.json();
      return result.products.reduce((acc, product) => {
        acc[product._id] = product;
        return acc;
      }, {});
    } catch (error) {
      console.error("Lỗi khi lấy thông tin sản phẩm:", error);
      toast.error("Lỗi khi lấy thông tin sản phẩm");
      return {};
    }
  };

  const handleExpandClick = async (orderId) => {
    if (expandedRows[orderId]) {
      setExpandedRows({ ...expandedRows, [orderId]: false });
      return;
    }

    const order = orders.find((o) => o._id === orderId);
    const productsToFetch = order.productList
      .filter((p) => p.quantityRe < p.quantity)
      .map((p) => p.productId);

    if (productsToFetch.length > 0) {
      const products = await fetchProductDetails(productsToFetch);
      setProductDetails((prev) => ({
        ...prev,
        [orderId]: products,
      }));
    }

    setExpandedRows({ ...expandedRows, [orderId]: true });
  };

  const handleCreateNewOrder = async () => {
    try {
      const response = await fetch(`${apiUrl}/iporders/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userName: "admin", productList: [] }),
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      const result = await response.json();
      if (response.status === 201) {
        toast.success("Tạo đơn hàng mới thành công");
        navigate(`/importorder/${result._id}`);
      } else {
        throw new Error(result.message || "Lỗi khi tạo đơn hàng");
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const handleCreateOrderFromTemplate = async (template) => {
    try {
      const productIds = template.products.map((p) => p.productId);
      const productDetails = await fetchProductDetails(productIds);

      const productList = template.products.map((p) => {
        const product = productDetails[p.productId];
        const importPrice = product?.variant[0]?.importPrice || "0";
        return {
          productId: p.productId,
          quantity: p.quantity,
          price: importPrice,
          unit: "cái",
          status: false,
          quantityRe: 0,
          note: "",
        };
      });

      const response = await fetch(`${apiUrl}/iporders/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          productList,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      const result = await response.json();
      if (response.status === 201) {
        toast.success(`Tạo đơn từ mẫu "${template.displayName}" thành công`);
        navigate(`/importorder/${result._id}`);
      } else {
        throw new Error(result.message || "Lỗi khi tạo đơn từ mẫu");
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const handleCreateNewTemplate = async () => {
    try {
      const response = await fetch(`${apiUrl}/users/order-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          displayName: "Mẫu_1",
          products: [],
        }),
      });

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return;
      }

      if (!response.ok) throw new Error("Lỗi khi tạo mẫu hóa đơn");
      const result = await response.json();
      toast.success("Tạo mẫu hóa đơn mới thành công");
      navigate(`/importordertemplate/${result.index}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSelectTemplate = (index) => {
    navigate(`/importordertemplate/${index}`);
    handleCloseDialog();
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleOpenCreateDialog = () => {
    fetchOrderTemplates();
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  const handleUpdateOrderStatus = async (order) => {
    if (order.status) {
      toast("Đơn hàng này đã hoàn thành");
      return;
    }

    if (
      !window.confirm(
        "Bạn có chắc muốn hoàn thành đơn hàng này? Tất cả sản phẩm còn thiếu sẽ được nhập kho."
      )
    ) {
      return;
    }

    try {
      // 🔹 Tính số lượng còn thiếu cho từng sản phẩm TRƯỚC khi gọi API
      const missingQuantities = order.productList.map((product) => ({
        productId: product.productId,
        missingQty: product.quantity - product.quantityRe,
      }));

      // 1. Cập nhật status đơn hàng và set quantityRe = quantity
      const res = await fetch(
        `${apiUrl}/iporders/orders/${order._id}/setStatusAndQuantity`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: true }),
        }
      );

      if (!res.ok) throw new Error("Lỗi khi cập nhật đơn hàng");
      const updatedOrder = await res.json();

      // 2. Cập nhật tồn kho cho từng sản phẩm theo missingQty
      for (const item of missingQuantities) {
        if (item.missingQty > 0) {
          await fetch(`${apiUrl}/products/${item.productId}/0`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ quantity: item.missingQty }),
          });
        }
      }

      toast.success("Cập nhật trạng thái & tồn kho thành công");
      fetchOrders(currentPage); // reload danh sách
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra");
    }
  };

  // Tải danh sách đơn hàng khi component mount
  useEffect(() => {
    fetchOrders(1);
  }, []);

  // Tải danh sách mẫu hóa đơn khi component mount
  useEffect(() => {
    fetchOrderTemplates();
  }, []);

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">Lỗi: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h5">Quản lý đơn nhập</Typography>
        <Box>
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
            sx={{ ml: 1 }}
          >
            Tạo đơn mới
          </Button>
        </Box>
      </Box>

      {/* Bộ lọc */}
      <Box display="flex" gap={2} mb={2} alignItems="center">
        <TextField
          label="Tên hóa đơn"
          value={filterOrderName}
          onChange={(e) => setFilterOrderName(e.target.value)}
          size="small"
          sx={{ width: "200px" }}
        />
        <TextField
          label="Tên người tạo"
          value={filterUserName}
          onChange={(e) => setFilterUserName(e.target.value)}
          size="small"
          sx={{ width: "200px" }}
        />
        <TextField
          select
          label="Trạng thái"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          size="small"
          sx={{ width: "150px" }}
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
          sx={{ width: "150px" }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ width: "150px" }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setCurrentPage(1);
            fetchOrders(1);
          }}
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
                key={template._id || index}
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
        </DialogActions>
      </Dialog>

      {/* Dialog tạo đơn mới với mẫu */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog}>
        <DialogTitle>Chọn mẫu hóa đơn để tạo đơn</DialogTitle>
        <DialogContent>
          {orderTemplates.length > 0 ? (
            orderTemplates.map((template, index) => (
              <Button
                key={template._id || index}
                variant="outlined"
                fullWidth
                sx={{ mb: 1 }}
                onClick={() => {
                  handleCreateOrderFromTemplate(template);
                  handleCloseCreateDialog();
                }}
              >
                {template.displayName || `Mẫu ${index}`}
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
          <Button onClick={handleCloseCreateDialog}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      ) : (
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
                  (p) => p.quantityRe < p.quantity
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
                      <TableCell align="center">{order.orderName}</TableCell>
                      <TableCell align="center">{order.userName}</TableCell>
                      <TableCell align="center">
                        {order.productList.length} sản phẩm
                      </TableCell>
                      <TableCell align="center">
                        {Number(order.total).toLocaleString("vi-VN")} VNĐ
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
                          onClick={() => navigate(`/importorder/${order._id}`)}
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
                                    .filter((p) => p.quantityRe < p.quantity)
                                    .map((product) => {
                                      const productDetail =
                                        productDetails[order._id]?.[
                                          product.productId
                                        ];
                                      return (
                                        <TableRow key={product._id}>
                                          <TableCell>
                                            {productDetail?.name ||
                                              "Đang tải..."}
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
                                              product.quantityRe}
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
      )}

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

export default IpOrders;
