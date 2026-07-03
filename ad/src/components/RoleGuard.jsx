import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Box, CircularProgress } from '@mui/joy';

const RoleGuard = ({ children, requiredFunction, adminOnly = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkPermission = async () => {
      try {
        const backendUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${backendUrl}/users/profile`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          navigate('/login');
          return;
        }

        const user = await response.json();
        const role = user?.role || '';
        const functions = Array.isArray(user?.functions) ? user.functions : [];
        const isAdmin = role === 'admin' || role === 'superadmin';
        const allowed = isAdmin || (!adminOnly && (!requiredFunction || functions.includes(requiredFunction)));

        if (!allowed) {
          toast.error('Bạn không có quyền truy cập trang này!');
          navigate('/product');
          return;
        }

        if (isMounted) {
          setCanAccess(true);
        }
      } catch (error) {
        navigate('/login');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, [adminOnly, navigate, requiredFunction]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return canAccess ? children : null;
};

export default RoleGuard;
