
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ExcelJS from "exceljs";

const apiUrl = import.meta.env.VITE_API_URL;

const StationDisplay = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    stationCode: "",
    stationName: "",
    location: "",
  });

  const fileInputRef = useRef();
  const fileExcelRef = useRef();
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const [openProductDialog, setOpenProductDialog] = useState(false);
  const [searchInput, setSearchInput] = useState({ name: "", code: "" });
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [productData, setProductData] = useState([]);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    if (!searchInput.name && !searchInput.code) {
      setSearchResults([]);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const url = new URL(`${apiUrl}/products`);
        if (searchInput.name) url.searchParams.set("search", searchInput.name);
        if (searchInput.code) url.searchParams.set("code", searchInput.code);
        const res = await fetch(url.toString());
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch (err) {
        console.error("Lỗi tìm sản phẩm:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 1000);
  }, [searchInput]);

  useEffect(() => {
    const fetchStation = async () => {
      try {
        const res = await fetch(`${apiUrl}/stations/code/${code}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Không tìm thấy trạm");
        }
        const data = await res.json();
        setStation(data);
        setForm({
          stationCode: data.stationCode || "",
          stationName: data.stationName || "",
          location: data.location || "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStation();
  }, [code]);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!station?.productId?.length) return setProductData([]);
      const res = await fetch(`${apiUrl}/products/fetch-by-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: station.productId }),
      });
      const data = await res.json();
      setProductData(data.products || []);
    };
    fetchProductData();
  }, [station?.productId]);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleUpdate = async () => {
    if (!station?._id) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/stations/${station._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Cập nhật thất bại");
      }

      const updated = await res.json();
      setStation(updated);
      alert("Cập nhật thành công!");
    } catch (err) {
      alert("Lỗi khi cập nhật: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStation = async () => {
    if (!station?._id) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa trạm ${station.stationName || ""}?`)) return;
    try {
      const res = await fetch(`${apiUrl}/stations/${station._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể xóa trạm");
      }
      alert("Xóa trạm thành công!");
      navigate("/admin/station");
    } catch (err) {
      alert("Lỗi khi xóa trạm: " + err.message);
    }
  };

  const handleAddProduct = async (productId) => {
    if (!station?._id) return;
    const currentIds = station.productId || [];
    if (currentIds.includes(productId)) return;

    const updatedIds = [...currentIds, productId];
    const res = await fetch(`${apiUrl}/stations/${station._id}/products`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId: updatedIds }),
    });

    const data = await res.json();
    setStation(data);
    setOpenProductDialog(false);
    setSearchInput({ name: "", code: "" });
  };

  const handleRemoveProduct = async (productId) => {
    const updatedIds = (station.productId || []).filter((id) => id !== productId);
    const res = await fetch(`${apiUrl}/stations/${station._id}/products`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId: updatedIds }),
    });

    const data = await res.json();
    setStation(data);
  };

  const handleUploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !station?._id) return;

    try {
      if (station.imgUrl) {
        await fetch(`${apiUrl}/stations/${station._id}/remove-image`, {
          method: "DELETE",
          credentials: "include",
        });
      }

      const formData = new FormData();
      formData.append("station", file);

      const res = await fetch(`${apiUrl}/stations/${station._id}/upload-image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể upload ảnh");
      }

      const updated = await res.json();
      setStation(updated.station || updated);
      alert("Ảnh đã được cập nhật");
    } catch (err) {
      alert("Lỗi khi upload ảnh: " + err.message);
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file || !station?._id) return;
    setIsImportingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet(1);
      const headerRow = sheet.getRow(2).values.slice(1);
      const codeColIndex = headerRow.findIndex((h) =>
        h?.toString().toLowerCase().includes("mã")
      );

      if (codeColIndex === -1) {
        alert("Không tìm thấy cột 'Mã sản phẩm'");
        return;
      }

      const codes = [];
      sheet.eachRow((row, idx) => {
        if (idx <= 2) return;
        const code = row.getCell(codeColIndex + 1).text?.trim();
        if (code) codes.push(code);
      });

      if (!codes.length) {
        alert("Không có mã sản phẩm hợp lệ trong file");
        return;
      }

      const res = await fetch(`${apiUrl}/products/by-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ codes }),
      });
      const data = await res.json();
      const idsFromExcel = (data.products || []).map((p) => p._id);
      const currentIds = station.productId || [];
      const newIds = Array.from(new Set([...currentIds, ...idsFromExcel]));

      const updateRes = await fetch(`${apiUrl}/stations/${station._id}/products`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: newIds }),
      });

      const updatedStation = await updateRes.json();
      setStation(updatedStation);
      alert("Đã nhập sản phẩm từ Excel thành công");
    } catch (err) {
      console.error("Lỗi nhập Excel:", err);
      alert("Lỗi khi nhập Excel");
    } finally {
      setIsImportingExcel(false);
    }
  };

  const productColumns = [
    {
      field: "image",
      headerName: "Hình ảnh",
      flex: 1,
      minWidth: 80,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", width: "100%", height: "100%" }}>
          <Avatar src={params.value} variant="rounded" />
        </Box>
      ),
    },
    { field: "name", headerName: "Tên sản phẩm", flex: 2, minWidth: 160 },
    { field: "code", headerName: "Mã sản phẩm", flex: 1.5, minWidth: 120 },
    {
      field: "actions",
      headerName: "Thao tác",
      flex: 1,
      minWidth: 100,
      renderCell: (params) => (
        <Button variant="contained" color="error" size="small" onClick={() => handleRemoveProduct(params.row._id)}>
          Xóa
        </Button>
      ),
    },
  ];

  const productRows = productData.map((p) => ({
    id: p._id,
    _id: p._id,
    name: p.name,
    code: p.code,
    image: p.variant?.[0]?.imgUrl || "",
  }));

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Thông tin trạm</Typography>

      <Box mb={3}>
        <Typography variant="subtitle1" gutterBottom>Ảnh trạm</Typography>
        {station?.imgUrl ? (
          <img
            src={station.imgUrl}
            alt="Station"
            onClick={handleUploadImage}
            style={{
              width: 200,
              height: 120,
              objectFit: "cover",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid #ccc",
            }}
          />
        ) : (
          <Button variant="outlined" onClick={handleUploadImage}>Thêm ảnh</Button>
        )}
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
      </Box>

      <Stack spacing={2} maxWidth={400} mb={4}>
        <TextField label="Mã trạm" value={form.stationCode} onChange={handleChange("stationCode")} fullWidth size="small" />
        <TextField label="Tên trạm" value={form.stationName} onChange={handleChange("stationName")} fullWidth size="small" />
        <TextField label="Vị trí" value={form.location} onChange={handleChange("location")} fullWidth size="small" />
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleUpdate} disabled={saving} sx={{ flex: 1 }}>
            {saving ? "Đang cập nhật..." : "Cập nhật"}
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteStation} sx={{ flex: 1 }}>
            Xóa trạm
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h6" gutterBottom>Danh sách sản phẩm</Typography>
      <Box display="flex" gap={2} mb={2}>
        <Button variant="contained" onClick={() => setOpenProductDialog(true)}>Thêm sản phẩm</Button>
        <Button variant="outlined" onClick={() => fileExcelRef.current?.click()} disabled={isImportingExcel}>
          Nhập Excel
        </Button>
        <input
          type="file"
          accept=".xlsx"
          ref={fileExcelRef}
          style={{ display: "none" }}
          onChange={handleImportExcel}
        />
      </Box>

      <DataGrid
        rows={productRows}
        columns={productColumns}
        pageSize={5}
        rowsPerPageOptions={[5]}
        disableColumnMenu
        disableRowSelectionOnClick
      />

      <Dialog open={openProductDialog} onClose={() => setOpenProductDialog(false)} maxWidth="sm">
        <DialogTitle>Tìm kiếm và thêm sản phẩm</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField label="Tên sản phẩm" value={searchInput.name} onChange={(e) => setSearchInput({ ...searchInput, name: e.target.value })} fullWidth size="small" />
          <TextField label="Mã sản phẩm" value={searchInput.code} onChange={(e) => setSearchInput({ ...searchInput, code: e.target.value })} fullWidth size="small" />
          {searchLoading && <Typography>Đang tìm kiếm...</Typography>}
          <List sx={{ maxHeight: 400, overflowY: "auto", border: "1px solid #ddd", borderRadius: 1 }}>
            {searchResults.map((product) => (
              <ListItem key={product._id} button onClick={() => handleAddProduct(product._id)}>
                <ListItemAvatar>
                  <Avatar src={product.variant?.[0]?.imgUrl || ""} variant="square" />
                </ListItemAvatar>
                <ListItemText primary={product.name} secondary={`Mã: ${product.code}`} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProductDialog(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StationDisplay;
