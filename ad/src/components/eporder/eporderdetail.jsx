import React, { useState, useEffect, useMemo } from "react";
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
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import toast from "react-hot-toast";
import { NumericFormat } from "react-number-format";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// Component con cho hàng có thể kéo thả
const SortableTableRow = ({
  product,
  index,
  tempProductList,
  handleTempUpdateProduct,
  navigate,
  receiveInput,
  setReceiveInput,
  handleExportQuantity,
  handleDeleteProduct,
  handleProductStatusChange,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${product.productId}-${index}`,
    disabled: product.status,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isDragging ? "rgba(0, 0, 0, 0.1)" : "inherit",
    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" },
  };

  return (
    <TableRow ref={setNodeRef} sx={style}>
      <TableCell
        align="center"
        {...attributes}
        {...listeners}
        sx={{
          cursor: product.status ? "not-allowed" : "grab",
          userSelect: "none",
          width: "40px",
          padding: "8px",
          "&:active": {
            cursor: product.status ? "not-allowed" : "grabbing",
          },
          pointerEvents: "auto",
        }}
      >
        ☰
      </TableCell>
      <TableCell align="center">
        <Typography
          variant="body2"
          sx={{ cursor: "pointer", color: "primary.main" }}
          onClick={() => navigate(`/product/${product.productId}`)}
        >
          {product.name || "N/A"}
        </Typography>
      </TableCell>
      <TableCell align="center">
   {product.imgUrl ? (
  <img
    src={product.imgUrl}
    alt={product.name || "Sản phẩm"}
    style={{ width: "50px", height: "50px", objectFit: "cover" }}
  />
) : (
  "N/A"
)}
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
            handleTempUpdateProduct(index, "price", value, false);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = tempProductList[index]?.price || "";
              handleTempUpdateProduct(index, "price", value, true);
            }
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
            handleTempUpdateProduct(index, "unit", e.target.value, false)
          }
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = e.target.value || "";
              handleTempUpdateProduct(index, "unit", value, true);
            }
          }}
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
            handleTempUpdateProduct(index, "quantity", value, false);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = tempProductList[index]?.quantity || "";
              handleTempUpdateProduct(index, "quantity", value, true);
            }
          }}
          size="small"
          disabled={product.status}
          sx={{ width: "100px" }}
        />
      </TableCell>
      <TableCell align="center">{product.quantityEx || 0}</TableCell>
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
              handleExportQuantity(index, value);
            }
          }}
          size="small"
          disabled={product.status}
          sx={{ width: "50px", backgroundColor: "#a6e3b5" }}
          allowNegative={true}
        />
      </TableCell>
      <TableCell align="center">
        <TextField
          value={tempProductList[index]?.note || ""}
          onChange={(e) =>
            handleTempUpdateProduct(index, "note", e.target.value, false)
          }
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              const value = e.target.value || "";
              handleTempUpdateProduct(index, "note", value, true);
            }
          }}
          size="small"
          multiline
          disabled={product.status}
        />
      </TableCell>
      <TableCell align="center">
        <Checkbox
          checked={product.status}
          color="success"
          onChange={() => handleProductStatusChange(index, product)}
        />
      </TableCell>
      <TableCell align="center">
        <IconButton
          onClick={() => handleDeleteProduct(index)}
          disabled={product.quantityEx > 0}
          color="error"
        >
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

// Component chính
const ExportOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [enrichedOrder, setEnrichedOrder] = useState(null);
  const [tempProductList, setTempProductList] = useState([]);
  const [productDetails, setProductDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [codeTerm, setCodeTerm] = useState("")
  const [receiveInput, setReceiveInput] = useState({});
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  // States phục vụ tính năng quét hóa đơn bằng AI
  const [allProducts, setAllProducts] = useState([]);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [selectedScanImage, setSelectedScanImage] = useState(null);

  // Cấu hình sensors cho @dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Hàm gọi API chung với xử lý lỗi
  const apiFetch = async (url, options = {}) => {
    try {
      const headers = { ...(options.headers || {}) };
      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return null;
      }

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Yêu cầu thất bại");
        } else {
          const errorText = await response.text();
          throw new Error(`Yêu cầu thất bại (HTTP ${response.status}): ${errorText.substring(0, 150)}`);
        }
      }

      if (isJson) {
        return await response.json();
      } else {
        throw new Error("Server phản hồi định dạng không hợp lệ (không phải JSON).");
      }
    } catch (err) {
      toast.error(err.message);
      setError(err.message);
      return null;
    }
  };

  // Hàm tải toàn bộ sản phẩm từ DB để chọn khi đổi khớp
  const loadAllProductsForScan = async () => {
    const res = await apiFetch(`${apiUrl}/products/?limit=9999`);
    if (res && Array.isArray(res.products)) {
      setAllProducts(res.products);
    }
  };

  // Hàm nén ảnh ngay tại client trước khi upload
  const compressImage = (file, maxWidth = 1280, maxHeight = 1280, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };
      };
    });
  };

  // Hàm xử lý chọn ảnh hóa đơn và gửi lên AI quét
  const handleScanInvoiceSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Hiển thị ảnh xem trước
    setSelectedScanImage(URL.createObjectURL(file));
    setIsScanDialogOpen(true);
    setIsScanning(true);
    setScanResults([]);

    try {
      // Tải danh sách sản phẩm trước để lát khớp thủ công
      await loadAllProductsForScan();

      // Nén ảnh tại client
      const compressedFile = await compressImage(file);

      // Tạo FormData và gọi API gửi lên backend
      const formData = new FormData();
      formData.append("invoice", compressedFile);

      const res = await apiFetch(`${apiUrl}/products/scan-invoice`, {
        method: "POST",
        body: formData,
      });

      if (res && res.success) {
        setScanResults(res.items || []);
        toast.success("AI đã phân tích hóa đơn xong!");
      } else {
        toast.error(res?.message || "Không thể phân tích hóa đơn");
        setIsScanDialogOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải ảnh và phân tích hóa đơn");
      setIsScanDialogOpen(false);
    } finally {
      setIsScanning(false);
      // Reset input file để có thể chọn lại cùng 1 file
      event.target.value = "";
    }
  };

  // Hàm xác nhận nhập sản phẩm đã quét AI vào đơn hàng
  const handleConfirmScanImport = async () => {
    // Lọc ra các dòng đã được chọn sản phẩm khớp
    const validItems = scanResults.filter((row) => row.matchedProductId);
    if (validItems.length === 0) {
      toast.error("Vui lòng đối khớp ít nhất một sản phẩm hợp lệ!");
      return;
    }

    setIsScanning(true);
    let addedCount = 0;
    let hasError = false;
    let updatedOrder = order;

    try {
      // Đầu tiên, lấy chi tiết các sản phẩm được chọn để có đầy đủ cấu trúc
      const matchedIds = validItems.map(item => item.matchedProductId);
      const productDetails = await fetchProductDetails(matchedIds);
      const productDetailsMap = productDetails.reduce((map, p) => {
        map[p._id] = p;
        return map;
      }, {});

      for (const row of validItems) {
        const productId = row.matchedProductId;
        const details = productDetailsMap[productId];
        if (!details) continue;

        // Tìm xem sản phẩm đã có sẵn trong đơn hàng hay chưa
        const existingProductIndex = tempProductList.findIndex(
          (p) => p.productId === productId
        );

        if (existingProductIndex !== -1) {
          const existingProduct = tempProductList[existingProductIndex];
          if (existingProduct.status) {
            // Đã hoàn thành thì bỏ qua không update đè
            continue;
          }

          // Cập nhật số lượng và đơn giá mới
          const updatedProduct = {
            ...existingProduct,
            price: row.price.toString(),
            quantity: row.quantity,
            note: row.note || existingProduct.note || "",
          };

          const putUrl = `${apiUrl}/eporders/orders/${id}/products/${existingProductIndex}`;
          const resOrder = await apiFetch(putUrl, {
            method: "PUT",
            body: JSON.stringify(updatedProduct),
          });

          if (resOrder) {
            updatedOrder = resOrder;
            addedCount++;
          } else {
            hasError = true;
          }
        } else {
          // Thêm mới sản phẩm vào đơn hàng
          const newProduct = {
            productId,
            price: row.price.toString(),
            unit: row.unit || "cái",
            quantity: row.quantity,
            note: row.note || "",
            quantityEx: 0,
            status: false,
          };

          const postUrl = `${apiUrl}/eporders/orders/${id}/products`;
          const resOrder = await apiFetch(postUrl, {
            method: "POST",
            body: JSON.stringify(newProduct),
          });

          if (resOrder) {
            updatedOrder = resOrder;
            addedCount++;
          } else {
            hasError = true;
          }
        }
      }

      // Cập nhật lại state đơn hàng cục bộ để hiển thị danh sách mới
      if (updatedOrder) {
        setOrder(updatedOrder);
        setTempProductList(updatedOrder.productList || []);
        
        // Cập nhật lại state productDetails để giao diện hiển thị tên, hình ảnh, mã, hãng... lập tức không bị N/A
        setProductDetails((prevDetails) => {
          const merged = [...prevDetails];
          productDetails.forEach((newP) => {
            if (!merged.some((p) => p._id === newP._id)) {
              merged.push(newP);
            }
          });
          return merged;
        });
        
        // Cập nhật trạng thái tổng thể đơn hàng nếu cần
        const allCompleted = updatedOrder.productList.every((p) => p.status);
        if (updatedOrder.status && !allCompleted) {
          const statusUpdate = await apiFetch(
            `${apiUrl}/eporders/orders/${id}/status`,
            {
              method: "PUT",
              body: JSON.stringify({ status: false }),
            }
          );
          if (statusUpdate) {
            setOrder((prev) => ({ ...prev, status: false }));
          }
        }
      }

      if (hasError) {
        toast.error("Có lỗi xảy ra khi nhập một số sản phẩm.");
      } else {
        toast.success(`Đã tự động nhập/cập nhật thành công ${addedCount} sản phẩm từ hóa đơn!`);
      }
      setIsScanDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi nhập sản phẩm vào đơn hàng.");
    } finally {
      setIsScanning(false);
    }
  };

  // Hàm lấy chi tiết sản phẩm
  const fetchProductDetails = async (productIds) => {
    if (!productIds || productIds.length === 0) return [];
    const result = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
      method: "POST",
      body: JSON.stringify({ ids: productIds }),
    });
    return Array.isArray(result?.products) ? result.products : [];
  };

  // Hàm lấy thông tin đơn hàng
  const fetchOrder = async () => {
    setLoading(true);
    const data = await apiFetch(`${apiUrl}/eporders/orders/${id}`, {
      method: "GET",
    });

    if (data) {
      setOrder(data);
      if (Array.isArray(data.productList) && data.productList.length > 0) {
        const productIds = data.productList.map((item) => item.productId);
        const productDetailsData = await fetchProductDetails(productIds);
        setProductDetails(productDetailsData);
        const updatedTempList = data.productList.map((item) => {
          const product =
            productDetailsData.find(
              (p) => p._id === item.productId.toString()
            ) || {};
          return {
            ...item,
            price: item.price || product.variant?.[0]?.importPrice || "0",
          };
        });
        setTempProductList(updatedTempList);
      } else {
        setTempProductList([]);
        setProductDetails([]);
      }
    } else {
      setTempProductList([]);
      setProductDetails([]);
    }
    setLoading(false);
  };

  // Tính toán danh sách sản phẩm làm giàu với useMemo
  const enrichedProductList = useMemo(() => {
    if (
      !order ||
      !Array.isArray(order.productList) ||
      !Array.isArray(productDetails)
    ) {
      return [];
    }

    return tempProductList
      .filter((item) => item && item.productId)
      .map((item) => {
        const product =
          productDetails.find((p) => p._id === item.productId.toString()) || {};
        if (!product._id) {
          console.warn(
            `Không tìm thấy sản phẩm với productId: ${item.productId}`
          );
        }
        return {
          ...item,
          name: product.name || "N/A",
          imgUrl: product.variant?.[0]?.imgUrl || "",
          brand: product.brand || "N/A",
          code: product.code || "N/A",
        };
      });
  }, [tempProductList, productDetails]);

  // Cập nhật enrichedOrder khi cần
  useEffect(() => {
    if (!order) return;
    setEnrichedOrder({
      ...order,
      productList: enrichedProductList,
      total: tempProductList.reduce(
        (sum, p) => sum + Number(p.price) * Number(p.quantity),
        0
      ),
    });
  }, [order, enrichedProductList]);

  // Hàm tìm kiếm tất cả sản phẩm
  const fetchAllProducts = async () => {
    const query = new URLSearchParams();
    if (searchTerm.trim() !== "") query.append("search", searchTerm.trim());
    if (codeTerm.trim() !== "") query.append("code", codeTerm.trim());

    const result = await apiFetch(`${apiUrl}/products/?${query.toString()}`);
    if (result) {
      setProducts(result.products || []);
    }
  };

  // Debounce thủ công cho tìm kiếm sản phẩm
  useEffect(() => {
    if (!openAddDialog) return;

    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim() !== "" || codeTerm.trim()  !== "") {
        fetchAllProducts();
      } else {
        setProducts([]);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, codeTerm, openAddDialog]);

  // Hàm thêm sản phẩm vào đơn hàng
  const handleAddProduct = async (product) => {
    const productDetailsData = await fetchProductDetails([product._id]);
    const selectedProduct = productDetailsData[0] || {};
    const importPrice = selectedProduct.variant?.[0]?.importPrice || "0";

    const newProduct = {
      productId: product._id,
      price: importPrice,
      unit: "cái",
      quantity: 1,
      note: "",
      quantityEx: 0,
      status: false,
    };

    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/products`,
      {
        method: "POST",
        body: JSON.stringify(newProduct),
      }
    );

    if (updatedOrder) {
      const allCompleted = updatedOrder.productList.every((p) => p.status);
      if (updatedOrder.status && !allCompleted) {
        const statusUpdate = await apiFetch(
          `${apiUrl}/eporders/orders/${id}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ status: false }),
          }
        );
        if (statusUpdate) updatedOrder.status = false;
      }

      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      const productIds = updatedOrder.productList.map((item) => item.productId);
      const newProductDetails = await fetchProductDetails(productIds);
      setProductDetails(newProductDetails);
      setOpenAddDialog(false);
      toast.success("Thêm sản phẩm thành công");
    }
  };

  // Hàm cập nhật tạm thời sản phẩm và lưu khi cần
  const handleTempUpdateProduct = async (
    productIndex,
    field,
    value,
    save = false
  ) => {
    // Cập nhật tạm thời
    const updatedTempList = [...tempProductList];
    updatedTempList[productIndex] = {
      ...updatedTempList[productIndex],
      [field]: field === "quantity" ? parseInt(value) || 0 : value || "",
    };
    setTempProductList(updatedTempList);

    // Lưu vào server nếu save = true (khi nhấn Enter)
    if (save) {
      if (
        !order ||
        !order.productList ||
        productIndex >= order.productList.length
      ) {
        toast.error("Dữ liệu đơn hàng không hợp lệ");
        return;
      }

      const updatedProduct = {
        ...order.productList[productIndex],
        [field]: field === "quantity" ? parseInt(value) || 0 : value || "",
      };

      const updatedOrder = await apiFetch(
        `${apiUrl}/eporders/orders/${id}/products/${productIndex}`,
        {
          method: "PUT",
          body: JSON.stringify(updatedProduct),
        }
      );

      if (updatedOrder) {
        setOrder(updatedOrder);
        setTempProductList(updatedOrder.productList);
        toast.success(`Cập nhật thành công`);
      } else {
        // Khôi phục nếu lưu thất bại
        setTempProductList(order.productList);
      }
    }
  };

  // Hàm xử lý số lượng xuất
  const handleExportQuantity = async (productIndex, received) => {
    if (
      !order ||
      !order.productList ||
      productIndex >= order.productList.length
    ) {
      toast.error("Dữ liệu đơn hàng không hợp lệ");
      return;
    }

    const receivedNum = parseInt(received);
    if (isNaN(receivedNum) || receivedNum <= 0) {
      toast.error("Vui lòng nhập số lượng xuất hợp lệ");
      return;
    }

    const currentQuantityEx = order.productList[productIndex].quantityEx || 0;
    const quantity = order.productList[productIndex].quantity;
    const newQuantityEx = currentQuantityEx + receivedNum;

    if (newQuantityEx > quantity) {
      toast.error("Số lượng xuất không được vượt quá số lượng đặt");
      return;
    }

    const productId = order.productList[productIndex].productId;

    // Kiểm tra tồn kho
    const productData = await apiFetch(`${apiUrl}/products/${productId}`);
    if (!productData) {
      toast.error("Không tìm thấy thông tin sản phẩm");
      console.error("No product data for productId:", productId);
      return;
    }

    const currentInventory = productData.variant?.[0]?.quantityInStorage || 0;
    const currentForSale = productData.variant?.[0]?.quantityForSale || 0;

    if (currentInventory < receivedNum || currentForSale < receivedNum) {
      toast.error(
        `Số lượng không đủ (Tồn kho: ${currentInventory}, Có thể bán: ${currentForSale})`
      );
      return;
    }

    const updatedProduct = {
      ...order.productList[productIndex],
      quantityEx: newQuantityEx,
      status: newQuantityEx === quantity,
    };

    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/products/${productIndex}`,
      {
        method: "PUT",
        body: JSON.stringify(updatedProduct),
      }
    );

    if (updatedOrder) {
      const allCompleted = updatedOrder.productList.every((p) => p.status);
      if (allCompleted && !updatedOrder.status) {
        const statusUpdate = await apiFetch(
          `${apiUrl}/eporders/orders/${id}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ status: true }),
          }
        );
        if (statusUpdate) updatedOrder.status = true;
      }

      const inventoryResponse = await apiFetch(
        `${apiUrl}/products/${productId}/0`,
        {
          method: "POST",
          body: JSON.stringify({ quantity: -receivedNum }),
        }
      );

      if (inventoryResponse) {
        setOrder(updatedOrder);
        setTempProductList(updatedOrder.productList);
        setReceiveInput((prev) => ({ ...prev, [productIndex]: "" }));
        toast.success("Cập nhật số lượng xuất thành công");
      } else {
        toast.error("Lỗi khi cập nhật tồn kho");
      }
    }
  };

  // Hàm xóa sản phẩm
  const handleDeleteProduct = async (productIndex) => {
    if (
      !order ||
      !order.productList ||
      productIndex >= order.productList.length
    ) {
      toast.error("Dữ liệu đơn hàng không hợp lệ");
      return;
    }

    if (order.productList[productIndex].quantityEx > 0) {
      toast.error("Không thể xóa sản phẩm đã xuất hàng");
      return;
    }

    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/products/${productIndex}`,
      {
        method: "DELETE",
      }
    );

    if (updatedOrder) {
      if (!Array.isArray(updatedOrder.productList)) {
        console.error("Invalid productList in API response:", updatedOrder);
        toast.error("Dữ liệu trả về từ API không hợp lệ");
        return;
      }

      const validProductList = updatedOrder.productList.filter(
        (item) => item && item.productId
      );

      const allCompleted = validProductList.every((p) => p.status);
      if (allCompleted && !updatedOrder.status) {
        const statusUpdate = await apiFetch(
          `${apiUrl}/eporders/orders/${id}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ status: true }),
          }
        );
        if (statusUpdate) updatedOrder.status = true;
      }

      setOrder({ ...updatedOrder, productList: validProductList });
      setTempProductList(validProductList);
      const productIds = validProductList.map((item) => item.productId);
      const newProductDetails = await fetchProductDetails(productIds);
      setProductDetails(
        Array.isArray(newProductDetails) ? newProductDetails : []
      );
      toast.success("Xóa sản phẩm thành công");
    }
  };

  // Hàm xóa đơn hàng
  const handleDeleteOrder = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn hàng này?")) return;

    const result = await apiFetch(`${apiUrl}/eporders/orders/${id}`, {
      method: "DELETE",
    });

    if (result) {
      toast.success("Xóa đơn hàng thành công");
      setTimeout(() => {
        navigate("/exportorder");
      }, 1000);
    }
  };

  // Hàm cập nhật tên đơn hàng
  const handleUpdateOrderName = async (newOrderName) => {
    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/name`,
      {
        method: "PUT",
        body: JSON.stringify({ orderName: newOrderName }),
      }
    );

    if (updatedOrder) {
      setOrder(updatedOrder);
      toast.success("Cập nhật tên đơn hàng thành công");

      await apiFetch(`${apiUrl}/histories/update-ordername`, {
        method: "PUT",
        body: JSON.stringify({
          orderId: id,
          newOrderName: newOrderName,
        }),
      });
    }
  };

  // Hàm sao chép đơn hàng
  const handleCopyOrder = async () => {
    if (!order) {
      toast.error("Không có đơn hàng để sao chép");
      return;
    }

    const copiedProductList = order.productList.map((product) => ({
      productId: product.productId,
      price: product.price,
      unit: product.unit,
      quantity: product.quantity,
      quantityEx: 0,
      note: product.note,
      status: false,
    }));

    const newOrderData = {
      orderName: `${order.orderName || "Đơn hàng"}_copy`,
      productList: copiedProductList,
    };

    const newOrder = await apiFetch(`${apiUrl}/eporders/orders`, {
      method: "POST",
      body: JSON.stringify(newOrderData),
    });

    if (newOrder) {
      toast.success("Sao chép đơn hàng thành công");
      navigate(`/exportorder/${newOrder._id}`);
    }
  };

  // Hàm tạo đơn nhập từ đơn xuất
  const handleCreateImportOrder = async () => {
    if (!order) {
      toast.error("Không có đơn hàng để tạo đơn nhập");
      return;
    }

    const importProductList = order.productList.map((product) => ({
      productId: product.productId,
      price: product.price,
      unit: product.unit,
      quantity: product.quantity,
      quantityRe: 0,
      note: product.note,
      status: false,
    }));

    const newImportOrder = {
      orderName: `${order.orderName || "Đơn xuất"}_nhập`,
      productList: importProductList,
    };

    const createdOrder = await apiFetch(`${apiUrl}/iporders/orders`, {
      method: "POST",
      body: JSON.stringify(newImportOrder),
    });

    if (createdOrder) {
      toast.success("Tạo đơn nhập thành công");
      navigate(`/importorder/${createdOrder._id}`);
    }
  };

  // Hàm xuất dữ liệu ra file Excel
  const handleExportToExcel = async () => {
    if (!enrichedProductList || enrichedProductList.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chi tiết đơn xuất");

    // Tiêu đề A1 (gộp ô A1:H1)
    const title = order?.orderName || `Đơn xuất ${id}`;
    worksheet.mergeCells("A1:H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Header row A2:H2
    const headerRow = [
      "STT",
      "Tên sản phẩm",
      "Mã sản phẩm",
      "Hãng",
      "Giá xuất",
      "Đơn vị",
      "Số lượng",
      "Ghi chú",
    ];
    worksheet.addRow(headerRow);
    const header = worksheet.getRow(2);
    header.font = { bold: true };
    header.alignment = { vertical: "middle", horizontal: "center" };
    header.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
    });

    // Dữ liệu sản phẩm
    enrichedProductList.forEach((product, index) => {
      const row = [
        index + 1,
        product.name || "N/A",
        product.code || "N/A",
        product.brand || "N/A",
        Number(product.price) || 0,
        product.unit
          ? product.unit.charAt(0).toUpperCase() + product.unit.slice(1)
          : "N/A",
        Number(product.quantity) || 0,
        product.note || "",
      ];
      worksheet.addRow(row);
    });

    // Định dạng các dòng dữ liệu
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        row.alignment = { vertical: "middle", horizontal: "left" };
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (colNumber === 5) {
            cell.numFmt = "#,##0";
          } else if (colNumber === 7) {
            cell.numFmt = "0";
          }
        });
      }
    });

    // Đặt chiều rộng cột
    worksheet.columns = [
      { width: 5 },
      { width: 40 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 30 },
    ];

    // Xuất file
    const buffer = await workbook.xlsx.writeBuffer();
    const safeName = (order?.orderName || `Đơn xuất_${id}`).replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    saveAs(new Blob([buffer]), `${safeName}.xlsx`);
    toast.success("Xuất file Excel thành công");
  };

  // Hàm nhập Excel
  const handleFileUpload = async (event) => {
    setIsProcessingExcel(true);
    const file = event.target.files[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel");
      setIsProcessingExcel(false);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        // Lấy worksheet đầu tiên hoặc worksheet theo tên nếu biết
        const worksheet =
          workbook.getWorksheet("Chi tiết đơn xuất") || workbook.worksheets[0];

        // Header nằm ở dòng 2
        const headerRow = worksheet.getRow(2);
        const headers = headerRow.values
          .slice(1)
          .map((h) => (typeof h === "string" ? h.trim() : h));

        const expectedHeaders = [
          "STT",
          "Tên sản phẩm",
          "Mã sản phẩm",
          "Hãng",
          "Giá xuất",
          "Đơn vị",
          "Số lượng",
          "Ghi chú",
        ];

        // Kiểm tra header đúng định dạng
        const isValidHeader = expectedHeaders.every((h, i) => h === headers[i]);
        if (!isValidHeader) {
          toast.error("File Excel không đúng định dạng hoặc thiếu cột");
          setIsProcessingExcel(false);
          return;
        }

        // Lấy dữ liệu từ dòng 3 trở đi
        const jsonData = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber > 2) {
            const rowValues = row.values.slice(1);
            const obj = {};
            expectedHeaders.forEach((col, idx) => {
              obj[col] = rowValues[idx] !== undefined ? rowValues[idx] : null;
            });
            jsonData.push(obj);
          }
        });

        if (jsonData.length === 0) {
          toast.error("File Excel trống hoặc sai định dạng");
          setIsProcessingExcel(false);
          return;
        }

        // Lấy các mã sản phẩm hợp lệ
        const codes = jsonData
          .map((row) => row["Mã sản phẩm"]?.toString().trim())
          .filter((code) => code && code.trim() !== "");

        if (codes.length === 0) {
          toast.error("Không có mã sản phẩm hợp lệ trong file Excel");
          setIsProcessingExcel(false);
          return;
        }

        // Gọi API lấy dữ liệu sản phẩm theo mã
        const productData = await apiFetch(`${apiUrl}/products/by-codes`, {
          method: "POST",
          body: JSON.stringify({ codes }),
        });

        if (!productData || !Array.isArray(productData.products)) {
          toast.error("Không lấy được dữ liệu sản phẩm từ API");
          setIsProcessingExcel(false);
          return;
        }

        const codeToIdMap = productData.products.reduce((map, product) => {
          map[product.code] = product._id;
          return map;
        }, {});

        const invalidCodes = [];
        const validProductIds = [];
        jsonData.forEach((row, index) => {
          const code = row["Mã sản phẩm"]?.trim();
          if (!code || !codeToIdMap[code]) {
            invalidCodes.push({ line: index + 3, code: code || "Thiếu mã" });
          } else {
            validProductIds.push(codeToIdMap[code]);
          }
        });

        // Lấy chi tiết sản phẩm cho tất cả productId hợp lệ trước
        const newProductDetails = await fetchProductDetails(validProductIds);
        let addedCount = 0;
        let hasError = false;
        let updatedOrder = order;

        for (const row of jsonData) {
          const code = row["Mã sản phẩm"]?.trim();
          const price = row["Giá xuất"];
          const unit = row["Đơn vị"];
          const quantity = row["Số lượng"];
          const note = row["Ghi chú"];

          if (!code || !codeToIdMap[code]) {
            hasError = true;
            continue;
          }

          const productId = codeToIdMap[code];
          const existingProductIndex = tempProductList.findIndex(
            (p) => p.productId === productId
          );

          if (existingProductIndex !== -1) {
            const existingProduct = tempProductList[existingProductIndex];
            if (existingProduct.status) {
              hasError = true;
              continue;
            }

            const updatedProduct = {
              ...existingProduct,
              price:
                price !== undefined && price !== null && price !== ""
                  ? typeof price === "string"
                    ? price.replace(/[^\d]/g, "")
                    : price.toString()
                  : existingProduct.price,
              unit:
                unit !== undefined && unit !== null && unit !== ""
                  ? unit
                  : existingProduct.unit,
              quantity:
                quantity !== undefined && quantity !== null && quantity !== ""
                  ? parseInt(quantity) || existingProduct.quantity
                  : existingProduct.quantity,
              note:
                note !== undefined && note !== null
                  ? String(note)
                  : existingProduct.note,
            };

            updatedOrder = await apiFetch(
              `${apiUrl}/eporders/orders/${id}/products/${existingProductIndex}`,
              {
                method: "PUT",
                body: JSON.stringify(updatedProduct),
              }
            );

            if (updatedOrder) {
              addedCount++;
            } else {
              hasError = true;
            }
          } else {
            const newProduct = {
              productId,
              price:
                price !== undefined && price !== null && price !== ""
                  ? typeof price === "string"
                    ? price.replace(/[^\d]/g, "")
                    : price.toString()
                  : "0",
              unit:
                unit !== undefined && unit !== null && unit !== ""
                  ? unit
                  : "cái",
              quantity:
                quantity !== undefined && quantity !== null && quantity !== ""
                  ? parseInt(quantity) || 1
                  : 1,
              note: note !== undefined && note !== null ? String(note) : "",
              quantityEx: 0,
              status: false,
            };

            updatedOrder = await apiFetch(
              `${apiUrl}/eporders/orders/${id}/products`,
              {
                method: "POST",
                body: JSON.stringify(newProduct),
              }
            );

            if (updatedOrder) {
              addedCount++;

              const allCompleted = updatedOrder.productList.every(
                (p) => p.status
              );
              if (updatedOrder.status && !allCompleted) {
                const statusUpdate = await apiFetch(
                  `${apiUrl}/eporders/orders/${id}/status`,
                  {
                    method: "PUT",
                    body: JSON.stringify({ status: false }),
                  }
                );
                if (statusUpdate) updatedOrder.status = false;
              }
            } else {
              hasError = true;
            }
          }
        }

        if (updatedOrder) {
          setOrder(updatedOrder);
          setTempProductList(updatedOrder.productList);
          setProductDetails(newProductDetails);
        }

        if (invalidCodes.length > 0) {
          toast.error("Có mã sản phẩm không hợp lệ hoặc không tồn tại");
          console.log("Các dòng chứa mã sản phẩm không hợp lệ:");
          invalidCodes.forEach(({ line, code }) => {
            console.log(`Dòng ${line}: Mã sản phẩm "${code}"`);
          });
        } else if (hasError) {
          toast.error("Có lỗi khi thêm/cập nhật sản phẩm");
        }

        if (addedCount > 0) {
          toast.success(`Thêm/Cập nhật thành công ${addedCount} sản phẩm`);
        } else if (!hasError) {
          toast.warn("Không có sản phẩm nào được thêm hoặc cập nhật");
        }
        setIsProcessingExcel(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Lỗi khi đọc file Excel:", error);
      toast.error("Lỗi khi nhập file Excel");
      setIsProcessingExcel(false);
    }
  };

  // Hàm xử lý kéo thả sản phẩm
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = enrichedProductList.findIndex(
      (item, index) => `${item.productId}-${index}` === active.id
    );
    const newIndex = enrichedProductList.findIndex(
      (item, index) => `${item.productId}-${index}` === over.id
    );

    const reorderedList = [...tempProductList];
    const [movedItem] = reorderedList.splice(oldIndex, 1);
    reorderedList.splice(newIndex, 0, movedItem);

    setTempProductList(reorderedList);

    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/reorder`,
      {
        method: "PUT",
        body: JSON.stringify({ productList: reorderedList }),
      }
    );

    if (updatedOrder) {
      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      toast.success("Cập nhật thứ tự sản phẩm thành công");
    } else {
      setTempProductList(order.productList);
    }
  };

  const handleProductStatusChange = async (productIndex, product) => {
    if (!order) return;

    if (!window.confirm("Bạn có chắc muốn cập nhật trạng thái sản phẩm này?")) {
      return;
    }

    // 1. Gọi API setStatusAndQuantity
    const updatedOrder = await apiFetch(
      `${apiUrl}/eporders/orders/${id}/products/${productIndex}/setStatusAndQuantity`,
      {
        method: "PUT",
        body: JSON.stringify({ status: true }),
      }
    );

    if (updatedOrder) {
      // 2. Gọi API cập nhật tồn kho sản phẩm
      const productId = product.productId;
      const quantityToSub = product.quantityEx - product.quantity;

      const inventoryResponse = await apiFetch(
        `${apiUrl}/products/${productId}/0`,
        {
          method: "POST",
          body: JSON.stringify({ quantity: quantityToSub }),
        }
      );

      if (inventoryResponse) {
        setOrder(updatedOrder);
        setTempProductList(updatedOrder.productList);
        toast.success("Cập nhật trạng thái & tồn kho thành công");
      } else {
        toast.error("Cập nhật tồn kho thất bại");
      }
    } else {
      toast.error("Cập nhật trạng thái sản phẩm thất bại");
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box className="sticky-header">
        <Typography variant="h5" gutterBottom>
          Chi tiết đơn hàng #{id}
        </Typography>

        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <TextField
            label="Tên đơn hàng"
            value={order?.orderName || ""}
            onChange={(e) =>
              setOrder((prev) => ({ ...prev, orderName: e.target.value }))
            }
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
          <Button variant="contained" color="error" onClick={handleDeleteOrder}>
            Xóa đơn
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleCreateImportOrder}
          >
            Nhập đơn
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
            variant="contained"
            startIcon={<CloudUploadIcon />}
            color="warning"
            disabled={isProcessingExcel}
          >
            Nhập Excel
            <VisuallyHiddenInput
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
            />
          </Button>
          <Button
            component="label"
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            sx={{
              backgroundColor: "#673ab7",
              "&:hover": { backgroundColor: "#512da8" },
            }}
            disabled={isScanning}
          >
            Quét hóa đơn (AI)
            <VisuallyHiddenInput
              type="file"
              accept="image/*"
              onChange={handleScanInvoiceSelect}
            />
          </Button>
        </Box>
        <Typography variant="body1" className="total-summary-text">
          Tổng cộng: {Number(enrichedOrder?.total || 0).toLocaleString("vi-VN")}{" "}
          VNĐ
        </Typography>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <TableContainer component={Paper} sx={{ userSelect: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center"></TableCell>
                <TableCell align="center">Tên</TableCell>
                <TableCell align="center">Hình ảnh</TableCell>
                <TableCell align="center">Mã</TableCell>
                <TableCell align="center">Hãng</TableCell>
                <TableCell align="center">Giá xuất</TableCell>
                <TableCell align="center">Đơn vị</TableCell>
                <TableCell align="center">Số lượng xuất</TableCell>
                <TableCell align="center">Đã xuất</TableCell>
                <TableCell align="center">Nhập số lượng xuất</TableCell>
                <TableCell align="center">Ghi chú</TableCell>
                <TableCell align="center">Trạng thái</TableCell>
                <TableCell align="center"></TableCell>
              </TableRow>
            </TableHead>
            <SortableContext
              items={
                enrichedProductList.map(
                  (item, index) => `${item.productId}-${index}`
                ) || []
              }
              strategy={verticalListSortingStrategy}
            >
              <TableBody>
                {enrichedProductList.length > 0 ? (
                  enrichedProductList.map((product, index) => (
                    <SortableTableRow
                      key={`${product.productId}-${index}`}
                      product={product}
                      index={index}
                      tempProductList={tempProductList}
                      handleTempUpdateProduct={handleTempUpdateProduct}
                      navigate={navigate}
                      receiveInput={receiveInput}
                      setReceiveInput={setReceiveInput}
                      handleExportQuantity={handleExportQuantity}
                      handleDeleteProduct={handleDeleteProduct}
                      handleProductStatusChange={handleProductStatusChange}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      <Typography>Chưa có sản phẩm trong đơn hàng</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </SortableContext>
          </Table>
        </TableContainer>
      </DndContext>

      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Thêm sản phẩm vào đơn xuất</DialogTitle>
        <DialogContent>
          <Box mb={2} mt={2} sx={{ display: 'grid', gap: 2}}>
            <TextField
              label="Tìm kiếm sản phẩm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
            />
            <TextField
              label="Tìm kiếm sản phẩm"
              value={codeTerm}
              onChange={(e) => setCodeTerm(e.target.value)}
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
                    <TableCell>Mã sản phẩm</TableCell>
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
                        {product.variant?.[0]?.imgUrl ? (
  <img
    src={product.variant?.[0]?.imgUrl}
    alt={product.name || "Sản phẩm"}
    style={{
      width: "50px",
      height: "50px",
      objectFit: "cover",
    }}
  />
) : (
  "N/A"
)}
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
                : "Không tìm thấy sản phẩm"}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Preview và Đối khớp hóa đơn AI */}
      <Dialog
        open={isScanDialogOpen}
        onClose={() => !isScanning && setIsScanDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: '#512da8', 
          color: '#fff', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          py: 2 
        }}>
          <AutoAwesomeIcon />
          <Typography variant="h6" fontWeight="bold">AI Trích xuất & Đối khớp Hóa đơn</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", gap: 3, mt: 2, flexDirection: { xs: "column", md: "row" } }}>
            
            {/* Cột trái: Ảnh hóa đơn gốc */}
            <Box sx={{ 
              flex: 1, 
              minWidth: "300px", 
              border: "1px solid rgba(0,0,0,0.12)", 
              borderRadius: "12px", 
              overflow: "hidden", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              bgcolor: "#fafafa",
              boxShadow: "inset 0 0 10px rgba(0,0,0,0.03)",
              p: 1
            }}>
              {selectedScanImage ? (
                <img
                  src={selectedScanImage}
                  alt="Invoice Preview"
                  style={{ maxWidth: "100%", maxHeight: "550px", objectFit: "contain", borderRadius: "8px" }}
                />
              ) : (
                <Typography color="text.secondary">Chưa chọn ảnh</Typography>
              )}
            </Box>

            {/* Cột phải: Danh sách kết quả từ AI */}
            <Box sx={{ flex: 2, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {isScanning ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                  <CircularProgress size={50} thickness={4} sx={{ color: '#512da8' }} />
                  <Typography variant="body1" fontWeight="bold" color="text.primary" sx={{ 
                    animation: 'pulse 1.5s infinite ease-in-out',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.6 },
                      '50%': { opacity: 1 }
                    }
                  }}>
                    AI đang phân tích hình ảnh và đối khớp với Database...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Quá trình này có thể mất từ 5 - 15 giây.</Typography>
                </Box>
              ) : scanResults.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "12px", maxHeight: "550px" }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>Sản phẩm khớp (DB)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>Tên trên hóa đơn</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '100px' }}>Số lượng</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '150px' }}>Đơn giá</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '80px' }}>Xóa</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResults.map((row, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Autocomplete
                              options={allProducts}
                              getOptionLabel={(option) => {
                                if (!option) return "";
                                const brandStr = option.brand ? ` [${option.brand}]` : "";
                                const codeStr = option.code ? ` (${option.code})` : "";
                                return `${option.name}${codeStr}${brandStr}`;
                              }}
                              value={allProducts.find((p) => p._id === row.matchedProductId) || null}
                              onChange={(event, newValue) => {
                                const updated = [...scanResults];
                                updated[index].matchedProductId = newValue ? newValue._id : null;
                                setScanResults(updated);
                              }}
                              renderInput={(params) => (
                                <TextField {...params} label="Chọn sản phẩm" size="small" variant="outlined" />
                              )}
                              size="small"
                              sx={{ minWidth: "220px" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" fontWeight="medium">
                              {row.rawScannedName}
                            </Typography>
                            {row.code && (
                              <Typography variant="caption" display="block" color="primary.main">
                                Code: {row.code}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              value={row.quantity}
                              type="number"
                              size="small"
                              onChange={(e) => {
                                const updated = [...scanResults];
                                updated[index].quantity = Math.max(1, parseInt(e.target.value) || 1);
                                setScanResults(updated);
                              }}
                              inputProps={{ min: 1, style: { textAlign: 'center' } }}
                              sx={{ width: "80px" }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <NumericFormat
                              value={row.price}
                              customInput={TextField}
                              thousandSeparator="."
                              decimalSeparator=","
                              size="small"
                              onValueChange={(values) => {
                                const updated = [...scanResults];
                                updated[index].price = parseInt(values.value) || 0;
                                setScanResults(updated);
                              }}
                              sx={{ width: "120px" }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => {
                                const updated = scanResults.filter((_, idx) => idx !== index);
                                setScanResults(updated);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography color="text.secondary">Không tìm thấy hoặc không đọc được sản phẩm nào từ hóa đơn.</Typography>
                </Box>
              )}
            </Box>

          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Button 
            onClick={() => setIsScanDialogOpen(false)} 
            disabled={isScanning}
            variant="outlined" 
            color="inherit"
          >
            Hủy bỏ
          </Button>
          <Button 
            onClick={handleConfirmScanImport} 
            disabled={isScanning || scanResults.filter(r => r.matchedProductId).length === 0}
            variant="contained" 
            sx={{
              bgcolor: '#512da8',
              "&:hover": { bgcolor: '#311b92' }
            }}
          >
            Xác nhận nhập
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExportOrderDetail;
