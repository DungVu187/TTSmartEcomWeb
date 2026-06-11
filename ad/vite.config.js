import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [react()],
  base: '/admin/', // Đảm bảo tài nguyên tĩnh dùng /admin
});
