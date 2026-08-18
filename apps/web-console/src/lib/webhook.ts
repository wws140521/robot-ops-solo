// Webhook 告警推送 —— 企微/钉钉/飞书机器人
// 对应 SUPABASE.md 第七节
import { supabase, isSupabaseEnabled } from './supabase'

interface AlertPayload {
  level: string
  code: string
  message: string
  robot_id: string
}

interface WebhookConfig {
  id: string
  type: 'wechat' | 'dingtalk' | 'feishu'
  url: string
  secret?: string | null
  events: string[]
  enabled: boolean
}

// 查当前租户启用的、订阅了该告警级别的 webhook 配置
async function getActiveWebhooks(level: string): Promise<WebhookConfig[]> {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('webhook_configs')
    .select('*')
    .eq('enabled', true)
    .contains('events', [level])

  if (error) {
    console.error(error)
    return []
  }
  return (data ?? []) as WebhookConfig[]
}

// 发送告警到企微/钉钉/飞书
export async function pushWebhook(alert: AlertPayload) {
  const webhooks = await getActiveWebhooks(alert.level)

  for (const wh of webhooks) {
    try {
      let body: Record<string, unknown>

      if (wh.type === 'wechat') {
        // 企业微信机器人
        body = {
          msgtype: 'markdown',
          markdown: {
            content: `## 🤖 机器人告警\n> **机器人**: ${alert.robot_id}\n> **级别**: ${alert.level}\n> **内容**: ${alert.message}\n> **时间**: ${new Date().toLocaleString('zh-CN')}`,
          },
        }
      } else if (wh.type === 'dingtalk') {
        // 钉钉机器人（需签名，此处简化版）
        body = {
          msgtype: 'markdown',
          markdown: {
            title: '机器人告警',
            text: `## 🤖 机器人告警\n\n- **机器人**: ${alert.robot_id}\n- **级别**: ${alert.level}\n- **内容**: ${alert.message}`,
          },
        }
      } else if (wh.type === 'feishu') {
        // 飞书机器人
        body = {
          msg_type: 'interactive',
          card: {
            header: { title: { content: '🤖 机器人告警', tag: 'plain_text' } },
            elements: [
              {
                tag: 'div',
                text: {
                  content: `**机器人**: ${alert.robot_id}\n**级别**: ${alert.level}\n**内容**: ${alert.message}`,
                  tag: 'lark_md',
                },
              },
            ],
          },
        }
      } else {
        continue
      }

      await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.error(`[webhook:${wh.type}] 推送失败`, err)
    }
  }
}
