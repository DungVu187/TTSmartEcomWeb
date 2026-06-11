
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  TextField,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
} from "@mui/material";
import TTProductVariants from "./ttproductvariants";

const TTProductDisplay = () => {
  const { ttproductId } = useParams();
  const [ttproduct, setTTProduct] = useState(null);
  const [ttbrands, setTTBrands] = useState([]);
  const [tttypes, setTTTypes] = useState([]);
  const [variantAddOpen, setVariantAddOpen] = useState(false);
  const [variant, setVariant] = useState({
    price: "",
    imgUrl: "",
    quantity:"",
    color: "",
    shape: "",
    buttonCount: "",
    frame: "",
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [colors, setColors] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [frames, setFrames] = useState([]);
  const [buttonCount, setButtonCount] = useState([]);
  const authToken = sessionStorage.getItem("auth-token");

  const handleVariantChange = (e) => {
    const { name, value } = e.target;
    setVariant((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("product", file);
    try {
      const response = await fetch("http://localhost:5000/ttproducts/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setVariant((prev) => ({ ...prev, imgUrl: data.imgUrl }));
        setPreviewUrl(data.imgUrl);
      } else {
        alert("Image upload failed!");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image!");
    }
  };

  const handleVariantSubmit = async () => {
    try {
      // Tách quantity từ state variant
      const { quantity, ...otherFields } = variant;
  
      // Chuyển đổi thành quantityForSale và quantityInStorage
      const updatedVariant = {
        ...otherFields,
        quantityForSale: Number(quantity), // Gán toàn bộ giá trị quantity cho quantityForSale
        quantityInStorage: Number(quantity), // Gán toàn bộ giá trị quantity cho quantityInStorage
      };
  
      const response = await fetch(
        `http://localhost:5000/ttproducts/${ttproductId}/variant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": `${authToken}`
          },
          body: JSON.stringify(updatedVariant),
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add variant");
      }
  
      alert("Variant added successfully!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to add variant");
    }
  };
  

  const handleClickOpenVariant = () => {
    setVariantAddOpen(true);
  };

  const handleClickCloseVariant = () => {
    setVariantAddOpen(false);
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/ttproducts/${ttproductId}`
        );
        if (response.ok) {
          const data = await response.json();
          setTTProduct(data);
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      }
    };
    fetchProduct();
  }, [ttproductId]);

  const handleDeleteProduct = async () => {
    if (window.confirm("Bạn có chắc muốn xóa sản phẩm này")) {
      try {
        const response = await fetch(
          `http://localhost:5000/ttproducts/${ttproductId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "auth-token": `${authToken}`,
            },
          }
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete product");
        }
        alert("Xóa sản phầm thành công");
        window.location.href = "/product";
      } catch (err) {
        console.error(err);
        alert(err.message || "Failed to delete product");
      }
    }
  };

  const handleProductUpdate = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/ttproducts/${ttproductId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "auth-token": `${authToken}`,
          },
          body: JSON.stringify(ttproduct),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update product");
      }

      alert("Product updated successfully!");
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to update product");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandsResponse, typesResponse] = await Promise.all([
          fetch("http://localhost:5000/chips/ttbrands"),
          fetch("http://localhost:5000/chips/tttypes"),
        ]);
        if (brandsResponse.ok && typesResponse.ok) {
          const brandsData = await brandsResponse.json();
          const typesData = await typesResponse.json();
          setTTBrands(brandsData);
          setTTTypes(typesData);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chipResponse] = await Promise.all([
          fetch("http://localhost:5000/chips/getValues"),
        ]);
        if (chipResponse.ok) {
          const chipData = await chipResponse.json();
          setColors(chipData.Color);
          setShapes(chipData.Shapes);
          setFrames(chipData.Frames);
          setButtonCount(chipData.ButtonCount);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{maxWidth: "900px"}}>
      {ttproduct ? (
        <>
          <Button
            onClick={handleClickOpenVariant}
            variant="contained"
            color="primary"
          >
            Thêm mục mới
          </Button>
          <Button
            onClick={handleDeleteProduct}
            variant="contained"
            color="error"
            sx={{ marginLeft: "1rem" }}
          >
            Xóa sản phẩm
          </Button>
          <Button
            onClick={handleProductUpdate}
            variant="contained"
            color="success"
            sx={{ marginLeft: "1rem" }}
          >
            Cập nhật sản phẩm
          </Button>
          <div style={{ display: "flex", gap: "10%", width: "100%" }}>
            <Autocomplete
              value={ttproduct?.type}
              options={tttypes.map((tttype) => tttype.TTType)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Loại"
                  name="type"
                  required
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
            <Autocomplete
              value={ttproduct?.brand}
              options={ttbrands.map((ttbrand) => ttbrand.TTBrand)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Thương hiệu"
                  name="brand"
                  required
                  margin="normal"
                  size="small"
                />
              )}
              sx={{ width: "45%" }}
            />
          </div>
          <TextField
            label="Tên sản phẩm"
            fullWidth
            margin="normal"
            size="small"
            value={ttproduct.name || ""}
            onChange={(e) => setTTProduct({ ...ttproduct, name: e.target.value })}
          />
          <div style={{ display: "flex", gap: "10%", width: "100%" }}>
            <TextField
              label="Bảo hành"
              margin="normal"
              size="small"
              value={ttproduct.warranty || ""}
              sx={{ width: "45%" }}
              onChange={(e) =>
                setTTProduct({ ...ttproduct, warranty: e.target.value })
              }
            />
            <TextField
              label="Giải pháp"
              margin="normal"
              size="small"
              value={ttproduct.solution || ""}
              sx={{ width: "45%" }}
              onChange={(e) =>
                setTTProduct({ ...ttproduct, solution: e.target.value })
              }
            />
          </div>
          <TextField
            label="Mô tả"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={ttproduct.description || ""}
            onChange={(e) =>
              setTTProduct({ ...ttproduct, description: e.target.value })
            }
          />
          <TextField
            label="Tính năng"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={ttproduct.features || ""}
            onChange={(e) =>
              setTTProduct({ ...ttproduct, features: e.target.value })
            }
          />
          <TextField
            label="Cách thức hoạt động"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={ttproduct.operatingMethod || ""}
            onChange={(e) =>
              setTTProduct({ ...ttproduct, operatingMethod: e.target.value })
            }
          />
          <TextField
            label="Ưu điểm"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={ttproduct.advantages || ""}
            onChange={(e) =>
              setTTProduct({ ...ttproduct, advantages: e.target.value })
            }
          />
          <TextField
            label="Thông số kỹ thuật"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={ttproduct.specifications || ""}
            onChange={(e) =>
              setTTProduct({ ...ttproduct, specifications: e.target.value })
            }
          />
          <TTProductVariants variants={ttproduct.variant} />
        </>
      ) : (
        <p>Loading product information...</p>
      )}
      <Dialog open={variantAddOpen} onClose={handleClickCloseVariant}>
        <DialogTitle>Thêm mục mới</DialogTitle>
        <DialogContent>
          {/* Hiển thị ảnh đã tải lên (nếu có) */}
          {previewUrl && (
            <Box display="flex" justifyContent="center" mb={2}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{ width: 100, height: 100 }}
              />
            </Box>
          )}

          <Box mb={2}>
            <Typography variant="body1">Tải ảnh:</Typography>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ marginTop: 8 }}
            />
          </Box>
          <TextField
            name="price"
            label="Giá"
            value={variant.price}
            onChange={handleVariantChange}
            fullWidth
            margin="normal"
            size="small"
          />
          <TextField
            name="quantity"
            label="Số lượng"
            value={variant.quantity}
            onChange={handleVariantChange}
            fullWidth
            margin="normal"
            size="small"
          />
          <Autocomplete
            value={variant.color}
            options={colors}
            onChange={(event, newValue) =>
              setVariant((prev) => ({ ...prev, color: newValue }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Màu sắc"
                margin="normal"
                size="small"
                fullWidth
              />
            )}
          />
          <Autocomplete
            value={variant.shape}
            options={shapes}
            onChange={(event, newValue) =>
              setVariant((prev) => ({ ...prev, shape: newValue }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Dáng"
                margin="normal"
                size="small"
                fullWidth
              />
            )}
          />
          <Autocomplete
            value={variant.frame}
            options={frames}
            onChange={(event, newValue) =>
              setVariant((prev) => ({ ...prev, frame: newValue }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Viền"
                margin="normal"
                size="small"
                fullWidth
              />
            )}
          />
          <Autocomplete
            value={variant.buttonCount}
            options={buttonCount}
            onChange={(event, newValue) =>
              setVariant((prev) => ({ ...prev, buttonCount: newValue }))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Số nút"
                margin="normal"
                size="small"
                fullWidth
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClickCloseVariant}>Hủy</Button>
          <Button
            onClick={handleVariantSubmit}
            color="primary"
            variant="contained"
          >
            Thêm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TTProductDisplay;
