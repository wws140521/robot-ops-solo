// AI SaaS API 封装，调外部 AI 服务做告警摘要和排查建议
// 没配 URL 时走本地 mock，先糊弄一下 UI
import type { IndustrialExtension } from 'robot-adapter-kit'

const AI_SAAS_URL = import.meta.env.VITE_AI_SAAS_URL || ''

export interface AIInsightResult {
  summary: string
  suggestions: string[]
  health_score: number
  rul_days?: number
  confidence: number
}

// AI SaaS 没配 URL 时的本地 mock，按几个简单阈值给建议
// 负载>80%、温度>50℃、RUL<30 天都是现场常用的维护触发线
function mockInsight(robotId: string, industrial: IndustrialExtension): AIInsightResult {
  const highLoadJoints = industrial.joints.filter((j) => j.load_pct > 80)
  const hotJoints = industrial.joints.filter((j) => (j.temp_c ?? 0) > 50)
  const activeAlarms = industrial.alarms.filter((a) => !a.cleared)

  const avgHealth = industrial.joints.reduce((sum, j) => sum + (j.health_score ?? 100), 0) / industrial.joints.length
  const minRul = Math.min(...industrial.joints.map((j) => j.rul_days ?? 999))

  const issues: string[] = []
  if (highLoadJoints.length > 0) {
    issues.push(`高负载关节: ${highLoadJoints.map((j) => `J${j.j}(${j.load_pct}%)`).join(', ')}`)
  }
  if (hotJoints.length > 0) {
    issues.push(`高温关节: ${hotJoints.map((j) => `J${j.j}(${j.temp_c}℃)`).join(', ')}`)
  }
  if (activeAlarms.length > 0) {
    issues.push(`活跃告警: ${activeAlarms.map((a) => a.raw_code).join(', ')}`)
  }

  const suggestions: string[] = []
  if (highLoadJoints.length > 0) suggestions.push('检查高负载关节的减速比参数，降低加速度')
  if (hotJoints.length > 0) suggestions.push('检查散热风扇和润滑油状态，必要时停机冷却')
  if (activeAlarms.length > 0) suggestions.push(`按报警码 ${activeAlarms.map((a) => a.raw_code).join('/')} 查看原厂维护手册`)
  if (minRul < 30) suggestions.push(`J${industrial.joints.find((j) => j.rul_days === minRul)?.j} 剩余寿命仅 ${minRul} 天，建议安排预防性维护`)
  if (suggestions.length === 0) suggestions.push('各项指标正常，保持定期巡检即可')

  return {
    summary: issues.length > 0
      ? `${robotId} 存在 ${issues.length} 项需关注：${issues.join('；')}。`
      : `${robotId} 运行状态良好，各项指标均在正常范围内。`,
    suggestions,
    health_score: Math.round(avgHealth),
    rul_days: minRul < 999 ? minRul : undefined,
    confidence: 0.85,
  }
}

// 调 AI SaaS 分析接口，没配就 mock
export async function fetchAIInsight(
  robotId: string,
  industrial: IndustrialExtension
): Promise<AIInsightResult> {
  if (!AI_SAAS_URL) {
    // AI SaaS 未配置时模拟 600ms 网络延迟，保持 UI 加载状态一致
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockInsight(robotId, industrial)), 600)
    })
  }

  const res = await fetch(`${AI_SAAS_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
    },
    body: JSON.stringify({
      robot_id: robotId,
      telemetry: industrial,
      timestamp: new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    throw new Error(`AI SaaS error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// 自然语言问答接口，现在没配 URL 直接返回提示
export async function fetchAINaturalQuery(
  robotId: string,
  question: string,
  context?: IndustrialExtension
): Promise<{ answer: string; references: string[] }> {
  if (!AI_SAAS_URL) {
    return {
      answer: `AI SaaS 未配置，无法回答"${question}"。请配置 VITE_AI_SAAS_URL 环境变量。`,
      references: [],
    }
  }

  const res = await fetch(`${AI_SAAS_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
    },
    body: JSON.stringify({
      robot_id: robotId,
      question,
      context: context || null,
    }),
  })

  if (!res.ok) {
    throw new Error(`AI SaaS query error: ${res.status}`)
  }

  return res.json()
}
