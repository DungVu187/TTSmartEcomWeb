// src/components/ScrollRestoration.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollRestoration({ children }) {
  const location = useLocation();

  // Khôi phục vị trí cuộn khi trang tải
  useEffect(() => {
    const storedPosition = sessionStorage.getItem(`scrollPosition-${location.pathname}`);
    if (storedPosition) {
      window.scrollTo(0, parseInt(storedPosition, 10));
    }
  }, [location.pathname]);

  // Lưu vị trí cuộn trước khi rời trang
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(`scrollPosition-${location.pathname}`, window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll); // Dọn dẹp sự kiện
    };
  }, [location.pathname]);

  return <>{children}</>;
}

export default ScrollRestoration;