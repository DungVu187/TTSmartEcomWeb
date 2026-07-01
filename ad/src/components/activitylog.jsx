
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
  Chip,
  Autocomplete,
} from "@mui/material";
import moment from "moment";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL;

const removeVietnameseTones = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
};

// Nhãn hiển thị tiếng Việt cho các action
const ACTION_LABELS = {
  create_product: "Tạo sản phẩm",
  update_product: "Sửa sản phẩm",
  delete_product: "Xóa sản phẩm",
  update_variant: "Sửa biến thể",
  update_earn: "Sửa % lợi nhuận",
  update_import_price: "Sửa giá nhập",
  toggle_display: "Ẩn/Hiện sản phẩm",
  add_variant: "Thêm biến thể",
  delete_variant: "Xóa biến thể",

  // User management
  create_user: "Tạo tài khoản",
  update_user: "Sửa tài khoản",
  delete_user: "Xóa tài khoản",
  update_user_permissions: "Sửa quyền tài khoản",
  assign_user_stations: "Phân trạm cho tài khoản",

  // Station management
  create_station: "Tạo trạm trộn",
  update_station: "Sửa trạm trộn",
  update_station_products: "Cập nhật sản phẩm trạm",
  delete_station: "Xóa trạm trộn",

  // Chips & attributes
  add_chip_attr: "Thêm thuộc tính sản phẩm",
  remove_chip_attr: "Xóa thuộc tính sản phẩm",
  create_brand: "Thêm thương hiệu",
  delete_brand: "Xóa thương hiệu",
  create_type: "Thêm loại sản phẩm",
  delete_type: "Xóa loại sản phẩm",
  create_section: "Thêm phân loại",
  update_section: "Sửa phân loại",
  delete_section: "Xóa phân loại",
  create_section_value: "Thêm giá trị phân loại",
  update_section_value: "Sửa giá trị phân loại",
  delete_section_value: "Xóa giá trị phân loại",

  // Homepage & config updates
  update_settings: "Cập nhật cấu hình chung",
  update_introduction: "Sửa trang giới thiệu",
  update_policy: "Sửa trang chính sách",
  update_homepage_section: "Sửa phần trang chủ",

  // Zalo settings
  update_zalo_settings: "Cập nhật cấu hình Zalo OA"
};

// Nhãn hiển thị tiếng Việt cho các tên trường
const FIELD_LABELS = {
  name: "Tên",
  code: "Mã sản phẩm",
  brand: "Thương hiệu",
  type: "Loại",
  section: "Phân loại",
  value: "Giá trị",
  warranty: "Bảo hành",
  vat: "VAT",
  solution: "Giải pháp",
  description: "Mô tả",
  features: "Tính năng",
  operatingMethod: "Phương thức hoạt động",
  advantages: "Ưu điểm",
  specifications: "Thông số kỹ thuật",
  display: "Hiển thị",
  price: "Giá bán",
  importPrice: "Giá nhập",
  earn: "% Lợi nhuận",
  note: "Ghi chú",
  color: "Màu sắc",
  shape: "Hình dạng",
  buttonCount: "Số nút",
  frame: "Khung",

  // User fields
  email: "Email",
  phone: "Số điện thoại",
  role: "Vai trò",
  functions: "Nhóm chức năng",
  permissions: "Quyền hạn",
  station: "Danh sách trạm",

  // Station fields
  stationName: "Tên trạm",
  stationCode: "Mã trạm",
  allowPublicSignup: "Cho phép đăng ký",
  location: "Địa điểm",
  productId: "Danh sách sản phẩm"
};

// Màu sắc cho từng loại thao tác
const ACTION_COLORS = {
  create_product: "success",
  update_product: "primary",
  delete_product: "error",
  update_variant: "info",
  update_earn: "warning",
  update_import_price: "warning",
  toggle_display: "default",
  add_variant: "success",
  delete_variant: "error",
};

const getActionColor = (action) => {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action];
  if (!action) return "default";
  if (action.startsWith("create_") || action.startsWith("add_")) return "success";
  if (action.startsWith("delete_") || action.startsWith("remove_")) return "error";
  if (action.startsWith("update_")) return "primary";
  return "default";
};

// Hàm lấy nhãn tiếng Việt cho field
const getFieldLabel = (fieldName) => {
  if (!fieldName) return fieldName;
  // Nếu là variant field (e.g. variant[0].price)
  const variantMatch = fieldName.match(/^variant\[(\d+)\]\.(.+)$/);
  if (variantMatch) {
    const idx = variantMatch[1];
    const subField = variantMatch[2];
    const label = FIELD_LABELS[subField] || subField;
    return `Biến thể [${idx}] - ${label}`;
  }
  // Nếu là variant index (e.g. variant[0])
  const variantIdxMatch = fieldName.match(/^variant\[(\d+)\]$/);
  if (variantIdxMatch) {
    return `Biến thể [${variantIdxMatch[1]}]`;
  }
  return FIELD_LABELS[fieldName] || fieldName;
};

const ActivityLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);

  // bộ lọc
  const [userName, setUserName] = useState("");
  const [productName, setProductName] = useState("");
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // debounced values cho tìm kiếm chữ
  const [debouncedUserName, setDebouncedUserName] = useState("");
  const [debouncedProductName, setDebouncedProductName] = useState("");

  const navigate = useNavigate();

  const uniqueUserNames = React.useMemo(() => {
    const names = logs.map((log) => log.userName).filter(Boolean);
    return Array.from(new Set(names));
  }, [logs]);

  const uniqueProductNames = React.useMemo(() => {
    const names = logs.map((log) => log.productName).filter(Boolean);
    return Array.from(new Set(names));
  }, [logs]);

  // Debounce hiệu ứng gõ phím
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUserName(userName);
    }, 500);
    return () => clearTimeout(handler);
  }, [userName]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductName(productName);
    }, 500);
    return () => clearTimeout(handler);
  }, [productName]);

  const fetchLogs = async (currentPage = page, currentUserName = debouncedUserName, currentProductName = debouncedProductName) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: currentPage,
        limit,
        ...(currentUserName && { userName: currentUserName }),
        ...(currentProductName && { productName: currentProductName }),
        ...(action && { action }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      }).toString();

      const res = await fetch(`${apiUrl}/activity-logs?${query}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Lỗi khi tải dữ liệu lịch sử hoạt động");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Tự động gọi API khi bất kỳ bộ lọc hoặc trang nào thay đổi
  useEffect(() => {
    fetchLogs(page, debouncedUserName, debouncedProductName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, startDate, endDate, action, debouncedUserName, debouncedProductName]);

  const handleResetFilters = () => {
    setUserName("");
    setProductName("");
    setAction("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <Box>
      <Typography variant="h5" mb={2} fontWeight="bold">
        Lịch sử hoạt động
      </Typography>

      <Box display="flex" gap={1} flexWrap="wrap" mb={2} alignItems="center">
        <Autocomplete
          freeSolo
          size="small"
          options={uniqueUserNames}
          value={userName}
          onInputChange={(event, newInputValue) => {
            setUserName(newInputValue);
            setPage(1);
          }}
          onChange={(event, newValue) => {
            setUserName(newValue || "");
            setPage(1);
          }}
          filterOptions={(options, state) => {
            const inputValue = removeVietnameseTones(state.inputValue);
            return options.filter((option) =>
              removeVietnameseTones(option).includes(inputValue)
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Người thực hiện"
              placeholder="Nhập tên..."
              variant="outlined"
              sx={{ width: 200 }}
            />
          )}
        />
        <Autocomplete
          freeSolo
          size="small"
          options={uniqueProductNames}
          value={productName}
          onInputChange={(event, newInputValue) => {
            setProductName(newInputValue);
            setPage(1);
          }}
          onChange={(event, newValue) => {
            setProductName(newValue || "");
            setPage(1);
          }}
          filterOptions={(options, state) => {
            const inputValue = removeVietnameseTones(state.inputValue);
            return options.filter((option) =>
              removeVietnameseTones(option).includes(inputValue)
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Sản phẩm"
              placeholder="Nhập tên sản phẩm..."
              variant="outlined"
              sx={{ width: 200 }}
            />
          )}
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
          label="Loại thao tác"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ width: "180px", minWidth: "150px" }}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
        >
          <option value="">Tất cả</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </TextField>
        <Button variant="outlined" color="secondary" onClick={handleResetFilters}>
          Xóa bộ lọc
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Typography>Không có dữ liệu lịch sử hoạt động</Typography>
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

          <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 280px)", overflowX: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell align="center">
                    <b>Người thực hiện</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Thao tác</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Sản phẩm</b>
                  </TableCell>
                  <TableCell align="left">
                    <b>Chi tiết thay đổi</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Thời gian</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell align="center">{row.userName || ""}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={ACTION_LABELS[row.action] || row.action}
                        color={getActionColor(row.action)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {row.productId ? (
                        <span
                          style={{
                            cursor: "pointer",
                            color: "#1976d2",
                            textDecoration: "underline",
                          }}
                          onClick={() =>
                            navigate(`/product/${row.productId}`)
                          }
                        >
                          {row.productName || ""}
                        </span>
                      ) : (
                        row.productName || ""
                      )}
                    </TableCell>
                    <TableCell align="left">
                      {row.details && row.details.length > 0 ? (
                        <Box
                          component="ul"
                          sx={{
                            m: 0,
                            pl: 2,
                            listStyleType: "none",
                            "& li": { mb: 0.3 },
                          }}
                        >
                          {row.details.map((d, idx) => (
                            <li key={idx}>
                              <Typography
                                variant="body2"
                                component="span"
                                sx={{ fontWeight: 500 }}
                              >
                                {getFieldLabel(d.field)}:
                              </Typography>{" "}
                              {d.oldValue ? (
                                <Typography
                                  variant="body2"
                                  component="span"
                                  sx={{
                                    color: "#d32f2f",
                                    textDecoration: "line-through",
                                    mr: 0.5,
                                  }}
                                >
                                  {d.oldValue}
                                </Typography>
                              ) : null}
                              {d.oldValue && d.newValue ? " → " : ""}
                              {d.newValue ? (
                                <Typography
                                  variant="body2"
                                  component="span"
                                  sx={{
                                    color: "#2e7d32",
                                    fontWeight: 600,
                                  }}
                                >
                                  {d.newValue}
                                </Typography>
                              ) : null}
                            </li>
                          ))}
                        </Box>
                      ) : (
                        ""
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

export default ActivityLog;
