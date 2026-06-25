// src/components/ScrollRestoration.jsx
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollRestoration({ children }) {
  const { pathname } = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Không chạy hiệu ứng fade khi lần đầu tải trang
    if (isFirstRender.current) {
      isFirstRender.current = false;
      window.scrollTo(0, 0);
      return;
    }

    // Bước 1: Ẩn nội dung cũ (fade-out nhanh)
    setIsVisible(false);

    // Bước 2: Sau khi fade-out xong, cuộn lên đầu và hiện nội dung mới (fade-in)
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      setIsVisible(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className="page-transition"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      {children}
    </div>
  );
}

export default ScrollRestoration;