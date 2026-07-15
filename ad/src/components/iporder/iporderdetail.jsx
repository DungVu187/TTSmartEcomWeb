
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { usePermissions } from "../../context/permissioncontext";

const apiUrl = import.meta.env.VITE_API_URL;

const removeTonesLocal = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D");

const brandKeyOf = (value) => removeTonesLocal(value)
  .toLowerCase()
  .replace(/\s+/g, "")
  .trim();

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
  handleReceiveQuantity,
  handleDeleteProduct,
  handleProductStatusChange,
  canEdit,
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
    disabled: product.status || !canEdit,
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
          cursor: product.status || !canEdit ? "not-allowed" : "grab",
          userSelect: "none",
          width: "40px",
          padding: "8px",
          "&:active": {
            cursor: product.status || !canEdit ? "not-allowed" : "grabbing",
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
          onBlur={() => {
            const value = tempProductList[index]?.price || "";
            handleTempUpdateProduct(index, "price", value, true);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = tempProductList[index]?.price || "";
              handleTempUpdateProduct(index, "price", value, true);
            }
          }}
          disabled={!canEdit}
          size="small"
          sx={{ width: "100px" }}
        />
      </TableCell>
      <TableCell align="center">
        <TextField
          value={tempProductList[index]?.unit || ""}
          onChange={(e) =>
            handleTempUpdateProduct(index, "unit", e.target.value, false)
          }
          onBlur={(e) => {
            const value = e.target.value || "";
            handleTempUpdateProduct(index, "unit", value, true);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = e.target.value || "";
              handleTempUpdateProduct(index, "unit", value, true);
            }
          }}
          disabled={!canEdit}
          size="small"
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
          onBlur={() => {
            const value = tempProductList[index]?.quantity || "";
            handleTempUpdateProduct(index, "quantity", value, true);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = tempProductList[index]?.quantity || "";
              handleTempUpdateProduct(index, "quantity", value, true);
            }
          }}
          disabled={!canEdit}
          size="small"
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
          disabled={!canEdit}
          size="small"
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
          onBlur={(e) => {
            const value = e.target.value || "";
            handleTempUpdateProduct(index, "note", value, true);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              const value = e.target.value || "";
              handleTempUpdateProduct(index, "note", value, true);
            }
          }}
          disabled={!canEdit}
          size="small"
          multiline
        />
      </TableCell>
      <TableCell align="center">
        <Checkbox
          checked={product.status}
          color="success"
          onChange={() => handleProductStatusChange(index, product)}
          disabled={!canEdit || product.status}
        />
      </TableCell>
      <TableCell align="center">
        {canEdit && (
          <IconButton
            onClick={() => handleDeleteProduct(index)}
            disabled={product.quantityRe > 0}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
};

// Component chính
const ImportOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can("iporder.create");
  const canEdit = can("iporder.edit");
  const canDelete = can("iporder.delete");
  const canExcel = canEdit && can("iporder.excel");
  const canScanAi = canEdit && can("iporder.scan_ai");
  const canAddImage = canCreate || canEdit;
  const canCreateRelatedOrder = canCreate || canEdit;
  const [order, setOrder] = useState(null);
  const [enrichedOrder, setEnrichedOrder] = useState(null);
  const [tempProductList, setTempProductList] = useState([]);
  const [productDetails, setProductDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [codeTerm, setCodeTerm] = useState("");
  const [receiveInput, setReceiveInput] = useState({});
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  // States phục vụ tính năng quét hóa đơn bằng AI
  const [allProducts, setAllProducts] = useState([]);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [selectedScanImage, setSelectedScanImage] = useState(null);
  const [scannedImages, setScannedImages] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [tempScanImageUrl, setTempScanImageUrl] = useState(null);

  // States phục vụ Zoom + Drag cho khung xem ảnh hóa đơn AI
  const [scanZoomScale, setScanZoomScale] = useState(1);
  const [scanPanOffset, setScanPanOffset] = useState({ x: 0, y: 0 });
  const [scanIsDragging, setScanIsDragging] = useState(false);
  const [scanDragStart, setScanDragStart] = useState({ x: 0, y: 0 });
  const imageWrapperRef = useRef(null);

  // States phục vụ Zoom + Xoay + Drag ảnh giống Zalo
  const [rotation, setRotation] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const activeListenerRef = useRef(null);
  const activeTouchStartRef = useRef(null);
  const activeTouchMoveRef = useRef(null);
  const activeTouchEndRef = useRef(null);

  // States phục vụ chạm/pinch zoom trên điện thoại
  const [touchStartDist, setTouchStartDist] = useState(null);
  const [touchStartScale, setTouchStartScale] = useState(1);

  const stateRef = useRef({ zoomScale, position, isDragging, dragStart, touchStartDist, touchStartScale });
  useEffect(() => {
    stateRef.current = { zoomScale, position, isDragging, dragStart, touchStartDist, touchStartScale };
  }, [zoomScale, position, isDragging, dragStart, touchStartDist, touchStartScale]);

  const getDistance = (t1, t2) => {
    return Math.sqrt(
      Math.pow(t1.clientX - t2.clientX, 2) +
      Math.pow(t1.clientY - t2.clientY, 2)
    );
  };

  const containerCallbackRef = (node) => {
    if (containerRef.current) {
      if (activeListenerRef.current) {
        containerRef.current.removeEventListener("wheel", activeListenerRef.current);
        activeListenerRef.current = null;
      }
      if (activeTouchStartRef.current) {
        containerRef.current.removeEventListener("touchstart", activeTouchStartRef.current);
        activeTouchStartRef.current = null;
      }
      if (activeTouchMoveRef.current) {
        containerRef.current.removeEventListener("touchmove", activeTouchMoveRef.current);
        activeTouchMoveRef.current = null;
      }
      if (activeTouchEndRef.current) {
        containerRef.current.removeEventListener("touchend", activeTouchEndRef.current);
        activeTouchEndRef.current = null;
      }
    }

    containerRef.current = node;

    if (node) {
      // 1. Wheel zoom
      const handleNativeWheel = (e) => {
        e.preventDefault();
        const zoomFactor = 0.15;
        setZoomScale((prev) => {
          let nextScale = prev + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
          return Math.min(Math.max(nextScale, 0.5), 5); // Zoom từ 0.5x đến 5x
        });
      };
      node.addEventListener("wheel", handleNativeWheel, { passive: false });
      activeListenerRef.current = handleNativeWheel;

      // 2. Touch Start
      const handleNativeTouchStart = (e) => {
        const currentScale = stateRef.current.zoomScale;
        const currentPos = stateRef.current.position;

        if (e.touches.length === 1) {
          if (currentScale > 1) {
            setIsDragging(true);
            const touch = e.touches[0];
            setDragStart({ x: touch.clientX - currentPos.x, y: touch.clientY - currentPos.y });
          }
        } else if (e.touches.length === 2) {
          setIsDragging(false);
          const dist = getDistance(e.touches[0], e.touches[1]);
          setTouchStartDist(dist);
          setTouchStartScale(currentScale);
        }
      };
      node.addEventListener("touchstart", handleNativeTouchStart, { passive: true });
      activeTouchStartRef.current = handleNativeTouchStart;

      // 3. Touch Move
      const handleNativeTouchMove = (e) => {
        const currentScale = stateRef.current.zoomScale;
        const currentIsDragging = stateRef.current.isDragging;
        const currentDragStart = stateRef.current.dragStart;
        const currentTouchStartDist = stateRef.current.touchStartDist;
        const currentTouchStartScale = stateRef.current.touchStartScale;

        if (e.touches.length === 1 && currentIsDragging && currentScale > 1) {
          e.preventDefault(); // Chặn cuộn trang web
          const touch = e.touches[0];
          setPosition({
            x: touch.clientX - currentDragStart.x,
            y: touch.clientY - currentDragStart.y,
          });
        } else if (e.touches.length === 2 && currentTouchStartDist) {
          e.preventDefault(); // Chặn zoom mặc định của trình duyệt
          const currentDist = getDistance(e.touches[0], e.touches[1]);
          const ratio = currentDist / currentTouchStartDist;
          let nextScale = currentTouchStartScale * ratio;
          nextScale = Math.min(Math.max(nextScale, 0.5), 5);
          setZoomScale(nextScale);
        }
      };
      node.addEventListener("touchmove", handleNativeTouchMove, { passive: false }); // PASSIVE: FALSE để e.preventDefault() chạy được
      activeTouchMoveRef.current = handleNativeTouchMove;

      // 4. Touch End
      const handleNativeTouchEnd = () => {
        setIsDragging(false);
        setTouchStartDist(null);
      };
      node.addEventListener("touchend", handleNativeTouchEnd, { passive: true });
      activeTouchEndRef.current = handleNativeTouchEnd;
    }
  };

  // Tự động đưa ảnh về trung tâm khi thu nhỏ về nhỏ hơn hoặc bằng kích thước gốc
  useEffect(() => {
    if (zoomScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoomScale]);

  // Khôi phục góc xoay từ localStorage và reset zoom khi mở hoặc chuyển ảnh
  useEffect(() => {
    if (lightboxOpen && scannedImages[currentImgIndex]) {
      const savedRot = parseInt(localStorage.getItem(`rotation_${scannedImages[currentImgIndex]}`)) || 0;
      setRotation(savedRot);
      setZoomScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentImgIndex, lightboxOpen, scannedImages]);

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    localStorage.setItem(`rotation_${scannedImages[currentImgIndex]}`, nextRot.toString());
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoomScale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleOpenLightbox = (index) => {
    setCurrentImgIndex(index);
    setLightboxOpen(true);
  };

  // Zoom & Pan handlers for the AI Scan invoice image box via ref callback
  const setWrapperRef = useCallback((node) => {
    if (imageWrapperRef.current) {
      try {
        imageWrapperRef.current.removeEventListener("wheel", imageWrapperRef.current._wheelHandler);
      } catch (err) {
        console.error("Lỗi gỡ bỏ wheel listener:", err);
      }
    }
    imageWrapperRef.current = node;
    if (node) {
      const handleNativeWheel = (e) => {
        e.preventDefault();
        const zoomFactor = 0.15;
        setScanZoomScale((prevScale) => {
          let newScale = prevScale + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
          newScale = Math.max(1, Math.min(newScale, 8)); // Limit zoom scale from 1x to 8x
          if (newScale <= 1) {
            setScanPanOffset({ x: 0, y: 0 });
          }
          return newScale;
        });
      };
      node.addEventListener("wheel", handleNativeWheel, { passive: false });
      node._wheelHandler = handleNativeWheel;
    }
  }, []);

  const handleScanMouseDown = (e) => {
    if (scanZoomScale <= 1) return;
    e.preventDefault();
    setScanIsDragging(true);
    setScanDragStart({ x: e.clientX - scanPanOffset.x, y: e.clientY - scanPanOffset.y });
  };

  const handleScanMouseMove = (e) => {
    if (!scanIsDragging) return;
    e.preventDefault();
    setScanPanOffset({
      x: e.clientX - scanDragStart.x,
      y: e.clientY - scanDragStart.y
    });
  };

  const handleScanMouseUp = () => {
    setScanIsDragging(false);
  };

  const resetScanZoomPan = () => {
    setScanZoomScale(1);
    setScanPanOffset({ x: 0, y: 0 });
    setScanIsDragging(false);
  };

  const handleCancelScanDialog = async () => {
    if (isScanning) return;
    setIsScanDialogOpen(false);
    resetScanZoomPan();
    if (tempScanImageUrl) {
      const urlToDelete = tempScanImageUrl;
      setTempScanImageUrl(null);
      try {
        await apiFetch(`${apiUrl}/products/clean-temp-image?imageUrl=${encodeURIComponent(urlToDelete)}`, {
          method: "DELETE"
        });
      } catch (err) {
        console.error("Lỗi khi xóa ảnh tạm mồ côi:", err);
      }
    }
  };


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
      const { ignoredStatuses = [], ...requestOptions } = options;
      const headers = { ...(requestOptions.headers || {}) };
      if (!(requestOptions.body instanceof FormData)) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }
      const response = await fetch(url, {
        ...requestOptions,
        headers,
        credentials: "include",
      });

      if (ignoredStatuses.includes(response.status)) {
        return { ignoredStatus: response.status };
      }

      if (response.status === 401 || response.status === 403) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
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
  const compressImage = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) => {
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
              if (!blob) {
                // Fallback sang JPEG nếu trình duyệt cũ không hỗ trợ WebP
                canvas.toBlob(
                  (jpegBlob) => {
                    const jpegName = file.name.substring(0, file.name.lastIndexOf('.')) + ".jpg";
                    const compressedFile = new File([jpegBlob], jpegName, {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    });
                    resolve(compressedFile);
                  },
                  "image/jpeg",
                  quality
                );
                return;
              }
              // Đổi phần mở rộng thành .webp
              const webpName = file.name.substring(0, file.name.lastIndexOf('.')) + ".webp";
              const compressedFile = new File([blob], webpName, {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/webp",
            quality
          );
        };
      };
    });
  };

  // Hàm đối khớp Level 1 - ưu tiên so khớp các sản phẩm đang có sẵn trong đơn hàng
  const performLevel1Matching = (scanItem, currentTempList, currentProductDetails) => {
    const tokenizeSpec = (text) => {
      if (!text) return new Set();
      const regexModel = /(?=\d+[a-zA-Z]|[a-zA-Z]+\d)[a-zA-Z0-9\-/]+/gi;
      const regexPureNum = /\b\d{3,}\b/g;

      const tokens = new Set();
      let match;

      regexModel.lastIndex = 0;
      while ((match = regexModel.exec(text)) !== null) {
        tokens.add(match[0].toLowerCase());
      }

      regexPureNum.lastIndex = 0;
      while ((match = regexPureNum.exec(text)) !== null) {
        tokens.add(match[0].toLowerCase());
      }

      return tokens;
    };

    const tokenizeTypeWords = (text) => {
      if (!text) return new Set();
      const out = new Set();
      const words = removeVietnameseTones(text).toLowerCase().split(/[\s,.\-/()]+/);
      for (const w of words) {
        // từ chữ: có chữ cái, KHÔNG chứa số, độ dài > 1 (lớn hơn hoặc bằng 2)
        if (w.length > 1 && /[a-z]/.test(w) && !/\d/.test(w)) {
          out.add(w);
        }
      }

      // Đồng bộ nhóm từ đồng nghĩa tiếng Anh <-> tiếng Việt cho thiết bị điện
      // 1. Contactor / Công tắc tơ / Khởi động từ
      if (
        (out.has('cong') && out.has('to')) || 
        (out.has('cong') && out.has('tac') && out.has('to')) || 
        (out.has('cong') && out.has('tac') && out.has('tor')) || 
        (out.has('khoi') && out.has('dong') && out.has('tu'))
      ) {
        out.add('contactor');
      }
      if (out.has('contactor')) {
        out.add('cong');
        out.add('tac');
        out.add('to');
        out.add('contactor');
      }

      // 2. Rơ le / Rơle <-> Relay
      if (out.has('ro') && out.has('le')) {
        out.add('role');
        out.add('relay');
      }
      if (out.has('role') || out.has('relay')) {
        out.add('ro');
        out.add('le');
        out.add('role');
        out.add('relay');
      }

      // 3. Aptomat / Cầu dao / CB <-> Breaker / MCB / MCCB
      if (out.has('aptomat') || (out.has('cau') && out.has('dao'))) {
        out.add('cb');
        out.add('mcb');
        out.add('mccb');
      }
      if (out.has('cb') || out.has('mcb') || out.has('mccb')) {
        out.add('cau');
        out.add('dao');
        out.add('aptomat');
      }

      return out;
    };

    const codeKind = (code) => {
      if (!code || !code.trim()) return 'none';
      return /^\d+$/.test(code.trim()) ? 'supplier' : 'model';
    };

    const cleanCode = (code) => {
      return code ? code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    };

    const removeVietnameseTones = (str) => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };

    const scanName = scanItem.rawScannedName || '';
    const scanCodeKind = codeKind(scanItem.code);
    const scanSpec = tokenizeSpec(`${scanName} ${scanCodeKind === 'model' ? scanItem.code : ''}`);
    const scanType = tokenizeTypeWords(scanName);
    const hasScanSpec = scanSpec.size > 0;

    const ctx = {
      scanCodeKind,
      scanSpec,
      scanType,
      hasScanSpec
    };

    const fuzzyScore = (p, scanName) => {
      const a = removeVietnameseTones(scanName).toLowerCase().split(/[\s,.\-/]+/).filter(w => w.length > 1);
      const b = removeVietnameseTones(p.name).toLowerCase().split(/[\s,.\-/]+/).filter(w => w.length > 1);
      return a.reduce((n, w) => n + (b.includes(w) ? 1 : 0), 0);
    };

    // Lọc các ứng viên trong đơn hàng vượt qua các cổng kiểm soát (gates)
    let candidates = [];
    for (const item of currentTempList) {
      const product = currentProductDetails.find((p) => p._id === item.productId);
      if (!product) continue;

      // Cổng 1: Code conflict
      if (ctx.scanCodeKind === 'model' && codeKind(product.code) === 'model'
          && cleanCode(scanItem.code) !== cleanCode(product.code)) {
        continue;
      }

      // Cổng 2: Spec subset (Set membership)
      if (ctx.hasScanSpec) {
        const pSpec = tokenizeSpec(`${product.name || ''} ${product.code || ''}`);
        let specMatch = true;
        for (const t of ctx.scanSpec) {
          if (!pSpec.has(t)) {
            specMatch = false;
            break;
          }
        }
        if (!specMatch) continue;
      }

      // Cổng 3: Type word match
      const pType = tokenizeTypeWords(product.name || '');
      let typeHit = false;
      for (const t of ctx.scanType) {
        if (pType.has(t)) {
          typeHit = true;
          break;
        }
      }
      if (!typeHit) continue;

      candidates.push(product);
    }

    if (candidates.length > 0) {
      // Fuzzy score tie-breaker
      const best = candidates.reduce((x, p) => fuzzyScore(p, scanName) > fuzzyScore(x, scanName) ? p : x);
      const pSpec = tokenizeSpec(`${best.name || ''} ${best.code || ''}`);
      const confidence = !ctx.hasScanSpec ? 'low'
                       : pSpec.size === ctx.scanSpec.size ? 'high'
                       : 'medium';
      return { productId: best._id, confidence };
    }

    return null;
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
        if (res.imageUrl) {
          setTempScanImageUrl(res.imageUrl);
        }
        // Áp dụng Level 1 Matching trên Frontend
        const items = res.items || [];
        const processedItems = items.map(item => {
          const l1Match = performLevel1Matching(item, tempProductList, productDetails);
          if (l1Match) {
            return {
              ...item,
              matchedProductId: l1Match.productId,
              confidence: l1Match.confidence
            };
          }
          return item;
        });
        setScanResults(processedItems);
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

  // Hàm xử lý upload ảnh hóa đơn thủ công
  const handleManualUploadSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsScanning(true);
    const uploadedUrls = [];

    try {
      for (const file of files) {
        // Nén ảnh tại client thành WebP
        const compressedFile = await compressImage(file);

        // Gửi lên API upload-image
        const formData = new FormData();
        formData.append("invoice", compressedFile);

        const res = await apiFetch(`${apiUrl}/iporders/upload-image`, {
          method: "POST",
          body: formData,
        });

        if (res && res.success && res.imageUrl) {
          uploadedUrls.push(res.imageUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        // Sử dụng functional update để tránh Race Condition và closure state
        setScannedImages((prev) => {
          const updated = [...prev, ...uploadedUrls];
          apiFetch(`${apiUrl}/iporders/orders/${id}`, {
            method: "PUT",
            body: JSON.stringify({ images: updated }),
          }).catch(err => console.error("Lỗi cập nhật ảnh hóa đơn:", err));
          return updated;
        });
        toast.success(`Đã đính kèm thành công ${uploadedUrls.length} ảnh hóa đơn!`);
      }
    } catch (err) {
      console.error("Lỗi khi đính kèm ảnh hóa đơn thủ công:", err);
      toast.error("Lỗi khi đính kèm ảnh hóa đơn");
    } finally {
      setIsScanning(false);
      event.target.value = "";
    }
  };

  // Hàm xóa ảnh hóa đơn đính kèm
  const handleDeleteScannedImage = async (indexToDelete) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa ảnh hóa đơn này?")) return;
    
    const imageUrlToDelete = scannedImages[indexToDelete];
    const newImages = scannedImages.filter((_, idx) => idx !== indexToDelete);
    
    try {
      await apiFetch(`${apiUrl}/iporders/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ images: newImages }),
      });
      
      setScannedImages(newImages);

      if (imageUrlToDelete) {
        try {
          await apiFetch(`${apiUrl}/iporders/delete-image?imageUrl=${encodeURIComponent(imageUrlToDelete)}`, {
            method: "DELETE"
          });
        } catch (delErr) {
          console.error("Lỗi khi xóa file vật lý ảnh hóa đơn:", delErr);
        }
      }

      toast.success("Xóa ảnh hóa đơn thành công");
    } catch (err) {
      console.error("Lỗi khi cập nhật ảnh hóa đơn sau khi xóa:", err);
      toast.error("Lỗi khi cập nhật đơn hàng");
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
      // Lấy chi tiết các sản phẩm đã có sẵn để cập nhật giá (loại trừ NEW_PRODUCT)
      const matchedIds = validItems
        .map((item) => item.matchedProductId)
        .filter((id) => id && id !== "NEW_PRODUCT");

      const productDetailsList = await fetchProductDetails(matchedIds);
      const productDetailsMap = productDetailsList.reduce((map, p) => {
        map[p._id] = p;
        return map;
      }, {});

      const brandMap = new Map();
      validItems
        .filter((row) => row.brandIsNew === true)
        .map((row) => String(row.brand || "").trim())
        .filter(Boolean)
        .forEach((brand) => {
          const key = brandKeyOf(brand);
          if (key && !brandMap.has(key)) {
            brandMap.set(key, brand);
          }
        });
      const newBrands = [...brandMap.values()];

      let brandFailCount = 0;
      for (const brand of newBrands) {
        try {
          const brandResult = await apiFetch(`${apiUrl}/chips/brands`, {
            method: "POST",
            body: JSON.stringify({ Brand: brand }),
            ignoredStatuses: [400],
          });
          if (!brandResult) {
            brandFailCount++;
            console.warn(`Không tạo được hãng mới (bỏ qua, vẫn nhập tiếp): ${brand}`);
          }
        } catch (error) {
          brandFailCount++;
          console.warn(`Lỗi khi tạo hãng mới (bỏ qua, vẫn nhập tiếp): ${brand}`, error);
        }
      }

      for (const row of validItems) {
        let productId = row.matchedProductId;
        let details = null;

        if (productId === "NEW_PRODUCT") {
          // Tạo sản phẩm mới
          const importPriceNum = Number(row.price) || 0;
          const earnVal = 25;
          const hasPrice = importPriceNum > 0;
          const calculatedRetailPrice = hasPrice
            ? Math.ceil((importPriceNum * (1 + earnVal / 100)) / 1000) * 1000
            : 0;

          const newProductPayload = {
            type: "Chưa phân loại",
            name: row.rawScannedName || "Sản phẩm mới AI quét",
            code: row.code || "",
            brand: row.brand && row.brand.trim() ? row.brand.trim() : "Chưa rõ",
            section: "Chưa phân loại",
            value: "Chưa rõ",
            vat: row.vat ? row.vat.toString() : "",
            warranty: "12 tháng",
            adjusted: false,
            variant: [
              {
                price: hasPrice ? calculatedRetailPrice.toString() : "",
                importPrice: hasPrice ? importPriceNum.toString() : "",
                earn: earnVal,
                quantityForSale: 0,
                quantityInStorage: 0,
                imgUrl: "",
                note: row.note || "",
              },
            ],
          };

          try {
            const createRes = await apiFetch(`${apiUrl}/products/create`, {
              method: "POST",
              body: JSON.stringify(newProductPayload),
            });

            if (createRes && createRes.product) {
              productId = createRes.product._id;
              details = createRes.product;
              // Thêm sản phẩm mới vào danh sách allProducts ở client
              setAllProducts((prev) => [createRes.product, ...prev]);
            } else {
              console.error("Không tạo được sản phẩm mới:", row.rawScannedName);
              hasError = true;
              continue;
            }
          } catch (err) {
            console.error("Lỗi khi tạo sản phẩm mới:", err);
            hasError = true;
            continue;
          }
        } else {
          details = productDetailsMap[productId];
          if (!details) continue;

          // Cập nhật giá sản phẩm cũ
          const importPriceNum = Number(row.price) || 0;
          const existingEarn = Number(details.variant?.[0]?.earn) || 0;

          const updatePayload = {};
          // Chỉ cập nhật giá khi quét được giá nhập hợp lệ (> 0); nếu không, giữ nguyên giá cũ.
          if (importPriceNum > 0) {
            const calculatedRetailPrice = Math.ceil((importPriceNum * (1 + existingEarn / 100)) / 1000) * 1000;
            updatePayload.variant = [
              {
                ...(details.variant?.[0] || {}),
                importPrice: importPriceNum.toString(),
                price: calculatedRetailPrice.toString(),
              },
            ];
          }
          const scannedVat = row.vat?.toString().trim();
          if (scannedVat) {
            updatePayload.vat = scannedVat;
          }
          const scannedBrand = String(row.brand || "").trim();
          const currentBrand = String(details.brand || "").trim().toLowerCase();
          if (scannedBrand && (!currentBrand || currentBrand === "n/a" || currentBrand === "chưa rõ")) {
            updatePayload.brand = scannedBrand;
          }

          try {
            const updateRes = await apiFetch(`${apiUrl}/products/${productId}`, {
              method: "PUT",
              body: JSON.stringify(updatePayload),
            });
            if (updateRes) {
              details = updateRes;
            }
          } catch (err) {
            console.error(`Không thể cập nhật giá cho sản phẩm cũ ${productId}:`, err);
          }
        }

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

          const scannedQty = Number(row.quantity) || 0;
          const targetQty = Number(existingProduct.quantity) || 0;
          const finalQtyRe = Math.min(scannedQty, targetQty);
          const newQuantityRe = Math.max(existingProduct.quantityRe || 0, finalQtyRe);

          // Cập nhật số lượng và đơn giá mới
          const updatedProduct = {
            ...existingProduct,
            price: (row.price ?? "0").toString(),
            quantityRe: newQuantityRe,
            status: newQuantityRe === targetQty,
            note: row.note || existingProduct.note || "",
            vat: row.vat || existingProduct.vat || "",
            isAIScan: true,
          };

          const putUrl = `${apiUrl}/iporders/orders/${id}/products/${existingProductIndex}`;
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
          const scannedQty = Number(row.quantity) || 0;
          const newProduct = {
            productId,
            price: (row.price ?? "0").toString(),
            unit: row.unit || "cái",
            quantity: scannedQty,
            quantityRe: scannedQty,
            note: row.note || "",
            vat: row.vat || "",
            status: true,
            isAIScan: true,
          };

          const postUrl = `${apiUrl}/iporders/orders/${id}/products`;
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
        let finalOrder = updatedOrder;
        if (tempScanImageUrl) {
          const newImages = [...scannedImages, tempScanImageUrl];
          setScannedImages(newImages);
          setTempScanImageUrl(null);

          // Cập nhật trường images vào DB của đơn nhập hiện tại
          const imageUpdateRes = await apiFetch(`${apiUrl}/iporders/orders/${id}`, {
            method: "PUT",
            body: JSON.stringify({ images: newImages }),
          });
          if (imageUpdateRes) {
            finalOrder = imageUpdateRes;
          }
        }

        setOrder(finalOrder);
        setTempProductList(finalOrder.productList || []);

        // Cập nhật lại list chi tiết sản phẩm cho tất cả sản phẩm trong đơn hàng
        const allIds = updatedOrder.productList.map((p) => p.productId);
        const latestDetails = await fetchProductDetails(allIds);
        setProductDetails(latestDetails);

        // Cập nhật trạng thái tổng thể đơn hàng nếu cần
        const allCompleted = updatedOrder.productList.every((p) => p.status);
        if (allCompleted && !updatedOrder.status) {
          const statusUpdate = await apiFetch(
            `${apiUrl}/iporders/orders/${id}/status`,
            {
              method: "PUT",
              body: JSON.stringify({ status: true }),
            }
          );
          if (statusUpdate) {
            setOrder((prev) => ({ ...prev, status: true }));
          }
        } else if (!allCompleted && updatedOrder.status) {
          const statusUpdate = await apiFetch(
            `${apiUrl}/iporders/orders/${id}/status`,
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
        toast.success(
          `Đã tự động nhập/cập nhật thành công ${addedCount} sản phẩm từ hóa đơn${brandFailCount > 0 ? ` (${brandFailCount} hãng chưa tạo được)` : ""}!`
        );
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
    const data = await apiFetch(`${apiUrl}/iporders/orders/${id}`, {
      method: "GET",
    });

    if (data) {
      setOrder(data);
      setScannedImages(data.images || []);
      if (Array.isArray(data.productList) && data.productList.length > 0) {
        const productIds = data.productList.map((item) => item.productId);
        const productDetailsData = await fetchProductDetails(productIds);
        setProductDetails(productDetailsData);
        const updatedTempList = data.productList.map((item) => ({
          ...item,
          price: item.price || "0",
        }));
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
      if (searchTerm.trim() !== "" || codeTerm.trim() !== "") {
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
      quantityRe: 0,
      status: false,
    };

    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/products`,
      {
        method: "POST",
        body: JSON.stringify(newProduct),
      }
    );

    if (updatedOrder) {
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
        `${apiUrl}/iporders/orders/${id}/products/${productIndex}`,
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

  // Hàm xử lý số lượng nhận
  const handleReceiveQuantity = async (productIndex, received) => {
    if (
      !order ||
      !order.productList ||
      productIndex >= order.productList.length
    ) {
      toast.error("Dữ liệu đơn hàng không hợp lệ");
      return;
    }

    const receivedNum = parseInt(received);
    if (isNaN(receivedNum)) {
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

    const updatedProduct = {
      ...order.productList[productIndex],
      quantityRe: newQuantityRe,
      status: newQuantityRe === quantity,
    };

    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/products/${productIndex}`,
      {
        method: "PUT",
        body: JSON.stringify(updatedProduct),
      }
    );

    if (updatedOrder) {
      const allCompleted = updatedOrder.productList.every((p) => p.status);
      if (allCompleted && !updatedOrder.status) {
        const statusUpdate = await apiFetch(
          `${apiUrl}/iporders/orders/${id}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ status: true }),
          }
        );
        if (statusUpdate) updatedOrder.status = true;
      }

      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      setReceiveInput((prev) => ({ ...prev, [productIndex]: "" }));
      toast.success("Cập nhật số lượng thành công");
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

    if (order.productList[productIndex].quantityRe > 0) {
      toast.error("Không thể xóa sản phẩm đã nhập hàng");
      return;
    }

    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/products/${productIndex}`,
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

  // Hàm cập nhật tên đơn hàng
  const handleUpdateOrderName = async (newOrderName) => {
    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/name`,
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
      quantityRe: 0,
      note: product.note,
      status: false,
    }));

    const newOrderData = {
      orderName: `${order.orderName || "Đơn hàng"}_copy`,
      productList: copiedProductList,
    };

    const newOrder = await apiFetch(`${apiUrl}/iporders/orders`, {
      method: "POST",
      body: JSON.stringify(newOrderData),
    });

    if (newOrder) {
      toast.success("Sao chép đơn hàng thành công");
      navigate(`/importorder/${newOrder._id}`);
    }
  };

  // Hàm tạo đơn xuất từ đơn nhập
  const handleCreateExportOrder = async () => {
    if (!order) {
      toast.error("Không có đơn hàng để xuất");
      return;
    }

    const exportProductList = order.productList.map((product) => ({
      productId: product.productId,
      price: product.price,
      unit: product.unit,
      quantity: product.quantity,
      quantityEx: 0,
      note: product.note,
      status: false,
    }));

    const newExportOrder = {
      orderName: `${order.orderName || "Đơn nhập"}_xuất`,
      productList: exportProductList,
    };

    const createdOrder = await apiFetch(`${apiUrl}/eporders/orders`, {
      method: "POST",
      body: JSON.stringify(newExportOrder),
    });

    if (createdOrder) {
      toast.success("Tạo đơn xuất thành công");
      navigate(`/exportorder/${createdOrder._id}`);
    }
  };

  // Hàm xuất dữ liệu ra file Excel
  const handleExportToExcel = async () => {
    if (!enrichedOrder?.productList || enrichedOrder.productList.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chi tiết đơn hàng");

    // Tiêu đề A1 (gộp ô A1:H1)
    const title = order?.orderName || `Đơn hàng ${id}`;
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
      "Giá nhập",
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
    enrichedOrder.productList.forEach((product, index) => {
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
    const safeName = (order?.orderName || `Đơn hàng_${id}`).replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    saveAs(new Blob([buffer]), `${safeName}.xlsx`);
    toast.success("Xuất file Excel thành công");
  };

  // Hàm xử lý kéo thả
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = enrichedOrder.productList.findIndex(
      (item) =>
        `${item.productId}-${enrichedOrder.productList.indexOf(item)}` ===
        active.id
    );
    const newIndex = enrichedOrder.productList.findIndex(
      (item) =>
        `${item.productId}-${enrichedOrder.productList.indexOf(item)}` ===
        over.id
    );

    const reorderedList = [...tempProductList];
    const [movedItem] = reorderedList.splice(oldIndex, 1);
    reorderedList.splice(newIndex, 0, movedItem);

    setTempProductList(reorderedList);

    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/reorder`,
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
          workbook.getWorksheet("Chi tiết đơn hàng") || workbook.worksheets[0];

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
          "Giá nhập",
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
          const price = row["Giá nhập"];
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
              `${apiUrl}/iporders/orders/${id}/products/${existingProductIndex}`,
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
              quantityRe: 0,
              status: false,
            };

            updatedOrder = await apiFetch(
              `${apiUrl}/iporders/orders/${id}/products`,
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
                  `${apiUrl}/iporders/orders/${id}/status`,
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

  // Hàm xóa đơn hàng
  const handleDeleteOrder = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn hàng này?")) return;

    try {
      const response = await fetch(`${apiUrl}/iporders/orders/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok || response.status === 404) {
        toast.success("Xóa đơn hàng thành công");
        setTimeout(() => {
          navigate("/importorder");
        }, 1000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Xóa đơn hàng thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi xóa đơn hàng");
    }
  };

  const handleProductStatusChange = async (productIndex, product) => {
    if (!order || product.status) return;

    if (!window.confirm("Bạn có chắc muốn cập nhật trạng thái sản phẩm này?")) {
      return;
    }

    // 1. Gọi API setStatusAndQuantity
    const updatedOrder = await apiFetch(
      `${apiUrl}/iporders/orders/${id}/products/${productIndex}/setStatusAndQuantity`,
      {
        method: "PUT",
        body: JSON.stringify({ status: true }),
      }
    );

    if (updatedOrder) {
      setOrder(updatedOrder);
      setTempProductList(updatedOrder.productList);
      toast.success("Cập nhật trạng thái & tồn kho thành công");
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
        <Alert severity="error">Lỗi: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box className="sticky-header">
        <Typography variant="h5" gutterBottom>
          Chi tiết đơn hàng #{id}
        </Typography>

        <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
          <TextField
            label="Tên đơn hàng"
            value={order?.orderName || ""}
            onChange={(e) => setOrder({ ...order, orderName: e.target.value })}
            sx={{ width: "300px" }}
            size="small"
            disabled={!canEdit}
          />
          {canEdit && (
          <Button
            variant="contained"
            color="success"
            onClick={() => handleUpdateOrderName(order?.orderName || "")}
          >
            Lưu tên
          </Button>
          )}
        </Box>

        <Box display="flex" gap={1.5} mb={2} flexWrap="wrap">
          {canEdit && (
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setOpenAddDialog(true)}
          >
            Thêm sản phẩm
          </Button>
          )}
          {canEdit && (
          <Button variant="contained" color="primary" onClick={handleCopyOrder}>
            Sao chép đơn
          </Button>
          )}
          {canDelete && (
          <Button variant="contained" color="error" onClick={handleDeleteOrder}>
            Xóa đơn
          </Button>
          )}
          {canCreateRelatedOrder && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleCreateExportOrder}
          >
            Xuất đơn
          </Button>
          )}
          {canExcel && (
          <Button
            variant="contained"
            color="info"
            onClick={handleExportToExcel}
            startIcon={<CloudDownloadIcon />}
          >
            Xuất Excel
          </Button>
          )}
          {canExcel && (
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
          )}
          {canScanAi && (
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
          )}
          {canAddImage && (
          <Button
            component="label"
            variant="contained"
            startIcon={<CloudUploadIcon />}
            color="primary"
            disabled={isScanning}
          >
            Thêm ảnh thủ công
            <VisuallyHiddenInput
              type="file"
              accept="image/*"
              multiple
              onChange={handleManualUploadSelect}
            />
          </Button>
          )}
        </Box>

        {/* Hiển thị danh sách ảnh hóa đơn đính kèm */}
        {scannedImages.length > 0 && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#555' }}>
              Ảnh hóa đơn đính kèm ({scannedImages.length} ảnh):
            </Typography>
            <Box 
              sx={{ 
                display: "flex", 
                gap: 2, 
                overflowX: "auto", 
                pb: 1,
                "&::-webkit-scrollbar": { height: 6 },
                "&::-webkit-scrollbar-thumb": { bgcolor: "#ccc", borderRadius: 3 }
              }}
            >
              {scannedImages.map((imgUrl, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    position: 'relative', 
                    minWidth: 100, 
                    width: 100, 
                    height: 100, 
                    border: '2px solid #e0e0e0', 
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <img 
                    src={`${apiUrl}${imgUrl}`} 
                    alt={`Invoice page ${index + 1}`} 
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => handleOpenLightbox(index)}
                  />
                  {canAddImage && (
                  <IconButton 
                    size="small" 
                    color="error"
                    sx={{ 
                      position: 'absolute', 
                      top: 2, 
                      right: 2, 
                      bgcolor: 'rgba(255,255,255,0.9)', 
                      '&:hover': { bgcolor: 'white' } 
                    }}
                    onClick={() => handleDeleteScannedImage(index)}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <Typography variant="body1" className="total-summary-text">
          Tổng cộng: {Number(enrichedOrder?.total || 0).toLocaleString("vi-VN")}{" "}
          VNĐ
        </Typography>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={canEdit ? handleDragEnd : undefined}
      >
        <TableContainer component={Paper} sx={{ userSelect: "none", overflowX: "auto", maxHeight: "calc(100vh - 320px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center"></TableCell>
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
            <SortableContext
              items={
                enrichedOrder?.productList?.map(
                  (item, index) => `${item.productId}-${index}`
                ) || []
              }
              strategy={verticalListSortingStrategy}
            >
              <TableBody>
                {enrichedOrder?.productList?.length > 0 ? (
                  enrichedOrder.productList.map((product, index) => (
                    <SortableTableRow
                      key={`${product.productId}-${index}`}
                      product={product}
                      index={index}
                      tempProductList={tempProductList}
                      handleTempUpdateProduct={handleTempUpdateProduct}
                      navigate={navigate}
                      receiveInput={receiveInput}
                      setReceiveInput={setReceiveInput}
                      handleReceiveQuantity={handleReceiveQuantity}
                      handleDeleteProduct={handleDeleteProduct}
                      handleProductStatusChange={handleProductStatusChange}
                      canEdit={canEdit}
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

      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} disableScrollLock>
        <DialogTitle>Thêm sản phẩm vào đơn</DialogTitle>
        <DialogContent>
          <Box mb={2} mt={2} sx={{ display: "grid", gap: 2 }}>
            <TextField
              label="Tìm theo tên sản phẩm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
            />
            <TextField
              label="Tìm theo mã sản phẩm"
              value={codeTerm}
              onChange={(e) => setCodeTerm(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
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
                        {product.variant?.[0]?.imgUrl ? (
  <img
    src={product.variant?.[0]?.imgUrl}
    alt={product.name || "Sản phẩm"}
    style={{ width: "50px", height: "50px", objectFit: "cover" }}
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
        onClose={handleCancelScanDialog}
        disableScrollLock
        fullWidth={true}
        maxWidth={false}
        PaperProps={{ sx: { width: "95vw", maxWidth: "95vw", height: "95vh", m: 0 } }}
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
        <DialogContent sx={{ p: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Box sx={{ display: "flex", gap: 2, flex: 1, minHeight: 0, flexDirection: { xs: "column", md: "row" } }}>
            
            {/* Cột trái: Ảnh hóa đơn gốc */}
            <Box 
              ref={setWrapperRef}
              onMouseDown={handleScanMouseDown}
              onMouseMove={handleScanMouseMove}
              onMouseUp={handleScanMouseUp}
              onMouseLeave={handleScanMouseUp}
              sx={{
                width: "28%",
                maxWidth: "28%",
                flexShrink: 0,
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#fafafa",
                boxShadow: "inset 0 0 10px rgba(0,0,0,0.03)",
                p: 1,
                cursor: scanZoomScale > 1 ? (scanIsDragging ? 'grabbing' : 'grab') : 'default',
                position: 'relative'
              }}
            >
              {selectedScanImage ? (
                <img
                  src={selectedScanImage}
                  alt="Invoice Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: "8px",
                    transform: `scale(${scanZoomScale}) translate(${scanPanOffset.x / scanZoomScale}px, ${scanPanOffset.y / scanZoomScale}px)`,
                    transformOrigin: "center center",
                    transition: scanIsDragging ? "none" : "transform 0.1s ease-out",
                    userSelect: "none",
                    pointerEvents: "none"
                  }}
                />
              ) : (
                <Typography color="text.secondary">Chưa chọn ảnh</Typography>
              )}
            </Box>

            {/* Cột phải: Danh sách kết quả từ AI */}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "12px", height: "100%" }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '44px', px: 0.5 }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '30%', minWidth: '200px' }}>Sản phẩm khớp (DB)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', minWidth: '240px' }}>Tên trên hóa đơn</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '76px', px: 0.5 }}>SL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '110px', px: 1 }}>Đơn giá</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '110px', px: 1 }}>Thành tiền</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '64px', px: 0.5 }}>VAT</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: '48px', px: 0.5 }}>Xóa</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResults.map((row, index) => {
                        const NEW_PRODUCT_OPTION = {
                          _id: "NEW_PRODUCT",
                          name: "[NEW] Tạo sản phẩm mới",
                          brand: "",
                          code: ""
                        };
                        const matchedProduct = row.matchedProductId === "NEW_PRODUCT"
                          ? NEW_PRODUCT_OPTION
                          : allProducts.find((p) => p._id === row.matchedProductId);
                        return (
                          <TableRow key={index} hover>
                            <TableCell align="center">
                              <TextField
                                value={row.stt || ""}
                                size="small"
                                onChange={(e) => {
                                  const updated = [...scanResults];
                                  updated[index].stt = e.target.value;
                                  setScanResults(updated);
                                }}
                                inputProps={{ style: { textAlign: 'center', padding: '6px 2px' } }}
                                sx={{ width: "36px" }}
                              />
                            </TableCell>
                            <TableCell>
                              <Autocomplete
                                options={[NEW_PRODUCT_OPTION, ...allProducts]}
                                getOptionLabel={(option) => {
                                  if (!option) return "";
                                  if (option._id === "NEW_PRODUCT") return option.name;
                                  const brandStr = option.brand ? ` [${option.brand}]` : "";
                                  const codeStr = option.code ? ` (${option.code})` : "";
                                  return `${option.name}${codeStr}${brandStr}`;
                                }}
                                value={matchedProduct || null}
                                onChange={(event, newValue) => {
                                  const updated = [...scanResults];
                                  updated[index].matchedProductId = newValue ? newValue._id : null;
                                  if (newValue && newValue.vat && !updated[index].vat?.toString().trim()) {
                                    updated[index].vat = newValue.vat;
                                  }
                                  setScanResults(updated);
                                }}
                                renderInput={(params) => (
                                  <TextField {...params} label="Chọn sản phẩm" size="small" variant="outlined" />
                                )}
                                size="small"
                                sx={{ width: "100%", minWidth: "180px" }}
                              />
                              {matchedProduct && (
                                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                  {matchedProduct._id === "NEW_PRODUCT" 
                                    ? matchedProduct.name 
                                    : `${matchedProduct.name}${matchedProduct.code ? ` (${matchedProduct.code})` : ""}${matchedProduct.brand ? ` [${matchedProduct.brand}]` : ""}`}
                                </Typography>
                              )}
                              {row.confidence === 'low' && (
                                <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5, fontWeight: 'bold' }}>
                                  ⚠️ Độ tin cậy thấp (Không có thông số kỹ thuật)
                                </Typography>
                              )}
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
                                inputProps={{ min: 1, style: { textAlign: 'center', padding: '6px 4px' } }}
                                sx={{ width: "64px" }}
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
                                inputProps={{ style: { textAlign: 'right', padding: '6px 8px' } }}
                                sx={{ width: "100%", minWidth: "90px" }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="bold">
                                {((row.quantity || 0) * (row.price || 0)).toLocaleString("vi-VN")}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <TextField
                                value={row.vat || ""}
                                size="small"
                                onChange={(e) => {
                                  const updated = [...scanResults];
                                  updated[index].vat = e.target.value;
                                  setScanResults(updated);
                                }}
                                inputProps={{ style: { textAlign: 'center', padding: '6px 2px' } }}
                                sx={{ width: "56px" }}
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
                        );
                      })}
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
        {scanResults.length > 0 && !isScanning && (
          <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
            py: 1.5,
            bgcolor: "#f5f5f5",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            borderBottom: "1px solid rgba(0,0,0,0.08)"
          }}>
            <Typography variant="body1" fontWeight="bold" color="text.primary">
              Tổng số lượng: <span style={{ color: '#512da8' }}>{scanResults.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString("vi-VN")}</span>
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
              Tổng đơn hàng trích xuất (tự tính): <span style={{ color: '#512da8', fontSize: '1.2rem' }}>{scanResults.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0).toLocaleString("vi-VN")}đ</span>
            </Typography>
          </Box>
        )}
        <DialogActions sx={{ p: 3, borderTop: scanResults.length > 0 && !isScanning ? 'none' : '1px solid rgba(0,0,0,0.08)' }}>
          <Button 
            onClick={handleCancelScanDialog} 
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

      {/* Dialog Xem ảnh hóa đơn Zoom đa điểm trực tiếp */}
      <Dialog 
        open={lightboxOpen} 
        onClose={() => setLightboxOpen(false)}
        disableScrollLock
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: { 
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            color: 'white', 
            overflow: 'hidden',
            margin: 16,
            borderRadius: 12
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 1.5, borderBottom: '1px solid #333' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Chi tiết ảnh hóa đơn đính kèm (Ảnh {currentImgIndex + 1}/{scannedImages.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={handleRotate}
              sx={{ borderColor: '#555', color: '#fff', '&:hover': { borderColor: '#888' } }}
            >
              🔄 Quay ảnh 90°
            </Button>
            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={handleResetZoom}
              sx={{ borderColor: '#555', color: '#fff', '&:hover': { borderColor: '#888' } }}
            >
              🔍 Reset Zoom
            </Button>
            <Button 
              variant="contained" 
              color="error" 
              onClick={() => setLightboxOpen(false)}
              sx={{ minWidth: 80 }}
            >
              Đóng [X]
            </Button>
          </Box>
        </Box>

        <DialogContent 
          ref={containerCallbackRef}
          sx={{ 
            p: 0, 
            bgcolor: '#000', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            position: 'relative',
            height: '75vh',
            overflow: 'hidden',
            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {scannedImages.length > 0 && (
            <>
              {/* Nút Previous */}
              {scannedImages.length > 1 && (
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImgIndex((prev) => (prev - 1 + scannedImages.length) % scannedImages.length);
                  }}
                  sx={{ 
                    position: 'absolute', 
                    left: 16, 
                    zIndex: 10, 
                    color: '#fff', 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } 
                  }}
                >
                  ◀
                </IconButton>
              )}

              {/* Ảnh chính */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  height: '100%',
                  userSelect: 'none'
                }}
              >
                <img 
                  ref={containerRef}
                  src={`${apiUrl}${scannedImages[currentImgIndex]}`} 
                  alt={`Trang hóa đơn ${currentImgIndex + 1}`} 
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoomScale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    maxWidth: '100%',
                    maxHeight: '75vh',
                    objectFit: 'contain',
                    pointerEvents: 'none'
                  }}
                />
              </Box>

              {/* Nút Next */}
              {scannedImages.length > 1 && (
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImgIndex((prev) => (prev + 1) % scannedImages.length);
                  }}
                  sx={{ 
                    position: 'absolute', 
                    right: 16, 
                    zIndex: 10, 
                    color: '#fff', 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } 
                  }}
                >
                  ▶
                </IconButton>
              )}
            </>
          )}
        </DialogContent>

        <Box sx={{ textAlign: 'center', py: 1.5, bgcolor: '#111', color: '#aaa', fontSize: 13 }}>
          💡 Mẹo: Lăn chuột để phóng to/thu nhỏ. Giữ chuột trái và di chuyển để kéo ảnh. Đã tự động nhớ góc xoay cho từng ảnh.
        </Box>
      </Dialog>
    </Box>
  );
};

export default ImportOrderDetail;
