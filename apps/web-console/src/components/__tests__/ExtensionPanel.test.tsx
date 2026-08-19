import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExtensionPanel } from '../ExtensionPanel'

describe('ExtensionPanel · 品牌特有数据面板', () => {
  it('无 extensions 时显示占位文案', () => {
    render(<ExtensionPanel brand="FANUC" />)
    expect(screen.getByText(/暂无/)).toBeInTheDocument()
    expect(screen.getByText(/FANUC/)).toBeInTheDocument()
  })

  it('空对象也显示占位文案', () => {
    render(<ExtensionPanel extensions={{}} brand="KUKA" />)
    expect(screen.getByText(/暂无/)).toBeInTheDocument()
  })

  it('渲染键值对（数字值）', () => {
    render(
      <ExtensionPanel
        extensions={{ r_register_200: 58, d_parameter_101: 5.86 }}
        brand="FANUC"
      />
    )
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('5.86')).toBeInTheDocument()
  })

  it('FANUC 字段中文映射', () => {
    render(
      <ExtensionPanel
        extensions={{ r_register_200: 58, tool_life_remaining: 999 }}
        brand="FANUC"
      />
    )
    expect(screen.getByText('R 寄存器 #200')).toBeInTheDocument()
    expect(screen.getByText('刀具剩余寿命')).toBeInTheDocument()
  })

  it('KUKA 字段中文映射', () => {
    render(
      <ExtensionPanel
        extensions={{ safety_gate_open: true, axis_soft_limit: '正常' }}
        brand="KUKA"
      />
    )
    expect(screen.getByText('安全门状态')).toBeInTheDocument()
    expect(screen.getByText('轴软限位')).toBeInTheDocument()
  })

  it('ESTUN 字段中文映射', () => {
    render(
      <ExtensionPanel
        extensions={{ energy_consumption: 1.76, plc_extension: 'M1 Y0' }}
        brand="ESTUN"
      />
    )
    expect(screen.getByText('能耗监测')).toBeInTheDocument()
    expect(screen.getByText('PLC 扩展区')).toBeInTheDocument()
  })

  it('布尔值 true 显示为 ⛔ 开（红色）', () => {
    render(
      <ExtensionPanel
        extensions={{ safety_gate_open: true }}
        brand="KUKA"
      />
    )
    expect(screen.getByText('⛔ 开')).toBeInTheDocument()
  })

  it('布尔值 false 显示为 ✅ 关（绿色）', () => {
    render(
      <ExtensionPanel
        extensions={{ safety_gate_open: false }}
        brand="KUKA"
      />
    )
    expect(screen.getByText('✅ 关')).toBeInTheDocument()
  })

  it('未知品牌显示品牌大写名', () => {
    render(<ExtensionPanel extensions={{ foo: 1 }} brand="unknown_brand" />)
    // 图标和文字分属不同 text node，用正则匹配
    expect(screen.getByText(/UNKNOWN_BRAND/)).toBeInTheDocument()
  })

  it('未映射的 key 原样显示', () => {
    render(
      <ExtensionPanel
        extensions={{ custom_field: 42 }}
        brand="FANUC"
      />
    )
    expect(screen.getByText('custom_field')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('标题含品牌图标', () => {
    const { container } = render(
      <ExtensionPanel
        extensions={{ r_register_200: 58 }}
        brand="FANUC"
      />
    )
    expect(container.textContent).toContain('🤖')
  })
})
