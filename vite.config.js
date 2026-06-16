import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Local dev/build stays at '/'; the Pages build passes VITE_BASE=/localfit/.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:8788' },
  },
})
