
import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import moment from "moment";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL;

const History = () => {
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);

  // bộ lọc
  const [userName, setUserName] = useState("");
  const [orderName, setOrderName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noteType, setNoteType] = useState("");

  // debounced values cho tìm kiếm chữ
  const [debouncedUserName, setDebouncedUserName] = useState("");
  const [debouncedOrderName, setDebouncedOrderName] = useState("");

  const navigate = useNavigate();

  // Debounce hiệu ứng gõ phím
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUserName(userName);
    }, 500);
    return () => clearTimeout(handler);
  }, [userName]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedOrderName(orderName);
    }, 500);
    return () => clearTimeout(handler);
  }, [orderName]);

  const fetchHistories = async (currentPage = page, currentUserName = debouncedUserName, currentOrderName = debouncedOrderName) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: currentPage,
        limit,
        ...(currentUserName && { userName: currentUserName }),
        ...(currentOrderName && { orderName: currentOrderName }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(noteType && { noteType }),
      }).toString();

      const res = await fetch(`${apiUrl}/histories?${query}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Lỗi khi tải dữ liệu lịch sử");
      const data = await res.json();
      setHistories(data.history || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Tự động gọi API khi bất kỳ bộ lọc hoặc trang nào thay đổi
  useEffect(() => {
    fetchHistories(page, debouncedUserName, debouncedOrderName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, startDate, endDate, noteType, debouncedUserName, debouncedOrderName]);

  const handleResetFilters = () => {
    setUserName("");
    setOrderName("");
    setStartDate("");
    setEndDate("");
    setNoteType("");
    setPage(1);
  };

  return (
    <Box p={2}>
      <div className="sticky-header">
        <Typography variant="h5" gutterBottom>
          Lịch sử nhập/xuất kho
        </Typography>
      </div>

      {/* Bộ lọc */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
        <TextField
          label="Người dùng"
          size="small"
          value={userName}
          onChange={(e) => {
            setUserName(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="Tên đơn hàng"
          size="small"
          value={orderName}
          onChange={(e) => {
            setOrderName(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="Từ ngày"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          select
          label="Ghi chú"
          value={noteType}
          onChange={(e) => {
            setNoteType(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ width: "180px", minWidth: "150px" }}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
        >
          <option value="">Tất cả</option>
          <option value="nhap_don">Nhập kho theo đơn</option>
          <option value="xuat_don">Xuất kho theo đơn</option>
          <option value="nhap_thu_cong">Nhập kho thủ công</option>
          <option value="xuat_thu_cong">Xuất kho thủ công</option>
          <option value="nhap_ai">Nhập đơn quét AI</option>
          <option value="xuat_ai">Xuất đơn quét AI</option>
        </TextField>
        <Button variant="outlined" color="secondary" onClick={handleResetFilters}>
          Xóa bộ lọc
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : histories.length === 0 ? (
        <Typography>Không có dữ liệu lịch sử</Typography>
      ) : (
        <>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <FormControl size="small">
              <Select
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value={20}>20 dòng</MenuItem>
                <MenuItem value={50}>50 dòng</MenuItem>
                <MenuItem value={100}>100 dòng</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">
                    <b>Người dùng</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Sản phẩm</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Đơn hàng</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Số lượng</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Ghi chú</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Thời gian</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {histories.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell align="center">{row.userName || ""}</TableCell>
                    <TableCell align="center">
                      {row.productName || ""}
                    </TableCell>
                    <TableCell align="center">
                      {row.orderId ? (
                        <span
                          style={{
                            cursor: "pointer",
                            color: "#1976d2",
                            textDecoration: "underline",
                          }}
                          onClick={() => {
                            if (row.quantity > 0) {
                              navigate(`/importorder/${row.orderId}`);
                            } else if (row.quantity < 0) {
                              navigate(`/exportorder/${row.orderId}`);
                            }
                          }}
                        >
                          {row.orderName || `Đơn hàng (#${row.orderId.slice(-6)})`}
                        </span>
                      ) : (
                        ""
                      )}
                    </TableCell>
                    <TableCell align="center">{row.quantity}</TableCell>
                    <TableCell align="center">
                      {row.isAIScan ? (
                        row.quantity > 0 ? "Nhập đơn quét AI" : "Xuất đơn quét AI"
                      ) : row.orderId ? (
                        row.quantity > 0 ? "Nhập kho theo đơn" : "Xuất kho theo đơn"
                      ) : (
                        row.quantity > 0 ? "Nhập kho thủ công" : "Xuất kho thủ công"
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {moment(row.createdAt).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" my={2}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export default History;
