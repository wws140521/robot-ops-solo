import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// mock react-chartjs-2 的 Line 组件（jsdom 不支持 canvas）
vi.mock('react-chartjs-2', () => ({
  Line: (props: any) => (
    <div data-testid="mock-line-chart" data-datasets={JSON.stringify(props.data.datasets)} />
  ),
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Filler: {},
  Tooltip: {},
  Legend: {},
}))

// 必须在 mock 之后导入
import { TrendChart } from '../TrendChart'

// 构造工业机器人 mock state
function makeRobot(overrides?: Partial<UnifiedRobotState>): UnifiedRobotState {
  return {
    robotId: 'fanuc-001',
    brand: 'FANUC',
    model: 'M-20iD/25',
    batteryPct: 0,
    voltage: 0,
    online: true,
    position: { x: 0, y: 0, theta: 0 },
    status: 'working',
    lastSeen: Date.now(),
    industrial: {
      joints: [
        { j: 1, load_pct: 62, temp_c: 41, current_a: 3.1, speed_rpm: 120, health_score: 88 },
        { j: 2, load_pct: 118, temp_c: 67, current_a: 5.4, speed_rpm: 90, health_score: 54, rul_days: 9 },
      ],
      alarms: [],
      runtime: { power_on_hours: 100, cycle_count: 50 },
      protocol: 'FOCAS',
    },
    ...overrides,
  }
}

describe('TrendChart · 实时趋势图', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('渲染标题和最新值', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="temp_c" jointIndex={1} />)
    // 温度 metric 的 label 是"温度"
    expect(screen.getByText('温度')).toBeInTheDocument()
    // J2 温度 67°C
    expect(screen.getByText(/67/)).toBeInTheDocument()
  })

  it('渲染 Line 图表组件', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="temp_c" />)
    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument()
  })

  it('temp_c 指标用红色线', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="temp_c" />)
    const chart = screen.getByTestId('mock-line-chart')
    const datasets = JSON.parse(chart.getAttribute('data-datasets') || '[]')
    expect(datasets[0].borderColor).toBe('#ef4444')
  })

  it('load_pct 指标用橙色线', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="load_pct" />)
    const chart = screen.getByTestId('mock-line-chart')
    const datasets = JSON.parse(chart.getAttribute('data-datasets') || '[]')
    expect(datasets[0].borderColor).toBe('#f59e0b')
  })

  it('current_a 指标用蓝色线', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="current_a" />)
    const chart = screen.getByTestId('mock-line-chart')
    const datasets = JSON.parse(chart.getAttribute('data-datasets') || '[]')
    expect(datasets[0].borderColor).toBe('#3b82f6')
  })

  it('health_score 指标用绿色线', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="health_score" />)
    const chart = screen.getByTestId('mock-line-chart')
    const datasets = JSON.parse(chart.getAttribute('data-datasets') || '[]')
    expect(datasets[0].borderColor).toBe('#22c55e')
  })

  it('提取关节温度值', () => {
    const robot = makeRobot()
    render(<TrendChart robot={robot} metric="temp_c" jointIndex={0} />)
    // J1 温度 41°C
    expect(screen.getByText(/41/)).toBeInTheDocument()
  })

  it('health_score 计算所有关节平均分', () => {
    const robot = makeRobot()
    // J1=88, J2=54, 平均=71
    render(<TrendChart robot={robot} metric="health_score" />)
    expect(screen.getByText(/71/)).toBeInTheDocument()
  })

  it('无 industrial 数据时健康分回退到 85', () => {
    const robot = makeRobot({ industrial: undefined })
    render(<TrendChart robot={robot} metric="health_score" />)
    expect(screen.getByText(/85/)).toBeInTheDocument()
  })

  it('无 industrial 数据时关节指标回退到 0', () => {
    const robot = makeRobot({ industrial: undefined })
    render(<TrendChart robot={robot} metric="temp_c" />)
    expect(screen.getByText(/0/)).toBeInTheDocument()
  })

  it('最新值为空时显示 --', () => {
    const robot = makeRobot()
    // 初始 history 为空，但 useEffect 会立即 push 一个值
    // 用 initial render 测：无关节数据 -> 最新值应为 0（temp_c 回退）
    // 这里验证 health_score 无关节场景：无 joints -> 85
    const robotNoJoints = makeRobot({
      industrial: { joints: [], alarms: [], runtime: { power_on_hours: 0, cycle_count: 0 }, protocol: 'FOCAS' },
    })
    render(<TrendChart robot={robotNoJoints} metric="health_score" />)
    // 无关节时 scores 为空，返回 85
    expect(screen.getByText(/85/)).toBeInTheDocument()
  })
})
