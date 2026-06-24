
import React, { useState, useEffect, useRef } from "react";
import {
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Box,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import AES from "crypto-js/aes";

const apiUrl = import.meta.env.VITE_API_URL;
const AES_KEY = import.meta.env.VITE_AES_KEY;

const StationUser = () => {
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [stationMap, setStationMap] = useState({});
  const [openRows, setOpenRows] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const [openStationDialog, setOpenStationDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserPhone, setSelectedUserPhone] = useState(null);
  const [stationSearch, setStationSearch] = useState({ name: "", code: "" });
  const [stationResults, setStationResults] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const debounceTimeout = useRef(null);
  const navigate = useNavigate();
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [encryptedString, setEncryptedString] = useState("");
  const encryptedInputRef = useRef(null);

  // Sửa thông tin khách hàng
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: "", phone: "", email: "" });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStations();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/users/customers`, {
        credentials: "include",
      });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Lỗi khi tải users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch(`${apiUrl}/stations`);
      const data = await res.json();
      setStations(data);
      const map = {};
      data.forEach((s) => (map[s._id] = s));
      setStationMap(map);
    } catch (err) {
      console.error("Lỗi khi tải trạm:", err);
    }
  };

  const toggleRow = (id) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInputChange = (e) => {
    const field = e.target.name?.replace("register-", "");
    if (!field) return;
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      alert("Mật khẩu không khớp");
      return;
    }

    if (!formData.phone || !formData.password) {
      alert("Thiếu SĐT hoặc mật khẩu");
      return;
    }

    const raw = `${formData.phone}+++${formData.password}`;
    const encrypted = AES.encrypt(raw, AES_KEY).toString();
    const logInString = encodeURIComponent(encrypted);

    try {
      const res = await fetch(`${apiUrl}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          password: formData.password,
          logInString,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Đăng ký thất bại");
      handleCloseDialog();
      toast.success("Thêm người dùng thành công");
      fetchUsers();
    } catch (error) {
      alert(error.message || "Đăng ký thất bại");
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({ name: "", phone: "", password: "", confirmPassword: "" });
  };

  const handleAddStation = async (stationId) => {
    try {
      const res = await fetch(`${apiUrl}/users/${selectedUserId}/stations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Thêm trạm thất bại");
      toast.success("Đã thêm trạm");
      setOpenStationDialog(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || "Lỗi khi thêm trạm");
    }
  };

  const handleRemoveStation = async (userPhone, stationIdToRemove) => {
    try {
      const user = users.find((u) => u.phone === userPhone);
      if (!user) return;

      const updatedStationList = (user.station || []).filter(
        (id) => id !== stationIdToRemove
      );

      const res = await fetch(`${apiUrl}/users/stations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: userPhone,
          stations: updatedStationList,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa trạm");

      toast.success("Đã xoá trạm khỏi người dùng");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Lỗi khi xóa trạm");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Bạn có chắc muốn xóa người dùng ${user.name}?`))
      return;
    try {
      const res = await fetch(`${apiUrl}/users/${user._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa");
      toast.success("Đã xóa người dùng");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Lỗi khi xóa người dùng");
    }
  };

  const filteredStations = stations.filter((station) => {
    const searchName = (stationSearch.name || "").trim().toLowerCase();
    const searchCode = (stationSearch.code || "").trim().toLowerCase();

    const nameMatch = !searchName || (station.stationName || "").toLowerCase().includes(searchName);
    const codeMatch = !searchCode || (station.stationCode || "").toLowerCase().includes(searchCode);

    return nameMatch && codeMatch;
  });

  const handleOpenPasswordDialog = (user) => {
    setPasswordInput("");
    setEncryptedString(user.logInString || "");
    setSelectedUserPhone(user.phone);
    setOpenPasswordDialog(true);
  };
  const copyToClipboard = async (text) => {
    // Thử navigator.clipboard trước (cần HTTPS)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (e) {
      // Fallback bên dưới
    }
    // Fallback cho HTTP: dùng textarea + execCommand
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Đặt style để không nhìn thấy nhưng vẫn selectable
    textArea.style.position = "fixed";
    textArea.style.left = "0";
    textArea.style.top = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      document.body.removeChild(textArea);
      throw new Error("Không thể sao chép");
    }
    document.body.removeChild(textArea);
  };

  const handleCopy = () => {
    try {
      const input = encryptedInputRef.current;
      if (input) {
        input.select();
        document.execCommand("copy");
        toast.success("Đã sao chép vào bộ nhớ tạm");
      } else {
        toast.error("Không tìm thấy nội dung để sao chép");
      }
    } catch (err) {
      toast.error("Không thể sao chép!");
    }
  };

  // Mở dialog sửa thông tin
  const handleOpenEditDialog = (user) => {
    setEditUser(user);
    setEditFormData({
      name: user.name || "",
      phone: user.phone || "",
      email: user.email || "",
    });
    setOpenEditDialog(true);
  };

  // Lưu thông tin đã sửa
  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${apiUrl}/users/${editUser._id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editFormData.name,
          phone: editFormData.phone,
          email: editFormData.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cập nhật thất bại");
      toast.success("Cập nhật thông tin thành công");
      setOpenEditDialog(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Lỗi khi cập nhật");
    } finally {
      setEditLoading(false);
    }
  };

  // Reset mật khẩu về 123456
  const handleResetPassword = async () => {
    if (!editUser) return;
    if (!window.confirm(`Bạn có chắc muốn reset mật khẩu của ${editUser.name || editUser.phone} về 123456?`)) return;
    setEditLoading(true);
    try {
      const raw = `${editUser.phone}+++123456`;
      const encrypted = AES.encrypt(raw, AES_KEY).toString();
      const logInString = encodeURIComponent(encrypted);

      const res = await fetch(`${apiUrl}/users/${editUser._id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          password: "123456",
          logInString,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset thất bại");
      toast.success("Đã reset mật khẩu về 123456");
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Lỗi khi reset mật khẩu");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Quản lý người dùng và trạm
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={() => setOpenDialog(true)}
        sx={{ mb: 2 }}
      >
        Thêm người dùng mới
      </Button>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Tên</TableCell>
              <TableCell>SĐT</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Số trạm</TableCell>
              <TableCell>Tác vụ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <React.Fragment key={user._id}>
                <TableRow>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => toggleRow(user._id)}
                    >
                      {openRows[user._id] ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>{user.station?.length || 0}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        color="info"
                        onClick={() => handleOpenEditDialog(user)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          setSelectedUserId(user._id);
                          setSelectedUserPhone(user.phone);
                          setOpenStationDialog(true);
                        }}
                      >
                        Thêm
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        onClick={() => handleDeleteUser(user)}
                      >
                        Xóa
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={() => handleOpenPasswordDialog(user)}
                      >
                        Xuất thông tin
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0 }}>
                    <Collapse
                      in={openRows[user._id]}
                      timeout="auto"
                      unmountOnExit
                    >
                      <Box sx={{ margin: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Danh sách trạm
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Tên trạm</TableCell>
                              <TableCell>Mã trạm</TableCell>
                              <TableCell>Số sản phẩm</TableCell>
                              <TableCell>Vị trí</TableCell>
                              <TableCell>Thao tác</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(user.station || []).map((stationId) => {
                              const s = stationMap[stationId];
                              if (!s) return null;
                              return (
                                <TableRow key={stationId}>
                                  <TableCell>{s.stationName}</TableCell>
                                  <TableCell>{s.stationCode}</TableCell>
                                  <TableCell>
                                    {s.productId?.length || 0}
                                  </TableCell>
                                  <TableCell>{s.location || "-"}</TableCell>
                                  <TableCell>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="primary"
                                        onClick={() =>
                                          navigate(`/station/${s.stationCode}`)
                                        }
                                      >
                                        Chi tiết
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="error"
                                        onClick={() =>
                                          handleRemoveStation(
                                            user.phone,
                                            stationId
                                          )
                                        }
                                      >
                                        Xóa
                                      </Button>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog tạo user */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Đăng ký người dùng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ minWidth: 300 }}>
            <TextField
              label="Tên"
              name="register-name"
              value={formData.name}
              onChange={handleInputChange}
              size="small"
            />
            <TextField
              label="SĐT"
              name="register-phone"
              value={formData.phone}
              onChange={handleInputChange}
              size="small"
            />
            <TextField
              label="Mật khẩu"
              name="register-password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              size="small"
            />
            <TextField
              label="Xác nhận mật khẩu"
              name="register-confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button onClick={handleRegister} variant="contained">
            Đăng ký
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog thêm trạm */}
      <Dialog
        open={openStationDialog}
        onClose={() => setOpenStationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Thêm trạm</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Tên trạm"
            value={stationSearch.name}
            onChange={(e) =>
              setStationSearch({ ...stationSearch, name: e.target.value })
            }
            size="small"
          />
          <TextField
            label="Mã trạm"
            value={stationSearch.code}
            onChange={(e) =>
              setStationSearch({ ...stationSearch, code: e.target.value })
            }
            size="small"
          />
          <List sx={{ maxHeight: 400, overflowY: "auto" }}>
            {filteredStations.map((station) => (
              <ListItem
                key={station._id}
                button
                onClick={() => handleAddStation(station._id)}
              >
                <ListItemAvatar>
                  <Avatar variant="square" />
                </ListItemAvatar>
                <ListItemText
                  primary={station.stationName}
                  secondary={`Mã: ${station.stationCode}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStationDialog(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPasswordDialog}
        onClose={() => setOpenPasswordDialog(false)}
      >
        <DialogTitle>Chuỗi mã hóa</DialogTitle>
        <DialogContent sx={{ minWidth: 300 }}>
          <TextField
            label="Chuỗi đăng nhập"
            value={encryptedString}
            inputRef={encryptedInputRef}
            fullWidth
            size="small"
            multiline
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setOpenPasswordDialog(false);
              setPasswordInput("");
              setEncryptedString("");
            }}
          >
            Đóng
          </Button>
          <Button variant="contained" color="primary" onClick={handleCopy}>
            Sao chép
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog sửa thông tin khách hàng */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Sửa thông tin khách hàng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ minWidth: 300, mt: 1 }}>
            <TextField
              label="Tên"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="SĐT"
              value={editFormData.phone}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="Email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              size="small"
              fullWidth
            />
            <Button
              variant="outlined"
              color="warning"
              onClick={handleResetPassword}
              disabled={editLoading}
              sx={{ textTransform: "none" }}
            >
              Reset mật khẩu về 123456
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Hủy</Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={editLoading}
          >
            {editLoading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StationUser;
