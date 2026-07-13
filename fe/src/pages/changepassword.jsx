import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/languagecontext.jsx';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const apiUrl = process.env.REACT_APP_BACK_END;

const ChangePassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          toast.error(t('failed_to_get_user_info', 'Không lấy được thông tin người dùng'));
        }
      } catch (error) {
        console.error('Lỗi khi lấy profile:', error);
        toast.error(t('failed_to_get_user_info', 'Không thể lấy thông tin người dùng'));
      }
    };
    fetchProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('fill_all_fields', 'Vui lòng nhập đầy đủ thông tin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwords_do_not_match', 'Mật khẩu mới không trùng khớp!'));
      return;
    }
    if (!phone) {
      toast.error(t('phone_not_found', 'Không xác định được số điện thoại'));
      return;
    }

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
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('change_password_success', 'Đổi mật khẩu thành công'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        try {
          await fetch(`${apiUrl}/users/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {
          // Bỏ qua lỗi logout, session cũ đã bị vô hiệu và vẫn cần đưa người dùng về đăng nhập.
        }
        setTimeout(() => navigate('/login'), 1200);
      } else {
        toast.error(data.message || t('change_password_failed', 'Đổi mật khẩu thất bại'));
      }
    } catch (error) {
      console.error('Lỗi khi đổi mật khẩu:', error);
      toast.error(t('server_error', 'Lỗi máy chủ, thử lại sau'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', backgroundColor: '#ebf6fe', py: 8 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, boxShadow: 'none' }}>
          <Typography variant="h5" gutterBottom>
            {t('change_password')}
          </Typography>

          <TextField
            label={t('current_password')}
            type={showCurrentPassword ? 'text' : 'password'}
            fullWidth
            size="small"
            margin="normal"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    edge="end"
                  >
                    {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label={t('new_password')}
            type={showNewPassword ? 'text' : 'password'}
            fullWidth
            size="small"
            margin="normal"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    edge="end"
                  >
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label={t('confirm_new_password')}
            type={showConfirmPassword ? 'text' : 'password'}
            fullWidth
            size="small"
            margin="normal"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword !== '' && newPassword !== confirmPassword}
            helperText={confirmPassword !== '' && newPassword !== confirmPassword ? t('passwords_do_not_match') : ''}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleChangePassword}
            disabled={loading || (confirmPassword !== '' && newPassword !== confirmPassword)}
          >
            {loading ? t('processing') : t('change_password')}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default ChangePassword;
