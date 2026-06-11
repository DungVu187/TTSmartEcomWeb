
import React, { useEffect, useState } from "react";
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
const apiUrl = import.meta.env.VITE_API_URL;

const ProductDisplay = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
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
      const response = await fetch(`${apiUrl}/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
        setNoteInput(data.variant?.[0]?.note || "");
        setEarnInput(data.variant?.[0]?.earn || "");
      }
    } catch (err) {
      console.error("Error fetching product:", err);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
      if (updatedProduct.value && !values.includes(updatedProduct.value)) {
        toast.error("Không có thiết bị tương ứng");
        return;
      }

      const variantData = updatedProduct.variant?.length
        ? updatedProduct.variant[0]
        : {};

      const productData = {
        name: updatedProduct.name || "",
        code: updatedProduct.code || "",
        type: updatedProduct.type || "",
        brand: updatedProduct.brand || "",
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
            price: variantData.price || "",
            importPrice: variantData.importPrice || "",
            earn: Number(variantData.earn) || 0,
            quantityForSale: Number(variantData.quantityForSale) || 0,
            quantityInStorage: Number(variantData.quantityInStorage) || 0,
            imgUrl: variantData.imgUrl || "",
            note: variantData.note || "",
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
          <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
            <Button
              onClick={() => handleProductUpdate()}
              variant="contained"
              color="success"
              size="small"
            >
              Cập nhật sản phẩm
            </Button>
            <Button
              onClick={handleDeleteProduct}
              variant="contained"
              color="error"
              size="small"
            >
              Xóa sản phẩm
            </Button>
            <Button onClick={generateQRCode} variant="contained" size="small">
              Tạo mã QR
            </Button>
            <Button
              variant="outlined"
              onClick={handleToggleDisplay}
              size="small"
            >
              Hiển thị
              <Checkbox
                size="small"
                checked={product.display}
                color="primary"
                sx={{
                  "& .MuiSvgIcon-root": {
                    color: "primary.main",
                  },
                  "&.Mui-checked .MuiSvgIcon-root": {
                    color: "primary.main",
                  },
                }}
              />
            </Button>
          </Box>

          {product.variant?.[0]?.imgUrl ? (
            <Card sx={{ maxWidth: "400px", mt: 2 }}>
              <CardMedia
                component="img"
                sx={{ width: "400px", height: "300px", objectFit: "contain" }}
                image={product.variant?.[0]?.imgUrl}
                alt="Product image"
                onClick={() => document.getElementById("imageUpload").click()}
                style={{ cursor: "pointer" }}
              />
              <input
                id="imageUpload"
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageUpload}
              />
            </Card>
          ) : (
            <Button variant="contained" component="label" sx={{ mt: 2, mb: 2 }}>
              Thêm ảnh
              <input
                id="imageUpload"
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageUpload}
              />
            </Button>
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
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
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
              fullWidth
              margin="normal"
              size="small"
              sx={{ width: "50%" }}
            />
            <Button
              onClick={handleUpdateImportPrice}
              variant="contained"
              color="primary"
              sx={{ width: "210px" }}
            >
              Cập nhật giá nhập
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TextField
              type="number"
              value={earnInput}
              onChange={(e) => setEarnInput(e.target.value)}
              label="% Lợi nhuận"
              size="small"
              sx={{ width: "50%" }}
            />
            <Button
              onClick={handleUpdateEarn}
              variant="contained"
              color="primary"
              sx={{ width: "210px" }}
            >
              Cập nhật % lợi nhuận
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 1,
              mb: 1,
            }}
          >
            <TextField
              type="number"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              label="Nhập số lượng"
              size="small"
              sx={{ width: "50%" }}
            />
            <Button
              onClick={handleUpdateQuantity}
              variant="contained"
              color="primary"
              sx={{ width: "210px" }}
            >
              Nhập số lượng
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TextField
              multiline
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              label="Ghi chú"
              size="small"
              sx={{ width: "50%" }}
            />
            <Button
              onClick={handleSaveNote}
              variant="contained"
              color="primary"
              sx={{ width: "210px" }}
            >
              Lưu ghi chú
            </Button>
          </Box>

          <TextField
            label="Số lượng đang bán"
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
            fullWidth
            margin="normal"
            size="small"
          />

          <Typography variant="h6">Quản lý thông tin</Typography>
          <Box sx={{ display: "flex", gap: "10%", width: "100%" }}>
            <Autocomplete
              value={product.type || null}
              options={types}
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
              disabled={values.length === 0}
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
          />
          <TextField
            label="Mã sản phẩm"
            fullWidth
            margin="normal"
            size="small"
            value={product.code || ""}
            onChange={(e) => setProduct({ ...product, code: e.target.value })}
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
          />
          <Dialog open={openQRDialog} onClose={handleCloseQRDialog}>
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
