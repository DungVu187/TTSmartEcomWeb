
import React, { useState, useEffect } from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Chip,
  Typography,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

const apiUrl = import.meta.env.VITE_API_URL;

const vietnameseMapping = {
  order_management: "Quản lý đơn hàng",
  product_management: "Quản lý sản phẩm",
  iporder_management: "Quản lý đơn nhập",
  eporder_management: "Quản lý đơn xuất",
  read_order: "Xem đơn hàng",
  update_order: "Cập nhật đơn hàng",
  delete_order: "Xóa đơn hàng",
  read_iporder: "Xem đơn nhập",
  update_iporder: "Cập nhật đơn nhập",
  delete_iporder: "Xóa đơn nhập",
  read_eporder: "Xem đơn xuất",
  update_eporder: "Cập nhật đơn xuất",
  delete_eporder: "Xóa đơn xuất",
  read_product: "Xem sản phẩm",
  update_product: "Cập nhật sản phẩm",
  delete_product: "Xóa sản phẩm",
};

const Account = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState("");
  const [functions, setFunctions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const availableRoles = ["admin", "staff"];
  const availableFunctions = ["order_management", "product_management", "iporder_management", "eporder_management"];
  const availablePermissions = {
    order_management: ["read_order", "update_order", "delete_order"],
    iporder_management: ["read_iporder", "update_iporder", "delete_iporder"],
    eporder_management: ["read_eporder", "update_eporder", "delete_eporder"],
    product_management: ["read_product", "update_product", "delete_product"],
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${apiUrl}/users/all-users`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Lỗi ${response.status}: Lấy danh sách người dùng thất bại`);
        }
        const data = await response.json();
        const adminStaffUsers = data.filter((u) => u.role === "admin" || u.role === "staff");
        setUsers(adminStaffUsers);
      } catch (error) {
        console.error("Lỗi khi lấy danh sách người dùng:", error);
        setError(error.message);
      }
    };
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setSelectedUser(user);
    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setPassword("");
    setRole(user.role);
    setFunctions(user.functions || []);
    setPermissions(user.permissions || []);
    setOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedUser(null);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("staff");
    setFunctions([]);
    setPermissions([]);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedUser(null);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("");
    setFunctions([]);
    setPermissions([]);
  };

  const handleSave = async () => {
    try {
      if (!phone) {
        throw new Error("Số điện thoại không được để trống");
      }
      if (!selectedUser && !password) {
        throw new Error("Mật khẩu không được để trống");
      }

      const url = selectedUser
        ? `${apiUrl}/users/${selectedUser._id}/permissions`
        : `${apiUrl}/users/admin-create`;
      const method = selectedUser ? "PUT" : "POST";
      const body = {
        name,
        email,
        phone,
        role,
        functions: role === "staff" ? functions : [],
        permissions: role === "staff" ? permissions : [],
      };
      if (password) {
        body.password = password;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Lỗi ${response.status}: Thao tác thất bại`);
      }
      const data = await response.json();
      if (selectedUser) {
        setUsers(users.map((user) => (user._id === selectedUser._id ? data.user : user)));
      } else {
        setUsers([...users, data.user]);
      }
      handleClose();
    } catch (error) {
      console.error("Lỗi khi lưu người dùng:", error);
      setError(error.message);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  const columns = [
    { field: "email", headerName: "Email", width: 200 },
    { field: "phone", headerName: "Số điện thoại", width: 150 },
    { field: "name", headerName: "Tên", width: 150 },
    { field: "role", headerName: "Vai trò", width: 120 },
    {
      field: "functions",
      headerName: "Chức năng",
      width: 200,
      renderCell: (params) =>
        params.value && params.value.length > 0
          ? params.value.map((func) => (
              <Chip key={func} label={vietnameseMapping[func] || func} sx={{ m: 0.5 }} />
            ))
          : "Không có",
    },
    {
      field: "permissions",
      headerName: "Quyền",
      width: 300,
      renderCell: (params) =>
        params.value && params.value.length > 0
          ? params.value.map((perm) => (
              <Chip key={perm} label={vietnameseMapping[perm] || perm} sx={{ m: 0.5 }} />
            ))
          : "Không có",
    },
    {
      field: "actions",
      headerName: "Hành động",
      width: 150,
      renderCell: (params) => (
        <Button variant="contained" color="primary" onClick={() => handleEdit(params.row)}>
          Chỉnh sửa
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Quản lý quyền người dùng
        </Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
        >
          Thêm tài khoản
        </Button>
      </Box>

      <Box sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={users}
          columns={columns}
          getRowId={(row) => row._id}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          disableSelectionOnClick
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
        />
      </Box>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {selectedUser ? "Chỉnh sửa tài khoản" : "Thêm tài khoản mới"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              label="Họ và tên"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
              variant="outlined"
              required
            />
            <TextField
              label={selectedUser ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              variant="outlined"
              required={!selectedUser}
            />

            <FormControl component="fieldset">
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Vai trò
              </Typography>
              <RadioGroup
                row
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (e.target.value !== "staff") {
                    setFunctions([]);
                    setPermissions([]);
                  }
                }}
              >
                {availableRoles.map((r) => (
                  <FormControlLabel
                    key={r}
                    value={r}
                    control={<Radio />}
                    label={r.charAt(0).toUpperCase() + r.slice(1)}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>

          {role === "staff" && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 3, fontWeight: 'bold' }}>
                Chức năng
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {availableFunctions.map((func) => (
                  <FormControlLabel
                    key={func}
                    control={
                      <Checkbox
                        checked={functions.includes(func)}
                        onChange={(e) => {
                          const newFunctions = e.target.checked
                            ? [...functions, func]
                            : functions.filter((f) => f !== func);
                          setFunctions(newFunctions);
                          if (!e.target.checked) {
                            const relatedPermissions = availablePermissions[func] || [];
                            setPermissions(permissions.filter((p) => !relatedPermissions.includes(p)));
                          }
                        }}
                      />
                    }
                    label={vietnameseMapping[func] || func}
                  />
                ))}
              </Box>

              <Typography variant="subtitle1" sx={{ mt: 3, fontWeight: 'bold', mb: 1 }}>
                Quyền
              </Typography>
              {functions.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table sx={{ minWidth: 400 }} size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Chức năng</TableCell>
                        <TableCell align="center">Đọc</TableCell>
                        <TableCell align="center">Cập nhật</TableCell>
                        <TableCell align="center">Xóa</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {functions.map((func) => (
                        <TableRow key={func}>
                          <TableCell>{vietnameseMapping[func] || func}</TableCell>
                          {["read", "update", "delete"].map((action) => {
                            const perm = `${action}_${func.split("_")[0]}`;
                            return (
                              <TableCell key={perm} align="center">
                                <Checkbox
                                  checked={permissions.includes(perm)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setPermissions([...permissions, perm]);
                                    } else {
                                      setPermissions(permissions.filter((p) => p !== perm));
                                    }
                                  }}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Hủy</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={role === "staff" && functions.length === 0}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Account;
