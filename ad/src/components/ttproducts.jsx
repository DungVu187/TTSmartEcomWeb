
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField, Autocomplete, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import './style/products.css';

const TTProducts = () => {
  const [ttproducts, setTTProducts] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTTTypeDialogOpen, setIsTTTypeDialogOpen] = useState(false)
  const [isTTBrandDialogOpen, setIsTTBrandDialogOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    tttype: '',
    name: '',
    ttbrand: '',
    price: '',
    imgUrl: '',
    warranty: '',
    shapes: [],
    buttonCount: [],
    frames: [],
    colors: [],
    solution: '',
    description: '',
    features: '',
    operatingMethod: '',
    advantages: '',
    specifications: '',
  });

  const [imageUrl, setImageUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [ttbrands, setTTBrands] = useState([]);
  const [tttypes, setTTTypes] = useState([]);
  const [ttbrandName, setTTBrandName] = useState("");
  const [tttypeName, setTTTypeName] = useState("");

  const navigate = useNavigate(); // Hook để điều hướng

  const handleRowClick = (_id) => {
    navigate(`/ttproduct/${_id}`); // Điều hướng đến trang chi tiết sản phẩm
  };

  const fetchProducts = async (page = 1, limit = rowsPerPage) => {
    try {
      const response = await fetch(`http://localhost:5000/ttproducts?page=${page}&limit=${limit}`);
      const data = await response.json();
      setTTProducts(data.products);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    findProducts(1);
  };

  const findProducts = async (page = 1) => {
    try {
      const response = await fetch(`http://localhost:5000/ttproducts?page=${page}&limit=10&search=${searchQuery}`);
      const data = await response.json();
      setTTProducts(data.products);
      setTotalPages(Math.ceil(data.total / 10));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage + 1);
    fetchProducts(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchProducts(currentPage, rowsPerPage);
  }, [currentPage, rowsPerPage]);

  const openDialog = (ttproduct) => {
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const openBrandDialog = () => {
    setIsTTBrandDialogOpen(true)
  }
  const closeBrandDialog = () => {
    setIsTTBrandDialogOpen(false)
  }
  const openTypeDialog = () => {
    setIsTTTypeDialogOpen(true)
  }
  const closeTypeDialog = () => {
    setIsTTTypeDialogOpen(false)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

  const authToken = sessionStorage.getItem('auth-token');

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/ttproducts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': `${authToken}`,  // Thêm token vào header
        },
        body: JSON.stringify({ ...newProduct, imgUrl: imageUrl })
      });
      const result = await response.json();
      if (response.status === 201) {
        alert('Thêm sản phẩm thành công')
        setTTProducts([...ttproducts, result.ttproduct]);  // Thêm sản phẩm mới vào danh sách
        closeDialog();  // Đóng dialog
        window.location.reload();  // Reloads the current page
      } else {
        alert(result.message || 'Error adding product');
      }
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandsResponse, typesResponse] = await Promise.all([
          fetch('http://localhost:5000/chips/ttbrands'),
          fetch('http://localhost:5000/chips/tttypes'),
        ]);
        const brandsData = await brandsResponse.json();
        const typesData = await typesResponse.json();
        setTTBrands(brandsData);
        setTTTypes(typesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const handleCreateBrand = async () => {
    try {
      const response = await fetch('http://localhost:5000/chips/ttbrands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': `${authToken}`
        },
        body: JSON.stringify({ TTBrand: ttbrandName }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unknown error occurred');
      }
      const newBrand = await response.json();
      alert('Tạo thành công')
      window.location.reload()
    } catch (error) {
      console.error('Error creating type:', error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateType = async () => {
    try {
      const response = await fetch('http://localhost:5000/chips/tttypes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': `${authToken}`
        },
        body: JSON.stringify({ TTType: tttypeName }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unknown error occurred');
      }
      const newType = await response.json();
      alert('Tạo thành công')
      window.location.reload()
    } catch (error) {
      console.error('Error creating type:', error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteBrand = async () => {
    if (!ttbrandName) {
      alert('Vui lòng chọn một hãng để xóa');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa hãng "${ttbrandName}" không?`)) {
      return;
    }
    try {
      const brandToDelete = ttbrands.find((ttbrand) => ttbrand.TTBrand === ttbrandName);
      if (!brandToDelete || !brandToDelete._id) {
        alert('Không tìm thấy hãng này để xóa.');
        return;
      }
      const response = await fetch(`http://localhost:5000/chips/ttbrands/${brandToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': `${authToken}`
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete brand');
      }
      setTTTypeName('');
      alert('Xóa hãng thành công!');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting type:', error.message);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteType = async () => {
    if (!tttypeName) {
      alert('Vui lòng chọn một loại để xóa');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa loại sản phẩm "${tttypeName}" không?`)) {
      return;
    }
    try {
      const typeToDelete = tttypes.find((tttype) => tttype.TTType === tttypeName);
      if (!typeToDelete || !typeToDelete._id) {
        alert('Không tìm thấy loại sản phẩm này để xóa.');
        return;
      }
      const response = await fetch(`http://localhost:5000/chips/types/${typeToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': `${authToken}`
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete type');
      }
      setTTTypeName('');
      alert('Xóa loại sản phẩm thành công!');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting type:', error.message);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className='main-product-add-container'>
      <h2>Danh mục sản phẩm trạm trộn</h2>
      <div className='product-add-functions'>
        <div className='product-add-button-add'>
          <Button variant='contained' color='primary' className="open-product-add-dialog" onClick={openDialog}>Thêm sản phẩm</Button>
          <Button variant='contained' color='primary' className="open-product-add-dialog" onClick={openBrandDialog} sx={{ marginLeft: 2 }}>Thêm hãng</Button>
          <Button variant='contained' color='primary' className="open-product-add-dialog" onClick={openTypeDialog} sx={{ marginLeft: 2 }}>Thêm loại sản phẩm</Button>
        </div>
        <form onSubmit={handleSearch}>
          <TextField
            label="Tìm kiếm sản phẩm"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} // Cập nhật từ khóa tìm kiếm khi người dùng nhập
            fullWidth
            className='product-add-keyword'
            size='small'
          />
          <Button type="submit" variant="contained" color="primary">
            Tìm kiếm
          </Button>
        </form>
      </div>

      <Dialog open={isDialogOpen} onClose={closeDialog}>
        <DialogTitle>Thêm sản phẩm mới</DialogTitle>
        <DialogContent>
          <form onSubmit={handleAddProduct}>
            <Autocomplete
              value={newProduct.tttype}
              onChange={(event, newValue) => {
                // Cập nhật lại giá trị của brand trong state
                setNewProduct((prevState) => ({
                  ...prevState,
                  type: newValue,
                }));
              }}
              options={tttypes.map((tttype) => tttype.TTType)}
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
              size='small'
            />
            <Autocomplete
              value={newProduct.ttbrand}
              onChange={(event, newValue) => {
                // Cập nhật lại giá trị của brand trong state
                setNewProduct((prevState) => ({
                  ...prevState,
                  brand: newValue,
                }));
              }}
              options={ttbrands.map((ttbrand) => ttbrand.TTBrand)}
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
            <TextField
              label="Bảo hành"
              name="warranty"
              value={newProduct.warranty}
              onChange={handleInputChange}
              required
              fullWidth
              margin="normal"
              size='small'
            />
            <TextField
              label="Giải pháp"
              name="solution"
              value={newProduct.solution}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size='small'
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
              size='small'
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
              size='small'
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
              size='small'
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
              size='small'
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
              size='small'
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained" color="primary" onClick={handleAddProduct}>
            Submit
          </Button>
          <Button variant="outlined" color="secondary" onClick={closeDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <div style={{ overflowX: 'auto' }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Loại</TableCell>
              <TableCell>Tên</TableCell>
              <TableCell>Hãng</TableCell>
              <TableCell>Bảo hành</TableCell>
              <TableCell>Giải pháp</TableCell>
              <TableCell>Mô tả</TableCell>
              <TableCell>Tính năng</TableCell>
              <TableCell>Cách thức hoạt động</TableCell>
              <TableCell>Ưu điểm</TableCell>
              <TableCell>Thông số kỹ thuật</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ttproducts.map((ttproduct) => (
              <TableRow
                className='product-data'
                key={ttproduct._id}
                onClick={() => handleRowClick(ttproduct._id)} // Gọi hàm khi nhấn vào hàng
                style={{ cursor: 'pointer' }} // Thêm con trỏ chuột kiểu pointer khi di chuột vào hàng
              >
                <TableCell>{ttproduct.type}</TableCell>
                <TableCell>{ttproduct.name}</TableCell>
                <TableCell>{ttproduct.brand}</TableCell>
                <TableCell>{ttproduct.warranty}</TableCell>
                <TableCell>{ttproduct.solution}</TableCell>
                <TableCell>{ttproduct.description}</TableCell>
                <TableCell>{ttproduct.features}</TableCell>
                <TableCell>{ttproduct.operatingMethod}</TableCell>
                <TableCell>{ttproduct.advantages}</TableCell>
                <TableCell>{ttproduct.specifications}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>

      <TablePagination
        rowsPerPageOptions={[5, 10, 20]}
        component="div"
        count={totalPages * rowsPerPage}
        rowsPerPage={rowsPerPage}
        page={currentPage - 1}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
      <Dialog open={isTTTypeDialogOpen} onClose={closeTypeDialog}>
        <DialogTitle>Thêm loại sản phẩm</DialogTitle>
        <DialogContent>
          <form action="javascript:void(0);">
            <Autocomplete
              value={tttypeName}
              onChange={(event, newValue) => setTTTypeName(newValue)}
              options={tttypes.map((tttype) => tttype.TTType)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Loại"
                  name="type"
                  required
                  fullWidth
                  margin="normal"
                  size="small"
                  onChange={(e) => setTTTypeName(e.target.value)}
                />
              )}
              freeSolo
            />
            <DialogActions>
              <Button onClick={handleCreateType} variant="contained" color="primary">
                Thêm
              </Button>
              <Button onClick={handleDeleteType} variant="contained" color="secondary">
                Xóa
              </Button>
              <Button onClick={closeTypeDialog} variant="contained" color="primary">
                Hủy
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTTBrandDialogOpen} onClose={closeBrandDialog}>
        <DialogTitle>Thêm loại sản phẩm</DialogTitle>
        <DialogContent>
          <form action="javascript:void(0);">
            <Autocomplete
              value={ttbrandName}
              onChange={(event, newValue) => setTTBrandName(newValue)}
              options={ttbrands.map((ttbrand) => ttbrand.TTBrand)} // Access the 'Brand' property
              getOptionLabel={(option) => option} // If option is a string (Brand name), no need for complex logic here
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Hãng"
                  name="brand"
                  required
                  fullWidth
                  margin="normal"
                  size="small"
                  onChange={(e) => setTTBrandName(e.target.value)}
                />
              )}
              freeSolo
            />
            <DialogActions>
              <Button onClick={handleCreateBrand} variant="contained" color="primary">
                Thêm
              </Button>
              <Button onClick={handleDeleteBrand} variant="contained" color="secondary">
                Xóa
              </Button>
              <Button onClick={closeBrandDialog} variant="contained" color="primary">
                Hủy
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TTProducts;  