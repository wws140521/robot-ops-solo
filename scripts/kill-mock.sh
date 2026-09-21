#!/usr/bin/env bash
# 一键清理 mock 相关服务
# 覆盖：mock-ws-server (:8080/:8081/:8082) + mock-control (:3000)
# 用法：pnpm kill:mock
# 背景：dev:control 用 & 后台起 mock-ws-server，Ctrl+C 只能停前台进程，
#       mock 遥测源会残留并占用端口，导致下次启动报 EADDRINUSE。
set -u

PORTS=(8080 8081 8082 3000)
# 带 node 前缀精确匹配，避免误杀打开同名文件的编辑器等无关进程
PATTERNS=("node mock-ws-server.js" "node mock-control/server/index.js")

killed=0

# 1. 按进程命令行匹配（覆盖已启动但尚未监听端口的进程）
for p in "${PATTERNS[@]}"; do
  for pid in $(pgrep -f "$p" 2>/dev/null); do
    if kill "$pid" 2>/dev/null; then
      echo "✔ 已停止 PID $pid ($p)"
      killed=$((killed + 1))
    fi
  done
done

# 2. 按端口兜底（覆盖 pgrep 匹配不到的残留，如 pnpm 多层包装的子进程）
for port in "${PORTS[@]}"; do
  for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
    if kill "$pid" 2>/dev/null; then
      echo "✔ 已释放 :$port (PID $pid)"
      killed=$((killed + 1))
    fi
  done
done

# 3. 等待退出，仍占用的顽固进程 SIGKILL 强制清理
sleep 1
for port in "${PORTS[@]}"; do
  for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
    if kill -9 "$pid" 2>/dev/null; then
      echo "⚠ 强制终止 :$port (PID $pid)"
    fi
  done
done

# 4. 终态检查
left=0
for port in "${PORTS[@]}"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✗ :$port 仍被占用，请手动检查: lsof -i :$port"
    left=$((left + 1))
  fi
done

if [ "$left" -eq 0 ]; then
  if [ "$killed" -eq 0 ]; then
    echo "✅ 无残留 mock 服务（8080-8082 / 3000 均空闲）"
  else
    echo "✅ 清理完成，共停止 $killed 个进程"
  fi
fi
