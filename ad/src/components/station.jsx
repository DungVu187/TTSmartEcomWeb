
import React, { useEffect, useState } from "react";
import {
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const apiUrl = import.meta.env.VITE_API_URL;

const Station = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [newStation, setNewStation] = useState({
    stationCode: "",
    stationName: "",
    location: "",
  });

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/stations/`);
      if (!res.ok) throw new Error("Lỗi khi gọi API");
      const data = await res.json();
      setStations(
        data.map((s) => ({
          id: s._id,
          code: s.stationCode,
          name: s.stationName,
          location: s.location,
          productCount: s.productId?.length || 0,
          imgUrl: s.imgUrl || "",
        }))
      );
    } catch (error) {
      console.error("Lỗi khi lấy danh sách trạm:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleCreateStation = async () => {
    const { stationCode, stationName, location } = newStation;

    if (!stationCode || !stationName) {
      alert("Mã trạm và tên trạm là bắt buộc");
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/stations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stationCode,
          stationName,
          location,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tạo trạm");
      }

      setOpenDialog(false);
      toast.success("Tạo trạm thành công");
      setNewStation({ stationCode: "", stationName: "", location: "" });
      fetchStations();
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const columns = [
    {
      field: "imgUrl",
      headerName: "Ảnh",
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ height: "100%", display: "flex", alignItems: "center" }}>
          <Avatar
            src={params.value}
            variant="rounded"
            alt="Station"
            sx={{ width: 56, height: 40 }}
          />
        </Box>
      ),
    },
    { field: "code", headerName: "Mã trạm", flex: 1 },
    { field: "name", headerName: "Tên trạm", flex: 1.5 },
    { field: "productCount", headerName: "Sản phẩm", flex: 1 },
    { field: "location", headerName: "Vị trí", flex: 2 },
    {
      field: "actions",
      headerName: "Thao tác",
      flex: 1.5,
      sortable: false,
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate(`/station/${params.row.code}`)}
          >
            Chi tiết
          </Button>
          <Button variant="contained" color="error" size="small">
            Xóa
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Button
        variant="contained"
        color="primary"
        sx={{ mb: 2 }}
        onClick={() => setOpenDialog(true)}
      >
        Thêm trạm
      </Button>

      <Box sx={{ width: "100%" }}>
        <DataGrid
          rows={stations}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5]}
          autoHeight
          loading={loading}
          disableColumnMenu
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": {
              alignItems: "center",
            },
            "& .MuiDataGrid-row:hover": {
              cursor: "default",
            },
          }}
        />
      </Box>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Thêm trạm mới</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Mã trạm"
            value={newStation.stationCode}
            onChange={(e) =>
              setNewStation({ ...newStation, stationCode: e.target.value })
            }
            required
            size="small"
            sx={{ mt: 1 }}
          />
          <TextField
            label="Tên trạm"
            value={newStation.stationName}
            onChange={(e) =>
              setNewStation({ ...newStation, stationName: e.target.value })
            }
            required
            size="small"
          />
          <TextField
            label="Vị trí"
            value={newStation.location}
            onChange={(e) =>
              setNewStation({ ...newStation, location: e.target.value })
            }
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreateStation}>
            Tạo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Station;
