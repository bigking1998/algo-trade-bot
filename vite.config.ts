import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/postcss'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Force Tailwind v4 plugin to handle `@import "tailwindcss"` before any other import plugins
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/backend': path.resolve(__dirname, './src/backend'),
      '@/frontend': path.resolve(__dirname, './src/frontend'),
      'components': path.resolve(__dirname, './src/frontend/components'),
      'lib': path.resolve(__dirname, './src/frontend/lib'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

})
