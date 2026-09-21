import { defineConfig } from 'vitest/config'

// 2026-09-09 显式锁定测试配置：此前包内没有 vitest 配置，vitest 会向上查找，
// 被机器上其他位置的 vite.config.js 劫持（如桌面根目录无关项目文件）导致启动失败。
// 显式声明 root + include，测试环境与外部文件彻底隔离。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
