import type { Tool } from './types'

// 根据告警码匹配 SOP 模板，找不到就告诉 LLM 没有
export interface SopStep {
  id: number
  title: string
  detail: string
  require_photo?: boolean
}

export interface SopTemplate {
  alarm_code: string
  title: string
  estimated_minutes: number
  steps: SopStep[]
}

// 匹配函数由外部注入，让 agent-kit 不依赖具体的 SOP 数据源（文件/Supabase/远程服务）
export type SopMatcher = (alarm_code: string, brand?: string) => SopTemplate | null

let matcherImpl: SopMatcher = () => null

// 注入 SOP 匹配函数，数据源可以是文件、Supabase 或者远程服务
export function setSopMatcher(fn: SopMatcher): void {
  matcherImpl = fn
}

// SOP 匹配 tool
export const matchSOP: Tool = {
  name: 'matchSOP',
  description: '根据告警码/品牌匹配对应的 SOP 标准作业程序模板',
  parameters: {
    type: 'object',
    properties: {
      alarm_code: { type: 'string', description: 'UDM 统一告警码，如 OVER_TEMP_J2' },
      brand: { type: 'string', description: '机器人品牌，如 FANUC' },
    },
    required: ['alarm_code'],
  },
  async invoke(args: Record<string, any>) {
    const { alarm_code, brand } = args
    const sop = matcherImpl(alarm_code, brand)
    // 未命中时给 LLM 明确提示，避免它继续追问不存在的模板
    if (!sop) {
      return { found: false, message: `暂无 ${alarm_code} 的 SOP 模板，建议人工编写` }
    }
    return {
      found: true,
      sop_id: sop.alarm_code,
      title: sop.title,
      estimated_minutes: sop.estimated_minutes,
      steps: sop.steps,
    }
  },
}
