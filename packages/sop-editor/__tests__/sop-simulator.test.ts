import { describe, it, expect } from 'vitest'
import { createSimulator } from '../src/engine/sop-simulator'
import { HOTPOT_DINNER_V1 } from '../src/schema/sop-schema'

describe('火锅店晚市 SOP 模拟', () => {
  it('跑通完整验证清单：开机→传菜 3 桌→低电回充→降频→关机', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); origLog(...args) }

    const sim = createSimulator(HOTPOT_DINNER_V1, {
      onLog: (m) => logs.push(m),
      onSpeak: (t) => logs.push(`SPEAK:${t}`),
      onMove: (f, t) => logs.push(`MOVE:${f}->${t}`),
      onAlert: (c, m) => logs.push(`ALERT:${c}:${m}`),
      onComplete: () => logs.push('DONE'),
    })

    await sim.start()
    console.log = origLog

    const all = logs.join('\n')

    // 验证清单（对应 SOP-HOTPOT.md 第八节）
    expect(all).toContain('SOP 模拟开始')
    expect(all).toContain('开机自检')        // #2 boot
    expect(all).toContain('回充电桩')        // #3 charge_full
    expect(all).toContain('→ B')             // #4 3号桌
    expect(all).toContain('→ C')             // #5 7号桌
    expect(all).toContain('→ D')             // #6 5号桌
    expect(all).toContain('→ A')             // #7 回传菜口
    expect(all).toContain('小心烫手')         // 播报话术
    expect(all).toContain('电量恢复')         // #8 低电回充分支
    expect(all).toContain('SHUTDOWN')        // #9 关机
    expect(all).toContain('SOP 模拟结束')     // #10

    // 3 张桌各播报一次
    const speakCount = (all.match(/SPEAK:/g) || []).length
    expect(speakCount).toBeGreaterThanOrEqual(3)

    // 低电回充分支确实触发：电量曾低于 30
    expect(all).toMatch(/电量恢复至 \d+%/)
  }, 30000)
})
