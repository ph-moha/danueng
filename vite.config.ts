import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/danueng/',
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 으로 바인딩 → 같은 WiFi의 모바일 접근 가능
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
