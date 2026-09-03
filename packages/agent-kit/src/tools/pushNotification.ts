import type { Tool } from './types'

// 通知发送器类型，企微/钉钉/站内信自己实现
export type NotificationSender = (user: string, message: string) => Promise<{ pushed: boolean; channel: string }>

let senderImpl: NotificationSender = async (user, message) => {
  // 未接入企业微信 / 钉钉前，默认打到控制台，方便本地调试
  // 真实通道通过 setNotificationSender 注入
  console.log(`[Agent Notify] → ${user}: ${message}`)
  return { pushed: true, channel: 'console(demo)' }
}

// 注入真实的通知通道
export function setNotificationSender(fn: NotificationSender): void {
  senderImpl = fn
}

// 推送工具
export const pushNotification: Tool = {
  name: 'pushNotification',
  description: '将 Agent 建议推送给指定责任人（企微/钉钉/站内信，需配置通道）',
  parameters: {
    type: 'object',
    properties: {
      user: { type: 'string', description: '责任人标识' },
      message: { type: 'string', description: '推送内容' },
    },
    required: ['user', 'message'],
  },
  async invoke(args: Record<string, any>) {
    const { user, message } = args
    return senderImpl(user, message)
  },
}
