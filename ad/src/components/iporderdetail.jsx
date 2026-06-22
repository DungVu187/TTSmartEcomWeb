
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  styled,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import toast from "react-hot-toast";
import { NumericFormat } from "react-number-format";
import * as XLSX from "xlsx";

const apiUrl = import.meta.env.VITE_API_URL;

// Ẩn input file
const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const ImportOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [enrichedOrder, setEnrichedOrder] = useState(null);
  const [tempProductList, setTempProductList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [receiveInput, setReceiveInput] = useState({});
  const authToken = sessionStorage.getItem("auth-token");

  // Hàm lấy thông tin đơn hàng
  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/iporders/orders/${id}`, {
        headers: { "auth-token": authToken },
      });
      if (!response.ok) throw new Error("Không thể lấy thông tin đơn hàng");
      const data = await response.json();
      setOrder(data);

      if (data.productList?.length > 0) {
        const productIds = data.productList.map((item) => item.productId);
        const productDetails = await fetchProductDetails(productIds);
        const updatedTempList = data.productList.map((item) => {
          const product =
            productDetails.find((p) => p._id === item.productId.toString()) ||
            {};
          return {
            ...item,
            price: item.price || product.variant?.[0]?.importPrice || "0",
          };
        });
        setTempProductList(updatedTempList);
      } else {
        setTempProductList([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm lấy chi tiết sản phẩm
  const fetchProductDetails = async (productIds) => {
    try {
      const response = await fetch(`${apiUrl}/products/fetch-by-ids`, {
        method: "POST",
        headers: {
          "auth-token": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: productIds }),
      });
      if (!response.ok) throw new Error("Không thể lấy chi tiết sản phẩm");
      const result = await response.json();
      return result.products;
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
      toast.error("Lỗi khi lấy thông tin sản phẩm");
      return [];
    }
  };

  // Hàm làm giàu dữ liệu đơn hàng
  const enrichOrderData = async () => {
    if (!order || !order.productList || order.productList.length === 0) {
      setEnrichedOrder({ ...order, productList: [] });
      return;
    }

    const productIds = order.productList.map((item) => item.productId);
    const productDetails = await fetchProductDetails(productIds);

    const enrichedProductList = tempProductList.map((item) => {
      const product =
        productDetails.find((p) => p._id === item.productId.toString()) || {};
      return {
        ...item,
        name: product.name || "N/A",
        imgUrl: product.variant?.[0]?.imgUrl || "",
        brand: product.brand || "N/A",
        code: product.code || "N/A",
      };
    });

    setEnrichedOrder({
      ...order,
      productList: enrichedProductList,
    });
  };

  // Hàm tìm kiếm tất cả sản phẩm
  const fetchAllProducts = async () => {
    try {
      const response = await fetch(`${apiUrl}/products/?search=${searchTerm}`, {
        credentials: "include",
      });
      const result = await response.json();
      setProducts(result.products);
    } catch (error) {
      console.error("Lỗi khi tìm kiếm sản phẩm:", error);
      toast.error("Lỗi khi tìm kiếm sản phẩm");
    }
  };

  // Debounce cho tìm kiếm sản phẩm
  useEffect(() => {
    if (!openAddDialog) return;

    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim() !== "") {
        fetchAllProducts();
      } else {
        setProducts([]); // Xóa danh sách sản phẩm nếu searchTerm rỗng
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, openAddDialog]);

  // Hàm thêm sản phẩm vào đơn hàng
  const handleAddProduct = async (product) => {
    try {
      const productDetails = await fetchProductDetails([product._id]);
      const selectedProduct = productDetails[0] || {};
      const importPrice = selectedProduct.variant?.[0]?.importPrice || "0";

      const newProduct = {
        productId: product._id,
        price: importPrice,
        unit: "cái",
        quantity: 1,
        note: "",
        quantityRe: 0,
        status: false,
      };

      const response = await fetch(`${apiUrl}/iporders/orders/${id}/products`, {
        method: "POST",
        headers: {
          "auth-token": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) throw new Error("Không thể thêm sản phẩm");
      const updatedOrder = await response.json();

      const allCompleted = updatedOrder.productList.every((p) => p.status);
      if (updatedOrder.status && !allCompleted) {
        await fetch(`${apiUrl}/iporders/orders/${id}/status`, {
          method: "PUT",
          headers: {
            "auth-token": authToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: false }),
        });
        updatedOrder.status = false;
      }

      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      setOpenAddDialog(false);
      toast.success("Thêm sản phẩm thành công");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  // Hàm cập nhật tạm thời sản phẩm
  const handleTempUpdateProduct = (productIndex, field, value) => {
    const updatedTempList = [...tempProductList];
    updatedTempList[productIndex] = {
      ...updatedTempList[productIndex],
      [field]: field === "quantity" ? parseInt(value) || 0 : value || "",
    };
    setTempProductList(updatedTempList);
  };

  // Hàm xử lý số lượng nhận
  const handleReceiveQuantity = async (productIndex, received) => {
    if (
      !order ||
      !order.productList ||
      order.productList.length === 0 ||
      productIndex >= order.productList.length
    ) {
      if (order?.productList?.length > 0) {
        toast.error("Dữ liệu đơn hàng không hợp lệ");
      }
      return;
    }

    const receivedNum = parseInt(received);
    if (isNaN(receivedNum) || receivedNum <= 0) {
      toast.error("Vui lòng nhập số lượng nhận hợp lệ");
      return;
    }

    const currentQuantityRe = order.productList[productIndex].quantityRe || 0;
    const quantity = order.productList[productIndex].quantity;
    const newQuantityRe = currentQuantityRe + receivedNum;

    if (newQuantityRe > quantity) {
      toast.error("Số lượng nhận không được vượt quá số lượng đặt");
      return;
    }

    const productId = order.productList[productIndex].productId;

    try {
      const updatedProduct = {
        ...order.productList[productIndex],
        quantityRe: newQuantityRe,
        status: newQuantityRe === quantity,
      };
      const response = await fetch(
        `${apiUrl}/iporders/orders/${id}/products/${productIndex}`,
        {
          method: "PUT",
          headers: {
            "auth-token": authToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedProduct),
        }
      );
      if (!response.ok)
        throw new Error("Không thể cập nhật số lượng trong đơn hàng");
      const updatedOrder = await response.json();

      const allCompleted = updatedOrder.productList.every((p) => p.status);
      if (allCompleted && !updatedOrder.status) {
        await fetch(`${apiUrl}/iporders/orders/${id}/status`, {
          method: "PUT",
          headers: {
            "auth-token": authToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: true }),
        });
        updatedOrder.status = true;
      }

      const inventoryResponse = await fetch(
        `${apiUrl}/products/${productId}/0`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": authToken,
          },
          body: JSON.stringify({ quantity: receivedNum }),
        }
      );

      if (!inventoryResponse.ok) {
        const errorData = await inventoryResponse.json();
        throw new Error(
          errorData.message || "Không thể cập nhật số lượng tồn kho"
        );
      }

      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      setReceiveInput((prev) => ({ ...prev, [productIndex]: "" }));
      toast.success("Cập nhật số lượng thành công");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm xóa sản phẩm
  const handleDeleteProduct = async (productIndex) => {
    if (
      !order ||
      !order.productList ||
      order.productList.length === 0 ||
      productIndex >= order.productList.length
    ) {
      if (order?.productList?.length > 0) {
        toast.error("Dữ liệu đơn hàng không hợp lệ");
      }
      return;
    }

    if (order.productList[productIndex].quantityRe > 0) {
      toast.error("Không thể xóa sản phẩm đã nhận hàng");
      return;
    }
    try {
      const response = await fetch(
        `${apiUrl}/iporders/orders/${id}/products/${productIndex}`,
        {
          method: "DELETE",
          headers: { "auth-token": authToken },
        }
      );
      if (!response.ok) throw new Error("Không thể xóa sản phẩm");
      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      toast.success("Xóa sản phẩm thành công");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm lưu đơn hàng
  const handleSaveOrder = async () => {
    try {
      const updatedOrder = { ...order, productList: tempProductList };
      const response = await fetch(`${apiUrl}/iporders/orders/${id}`, {
        method: "PUT",
        headers: {
          "auth-token": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedOrder),
      });
      if (!response.ok) throw new Error("Không thể lưu đơn hàng");
      const savedOrder = await response.json();
      setOrder(savedOrder);
      setTempProductList(savedOrder.productList);
      toast.success("Lưu đơn hàng thành công");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm xóa đơn hàng
  const handleDeleteOrder = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn hàng này?")) return;
    try {
      const response = await fetch(`${apiUrl}/iporders/orders/${id}`, {
        method: "DELETE",
        headers: { "auth-token": authToken },
      });
      if (!response.ok) throw new Error("Không thể xóa đơn hàng");
      toast.success("Xóa đơn hàng thành công");
      navigate("/orders");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm cập nhật tên đơn hàng
  const handleUpdateOrderName = async (newOrderName) => {
    try {
      const response = await fetch(`${apiUrl}/iporders/orders/${id}/name`, {
        method: "PUT",
        headers: {
          "auth-token": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderName: newOrderName }),
      });
      if (!response.ok) throw new Error("Không thể cập nhật tên đơn hàng");
      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      toast.success("Cập nhật tên đơn hàng thành công");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm sao chép đơn hàng
  const handleCopyOrder = async () => {
    if (!order) {
      toast.error("Không có đơn hàng để sao chép");
      return;
    }

    try {
      const copiedProductList = order.productList.map((product) => ({
        productId: product.productId,
        price: product.price,
        unit: product.unit,
        quantity: product.quantity,
        quantityRe: 0,
        note: product.note,
        status: false,
      }));

      const newOrderData = {
        orderName: `${order.orderName || "Đơn hàng"}_copy`,
        productList: copiedProductList,
      };

      const response = await fetch(`${apiUrl}/iporders/orders`, {
        method: "POST",
        headers: {
          "auth-token": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newOrderData),
      });

      if (!response.ok) throw new Error("Không thể sao chép đơn hàng");
      const newOrder = await response.json();

      toast.success("Sao chép đơn hàng thành công");
      navigate(`/importorder/${newOrder._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm xuất dữ liệu ra file Excel
  const handleExportToExcel = () => {
    if (!enrichedOrder?.productList || enrichedOrder.productList.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const exportData = enrichedOrder.productList.map((product, index) => ({
      "STT": index + 1,
      "Tên sản phẩm": product.name || "N/A",
      "Mã sản phẩm": product.code || "N/A",
      "Giá nhập": product.price || "0",
      "Đơn vị": product.unit || "N/A",
      "Số lượng": product.quantity || 0,
      "Ghi chú": product.note || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chi tiết đơn hàng");

    const colWidths = [
      { wch: 3 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
    ];
    worksheet["!cols"] = colWidths;

    const safeOrderName = (order?.orderName || `DonHang_${id}`)
      .replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(workbook, `${safeOrderName}.xlsx`);
    toast.success("Xuất file Excel thành công");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData.length) {
          toast.error("File Excel trống");
          return;
        }

        const updatedTempList = [...tempProductList];
        let updatedCount = 0;
        const errors = [];

        jsonData.forEach((row, rowIndex) => {
          const code = row["Mã sản phẩm"];
          const price = row["Giá nhập"];
          const unit = row["Đơn vị"];
          const quantity = row["Số lượng"];
          const note = row["Ghi chú"];

          if (!code) {
            errors.push(`Dòng ${rowIndex + 2}: Thiếu mã sản phẩm`);
            return;
          }

          const productIndex = tempProductList.findIndex(
            (p, idx) =>
              enrichedOrder?.productList[idx]?.code === code &&
              p.productId === enrichedOrder?.productList[idx]?.productId
          );

          if (productIndex === -1) {
            errors.push(
              `Dòng ${rowIndex + 2}: Không tìm thấy sản phẩm với mã ${code}`
            );
            return;
          }

          if (updatedTempList[productIndex].status) {
            return;
          }

          let hasChanges = false;
          const product = updatedTempList[productIndex];

          if (price !== undefined && price !== null && price !== "") {
            let priceStr;
            if (typeof price === "string") {
              priceStr = price.replace(/[^\d]/g, "");
            } else {
              priceStr = price.toString();
            }
            if (priceStr !== product.price) {
              product.price = priceStr;
              hasChanges = true;
            }
          }

          if (unit !== undefined && unit !== null && unit !== "" && unit !== product.unit) {
            product.unit = unit;
            hasChanges = true;
          }

          if (quantity !== undefined && quantity !== null && quantity !== "") {
            const parsedQuantity = parseInt(quantity);
            if (!isNaN(parsedQuantity) && parsedQuantity !== product.quantity) {
              product.quantity = parsedQuantity;
              hasChanges = true;
            }
          }

          if (note !== product.note) {
            product.note = note === undefined || note === null ? "" : String(note);
            hasChanges = true;
          }

          if (hasChanges) {
            updatedCount += 1;
          }
        });

        if (updatedCount > 0) {
          setTempProductList(updatedTempList);
          toast.success(
            `Cập nhật thành công ${updatedCount} sản phẩm trong danh sách tạm`
          );
        } else {
          toast.warn("Không có sản phẩm nào được cập nhật");
        }

        if (errors.length) {
          errors.forEach((error) => toast.error(error));
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Lỗi khi đọc file Excel:", error);
      toast.error("Lỗi khi xử lý file Excel");
    }
  };

  // Hook lấy dữ liệu đơn hàng
  useEffect(() => {
    if (authToken) fetchOrder();
  }, [id, authToken]);

  // Hook làm giàu dữ liệu
  useEffect(() => {
    if (order) enrichOrderData();
  }, [order, tempProductList]);

  if (loading)
    return (
      < Box >
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Box p={2}>
        <Alert severity="error">Lỗi: {error}</Alert>
      </Box>
    );

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Chi tiết đơn hàng #{id}
      </Typography>

      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <TextField
          label="Tên đơn hàng"
          value={order?.orderName || ""}
          onChange={(e) => setOrder({ ...order, orderName: e.target.value })}
          sx={{ width: "300px" }}
          size="small"
        />
        <Button
          variant="contained"
          color="success"
          onClick={() => handleUpdateOrderName(order?.orderName || "")}
        >
          Lưu tên
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setOpenAddDialog(true)}
        >
          Thêm sản phẩm
        </Button>
        <Button variant="contained" color="primary" onClick={handleCopyOrder}>
          Sao chép đơn
        </Button>
        <Button variant="contained" color="success" onClick={handleSaveOrder}>
          Lưu đơn
        </Button>
        <Button variant="contained" color="error" onClick={handleDeleteOrder}>
          Xóa đơn
        </Button>
        <Button
          variant="contained"
          color="info"
          onClick={handleExportToExcel}
          startIcon={<CloudDownloadIcon />}
        >
          Xuất Excel
        </Button>
        <Button
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
          startIcon={<CloudUploadIcon />}
          color="warning"
        >
          Nhập Excel
          <VisuallyHiddenInput
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
          />
        </Button>
      </Box>
      <Typography variant="body1">
        Tổng cộng:{" "}
        {enrichedOrder?.total
          ? enrichedOrder.total.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
          : "0"}
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Tên</TableCell>
              <TableCell align="center">Hình ảnh</TableCell>
              <TableCell align="center">Mã</TableCell>
              <TableCell align="center">Hãng</TableCell>
              <TableCell align="center">Giá nhập</TableCell>
              <TableCell align="center">Đơn vị</TableCell>
              <TableCell align="center">Số lượng nhập</TableCell>
              <TableCell align="center">Đã nhận</TableCell>
              <TableCell align="center">Nhập số lượng nhận</TableCell>
              <TableCell align="center">Ghi chú</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
              <TableCell align="center"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enrichedOrder?.productList?.map((product, index) => (
              <TableRow key={index}>
                <TableCell align="center">{product.name || "N/A"}</TableCell>
                <TableCell align="center">
                  <img
  src={product.variant?.[0]?.imgUrl}
  alt=""
  style={{ width: "50px", height: "50px" }}
/>
                </TableCell>
                <TableCell align="center">{product.code || "N/A"}</TableCell>
                <TableCell align="center">{product.brand || "N/A"}</TableCell>
                <TableCell align="center">
                  <NumericFormat
                    value={tempProductList[index]?.price || ""}
                    customInput={TextField}
                    thousandSeparator="."
                    decimalSeparator=","
                    onValueChange={(values) => {
                      const { value } = values;
                      handleTempUpdateProduct(index, "price", value);
                    }}
                    size="small"
                    disabled={product.status}
                    sx={{ width: "120px" }}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={tempProductList[index]?.unit || ""}
                    onChange={(e) =>
                      handleTempUpdateProduct(index, "unit", e.target.value)
                    }
                    size="small"
                    disabled={product.status}
                    sx={{ width: "70px" }}
                  />
                </TableCell>
                <TableCell align="center">
                  <NumericFormat
                    value={tempProductList[index]?.quantity || ""}
                    customInput={TextField}
                    thousandSeparator="."
                    decimalSeparator=","
                    onValueChange={(values) => {
                      const { value } = values;
                      handleTempUpdateProduct(index, "quantity", value);
                    }}
                    size="small"
                    disabled={product.status}
                    sx={{ width: "100px" }}
                  />
                </TableCell>
                <TableCell align="center">{product.quantityRe || 0}</TableCell>
                <TableCell align="center">
                  <NumericFormat
                    customInput={TextField}
                    thousandSeparator="."
                    decimalSeparator=","
                    value={receiveInput[index] || ""}
                    onValueChange={(values) => {
                      const { value } = values;
                      setReceiveInput((prev) => ({ ...prev, [index]: value }));
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        const value = receiveInput[index] || "";
                        handleReceiveQuantity(index, value);
                      }
                    }}
                    size="small"
                    disabled={product.status}
                    sx={{ width: "100px" }}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={tempProductList[index]?.note || ""}
                    onChange={(e) =>
                      handleTempUpdateProduct(index, "note", e.target.value)
                    }
                    size="small"
                    multiline
                  />
                </TableCell>
                <TableCell align="center">
                  <Checkbox
                    checked={product.status}
                    color="success"
                    sx={{ pointerEvents: "none" }}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleDeleteProduct(index)}
                    disabled={product.quantityRe > 0}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Thêm sản phẩm vào đơn</DialogTitle>
        <DialogContent>
          <Box mb={2} mt={2}>
            <TextField
              label="Tìm kiếm sản phẩm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
            />
          </Box>
          {products.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tên</TableCell>
                    <TableCell>Hình ảnh</TableCell>
                    <TableCell>Mã</TableCell>
                    <TableCell>Hãng</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product._id}
                      hover
                      onClick={() => handleAddProduct(product)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <img
  src={product.variant?.[0]?.imgUrl}
  alt=""
  style={{ width: "50px", height: "50px" }}
/>
                      </TableCell>
                      <TableCell>{product.code || "N/A"}</TableCell>
                      <TableCell>{product.brand || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="textSecondary" align="center">
              {searchTerm.trim() === ""
                ? "Nhập từ khóa để tìm kiếm sản phẩm"
                : "Nhập từ khóa để tìm kiếm sản phẩm"}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImportOrderDetail;