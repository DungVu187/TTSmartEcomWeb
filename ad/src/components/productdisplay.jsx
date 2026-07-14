
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  TextField,
  Autocomplete,
  Button,
  Box,
  Card,
  CardMedia,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { NumericFormat } from "react-number-format";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { usePermissions } from "../context/permissioncontext";
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_UPLOAD_SETTINGS,
} from "../settings/imageUpload";
const apiUrl = import.meta.env.VITE_API_URL;

const productImageExtensionsText = PRODUCT_IMAGE_UPLOAD_SETTINGS.extensions.join(", ");

const hasValue = (value) => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

  return !["", "n/a", "na", "chua ro", "chua co", "chua phan loai"].includes(normalized);
};

const isProductAdjusted = (productData) => {
  return ["type", "brand", "section"].every((field) =>
    hasValue(productData?.[field])
  );
};

const parseLocalizedNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateSalePrice = (importPrice, earn, fallbackPrice) => {
  const importPriceNum = parseLocalizedNumber(importPrice);
  if (importPriceNum === null) return fallbackPrice || "";

  const earnNum = Number(earn) || 0;
  const rawPrice = importPriceNum * (1 + earnNum / 100);
  return String(Math.ceil(rawPrice / 1000) * 1000);
};

const metricRowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  mt: 1.5,
  maxWidth: 900,
};

const metricButtonSx = {
  width: 180,
  minWidth: 180,
  flexShrink: 0,
  justifyContent: "center",
  whiteSpace: "nowrap",
  textAlign: "center",
};

const ProductDisplay = () => {
  const { productId } = useParams();
  const { can } = usePermissions();
  const canEdit = can("product.edit");
  const canDelete = can("product.delete");
  const [product, setProduct] = useState(null);
  const [originalProduct, setOriginalProduct] = useState(null);
  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const [sections, setSections] = useState([]);
  const [values, setValues] = useState([]);
  const [quantityInput, setQuantityInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [earnInput, setEarnInput] = useState("");
  const [openQRDialog, setOpenQRDialog] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const fetchProduct = async () => {
    try {
      const endpoint = canEdit
        ? `${apiUrl}/products/${productId}/admin-detail`
        : `${apiUrl}/products/${productId}`;
      const response = await fetch(endpoint, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        setOriginalProduct(data);
        setNoteInput(data.variant?.[0]?.note || "");
        const existingEarn = Number(data.variant?.[0]?.earn);
        setEarnInput((existingEarn > 0 ? existingEarn : 25).toString());
      }
    } catch (err) {
      console.error("Error fetching product:", err);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId, canEdit]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    const hasAllowedExtension = PRODUCT_IMAGE_UPLOAD_SETTINGS.extensions.includes(extension);
    const hasAllowedMime = file.type
      ? PRODUCT_IMAGE_UPLOAD_SETTINGS.mimeTypes.includes(file.type)
      : true;

    if (file.size > PRODUCT_IMAGE_UPLOAD_SETTINGS.maxSizeBytes) {
      toast.error(`Dung lượng ảnh tối đa ${PRODUCT_IMAGE_UPLOAD_SETTINGS.maxSizeLabel}`);
      e.target.value = "";
      return;
    }

    if (!hasAllowedExtension || !hasAllowedMime) {
      toast.error(`Chỉ chấp nhận ảnh: ${productImageExtensionsText}`);
      e.target.value = "";
      return;
    }

    if (product?.variant?.[0]?.imgUrl) {
      try {
        const response = await fetch(
          `${apiUrl}/products/${productId}/0/image`,
          {
            method: "DELETE",
            credentials: 'include',
          }
        );
        if (!response.ok) {
          throw new Error("Failed to delete old image");
        }
      } catch (err) {
        console.error("Error deleting old image:", err);
        toast.error("Failed to delete old image");
        return;
      }
    }

    const formData = new FormData();
    formData.append("product", file);
    try {
      const response = await fetch(`${apiUrl}/products/upload/image`, {
        method: "POST",
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        const updatedProduct = {
          ...product,
          variant: [
            {
              ...(product.variant?.[0] || {}),
              imgUrl: data.imgUrl,
            },
          ],
        };
        setProduct(updatedProduct);
        handleProductUpdate(updatedProduct);
      } else {
        toast.error("Image upload failed!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error uploading image!");
    }
  };

  const handleProductUpdate = async (updatedProduct = product) => {
    if (!updatedProduct) {
      toast.error("Không có dữ liệu sản phẩm để cập nhật");
      return;
    }

    try {
      const variantData = updatedProduct.variant?.length
        ? updatedProduct.variant[0]
        : {};
      const originalVariantData = originalProduct?.variant?.length
        ? originalProduct.variant[0]
        : {};
      const nextEarn = earnInput !== "" ? Number(earnInput) : (Number(variantData.earn) || 0);
      const nextPrice = calculateSalePrice(
        variantData.importPrice,
        nextEarn,
        variantData.price
      );

      const productData = {
        name: updatedProduct.name || "",
        code: updatedProduct.code || "",
        vat: updatedProduct.vat || "",
        type: updatedProduct.type || "",
        brand: updatedProduct.brand || "",
        adjusted: isProductAdjusted(updatedProduct),
        section: updatedProduct.section || "",
        value: updatedProduct.value || "",
        warranty: updatedProduct.warranty || "",
        solution: updatedProduct.solution || "",
        description: updatedProduct.description || "",
        features: updatedProduct.features || "",
        operatingMethod: updatedProduct.operatingMethod || "",
        advantages: updatedProduct.advantages || "",
        specifications: updatedProduct.specifications || "",
        infoDoc: {
          manual: updatedProduct.infoDoc?.manual || "",
          dataSheet: updatedProduct.infoDoc?.dataSheet || "",
          catalog: updatedProduct.infoDoc?.catalog || "",
          others: updatedProduct.infoDoc?.others || "",
        },
        variant: [
          {
            price: nextPrice,
            importPrice: variantData.importPrice || "",
            earn: nextEarn,
            quantityForSale: Number(originalVariantData.quantityForSale) || 0,
            quantityInStorage: Number(originalVariantData.quantityInStorage) || 0,
            imgUrl: variantData.imgUrl || "",
            note: noteInput !== "" ? noteInput : (variantData.note || ""),
            color: variantData.color || "",
            shape: variantData.shape || "",
            buttonCount: variantData.buttonCount || "",
            frame: variantData.frame || "",
          },
        ],
      };

      const response = await fetch(`${apiUrl}/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update product");
      }

      toast.success("Cập nhật sản phẩm thành công");
      fetchProduct();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update product");
    }
  };

  const handleDeleteProduct = async () => {
    if (window.confirm("Bạn có chắc muốn xóa sản phẩm này")) {
      try {
        const response = await fetch(`${apiUrl}/products/${productId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete product");
        }
        toast.success("Xóa sản phẩm thành công");
        setTimeout(() => {
          window.location.href = "/admin/product";
        }, 1000);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to delete product");
      }
    }
  };

  const handleUpdateQuantity = async () => {
    if (!quantityInput || isNaN(quantityInput)) {
      toast.error("Vui lòng nhập số lượng hợp lệ");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/products/${productId}/0`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ quantity: quantityInput, orderId: '', orderName: '' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update quantity");
      }

      toast.success("Cập nhật số lượng thành công");
      setQuantityInput("");
      fetchProduct();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update quantity");
    }
  };

  const handleSaveNote = async () => {
    if (!product) return;

    try {
      const updatedProduct = {
        ...product,
        variant: [
          {
            ...(product.variant?.[0] || {}),
            note: noteInput,
          },
        ],
      };

      await handleProductUpdate(updatedProduct);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save note");
    }
  };

  const handleUpdateVat = async () => {
    if (!product) return;

    try {
      const response = await fetch(`${apiUrl}/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ vat: product.vat || "" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update VAT");
      }

      toast.success("Cập nhật VAT thành công");
      fetchProduct();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update VAT");
    }
  };

  const handleUpdateEarn = async () => {
    if (!earnInput || isNaN(earnInput) || earnInput < 0) {
      toast.error("Vui lòng nhập % lợi nhuận hợp lệ");
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/products/${productId}/0/update-earn`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({ earn: Number(earnInput) }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update earn");
      }

      toast.success("Cập nhật % lợi nhuận thành công");
      fetchProduct();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update earn");
    }
  };

  const handleUpdateImportPrice = async () => {
    const importPrice = product.variant?.[0]?.importPrice || "";
    if (!importPrice || isNaN(importPrice.replace(/\./g, ""))) {
      toast.error("Vui lòng nhập giá nhập hợp lệ");
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/products/${productId}/0/update-import-price`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({ importPrice }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update import price");
      }

      toast.success("Cập nhật giá nhập thành công");
      fetchProduct();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update import price");
    }
  };

  // Hàm xử lý thay đổi display
  const handleToggleDisplay = async () => {
    try {
      const response = await fetch(
        `${apiUrl}/products/${productId}/toggle-display`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Không thể thay đổi trạng thái hiển thị"
        );
      }

      const updatedData = await response.json();
      setProduct({ ...product, display: updatedData.product.display });
      toast.success(updatedData.message);
    } catch (error) {
      console.error("Error toggling display:", error);
      toast.error(error.message);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [brandsRes, typesRes, sectionsRes] = await Promise.all([
          fetch(`${apiUrl}/chips/brands`),
          fetch(`${apiUrl}/chips/types`),
          fetch(`${apiUrl}/chips/section`),
        ]);

        if (brandsRes.ok)
          setBrands((await brandsRes.json()).map((b) => b.Brand));
        if (typesRes.ok) setTypes((await typesRes.json()).map((t) => t.Type));
        if (sectionsRes.ok) setSections(await sectionsRes.json());
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchSectionValues = async () => {
      if (product?.section) {
        try {
          const response = await fetch(
            `${apiUrl}/chips/${product.section}/value`
          );
          if (response.ok) {
            setValues(await response.json());
          }
        } catch (error) {
          console.error("Error fetching section values:", error);
          setValues([]);
        }
      }
    };
    fetchSectionValues();
  }, [product?.section]);

  const generateQRCode = async () => {
    if (!product) return;

    try {
      const qrContent = `${window.location.origin}/product/${productId}`;
      const url = await QRCode.toDataURL(qrContent);
      setQrCodeUrl(url);
      setOpenQRDialog(true);
    } catch (err) {
      console.error("Error generating QR code:", err);
      toast.error("Failed to generate QR code");
    }
  };

  const handleDownloadQR = () => {
    if (!product || !qrCodeUrl) return;

    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `${product.name.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseQRDialog = () => {
    setOpenQRDialog(false);
  };

  return (
    <div style={{ maxWidth: "900px" }}>
      {product ? (
        <>
          <Box
            sx={{
              position: "fixed",
              top: { xs: 56, md: 0 },
              left: { xs: 20, md: 260 },
              right: { xs: 20, md: 20 },
              zIndex: 1000,
              px: 0,
              py: 1.25,
              display: "flex",
              gap: 1.5,
              flexWrap: "wrap",
              alignItems: "center",
              backgroundColor: "white",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            }}
          >
            {canEdit && (
              <Button
                onClick={() => handleProductUpdate()}
                variant="contained"
                color="success"
                size="small"
              >
                Cập nhật sản phẩm
              </Button>
            )}
            {canDelete && (
              <Button
                onClick={handleDeleteProduct}
                variant="contained"
                color="error"
                size="small"
              >
                Xóa sản phẩm
              </Button>
            )}
            <Button onClick={generateQRCode} variant="contained" size="small">
              Tạo mã QR
            </Button>
            {canEdit && (
              <Button variant="contained" component="label" size="small">
                Thêm ảnh
                <input
                  id="imageUpload"
                  type="file"
                  accept={PRODUCT_IMAGE_ACCEPT}
                  hidden
                  onChange={handleImageUpload}
                />
              </Button>
            )}
            {canEdit && (
              <Box
                onClick={handleToggleDisplay}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  border: "1px solid",
                  borderColor: "primary.main",
                  borderRadius: 1,
                  pl: 1,
                  pr: 0.5,
                  height: "30px",
                  cursor: "pointer",
                  userSelect: "none",
                  "&:hover": { backgroundColor: "rgba(25,118,210,0.08)" },
                }}
              >
                <Typography sx={{ fontSize: "0.8125rem", color: "primary.main", lineHeight: 1 }}>Hiển thị</Typography>
                <Checkbox
                  size="small"
                  checked={product.display}
                  color="primary"
                  disableRipple
                  onClick={(e) => e.stopPropagation()}
                  onChange={handleToggleDisplay}
                  sx={{ p: "4px" }}
                />
              </Box>
            )}
          </Box>
          <Box sx={{ height: 62, mb: 2 }} />

          {product.variant?.[0]?.imgUrl ? (
            <Card sx={{ maxWidth: "400px", mt: 2, mb: 2 }}>
              <CardMedia
                component="img"
                sx={{ width: "400px", height: "300px", objectFit: "contain" }}
                image={product.variant?.[0]?.imgUrl}
                alt="Product image"
                onClick={() => {
                  if (canEdit) document.getElementById("imageUpload")?.click();
                }}
                style={{ cursor: canEdit ? "pointer" : "default" }}
              />
            </Card>
          ) : (
            <Box sx={{ mt: 2, mb: 2 }} />
          )}

          <Typography variant="h6">Quản lý số liệu</Typography>
          <Typography
            variant="body1"
            sx={{ mt: 2, color: "rgb(255, 123, 0)", fontWeight: 700 }}
          >
            Giá:{" "}
            {(product.variant?.[0]?.price || "0")
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}{" "}
            VND
          </Typography>

          <Box
            sx={{ ...metricRowSx, mt: 2 }}
          >
            <NumericFormat
              label="Giá nhà cung cấp"
              value={product.variant?.[0]?.importPrice || ""}
              customInput={TextField}
              thousandSeparator="."
              decimalSeparator=","
              onValueChange={(values) =>
                setProduct({
                  ...product,
                  variant: [
                    {
                      ...(product.variant?.[0] || {}),
                      importPrice: values.value,
                    },
                  ],
                })
              }
              disabled={!canEdit}
              fullWidth
              size="small"
              sx={{ flex: 1 }}
            />
            {canEdit && (
            <Button
              onClick={handleUpdateImportPrice}
              variant="contained"
              color="primary"
              size="small"
              sx={metricButtonSx}
            >
              Cập nhật giá nhập
            </Button>
            )}
          </Box>

          <Box
            sx={metricRowSx}
          >
            <TextField
              type="number"
              value={earnInput}
              onChange={(e) => setEarnInput(e.target.value)}
              label="% Lợi nhuận"
              size="small"
              disabled={!canEdit}
              sx={{ flex: 1 }}
            />
            {canEdit && (
            <Button
              onClick={handleUpdateEarn}
              variant="contained"
              color="primary"
              size="small"
              sx={metricButtonSx}
            >
              Cập nhật % lợi nhuận
            </Button>
            )}
          </Box>

          <Box sx={metricRowSx}>
            <TextField
              label="VAT"
              fullWidth
              size="small"
              value={product.vat || ""}
              onChange={(e) => setProduct({ ...product, vat: e.target.value })}
              disabled={!canEdit}
              sx={{ flex: 1 }}
            />
            {canEdit && (
              <Button
                onClick={handleUpdateVat}
                variant="contained"
                color="primary"
                size="small"
                sx={metricButtonSx}
              >
                Cập nhật VAT
              </Button>
            )}
          </Box>

          <Box
            sx={metricRowSx}
          >
            <TextField
              multiline
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              label="Ghi chú"
              size="small"
              disabled={!canEdit}
              sx={{ flex: 1 }}
            />
            {canEdit && (
            <Button
              onClick={handleSaveNote}
              variant="contained"
              color="primary"
              size="small"
              sx={metricButtonSx}
            >
              Lưu ghi chú
            </Button>
            )}
          </Box>

          <Box
            sx={metricRowSx}
          >
            <TextField
              type="number"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              label="Nhập số lượng"
              size="small"
              disabled={!canEdit}
              sx={{ flex: 1 }}
            />
            {canEdit && (
            <Button
              onClick={handleUpdateQuantity}
              variant="contained"
              color="primary"
              size="small"
              sx={metricButtonSx}
            >
              Nhập số lượng
            </Button>
            )}
          </Box>

          <TextField
            label="Số lượng đang bán (Hiển thị ở trang bán hàng)"
            value={product.variant?.[0]?.quantityForSale || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                variant: [
                  {
                    ...(product.variant?.[0] || {}),
                    quantityForSale: e.target.value,
                  },
                ],
              })
            }
            disabled={!canEdit}
            fullWidth
            margin="normal"
            size="small"
          />

          <TextField
            label="Số lượng còn trong kho"
            value={product.variant?.[0]?.quantityInStorage || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                variant: [
                  {
                    ...(product.variant?.[0] || {}),
                    quantityInStorage: e.target.value,
                  },
                ],
              })
            }
            disabled={!canEdit}
            fullWidth
            margin="normal"
            size="small"
          />

          <Typography variant="h6">Quản lý thông tin</Typography>
          <Box sx={{ display: "flex", gap: "10%", width: "100%" }}>
            <Autocomplete
              value={product.type || null}
              options={types}
              disabled={!canEdit}
              onChange={(e, newValue) =>
                setProduct({ ...product, type: newValue })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Loại"
                  required
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
            <Autocomplete
              value={product.brand || null}
              options={brands}
              disabled={!canEdit}
              onChange={(e, newValue) =>
                setProduct({ ...product, brand: newValue })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Thương hiệu"
                  required
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: "10%", width: "100%" }}>
            <Autocomplete
              value={product.section || null}
              options={sections}
              disabled={!canEdit}
              onChange={(e, newValue) =>
                setProduct({ ...product, section: newValue })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cụm"
                  required
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
            <Autocomplete
              value={product.value || null}
              options={values}
              onChange={(e, newValue) =>
                setProduct({ ...product, value: newValue })
              }
              disabled={!canEdit || values.length === 0}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Thiết bị"
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
          </Box>

          <TextField
            label="Tên sản phẩm"
            fullWidth
            margin="normal"
            size="small"
            value={product.name || ""}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            disabled={!canEdit}
          />
          <TextField
            label="Mã sản phẩm"
            fullWidth
            margin="normal"
            size="small"
            value={product.code || ""}
            onChange={(e) => setProduct({ ...product, code: e.target.value })}
            disabled={!canEdit}
          />
          <TextField
            label="Bảo hành"
            fullWidth
            margin="normal"
            size="small"
            value={product.warranty || ""}
            onChange={(e) =>
              setProduct({ ...product, warranty: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Giải pháp"
            fullWidth
            margin="normal"
            size="small"
            value={product.solution || ""}
            onChange={(e) =>
              setProduct({ ...product, solution: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Mô tả"
            fullWidth
            margin="normal"
            multiline
            value={product.description || ""}
            onChange={(e) =>
              setProduct({ ...product, description: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Tính năng"
            fullWidth
            margin="normal"
            multiline
            value={product.features || ""}
            onChange={(e) =>
              setProduct({ ...product, features: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Cách thức hoạt động"
            fullWidth
            margin="normal"
            multiline
            value={product.operatingMethod || ""}
            onChange={(e) =>
              setProduct({ ...product, operatingMethod: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Ưu điểm"
            fullWidth
            margin="normal"
            multiline
            value={product.advantages || ""}
            onChange={(e) =>
              setProduct({ ...product, advantages: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Thông số kỹ thuật"
            fullWidth
            margin="normal"
            multiline
            value={product.specifications || ""}
            onChange={(e) =>
              setProduct({ ...product, specifications: e.target.value })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Link manual"
            fullWidth
            margin="normal"
            size="small"
            value={product.infoDoc?.manual || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                infoDoc: { ...product.infoDoc, manual: e.target.value },
              })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Link data sheet"
            fullWidth
            margin="normal"
            size="small"
            value={product.infoDoc?.dataSheet || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                infoDoc: { ...product.infoDoc, dataSheet: e.target.value },
              })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Link catalog"
            fullWidth
            margin="normal"
            size="small"
            value={product.infoDoc?.catalog || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                infoDoc: { ...product.infoDoc, catalog: e.target.value },
              })
            }
            disabled={!canEdit}
          />

          <TextField
            label="Link khác"
            fullWidth
            margin="normal"
            size="small"
            value={product.infoDoc?.others || ""}
            onChange={(e) =>
              setProduct({
                ...product,
                infoDoc: { ...product.infoDoc, others: e.target.value },
              })
            }
            disabled={!canEdit}
          />
          <Dialog open={openQRDialog} onClose={handleCloseQRDialog} disableScrollLock>
            <DialogTitle>QR Code</DialogTitle>
            <DialogContent>
              {qrCodeUrl && (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    style={{ width: "300px", height: "300px" }}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseQRDialog}>Đóng</Button>
              <Button
                onClick={handleDownloadQR}
                variant="contained"
                startIcon={<DownloadIcon />}
              >
                Tải về
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <p>Loading product information...</p>
      )}
    </div>
  );
};

export default ProductDisplay;
