import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper
} from '@mui/material';
import toast from 'react-hot-toast';
import AES from 'crypto-js/aes';

const apiUrl = process.env.REACT_APP_BACK_END;
const AES_KEY = process.env.REACT_APP_AES_KEY;

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiUrl}/users/profile`, {
          method: 'GET',
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data.phone) {
          setPhone(data.phone);
        } else {
          toast.error('Không lấy được thông tin người dùng');
        }
      } catch (error) {
        console.error('Lỗi khi lấy profile:', error);
        toast.error('Không thể lấy thông tin người dùng');
      }
    };
    fetchProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!phone) {
      toast.error('Không xác định được số điện thoại');
      return;
    }

    const raw = `${phone}+++${newPassword}`;
    const encrypted = AES.encrypt(raw, AES_KEY).toString();
    const logInString = encodeURIComponent(encrypted);

    console.log(logInString);
    

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/users/change-password`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          logInString,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Đổi mật khẩu thành công');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        toast.error(data.message || 'Đổi mật khẩu thất bại');
      }
    } catch (error) {
      console.error('Lỗi khi đổi mật khẩu:', error);
      toast.error('Lỗi máy chủ, thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', backgroundColor: '#ebf6fe', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, boxShadow: 'none' }}>
          <Typography variant="h5" gutterBottom>
            Đổi mật khẩu
          </Typography>

          <TextField
            label="Mật khẩu hiện tại"
            type="password"
            fullWidth
            size="small"
            margin="normal"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <TextField
            label="Mật khẩu mới"
            type="password"
            fullWidth
            size="small"
            margin="normal"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Button
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleChangePassword}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default ChangePassword;
