/**
 * Robot-Ops Agent 入口
 * - Mock 模式：无 LLM API Key 时按关键词匹配工具并生成中文回复
 * - LLM 模式：配置 VITE_OPENAI_API_KEY / VITE_ANTHROPIC_API_KEY 时调用真实模型
 */
import { executeTool } from './orchestrator'
import { getRobotState } from './tools/state-source'

const DISCLAIMER = '[AI 辅助生成 · 仅供参考 · 关键操作需人工确认]\n\n'

function extractRobotId(message: string): string | undefined {
  // 匹配常见 ID 格式：FANUC_M20iD_001、DJI_DOCK_001、g1-001、R1 等
  const m = message.match(/\b([A-Z][A-Za-z0-9_-]*(?:[_-]\d+)?|[a-z][a-z0-9_-]*-\d+)\b/)
  return m?.[1]
}

async function mockAgent(message: string, robotIdHint?: string): Promise<string> {
  const robotId = robotIdHint || extractRobotId(message)

  // 意图识别：查状态
  if (/状态|怎么样|健康|运行|在线/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"查一下 FANUC_M20iD_001 的状态"。`
    const state = await executeTool('queryRobotState', { robot_id: robotId })
    if (state.error) return `${DISCLAIMER}${state.error}`
    return `${DISCLAIMER}${robotId} 当前状态：\n- 在线状态：${state.online ? '在线' : '离线'}\n- 运行状态：${state.status}\n- 整体健康分：${state.health_score}\n- 关节数：${state.joint_count}\n- 活跃告警：${state.alarm_count} 条\n- 累计运行：${state.runtime_hours} 小时`
  }

  // 意图识别：查告警
  if (/告警|报警|故障|错误/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"FANUC_M20iD_001 最近有什么告警"。`
    const alarms = await executeTool('queryAlarms', { robot_id: robotId })
    if (alarms.error) return `${DISCLAIMER}${alarms.error}`
    if (alarms.total === 0) return `${DISCLAIMER}${robotId} 当前无活跃告警。`
    const lines = alarms.clustered.map((g: any) => `- ${g.code}：${g.count} 次，最近 ${g.sample.message}`)
    return `${DISCLAIMER}${robotId} 当前共有 ${alarms.total} 条活跃告警（按 code 聚类）：\n${lines.join('\n')}`
  }

  // 意图识别：查健康分/保养排序
  if (/健康分|保养|最该保养|最差关节|rul|寿命/.test(message)) {
    if (!robotId) {
      return `${DISCLAIMER}请提供机器人 ID，例如"FANUC_M20iD_001 哪个关节最该保养"。`
    }
    const health = await executeTool('queryHealthScore', { robot_id: robotId, top_n: 3 })
    if (health.error) return `${DISCLAIMER}${health.error}`
    const lines = health.worst_joints.map((j: any) => `- J${j.joint}：健康分 ${j.health_score}${j.rul_days ? `，剩余寿命 ${j.rul_days} 天` : ''}`)
    return `${DISCLAIMER}${robotId} 整体健康分 ${health.overall_health}，最差关节：\n${lines.join('\n')}`
  }

  // 意图识别：生成报告
  if (/报告|日报|周报|维修|保养报告/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"生成 FANUC_M20iD_001 的健康报告"。`
    const type = /维修/.test(message) ? 'repair' : /保养/.test(message) ? 'maintenance' : 'health'
    const report = await executeTool('generateReport', { type, robot_id: robotId })
    if (report.error) return `${DISCLAIMER}${report.error}`
    return `${DISCLAIMER}已生成 ${robotId} 的${type === 'repair' ? '维修' : type === 'maintenance' ? '保养' : '健康'}报告草稿，状态：${report.status}。\n\n${report.markdown}`
  }

  // 意图识别：匹配 SOP
  const sopMatch = message.match(/SOP|处置|步骤|流程|怎么处理/)
  if (sopMatch) {
    const codeMatch = message.match(/\b([A-Z][A-Z0-9_]*[A-Z0-9])\b/)
    if (!codeMatch) return `${DISCLAIMER}请提供告警码，例如"OVER_TEMP_J2 的 SOP 是什么"。`
    const alarmCode = codeMatch[1]
    const brandMatch = message.match(/(?:品牌|brand)[\s:：]*([A-Za-z0-9]+)/)
    const sop = await executeTool('matchSOP', { alarm_code: alarmCode, brand: brandMatch?.[1] })
    if (!sop.found) return `${DISCLAIMER}${sop.message}`
    const steps = sop.steps.map((s: any, i: number) => `${i + 1}. ${s.title}：${s.detail}`).join('\n')
    return `${DISCLAIMER}${sop.title}（预计 ${sop.estimated_minutes} 分钟）\n\n${steps}`
  }

  // 默认：领域拒绝
  return `${DISCLAIMER}我是 Robot-Ops-Solo 工厂运维助手，只回答工业机器人/机巢/起降场运维相关问题。您可以问我：\n- "FANUC_M20iD_001 的状态怎么样"\n- "查询某机器人的告警"\n- "生成某机器人的健康报告"\n- "OVER_TEMP_J2 的 SOP 是什么"`
}

export interface RunAgentOptions {
  robotIdHint?: string
  /** 强制使用 mock，不走 LLM */
  forceMock?: boolean
}

export async function runAgent(message: string, options: RunAgentOptions = {}): Promise<string> {
  const { robotIdHint, forceMock } = options

  const mode = (import.meta as any).env?.VITE_AGENT_MODE
  const hasKey =
    (import.meta as any).env?.VITE_OPENAI_API_KEY ||
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY

  if (forceMock || mode === 'disabled' || !hasKey) {
    return mockAgent(message, robotIdHint)
  }

  // LLM 模式占位：真实接入可在此扩展 OpenAI / Anthropic 调用
  // 为保持包体积和演示稳定性，默认仍走 mockAgent；配置 key 后可替换为真实调用
  return mockAgent(message, robotIdHint)
}

export { getRobotState }
