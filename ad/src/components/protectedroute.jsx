
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Box, CircularProgress } from '@mui/joy';

const ProtectedRoute = ({ children, redirectTo = '/login' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        const backendUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${backendUrl}/users/profile`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setIsAuthenticated(true);

          // Kiểm tra vai trò nếu truy cập /account
          if (location.pathname === '/account') {
            if (userData.role !== 'admin') {
              toast.error('Bạn không có quyền truy cập trang này!');
              navigate('/product', { state: { from: location } });
              return;
            }
          }
        } else {
          setIsAuthenticated(false);
          if (location.pathname !== redirectTo) {
            toast.error('Vui lòng đăng nhập để tiếp tục!');
            navigate(redirectTo, { state: { from: location } });
          }
        }
      } catch (error) {
        console.error('Lỗi khi kiểm tra xác thực:', error);
        setIsAuthenticated(false);
        if (location.pathname !== redirectTo) {
          toast.error('Không thể xác thực. Vui lòng thử lại!');
          navigate(redirectTo, { state: { from: location } });
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndRole();
  }, [navigate, location, redirectTo]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? children : null;
};

export default ProtectedRoute;