import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/languagecontext.jsx";
import {
  Container,
  Typography,
  Box,
  Button,
  TextField,
  Paper,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from "@mui/material";
import {
  Edit,
  Add,
  Delete,
  Home,
  CheckCircle,
  RadioButtonUnchecked,
} from "@mui/icons-material";
import toast from "react-hot-toast";

const apiUrl = process.env.REACT_APP_BACK_END;

const Profile = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Address dialog states
  const [openAddressDialog, setOpenAddressDialog] = useState(false);
  const [addressId, setAddressId] = useState(null); // Null for adding, otherwise for editing
  const [label, setLabel] = useState("Công trình");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${apiUrl}/users/profile`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error(t("session_expired"));
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        throw new Error(t("failed_to_load_profile", "Không thể tải thông tin hồ sơ"));
      }

      const data = await response.json();
      setUser(data);
      setName(data.name || "");
      setEmail(data.email || "");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("update_failed", "Cập nhật thất bại"));
      }

      toast.success(t("update_success", "Cập nhật thông tin thành công!"));
      setUser({ ...user, name, email });
      setIsEditingInfo(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleOpenAddAddress = () => {
    setAddressId(null);
    setLabel("Công trình");
    setReceiverName(user?.name || "");
    setReceiverPhone(user?.phone || "");
    setAddressDetail("");
    setOpenAddressDialog(true);
  };

  const handleOpenEditAddress = (addr) => {
    setAddressId(addr._id);
    setLabel(addr.label || "Công trình");
    setReceiverName(addr.receiverName || "");
    setReceiverPhone(addr.receiverPhone || "");
    setAddressDetail(addr.addressDetail || "");
    setOpenAddressDialog(true);
  };

  const handleSaveAddress = async () => {
    if (!receiverName || !receiverPhone || !addressDetail) {
      toast.error(t("fill_all_address_fields", "Vui lòng điền đầy đủ các thông tin địa chỉ!"));
      return;
    }

    try {
      const method = addressId ? "PUT" : "POST";
      const url = addressId
        ? `${apiUrl}/users/profile/addresses/${addressId}`
        : `${apiUrl}/users/profile/addresses`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label, receiverName, receiverPhone, addressDetail }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("failed_to_save_address", "Không thể lưu địa chỉ"));
      }

      toast.success(addressId ? t("update_address_success", "Cập nhật địa chỉ thành công!") : t("add_address_success", "Thêm địa chỉ thành công!"));
      setUser({ ...user, addresses: data.addresses });
      setOpenAddressDialog(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm(t("confirm_delete_address", "Bạn có chắc chắn muốn xóa địa chỉ này?"))) return;
    try {
      const response = await fetch(`${apiUrl}/users/profile/addresses/${addrId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("failed_to_delete_address", "Không thể xóa địa chỉ"));
      }

      toast.success(t("delete_address_success", "Xóa địa chỉ thành công!"));
      setUser({ ...user, addresses: data.addresses });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSetDefaultAddress = async (addrId) => {
    try {
      const response = await fetch(`${apiUrl}/users/profile/addresses/${addrId}/default`, {
        method: "PUT",
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("failed_to_set_default_address", "Không thể thiết lập địa chỉ mặc định"));
      }

      toast.success(t("set_default_address_success", "Đã đặt làm địa chỉ mặc định!"));
      setUser({ ...user, addresses: data.addresses });
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div style={{ width: '100%', background: 'var(--bg-gradient)', padding: '3rem 16px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a", mb: 4, fontFamily: "inherit" }}>
          {t("account_info", "Thông tin tài khoản")}
        </Typography>

        <Grid container spacing={4}>
          {/* Left Column - Personal Info */}
          <Grid item xs={12} md={5}>
            <Paper
              className="glass-panel"
              sx={{
                p: 3,
                borderRadius: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                border: "1px solid rgba(15, 23, 42, 0.05)",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.02)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  {t("personal_info")}
                </Typography>
                {!isEditingInfo && (
                  <IconButton onClick={() => setIsEditingInfo(true)} color="primary">
                    <Edit />
                  </IconButton>
                )}
              </Box>

              {isEditingInfo ? (
                <form onSubmit={handleUpdateInfo}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField
                      label={t("full_name")}
                      fullWidth
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      variant="outlined"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                    />
                    <TextField
                      label={t("phone_number")}
                      fullWidth
                      disabled
                      value={user?.phone || ""}
                      helperText={t("phone_number_used_for_login", "Số điện thoại dùng làm thông tin tài khoản đăng nhập")}
                      variant="outlined"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                    />
                    <TextField
                      label={t("email_address")}
                      fullWidth
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      variant="outlined"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                    />
                    <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 1 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setName(user?.name || "");
                          setEmail(user?.email || "");
                          setIsEditingInfo(false);
                        }}
                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        sx={{
                          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: "8px",
                        }}
                      >
                        {t("save_changes")}
                      </Button>
                    </Box>
                  </Box>
                </form>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      {t("full_name").toUpperCase()}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: "#0f172a" }}>
                      {user?.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t("not_updated_yet", "Chưa cập nhật")}</span>}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      {t("phone_number").toUpperCase()}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: "#0f172a" }}>
                      {user?.phone}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      {t("email_address").toUpperCase()}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: "#0f172a" }}>
                      {user?.email || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t("not_updated_yet", "Chưa cập nhật")}</span>}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right Column - Address Book */}
          <Grid item xs={12} md={7}>
            <Paper
              className="glass-panel"
              sx={{
                p: 3,
                borderRadius: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                border: "1px solid rgba(15, 23, 42, 0.05)",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.02)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  {t("address_book", "Sổ địa chỉ công trình / nhận hàng")}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={handleOpenAddAddress}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: "8px",
                    borderColor: "rgba(37, 99, 235, 0.3)",
                    color: "#2563eb",
                    "&:hover": { borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.04)" }
                  }}
                >
                  {t("add_address", "Thêm địa chỉ")}
                </Button>
              </Box>

              {(!user?.addresses || user.addresses.length === 0) ? (
                <Typography variant="body1" sx={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center", py: 4 }}>
                  {t("no_addresses_saved", "Chưa có địa chỉ công trình nào được lưu. Địa chỉ nhập khi đặt hàng đầu tiên sẽ được tự động lưu vào đây.")}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {user.addresses.map((addr) => (
                    <Box
                      key={addr._id}
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        border: addr.isDefault ? "1.5px solid #2563eb" : "1px solid rgba(15, 23, 42, 0.08)",
                        backgroundColor: addr.isDefault ? "rgba(37, 99, 235, 0.02)" : "rgba(255, 255, 255, 0.5)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        position: "relative"
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                        <IconButton
                          onClick={() => handleSetDefaultAddress(addr._id)}
                          color={addr.isDefault ? "primary" : "default"}
                          sx={{ p: 0, mt: 0.5 }}
                        >
                          {addr.isDefault ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
                              {t(addr.label || "Công trình")}
                            </Typography>
                            {addr.isDefault && (
                              <Chip
                                label={t("default")}
                                size="small"
                                color="primary"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: "#475569", fontWeight: 600 }}>
                            {t("receiver", "Người nhận")}: {addr.receiverName} — {addr.receiverPhone}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#64748b" }}>
                            {addr.addressDetail}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton size="small" color="primary" onClick={() => handleOpenEditAddress(addr)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAddress(addr._id)}
                          disabled={addr.isDefault && user.addresses.length > 1}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Address dialog */}
        <Dialog open={openAddressDialog} onClose={() => setOpenAddressDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>
            {addressId ? t("edit_construction_address", "Chỉnh sửa địa chỉ công trình") : t("add_construction_address", "Thêm địa chỉ công trình mới")}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1.5 }}>
              <TextField
                label={t("address_label_placeholder", "Tên gợi nhớ (Ví dụ: Công trình A, Văn phòng, Dự án B)")}
                fullWidth
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
              <TextField
                label={t("receiver_name", "Tên người nhận thiết bị")}
                fullWidth
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
              <TextField
                label={t("receiver_phone", "Số điện thoại người nhận")}
                fullWidth
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
              <TextField
                label={t("address_detail_label", "Địa chỉ chi tiết công trình nhận hàng")}
                fullWidth
                multiline
                rows={3}
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpenAddressDialog(false)} sx={{ fontWeight: 700 }}>
              {t("cancel")}
            </Button>
            <Button variant="contained" onClick={handleSaveAddress} sx={{ fontWeight: 700, borderRadius: "8px" }}>
              {t("save_address", "Lưu địa chỉ")}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default Profile;
