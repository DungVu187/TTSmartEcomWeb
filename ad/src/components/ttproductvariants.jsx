
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Autocomplete,
} from "@mui/material";

const TTProductVariants = ({ variants }) => {
  const { ttproductId } = useParams();
  const [open, setOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(null);
  const [colors, setColors] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [frames, setFrames] = useState([]);
  const [buttonCount, setButtonCount] = useState([]);
  const [quantity, setQuantity] = useState("");

  const handleUpdateQuantity = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/ttproducts/${ttproductId}/${selectedVariantIndex}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quantity }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update quantity");
      }
      alert("cập nhật số lượng thành công");
      setQuantity("");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to update quantity");
    }
  };

  const handleClickOpen = (variant, index) => {
    setSelectedVariant({ ...variant });
    setSelectedVariantIndex(index);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedVariant(null);
    setSelectedVariantIndex(null);
  };

  const authToken = sessionStorage.getItem("auth-token");

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

  const handleSave = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/ttproducts/${ttproductId}/${selectedVariantIndex}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "auth-token": `${authToken}`,
          },
          body: JSON.stringify(selectedVariant),
        }
      );
      if (response.ok) {
        alert("Cập nhật thành công");
        window.location.reload();
      } else {
        alert("Cập nhật thất bại");
      }
    } catch (error) {
      console.error("Error saving variant:", error);
      alert("Error saving variant.");
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Bạn có chắc muốn xóa mục này");
    if (!confirmDelete) {
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:5000/ttproducts/${ttproductId}/${selectedVariantIndex}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "auth-token": `${authToken}`,
          },
          body: JSON.stringify(selectedVariant),
        }
      );
      if (response.ok) {
        alert("Xóa thành công");
        window.location.reload();
      } else {
        alert("Xóa thất bại");
      }
    } catch (error) {
      console.error("Error deleting variant:", error);
      alert("Error deleting variant.");
    }
  };

  const handleChange = (event, newValue, field) => {
    setSelectedVariant({
      ...selectedVariant,
      [field]: newValue || event.target.value,
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        justifyContent: "center",
        mt: 2,
      }}
    >
      {variants.map((variant, index) => {
        const variantString = `${variant.color || ""} + ${
          variant.shape || ""
        } + ${variant.buttonCount || ""} + ${variant.frame || ""}`;
        return (
          <Card
            key={index}
            sx={{
              maxWidth: 250,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border: "1px solid #ccc",
              boxShadow: 2,
              cursor: "pointer",
              width: "200px",
            }}
            onClick={() => handleClickOpen(variant, index)}
          >
            {variant.imgUrl && (
              <CardMedia
                component="img"
                height="140"
                image={variant.imgUrl}
                alt={`Image of variant ${index}`}
              />
            )}
            <CardContent>
              <Typography variant="body1" gutterBottom>
                {variantString}
              </Typography>
              {variant.price && (
                <Typography variant="subtitle1" color="text.secondary">
                  Giá: {variant.price}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Variant Details</DialogTitle>
        <DialogContent>
          {selectedVariant && (
            <>
              {selectedVariant.imgUrl && (
                <CardMedia
                  component="img"
                  height="100px"
                  image={selectedVariant.imgUrl}
                  alt="Variant image"
                  sx={{ marginBottom: 2 }}
                />
              )}
              <Autocomplete
                value={selectedVariant.color || ""}
                options={colors}
                onChange={(e, newValue) => handleChange(e, newValue, "color")}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Color"
                    margin="normal"
                    size="small"
                    fullWidth
                  />
                )}
              />
              <Autocomplete
                value={selectedVariant.shape || ""}
                options={shapes}
                onChange={(e, newValue) => handleChange(e, newValue, "shape")}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Shape"
                    margin="normal"
                    size="small"
                    fullWidth
                  />
                )}
              />
              <Autocomplete
                value={selectedVariant.buttonCount || ""}
                options={buttonCount}
                onChange={(e, newValue) =>
                  handleChange(e, newValue, "buttonCount")
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Button Count"
                    margin="normal"
                    size="small"
                    fullWidth
                  />
                )}
              />
              <Autocomplete
                value={selectedVariant.frame || ""}
                options={frames}
                onChange={(e, newValue) => handleChange(e, newValue, "frame")}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Frame"
                    margin="normal"
                    size="small"
                    fullWidth
                  />
                )}
              />
              <TextField
                label="Price"
                value={selectedVariant.price || ""}
                onChange={(e) => handleChange(e, e.target.value, "price")}
                fullWidth
                margin="normal"
                variant="outlined"
                size="small"
              />
              <TextField
                label="Số lượng đang bán"
                value={selectedVariant.quantityForSale || ""}
                onChange={(e) =>
                  handleChange(e, e.target.value, "quantityForSale")
                }
                fullWidth
                margin="normal"
                variant="outlined"
                size="small"
              />
              <TextField
                label="Số lượng còn trong kho"
                value={selectedVariant.quantityInStorage || ""}
                onChange={(e) =>
                  handleChange(e, e.target.value, "quantityInStorage")
                }
                fullWidth
                margin="normal"
                variant="outlined"
                size="small"
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <TextField
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  label="Nhập số lượng"
                  size="small"
                  sx={{ marginRight: "10px" }}
                />
                <Button
                  onClick={handleUpdateQuantity}
                  color="primary"
                  variant="contained"
                >
                  Nhập
                </Button>
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSave} color="success" variant="contained">
            Lưu
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Xóa
          </Button>
          <Button onClick={handleClose} color="primary" variant="contained">
            Hủy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TTProductVariants;
