import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthGauge } from '../HealthGauge'

describe('HealthGauge · 健康分仪表盘', () => {
  it('渲染数字和标签', () => {
    render(<HealthGauge score={88} />)
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('健康分')).toBeInTheDocument()
  })

  it('score 被 clamp 到 [0,100]', () => {
    const { rerender } = render(<HealthGauge score={150} />)
    expect(screen.getByText('100')).toBeInTheDocument()

    rerender(<HealthGauge score={-20} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('四舍五入显示整数', () => {
    render(<HealthGauge score={87.6} />)
    expect(screen.getByText('88')).toBeInTheDocument()
  })

  it('自定义 label', () => {
    render(<HealthGauge score={90} label="综合评分" />)
    expect(screen.getByText('综合评分')).toBeInTheDocument()
  })

  it('≥80 用绿色（stroke 含 status-online）', () => {
    const { container } = render(<HealthGauge score={85} />)
    const circles = container.querySelectorAll('circle[stroke]')
    // 第二个 circle 是进度环
    const progressCircle = circles[1]
    expect(progressCircle.getAttribute('stroke')).toBe('var(--status-online)')
  })

  it('60-79 用工作色（status-working）', () => {
    const { container } = render(<HealthGauge score={65} />)
    const progressCircle = container.querySelectorAll('circle[stroke]')[1]
    expect(progressCircle.getAttribute('stroke')).toBe('var(--status-working)')
  })

  it('40-59 用警告色（alert-warn）', () => {
    const { container } = render(<HealthGauge score={50} />)
    const progressCircle = container.querySelectorAll('circle[stroke]')[1]
    expect(progressCircle.getAttribute('stroke')).toBe('var(--alert-warn)')
  })

  it('<40 用错误色（status-error）', () => {
    const { container } = render(<HealthGauge score={30} />)
    const progressCircle = container.querySelectorAll('circle[stroke]')[1]
    expect(progressCircle.getAttribute('stroke')).toBe('var(--status-error)')
  })

  it('SVG 圆环存在两个 circle（背景+进度）', () => {
    const { container } = render(<HealthGauge score={70} />)
    const circles = container.querySelectorAll('svg circle')
    expect(circles).toHaveLength(2)
  })

  it('自定义 size 生效', () => {
    const { container } = render(<HealthGauge score={70} size={150} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('150')
    expect(svg?.getAttribute('height')).toBe('150')
  })
})
