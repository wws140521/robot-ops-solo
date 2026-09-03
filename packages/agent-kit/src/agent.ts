// Robot-Ops Agent 入口
// 现在没配 LLM Key 就走本地 mock，按关键词匹配工具并返回中文；有 Key 后再接真模型
import { executeTool } from './orchestrator'

// 所有回复前都加免责声明，避免现场人员直接按建议操作
const DISCLAIMER = '[AI 辅助生成 · 仅供参考 · 关键操作需人工确认]\n\n'

// 从用户消息里抠 robotId，支持 FANUC_M20iD_001、g1-001 这种格式
function extractRobotId(message: string): string | undefined {
  // 匹配常见 ID 格式：FANUC_M20iD_001、DJI_DOCK_001、g1-001、R1
  // 优先大写下划线格式，其次小写连字符格式
  const m = message.match(/\b([A-Z][A-Za-z0-9_-]*(?:[_-]\d+)?|[a-z][a-z0-9_-]*-\d+)\b/)
  return m?.[1]
}

// 本地 mock 的 agent，不看 LLM，直接正则匹配意图然后调 tool
async function mockAgent(message: string, robotIdHint?: string): Promise<string> {
  const robotId = robotIdHint || extractRobotId(message)

  // ---- 意图：查状态 ----
  if (/状态|怎么样|健康|运行|在线/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"查一下 FANUC_M20iD_001 的状态"。`
    const state = await executeTool('queryRobotState', { robot_id: robotId })
    if (state.error) return `${DISCLAIMER}${state.error}`
    return `${DISCLAIMER}${robotId} 当前状态：\n- 在线状态：${state.online ? '在线' : '离线'}\n- 运行状态：${state.status}\n- 整体健康分：${state.health_score}\n- 关节数：${state.joint_count}\n- 活跃告警：${state.alarm_count} 条\n- 累计运行：${state.runtime_hours} 小时`
  }

  // ---- 意图：查告警 ----
  if (/告警|报警|故障|错误/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"FANUC_M20iD_001 最近有什么告警"。`
    const alarms = await executeTool('queryAlarms', { robot_id: robotId })
    if (alarms.error) return `${DISCLAIMER}${alarms.error}`
    if (alarms.total === 0) return `${DISCLAIMER}${robotId} 当前无活跃告警。`
    const lines = alarms.clustered.map((g: any) => `- ${g.code}：${g.count} 次，最近 ${g.sample.message}`)
    return `${DISCLAIMER}${robotId} 当前共有 ${alarms.total} 条活跃告警（按 code 聚类）：\n${lines.join('\n')}`
  }

  // ---- 意图：查健康分 / 保养排序 ----
  if (/健康分|保养|最该保养|最差关节|rul|寿命/.test(message)) {
    if (!robotId) {
      return `${DISCLAIMER}请提供机器人 ID，例如"FANUC_M20iD_001 哪个关节最该保养"。`
    }
    const health = await executeTool('queryHealthScore', { robot_id: robotId, top_n: 3 })
    if (health.error) return `${DISCLAIMER}${health.error}`
    const lines = health.worst_joints.map((j: any) => `- J${j.joint}：健康分 ${j.health_score}${j.rul_days ? `，剩余寿命 ${j.rul_days} 天` : ''}`)
    return `${DISCLAIMER}${robotId} 整体健康分 ${health.overall_health}，最差关节：\n${lines.join('\n')}`
  }

  // ---- 意图：生成报告 ----
  if (/报告|日报|周报|维修|保养报告/.test(message)) {
    if (!robotId) return `${DISCLAIMER}请提供机器人 ID，例如"生成 FANUC_M20iD_001 的健康报告"。`
    const type = /维修/.test(message) ? 'repair' : /保养/.test(message) ? 'maintenance' : 'health'
    const report = await executeTool('generateReport', { type, robot_id: robotId })
    if (report.error) return `${DISCLAIMER}${report.error}`
    return `${DISCLAIMER}已生成 ${robotId} 的${type === 'repair' ? '维修' : type === 'maintenance' ? '保养' : '健康'}报告草稿，状态：${report.status}。\n\n${report.markdown}`
  }

  // ---- 意图：匹配 SOP ----
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

  // 没有命中任何意图，给领域内的示例提示
  return `${DISCLAIMER}我是 Robot-Ops-Solo 工厂运维助手，只回答工业机器人/机巢/起降场运维相关问题。您可以问我：\n- "FANUC_M20iD_001 的状态怎么样"\n- "查询某机器人的告警"\n- "生成某机器人的健康报告"\n- "OVER_TEMP_J2 的 SOP 是什么"`
}

export interface RunAgentOptions {
  robotIdHint?: string
  // 强制使用 mock，不走 LLM
  forceMock?: boolean
}

// 外部调用的入口，判断是走 mock 还是 LLM（现在 LLM 分支也暂时走 mock）
export async function runAgent(message: string, options: RunAgentOptions = {}): Promise<string> {
  const { robotIdHint, forceMock } = options

  const mode = (import.meta as any).env?.VITE_AGENT_MODE
  const hasKey =
    (import.meta as any).env?.VITE_OPENAI_API_KEY ||
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY

  // 未配置 API Key 或显式关闭时走本地 mock 逻辑；
  // 有 Key 后可将下面分支替换为真实 LLM 调用
  if (forceMock || mode === 'disabled' || !hasKey) {
    return mockAgent(message, robotIdHint)
  }

  return mockAgent(message, robotIdHint)
}

export { getRobotState } from './tools/state-source'
