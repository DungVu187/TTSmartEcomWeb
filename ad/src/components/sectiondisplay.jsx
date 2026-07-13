
import { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  TablePagination,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL;

const SectionDisplay = () => {
  const [manageData, setManageData] = useState(null);
  const [products, setProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [activeSection, setActiveSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const navigate = useNavigate();

  const apiFetch = async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        navigate("/login");
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Lỗi ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };

  // Lấy dữ liệu manages
  const fetchManageData = async () => {
    setLoading(true);
    const result = await apiFetch(`${apiUrl}/manages/`);
    if (result?.success) {
      setManageData(result.data);
      await fetchProductsByIds(result.data);
    }
    setLoading(false);
  };

  // Lấy sản phẩm theo IDs
  const fetchProductsByIds = async (manageData) => {
    if (!manageData) return;
    const allProductIds = [
      ...(manageData.section1?.productId || []),
      ...(manageData.section2?.productId || []),
      ...(manageData.section3?.productId || []),
      ...(manageData.section4?.productId || []),
      ...(manageData.section5?.productId || []),
      ...(manageData.section6?.productId || []),
      ...(manageData.section7?.productId || []),
      ...(manageData.section8?.productId || []),
      ...(manageData.section9?.productId || []),
      ...(manageData.section10?.productId || []),
    ];

    if (allProductIds.length === 0) {
      setProducts([]);
      return;
    }

    const result = await apiFetch(`${apiUrl}/products/fetch-by-ids`, {
      method: "POST",
      body: JSON.stringify({ ids: allProductIds }),
    });

    if (result?.success) {
      setProducts(result.products || []);
    }
  };

  // Lấy tất cả sản phẩm với tìm kiếm và phân trang
  const fetchAllProducts = async (search = "", pageNum = 1, limit = rowsPerPage) => {
    const query = new URLSearchParams({ search, page: pageNum, limit }).toString();
    const result = await apiFetch(`${apiUrl}/products/?${query}`);
    if (result?.products) {
      setAvailableProducts(result.products);
    }
  };

  // Cập nhật tên section
  const handleUpdateName = async (section, newName) => {
    const result = await apiFetch(`${apiUrl}/manages/update-${section}`, {
      method: "PUT",
      body: JSON.stringify({ name: newName }),
    });

    if (result?.success) {
      setManageData(result.data);
      toast.success(`Cập nhật tên ${section} thành công`);
    }
  };

  // Chuyển display thành true
  const toggleDisplayToTrue = async (productId) => {
    const result = await apiFetch(`${apiUrl}/products/${productId}/toggle-display`, {
      method: "PUT",
    });

    return result?.product?.display ?? null;
  };

  // Thêm sản phẩm
  const handleAddProduct = async (section, productId) => {
    if (!manageData || !manageData[section]) {
      toast.error(`Dữ liệu cho ${section} chưa được tải`);
      return;
    }

    const productToAdd =
      availableProducts.find((p) => p._id === productId) ||
      products.find((p) => p._id === productId);
    if (!productToAdd) {
      toast.error("Không tìm thấy sản phẩm để thêm");
      return;
    }

    let updatedDisplay = productToAdd.display;
    if (!productToAdd.display) {
      updatedDisplay = await toggleDisplayToTrue(productId);
      if (updatedDisplay === null) return;

      setProducts((prev) =>
        prev.map((p) => (p._id === productId ? { ...p, display: updatedDisplay } : p))
      );
      setAvailableProducts((prev) =>
        prev.map((p) => (p._id === productId ? { ...p, display: updatedDisplay } : p))
      );
    }

    const currentProductIds = manageData[section].productId || [];
    const result = await apiFetch(`${apiUrl}/manages/update-${section}`, {
      method: "PUT",
      body: JSON.stringify({ productId: [...new Set([...currentProductIds, productId])] }),
    });

    if (result?.success) {
      setManageData(result.data);
      await fetchProductsByIds(result.data);
      setOpenAddDialog(false);
      toast.success("Thêm sản phẩm thành công");
    }
  };

  // Xóa sản phẩm
  const handleDeleteProduct = async () => {
    if (!manageData || !manageData[activeSection]) {
      toast.error(`Dữ liệu cho ${activeSection} chưa được tải`);
      return;
    }

    const currentProductIds = manageData[activeSection].productId || [];
    const updatedProductIds = currentProductIds.filter((id) => id !== selectedProductId);
    const result = await apiFetch(`${apiUrl}/manages/update-${activeSection}`, {
      method: "PUT",
      body: JSON.stringify({ productId: updatedProductIds }),
    });

    if (result?.success) {
      setManageData(result.data);
      await fetchProductsByIds(result.data);
      setOpenDeleteDialog(false);
      toast.success("Xóa sản phẩm thành công");
    }
  };

  // Tìm kiếm sản phẩm với debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (openAddDialog) {
        fetchAllProducts(searchTerm, page + 1, rowsPerPage);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, page, rowsPerPage, openAddDialog]);

  // Lấy dữ liệu ban đầu
  useEffect(() => {
    fetchManageData();
  }, []);

  // Xử lý phân trang
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Component hiển thị section
  const SectionComponent = ({ section, displayName }) => {
    const sectionData = manageData?.[section] || {};
    const [name, setName] = useState(sectionData.name || "");

    return (
      <Box mb={5}>
        <Typography variant="h6">{displayName}</Typography>
        <Box display="flex" gap={2} my={2}>
          <TextField
            label="Tên hiển thị"
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
            size="small"
            sx={{ width: 200 }}
          />
          <Button
            variant="contained"
            onClick={() => handleUpdateName(section, name)}
            disabled={!name.trim()}
          >
            Cập nhật tên
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setActiveSection(section);
              setOpenAddDialog(true);
              setSearchTerm("");
              setPage(0);
              fetchAllProducts("", 1, rowsPerPage);
            }}
          >
            Thêm sản phẩm
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Hình ảnh</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Thương hiệu</TableCell>
                <TableCell>Cụm</TableCell>
                <TableCell>Thiết bị</TableCell>
                <TableCell align="center">Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(sectionData.productId || []).map((id) => {
                const product = products.find((p) => p._id === id) || {};
                return (
                  <TableRow key={id}>
                    <TableCell>{product.name || "N/A"}</TableCell>
                    <TableCell>
                      {product.variant?.[0]?.imgUrl ? (
                        <img
                          src={product.variant?.[0]?.imgUrl}
                          alt={product.name || "Sản phẩm"}
                          style={{ width: 50, height: 50, objectFit: "cover" }}
                        />
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>{product.type || "N/A"}</TableCell>
                    <TableCell>{product.brand || "N/A"}</TableCell>
                    <TableCell>{product.section || "N/A"}</TableCell>
                    <TableCell>{product.value || "N/A"}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={() => {
                          setActiveSection(section);
                          setSelectedProductId(id);
                          setOpenDeleteDialog(true);
                        }}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={3}>
        <CircularProgress />
        <Typography mt={2}>Đang tải dữ liệu...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <div className="sticky-header">
        <Typography variant="h4" mb={3}>
          Quản lý hiển thị mục sản phẩm
        </Typography>
      </div>
      {manageData ? (
        <>
          <SectionComponent section="section1" displayName="Mục 1" />
          <SectionComponent section="section2" displayName="Mục 2" />
          <SectionComponent section="section3" displayName="Mục 3" />
          <SectionComponent section="section4" displayName="Mục 4" />
          <SectionComponent section="section5" displayName="Mục 5" />
          <SectionComponent section="section6" displayName="Mục 6" />
          <SectionComponent section="section7" displayName="Mục 7" />
          <SectionComponent section="section8" displayName="Mục 8" />
          <SectionComponent section="section9" displayName="Mục 9" />
          <SectionComponent section="section10" displayName="Mục 10" />
        </>
      ) : (
        <Typography>Không có dữ liệu để hiển thị</Typography>
      )}

      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Thêm sản phẩm vào {activeSection}</DialogTitle>
        <DialogContent>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              label="Tìm kiếm sản phẩm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
            <Button variant="contained" onClick={() => fetchAllProducts(searchTerm, page + 1, rowsPerPage)}>
              Tìm kiếm
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Hình ảnh</TableCell>
                  <TableCell>Loại</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableProducts.map((product) => (
                  <TableRow
                    key={product._id}
                    hover
                    onClick={() => handleAddProduct(activeSection, product._id)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell>{product.name || "N/A"}</TableCell>
                    <TableCell>
                      {product.variant?.[0]?.imgUrl ? (
                        <img
                          src={product.variant[0].imgUrl}
                          alt={product.name || "Sản phẩm"}
                          style={{ width: 50, height: 50, objectFit: "cover" }}
                        />
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>{product.type || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={availableProducts.length} // Cần backend trả về totalCount
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Hủy</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>
          Bạn có chắc chắn muốn xóa sản phẩm này khỏi {activeSection}?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Hủy</Button>
          <Button onClick={handleDeleteProduct} color="error">
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SectionDisplay;
