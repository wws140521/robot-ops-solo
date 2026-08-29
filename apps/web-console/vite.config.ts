import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'robot-adapter-kit': path.resolve(__dirname, '../../packages/adapter-kit/src/index.ts'),
      'sop-editor': path.resolve(__dirname, '../../packages/sop-editor/src/index.ts'),
      'digital-twin': path.resolve(__dirname, '../../packages/digital-twin/src/index.ts'),
      'ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // cloudflared/ngrok 隧道会换域名，开发阶段放开 Host 校验
    allowedHosts: true,
  },
})
