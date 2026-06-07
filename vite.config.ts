// 저장 위치: /vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // SPA 히스토리 폴백 — 모든 경로를 index.html로 서빙
  appType: 'spa',
  server: {
    historyApiFallback: true,
  },
  preview: {
    port: 4173,
  },
})
