// 订阅推送浮动提示（路演演示用，右上角堆栈）
// 数据源：feedToastStore（wsHub 在状态翻转/新告警时入队）
// 视觉：玻璃拟态卡片 + 状态语义色左边条 + 轻量滑入动画（不做拟人化动效）
import { useFeedToastStore, type FeedToast } from '../../stores/feedToastStore'
import './FeedToasts.css'

// 状态机中文标签（与设备页状态芯片一致）
const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  moving: '移动中',
  working: '作业中',
  charging: '充电中',
  error: '故障',
  offline: '离线',
}

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s
}

// 单条卡片：kind=alert 时红色系，status 按 error/warn/info 分色
function ToastCard({ toast }: { toast: FeedToast }) {
  return (
    <div className={`feed-toast feed-toast--${toast.level}`} role="status">
      <span className="feed-toast__icon">{toast.kind === 'alert' ? '⚠️' : '📥'}</span>
      <div className="feed-toast__body">
        <div className="feed-toast__title">
          <span className="feed-toast__tag">订阅推送</span>
          <span className="feed-toast__robot">{toast.title}</span>
        </div>
        <div className="feed-toast__detail">{toast.detail}</div>
        <div className="feed-toast__meta">
          {new Date(toast.ts).toLocaleTimeString('zh-CN', { hour12: false })} · WS 实时订阅
        </div>
      </div>
      <button className="feed-toast__close" onClick={() => useFeedToastStore.getState().dismiss(toast.id)} aria-label="关闭">×</button>
    </div>
  )
}

export function FeedToasts() {
  const toasts = useFeedToastStore((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="feed-toasts">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  )
}
