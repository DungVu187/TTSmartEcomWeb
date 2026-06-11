import React, { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Select,
  MenuItem,
  Box,
  Pagination,
  Typography,
  InputLabel,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import FilterListIcon from "@mui/icons-material/FilterList";
import "./styles/product.css";
import Item from "../components/item";

const apiUrl = process.env.REACT_APP_BACK_END;

function Product() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const initialFilters = {
    search: queryParams.get("search") || "",
    brand: queryParams.get("brand") || "Tất cả",
    type: queryParams.get("type") || "Tất cả",
    section: queryParams.get("section") || "Tất cả",
    value: queryParams.get("value") || "Tất cả",
    sortBy: queryParams.get("sortBy") || "purchaseCount",
    sortOrder: queryParams.get("sortOrder") || "desc",
  };

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(() => {
    const pageParam = queryParams.get("page");
    return pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState(initialFilters);
  const [openDialog, setOpenDialog] = useState(false);

  const limit = 12;

  const [brands, setBrands] = useState([]);
  const [types, setTypes] = useState([]);
  const [sections, setSections] = useState([]);
  const [values, setValues] = useState([]);

  const fetchProducts = async () => {
    try {
      const updatedFilters = {
        page,
        limit,
        search: filters.search,
        brand: filters.brand === "Tất cả" ? "" : filters.brand,
        type: filters.type === "Tất cả" ? "" : filters.type,
        section: filters.section === "Tất cả" ? "" : filters.section,
        value: filters.value === "Tất cả" ? "" : filters.value,
        sortBy: filters.sortBy || "purchaseCount",
        sortOrder: filters.sortOrder || "desc",
        display: "true",
      };

      const query = new URLSearchParams(updatedFilters).toString();

      const response = await fetch(`${apiUrl}/products?${query}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      setProducts(data.products);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    const updatedFilters = {
      search: queryParams.get("search") || "",
      brand: queryParams.get("brand") || "Tất cả",
      type: queryParams.get("type") || "Tất cả",
      section: queryParams.get("section") || "Tất cả",
      value: queryParams.get("value") || "Tất cả",
      sortBy: queryParams.get("sortBy") || "purchaseCount",
      sortOrder: queryParams.get("sortOrder") || "desc",
    };
    setFilters(updatedFilters);
    const pageParam = queryParams.get("page");
    setPage(pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1);
    fetchProducts();
  }, [location.search]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
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

  const fetchValues = async (sectionName) => {
    try {
      const response = await fetch(`${apiUrl}/chips/${sectionName}/value`);
      const data = await response.json();
      setValues(data);
    } catch (error) {
      console.error("Error fetching values:", error);
      setValues([]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const urlQuery = new URLSearchParams({
      ...filters,
      brand: filters.brand === "Tất cả" ? "" : filters.brand,
      type: filters.type === "Tất cả" ? "" : filters.type,
      section: filters.section === "Tất cả" ? "" : filters.section,
      value: filters.value === "Tất cả" ? "" : filters.value,
      sortBy: filters.sortBy || "purchaseCount",
      sortOrder: filters.sortOrder || "desc",
      page: 1,
    }).toString();

    navigate(`/product?${urlQuery}`);
    setPage(1);
    setOpenDialog(false);
    fetchProducts();
  };

  const handlePageChange = (event, newPage) => {
    const urlQuery = new URLSearchParams({
      ...filters,
      brand: filters.brand === "Tất cả" ? "" : filters.brand,
      type: filters.type === "Tất cả" ? "" : filters.type,
      section: filters.section === "Tất cả" ? "" : filters.section,
      value: filters.value === "Tất cả" ? "" : filters.value,
      sortBy: filters.sortBy || "purchaseCount",
      sortOrder: filters.sortOrder || "desc",
      page: newPage,
    }).toString();

    setPage(Number(newPage) || 1);
    navigate(`/product?${urlQuery}`);
    fetchProducts();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandsResponse, typesResponse, sectionsResponse] =
          await Promise.all([
            fetch(`${apiUrl}/chips/brands`),
            fetch(`${apiUrl}/chips/types`),
            fetch(`${apiUrl}/chips/section`),
          ]);
        const brandsData = await brandsResponse.json();
        const typesData = await typesResponse.json();
        const sectionsData = await sectionsResponse.json();
        setBrands(brandsData);
        setTypes(typesData);
        setSections(sectionsData);

        const initialSection = queryParams.get("section");
        if (initialSection && initialSection !== "Tất cả") {
          fetchValues(initialSection);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const isValueDisabled = filters.section === "Tất cả";

  const filterForm = (
    <form onSubmit={handleSubmit} className="filter-product-string">
      <Typography variant="h6">Tìm kiếm sản phẩm</Typography>
      <TextField
        label="Tìm kiếm theo tên"
        variant="outlined"
        name="search"
        value={filters.search}
        onChange={handleFilterChange}
        fullWidth
        size="small"
        margin="normal"
      />
      <InputLabel>Tìm kiếm thương hiệu</InputLabel>
      <Select
        value={filters.brand || "Tất cả"}
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
      <InputLabel>Tìm kiếm loại sản phẩm</InputLabel>
      <Select
        value={filters.type || "Tất cả"}
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
      <InputLabel>Tìm kiếm theo mục</InputLabel>
      <Select
        value={filters.section || "Tất cả"}
        onChange={handleFilterChange}
        name="section"
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="Tất cả">Tất cả mục</MenuItem>
        {sections.map((section, index) => (
          <MenuItem key={index} value={section}>
            {section}
          </MenuItem>
        ))}
      </Select>
      <InputLabel>Tìm kiếm theo thiết bị</InputLabel>
      <Select
        value={filters.value || "Tất cả"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "value", value: e.target.value },
          })
        }
        disabled={isValueDisabled}
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
      <Typography variant="h6">Sắp xếp theo</Typography>
      <Select
        value={filters.sortBy || "purchaseCount"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "sortBy", value: e.target.value },
          })
        }
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="createdAt">Ngày tạo</MenuItem>
        <MenuItem value="averageReviews">Đánh giá</MenuItem>
        <MenuItem value="purchaseCount">Lượt mua</MenuItem>
      </Select>
      <Select
        value={filters.sortOrder || "desc"}
        onChange={(e) =>
          handleFilterChange({
            target: { name: "sortOrder", value: e.target.value },
          })
        }
        size="small"
        fullWidth
        sx={{ margin: "8px 0" }}
      >
        <MenuItem value="desc">Giảm dần</MenuItem>
        <MenuItem value="asc">Tăng dần</MenuItem>
      </Select>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "16px",
          width: "full",
        }}
      >
        <Button type="submit" variant="contained" color="primary" fullWidth>
          Tìm kiếm
        </Button>
      </div>
    </form>
  );

  return (
    <div
      style={{ padding: "2rem 0 2rem", backgroundColor: "rgb(235, 246, 254)" }}
    >
      <div style={{ maxWidth: "1920px", margin: "auto" }}>
        <Button
          className="filter-button"
          onClick={() => setOpenDialog(true)}
          sx={{ display: "none" }}
          variant="contained"
          color="primary"
          startIcon={<FilterListIcon />}
        >
          Bộ lọc
        </Button>
        <div className="product-filter-main-container">
          <div className="filter-desktop">{filterForm}</div>

          <Dialog
            open={openDialog}
            onClose={() => setOpenDialog(false)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>Bộ lọc sản phẩm</DialogTitle>
            <DialogContent>{filterForm}</DialogContent>
          </Dialog>

          <ul>
            {products.length > 0 ? (
              <Box
                className="product-list-container"
                display="flex"
                flexWrap="wrap"
                justifyContent="flex-start"
                gap={2}
              >
                {products.map((product) => (
                  <Box key={product._id} className="product-item">
                    <Item product={product} />
                  </Box>
                ))}
              </Box>
            ) : (
              <p>Không tìm thấy sản phẩm nào phù hợp.</p>
            )}
          </ul>
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}
        >
          <Pagination
            count={totalPages}
            page={page}
            onChange={(event, value) => handlePageChange(event, value)}
            size="large"
            color="primary"
          />
        </div>
      </div>
    </div>
  );
}

export default Product;