
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Autocomplete,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Checkbox,
  Paper,
} from "@mui/material";
import "./style/products.css";
import toast from "react-hot-toast";
const apiUrl = import.meta.env.VITE_API_URL;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false);
  const [openSectionDialog, setOpenSectionDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({
    type: "",
    name: "",
    code: "",
    brand: "",
    section: "",
    value: "",
    price: "",
    infoDoc: {
      manual: "",
      dataSheet: "",
      catalog: "",
      others: "",
    },
    warranty: "",
    solution: "",
    description: "",
    features: "",
    operatingMethod: "",
    advantages: "",
    specifications: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const [sections, setSections] = useState([]);
  const [values, setValues] = useState([]);
  const [sectionName, setSectionName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [error, setError] = useState("");

  const initialFilters = {
    search: "",
    code: "", // thêm mới
    brand: "Tất cả",
    type: "Tất cả",
    section: "Tất cả",
    value: "Tất cả",
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  const getInitialFilters = () => {
    const savedFilters = sessionStorage.getItem("productFilters");
    return savedFilters ? JSON.parse(savedFilters) : initialFilters;
  };

  const [tempFilters, setTempFilters] = useState(getInitialFilters());

  const normalizeFilters = (filters) => ({
    ...filters,
    brand: filters.brand === "Tất cả" ? "" : filters.brand,
    type: filters.type === "Tất cả" ? "" : filters.type,
    section: filters.section === "Tất cả" ? "" : filters.section,
    value: filters.value === "Tất cả" ? "" : filters.value,
    sortBy: filters.sortBy || "createdAt",
    sortOrder: filters.sortOrder || "desc",
    code: filters.code || "",
  });

  const [filters, setFilters] = useState(getInitialFilters);
  const [quickSearch, setQuickSearch] = useState(() => {
    const initFilters = getInitialFilters();
    return initFilters.search || "";
  });
  const [openSearchDialog, setOpenSearchDialog] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === quickSearch) return prev;
        return { ...prev, search: quickSearch };
      });
      setTempFilters((prev) => {
        if (prev.search === quickSearch) return prev;
        return { ...prev, search: quickSearch };
      });
      setCurrentPage(1);
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [quickSearch]);

  useEffect(() => {
    setQuickSearch(filters.search || "");
  }, [filters.search]);

  const navigate = useNavigate();

  const handleRowClick = (_id) => {
    navigate(`/product/${_id}`);
  };

  const fetchProducts = async (page = currentPage) => {
    try {
      const query = new URLSearchParams({
        page,
        limit: rowsPerPage,
        ...normalizeFilters(filters),
      }).toString();
      const response = await fetch(`${apiUrl}/products?${query}`, {
        credentials: "include",
      });
      const data = await response.json();
      setProducts(data.products);
      setTotalPages(Math.ceil(data.total / rowsPerPage));
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [brandsResponse, typesResponse, sectionResponse] =
        await Promise.all([
          fetch(`${apiUrl}/chips/brands`),
          fetch(`${apiUrl}/chips/types`),
          fetch(`${apiUrl}/chips/section`),
        ]);
      const brandsData = await brandsResponse.json();
      const typesData = await typesResponse.json();
      const sectionData = await sectionResponse.json();
      setBrands(brandsData);
      setTypes(typesData);
      setSections(sectionData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await fetch(`${apiUrl}/chips/section`);
      if (!response.ok) {
        throw new Error(`Lỗi: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Dữ liệu không hợp lệ");
      }
      setSections(data);
    } catch (error) {
      console.error("Error fetching section:", error);
    }
  };

  const fetchValues = async (sectionName) => {
    try {
      const response = await fetch(`${apiUrl}/chips/${sectionName}/value`);
      if (!response.ok) {
        throw new Error("Không tìm thấy dữ liệu");
      }
      const data = await response.json();
      setValues(data);
    } catch (error) {
      toast.error("Mục này chưa có thiết bị");
      setValues([]);
    }
  };

  // Hàm xử lý thay đổi display
  const handleToggleDisplay = async (productId) => {
    try {
      const response = await fetch(
        `${apiUrl}/products/${productId}/toggle-display`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Không thể thay đổi trạng thái hiển thị"
        );
      }

      const updatedProduct = await response.json();
      toast.success(updatedProduct.message);

      setProducts((prevProducts) =>
        prevProducts.map((product) =>
          product._id === productId
            ? { ...product, display: updatedProduct.product.display }
            : product
        )
      );
    } catch (error) {
      console.error("Error toggling display:", error);
      toast.error(error.message);
    }
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage + 1);
    fetchProducts(newPage + 1);
  };

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setCurrentPage(1);
    fetchProducts(1);
  };

  useEffect(() => {
    sessionStorage.setItem("productFilters", JSON.stringify(filters));
    fetchProducts(currentPage);
  }, [filters]);

  useEffect(() => {
    fetchData();
    fetchSections();
    fetchProducts(currentPage);
    if (newProduct.section) {
      fetchValues(newProduct.section);
    } else {
      setValues([]);
    }
  }, [filters, newProduct.section]);

  const openDialog = () => setIsDialogOpen(true);
  const closeDialog = () => setIsDialogOpen(false);
  const openBrandDialog = () => setIsBrandDialogOpen(true);
  const closeBrandDialog = () => {
    setBrandName("");
    setIsBrandDialogOpen(false);
  };
  const openTypeDialog = () => setIsTypeDialogOpen(true);
  const closeTypeDialog = () => {
    setTypeName("");
    setIsTypeDialogOpen(false);
  };
  const handleOpenSectionDialog = () => setOpenSectionDialog(true);
  const handleCloseSectionDialog = () => {
    setOpenSectionDialog(false);
    setSectionName("");
    setNewSectionName("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setNewProduct((prevState) => {
      if (["manual", "dataSheet", "catalog", "others"].includes(name)) {
        return {
          ...prevState,
          infoDoc: {
            ...prevState.infoDoc,
            [name]: value,
          },
        };
      }

      return {
        ...prevState,
        [name]: value,
      };
    });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/products/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ...newProduct }),
      });
      const result = await response.json();
      if (response.status === 201) {
        toast.success("Thêm sản phẩm thành công");
        fetchProducts(currentPage);
        closeDialog();
        setNewProduct({
          type: "",
          name: "",
          code: "",
          brand: "",
          section: "",
          value: "",
          price: "",
          infoDoc: {
            manual: "",
            dataSheet: "",
            catalog: "",
            others: "",
          },
          warranty: "",
          solution: "",
          description: "",
          features: "",
          operatingMethod: "",
          advantages: "",
          specifications: "",
        });
      } else {
        alert(result.message || "Lỗi khi thêm sản phẩm");
      }
    } catch (error) {
      console.error("Lỗi khi thêm sản phẩm:", error);
    }
  };

  const handleCreateBrand = async () => {
    try {
      const response = await fetch(`${apiUrl}/chips/brands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ Brand: brandName }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unknown error occurred");
      }
      toast.success("Thêm hãng thành công");
      fetchData();
      closeBrandDialog();
    } catch (error) {
      console.error("Error creating type:", error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateType = async () => {
    try {
      const response = await fetch(`${apiUrl}/chips/types`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ Type: typeName }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unknown error occurred");
      }
      toast.success("Thêm loại sản phẩm thành công");
      fetchData();
      closeTypeDialog();
    } catch (error) {
      console.error("Error creating type:", error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteBrand = async () => {
    if (!brandName) {
      alert("Vui lòng chọn một hãng để xóa");
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn hãng "${brandName}" không?`)) {
      return;
    }
    try {
      const brandToDelete = brands.find((brand) => brand.Brand === brandName);
      if (!brandToDelete || !brandToDelete._id) {
        alert("Không tìm thấy hãng này để xóa.");
        return;
      }
      const response = await fetch(
        `${apiUrl}/chips/brands/${brandToDelete._id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete brand");
      }
      setTypeName("");
      fetchData();
      toast.success("Xóa hãng thành công!");
      closeBrandDialog();
    } catch (error) {
      console.error("Error deleting type:", error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteType = async () => {
    if (!typeName) {
      alert("Vui lòng chọn một loại để xóa");
      return;
    }
    if (
      !window.confirm(`Bạn có chắc muốn xóa loại sản phẩm "${typeName}" không?`)
    ) {
      return;
    }
    try {
      const typeToDelete = types.find((type) => type.Type === typeName);
      if (!typeToDelete || !typeToDelete._id) {
        alert("Không tìm thấy loại sản phẩm này để xóa.");
        return;
      }
      const response = await fetch(
        `${apiUrl}/chips/types/${typeToDelete._id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete type");
      }
      setTypeName("");
      fetchData();
      toast.success("Xóa loại sản phẩm thành công!");
      closeTypeDialog();
    } catch (error) {
      console.error("Error deleting type:", error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleAddSection = async () => {
    if (!sectionName.trim()) {
      setError("Tên cụm không được để trống!");
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/chips/section`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: sectionName }),
      });
      if (!response.ok) {
        throw new Error("Lỗi khi thêm mục!");
      }
      fetchSections();
      setSectionName("");
      toast.success("Thêm cụm thành công");
      handleCloseSectionDialog();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSection = async () => {
    if (!sectionName) {
      toast.error("Vui lòng chọn một cụm sản phẩm để xóa!");
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/chips/section/${sectionName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Xóa không thành công");
      }
      fetchSections();
      setSectionName("");
      handleCloseSectionDialog();
      toast.success("Xóa thành công!");
    } catch (error) {
      console.error("Lỗi khi xóa:", error);
      toast.info(error.message);
    }
  };

  const handleEditSection = async () => {
    if (!sectionName.trim() || !newSectionName.trim()) {
      toast.error("Vui lòng nhập cả tên cũ và tên mới!");
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/chips/section/${sectionName}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: newSectionName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Cập nhật thất bại");
      }
      toast.success("Cập nhật cụm thành công!");
      fetchSections();
      handleCloseSectionDialog();
    } catch (error) {
      console.error("Error updating section:", error);
      toast.error(error.message || "Lỗi khi cập nhật cụm");
    }
  };

  const cellStyle = {
    width: "100%",
    backgroundColor: "inherit",
    fontSize: "0.875rem",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "hidden",
    display: "block",
    maxHeight: "7em",
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setTempFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "section" ? { value: "Tất cả" } : {}),
    }));
    if (name === "section" && value !== "Tất cả") {
      fetchValues(value);
    } else if (name === "section" && value === "Tất cả") {
      setValues([]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFilters(tempFilters);
    setCurrentPage(1);
    setOpenSearchDialog(false);
  };

  const resetFilters = () => {
    setTempFilters(initialFilters);
    setFilters(initialFilters);
    sessionStorage.removeItem("productFilters");
    setCurrentPage(1);
  };

  const filterForm = (
    <form onSubmit={handleSubmit} className="filter-product-string">
      <TextField
        label="Tìm kiếm theo tên"
        variant="outlined"
        name="search"
        value={tempFilters.search}
        onChange={handleFilterChange}
        fullWidth
        size="small"
        margin="normal"
      />
      <TextField
        label="Mã sản phẩm"
        variant="outlined"
        name="code"
        value={tempFilters.code || ""}
        onChange={handleFilterChange}
        fullWidth
        size="small"
        margin="normal"
      />
      <Select
        value={tempFilters.brand || "Tất cả"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "brand", value: e.target.value },
          })
        }
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="Tất cả">Tất cả thương hiệu</MenuItem>
        {brands.map((brand, index) => (
          <MenuItem key={index} value={brand.Brand}>
            {brand.Brand}
          </MenuItem>
        ))}
      </Select>
      <Select
        value={tempFilters.type || "Tất cả"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "type", value: e.target.value },
          })
        }
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="Tất cả">Tất cả loại sản phẩm</MenuItem>
        {types.map((type, index) => (
          <MenuItem key={index} value={type.Type}>
            {type.Type}
          </MenuItem>
        ))}
      </Select>
      <Select
        value={tempFilters.section || "Tất cả"}
        onChange={handleFilterChange}
        name="section"
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="Tất cả">Tất cả cụm</MenuItem>
        {sections.map((section, index) => (
          <MenuItem key={index} value={section}>
            {section}
          </MenuItem>
        ))}
      </Select>
      <Select
        value={tempFilters.value || "Tất cả"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "value", value: e.target.value },
          })
        }
        disabled={tempFilters.section === "Tất cả"}
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="Tất cả">Tất cả thiết bị</MenuItem>
        {values.map((value, index) => (
          <MenuItem key={index} value={value}>
            {value}
          </MenuItem>
        ))}
      </Select>
      <div
        style={{
          justifyContent: "center",
          marginTop: "16px",
          width: "full",
        }}
      >
        <Button type="submit" variant="contained" color="primary" fullWidth>
          Tìm kiếm
        </Button>
        <Button
          onClick={resetFilters}
          variant="outlined"
          color="error"
          fullWidth
          sx={{ marginTop: "1rem" }}
        >
          Xóa bộ lọc
        </Button>
      </div>
    </form>
  );

  return (
    <div className="main-product-add-container">
      <h2>Danh mục sản phẩm</h2>
      <div className="product-add-functions">
        <div className="product-add-button-add">
          <Button
            variant="contained"
            color="primary"
            className="open-product-add-dialog"
            onClick={openDialog}
          >
            Thêm sản phẩm
          </Button>
          <Button
            variant="contained"
            color="primary"
            className="open-product-add-dialog"
            onClick={openBrandDialog}
            sx={{ marginLeft: 2 }}
          >
            Thêm hãng
          </Button>
          <Button
            variant="contained"
            color="primary"
            className="open-product-add-dialog"
            onClick={openTypeDialog}
            sx={{ marginLeft: 2 }}
          >
            Thêm loại sản phẩm
          </Button>
          <Button
            variant="contained"
            color="primary"
            className="open-product-add-dialog"
            sx={{ marginLeft: 2 }}
            onClick={handleOpenSectionDialog}
          >
            Thêm cụm
          </Button>
        </div>
        <div className="filter-desktop">
          <TextField
            label="Tìm kiếm nhanh..."
            variant="outlined"
            size="small"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Tìm theo tên, mã, hãng..."
            sx={{ width: 250, mr: 2, bgcolor: "white" }}
          />
          <Button
            className="filter-button"
            onClick={() => setOpenSearchDialog(true)}
            variant="contained"
            color="primary"
          >
            Bộ lọc
          </Button>
        </div>
      </div>

      <div>
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 1600 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#dedede" }}>
                <TableCell align="center">Hiển thị</TableCell>
                <TableCell align="center" sx={{ minWidth: 100 }}>Loại</TableCell>
                <TableCell align="center" sx={{ minWidth: 200 }}>Tên</TableCell>
                <TableCell align="center" sx={{ minWidth: 130 }}>Mã sản phẩm</TableCell>
                <TableCell align="center">Ảnh</TableCell>
                <TableCell align="center" sx={{ minWidth: 110 }}>Giá</TableCell>
                <TableCell align="center">Hãng</TableCell>
                <TableCell align="center" sx={{ minWidth: 120 }}>Cụm</TableCell>
                <TableCell align="center" sx={{ minWidth: 120 }}>Thiết bị</TableCell>
                <TableCell align="center" sx={{ minWidth: 100 }}>Bảo hành</TableCell>
                <TableCell align="center" sx={{ minWidth: 120 }}>Số lượng tồn</TableCell>
                <TableCell align="center" sx={{ minWidth: 130 }}>Số lượng đã bán</TableCell>
                <TableCell align="center" sx={{ minWidth: 250 }}>Ghi chú</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  className="product-data"
                  key={product._id}
                  onClick={() => handleRowClick(product._id)}
                  hover
                  style={{ cursor: "pointer" }}
                >
                  <TableCell
                    align="center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={product.display}
                      color="success"
                      onChange={() => handleToggleDisplay(product._id)}
                    />
                  </TableCell>
                  <TableCell align="center">{product.type}</TableCell>
                  <TableCell align="center">{product.name}</TableCell>
                  <TableCell align="center">{product.code}</TableCell>
                  <TableCell align="center">
{product.variant?.[0]?.imgUrl ? (
  <img
    className="img-products"
    src={product.variant?.[0]?.imgUrl}
    alt="Ảnh sản phẩm"
    style={{
      width: "50px",
      height: "50px",
      objectFit: "cover",
    }}
  />
) : (
  <span>Chưa có ảnh</span>
)}
                  </TableCell>
                  <TableCell align="center">
                    {product.variant?.[0]?.price
                      ? Number(product.variant[0].price).toLocaleString("vi-VN")
                      : product.variant?.[0]
                      ? "Liên hệ"
                      : "Chưa có giá"}
                  </TableCell>
                  <TableCell align="center">{product.brand}</TableCell>
                  <TableCell align="center">{product.section}</TableCell>
                  <TableCell align="center">{product.value}</TableCell>
                  <TableCell align="center">{product.warranty}</TableCell>
                  <TableCell align="center">
                    {product.variant?.[0]?.quantityInStorage ?? "Chưa nhập"}
                  </TableCell>
                  <TableCell align="center">{product.purchaseCount}</TableCell>
                  <TableCell align="left" sx={{ verticalAlign: "top" }}>
                    <div style={cellStyle}>
                      {product.variant?.[0]?.note || ""}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <Dialog open={isDialogOpen} onClose={closeDialog}>
        <DialogTitle>Thêm sản phẩm mới</DialogTitle>
        <DialogContent>
          <form onSubmit={handleAddProduct}>
            <Autocomplete
              value={newProduct.type}
              onChange={(event, newValue) => {
                setNewProduct((prevState) => ({
                  ...prevState,
                  type: newValue,
                }));
              }}
              options={types.map((type) => type.Type)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Loại"
                  name="type"
                  required
                  fullWidth
                  margin="normal"
                  size="small"
                />
              )}
              freeSolo
            />
            <TextField
              label="Tên"
              name="name"
              value={newProduct.name}
              onChange={handleInputChange}
              required
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Mã sản phẩm"
              name="code"
              value={newProduct.code}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
            <Autocomplete
              value={newProduct.brand}
              onChange={(event, newValue) => {
                setNewProduct((prevState) => ({
                  ...prevState,
                  brand: newValue,
                }));
              }}
              options={brands.map((brand) => brand.Brand)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Hãng"
                  name="brand"
                  required
                  fullWidth
                  margin="normal"
                  size="small"
                />
              )}
              freeSolo
            />
            <Autocomplete
              value={newProduct.section}
              onChange={(event, newValue) => {
                setNewProduct((prevState) => ({
                  ...prevState,
                  section: newValue,
                }));
              }}
              options={sections}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cụm"
                  name="section"
                  required
                  fullWidth
                  margin="normal"
                  size="small"
                />
              )}
              freeSolo
            />
            <Autocomplete
              value={newProduct.value}
              onChange={(event, newValue) => {
                setNewProduct((prevState) => ({
                  ...prevState,
                  value: newValue || "",
                }));
              }}
              options={values}
              getOptionLabel={(option) => option}
              disabled={!newProduct.section}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Thiết bị"
                  name="values"
                  fullWidth
                  margin="normal"
                  size="small"
                />
              )}
            />
            <TextField
              label="Bảo hành"
              name="warranty"
              value={newProduct.warranty}
              onChange={handleInputChange}
              required
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Giải pháp"
              name="solution"
              value={newProduct.solution}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Mô tả"
              name="description"
              value={newProduct.description}
              onChange={handleInputChange}
              multiline
              rows={2}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Tính năng"
              name="features"
              value={newProduct.features}
              onChange={handleInputChange}
              multiline
              rows={2}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Phương thức hoạt động"
              name="operatingMethod"
              value={newProduct.operatingMethod}
              onChange={handleInputChange}
              multiline
              rows={2}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Ưu điểm"
              name="advantages"
              value={newProduct.advantages}
              onChange={handleInputChange}
              multiline
              rows={2}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Thông số kỹ thuật"
              name="specifications"
              value={newProduct.specifications}
              onChange={handleInputChange}
              multiline
              rows={2}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Link manual"
              name="manual"
              value={newProduct.infoDoc.manual}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Link data sheet"
              name="dataSheet"
              value={newProduct.infoDoc.dataSheet}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Link catalog"
              name="catalog"
              value={newProduct.infoDoc.catalog}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
            <TextField
              label="Link khác"
              name="others"
              value={newProduct.infoDoc.others}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button
            type="submit"
            variant="contained"
            color="success"
            onClick={handleAddProduct}
          >
            Thêm
          </Button>
          <Button variant="outlined" color="secondary" onClick={closeDialog}>
            Hủy
          </Button>
        </DialogActions>
      </Dialog>

      <TablePagination
        rowsPerPageOptions={[50, 100]}
        component="div"
        count={totalPages * rowsPerPage}
        rowsPerPage={rowsPerPage}
        page={currentPage - 1}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
      <Dialog open={isTypeDialogOpen} onClose={closeTypeDialog}>
        <DialogTitle>Thêm loại sản phẩm</DialogTitle>
        <DialogContent>
          <form action="javascript:void(0);">
            <Autocomplete
              value={typeName}
              onChange={(event, newValue) => setTypeName(newValue)}
              options={types.map((type) => type.Type)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Loại"
                  name="type"
                  fullWidth
                  margin="normal"
                  size="small"
                  onChange={(e) => setTypeName(e.target.value)}
                />
              )}
              freeSolo
            />
            <DialogActions>
              <Button
                onClick={handleCreateType}
                variant="contained"
                color="success"
              >
                Thêm
              </Button>
              <Button
                onClick={handleDeleteType}
                variant="contained"
                color="error"
              >
                Xóa
              </Button>
              <Button
                onClick={closeTypeDialog}
                variant="outlined"
                color="secondary"
              >
                Hủy
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBrandDialogOpen} onClose={closeBrandDialog}>
        <DialogTitle>Thêm loại sản phẩm</DialogTitle>
        <DialogContent>
          <form action="javascript:void(0);">
            <Autocomplete
              value={brandName}
              onChange={(event, newValue) => setBrandName(newValue)}
              options={brands.map((brand) => brand.Brand)}
              getOptionLabel={(option) => option}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Hãng"
                  name="brand"
                  fullWidth
                  margin="normal"
                  size="small"
                  onChange={(e) => setBrandName(e.target.value)}
                />
              )}
              freeSolo
            />
            <DialogActions>
              <Button
                onClick={handleCreateBrand}
                variant="contained"
                color="success"
              >
                Thêm
              </Button>
              <Button
                onClick={handleDeleteBrand}
                variant="contained"
                color="error"
              >
                Xóa
              </Button>
              <Button
                onClick={closeBrandDialog}
                variant="outlined"
                color="secondary"
              >
                Hủy
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openSectionDialog} onClose={handleCloseSectionDialog}>
        <DialogTitle>Quản lý cụm sản phẩm</DialogTitle>
        <DialogContent>
          <form action="javascript:void(0);">
            <Autocomplete
              value={sectionName}
              onChange={(event, newValue) => setSectionName(newValue || "")}
              options={sections}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tên cụm"
                  name="section"
                  fullWidth
                  margin="normal"
                  size="small"
                  onChange={(e) => setSectionName(e.target.value)}
                />
              )}
              freeSolo
            />
            <TextField
              label="Tên cụm mới"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              fullWidth
              margin="normal"
              size="small"
              disabled={!sectionName}
            />
            <DialogActions>
              <Button
                onClick={handleAddSection}
                variant="contained"
                color="success"
              >
                Thêm
              </Button>
              <Button
                onClick={handleEditSection}
                variant="contained"
                color="primary"
                disabled={!sectionName || !newSectionName}
              >
                Sửa
              </Button>
              <Button
                onClick={handleDeleteSection}
                variant="contained"
                color="error"
                disabled={!sectionName}
              >
                Xóa
              </Button>
              <Button
                onClick={handleCloseSectionDialog}
                variant="outlined"
                color="secondary"
              >
                Hủy
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openSearchDialog}
        onClose={() => setOpenSearchDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Bộ lọc sản phẩm</DialogTitle>
        <DialogContent>{filterForm}</DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
