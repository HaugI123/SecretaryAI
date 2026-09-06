import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync('./192.168.1.227-key.pem'),
      cert: fs.readFileSync('./192.168.1.227.pem'),
        },
    host: true,
  },
})
