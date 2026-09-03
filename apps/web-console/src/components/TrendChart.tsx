// 实时趋势图，用 Chart.js 画折线
// 每来一帧 WS 数据就滚一个点，最多保留 30 个点，支持温度/负载/电流/健康分

import { useEffect, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import type { UnifiedRobotState } from 'robot-adapter-kit'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface Props {
  robot: UnifiedRobotState
  metric: 'temp_c' | 'load_pct' | 'current_a' | 'health_score'
  jointIndex?: number
  maxPoints?: number
  height?: number
}

const METRIC_CONFIG: Record<string, { label: string; color: string; unit: string }> = {
  temp_c:      { label: '温度',   color: '#ef4444', unit: '°C' },
  load_pct:    { label: '负载率', color: '#f59e0b', unit: '%' },
  current_a:   { label: '电流',   color: '#3b82f6', unit: 'A' },
  health_score:{ label: '健康分', color: '#22c55e', unit: '' },
}

export function TrendChart({
  robot,
  metric,
  jointIndex = 0,
  maxPoints = 30,
  height = 120,
}: Props) {
  const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.temp_c
  // 用 ref 缓存历史数据避免每次 render 丢失；tick 仅用于触发重绘
  const historyRef = useRef<number[]>([])
  const labelsRef = useRef<string[]>([])
  const [tick, setTick] = useState(0)

  // health_score 取所有关节均值；单关节指标取指定关节，无数据时返回 0 避免折线异常
  const getValue = (): number => {
    if (metric === 'health_score') {
      const joints = robot.industrial?.joints
      if (!joints || joints.length === 0) return 85
      const scores = joints.map((j) => j.health_score ?? 85)
      return scores.reduce((a, b) => a + b, 0) / scores.length
    }
    const joint = robot.industrial?.joints?.[jointIndex]
    if (!joint) return 0
    return (joint as any)[metric] ?? 0
  }

  // robot.lastSeen 每次 WS 更新都会变化，以此作为采样节拍；数据点超过上限时丢弃最旧点
  useEffect(() => {
    const val = getValue()
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    historyRef.current.push(val)
    labelsRef.current.push(time)
    if (historyRef.current.length > maxPoints) {
      historyRef.current.shift()
      labelsRef.current.shift()
    }
    setTick((t) => t + 1)
  }, [robot.lastSeen, metric, jointIndex])

  const data = {
    labels: [...labelsRef.current],
    datasets: [
      {
        label: cfg.label,
        data: [...historyRef.current],
        borderColor: cfg.color,
        backgroundColor: cfg.color + '22',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.y}${cfg.unit}`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        ticks: { maxTicksLimit: 4, font: { size: 9 }, color: '#9ca3af' },
        grid: { display: false },
      },
      y: {
        display: true,
        beginAtZero: metric !== 'health_score',
        ticks: { font: { size: 9 }, color: '#9ca3af', maxTicksLimit: 4 },
        grid: { color: '#f3f4f622' },
      },
    },
  }

  const latest = historyRef.current.length > 0
    ? historyRef.current[historyRef.current.length - 1]
    : null

  // tick 仅用于触发重渲染，不参与业务计算
  void tick

  return (
    <div
      style={{
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: 10,
        height,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          {cfg.label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color, fontFamily: 'var(--font-mono)' }}>
          {latest !== null ? `${Math.round(latest * 10) / 10}${cfg.unit}` : '--'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
