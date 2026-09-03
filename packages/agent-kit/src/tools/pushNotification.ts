import type { Tool } from './types'

export type NotificationSender = (user: string, message: string) => Promise<{ pushed: boolean; channel: string }>

let senderImpl: NotificationSender = async (user, message) => {
  // Demo 默认输出到控制台，不阻塞流程
  console.log(`[Agent Notify] → ${user}: ${message}`)
  return { pushed: true, channel: 'console(demo)' }
}

export function setNotificationSender(fn: NotificationSender): void {
  senderImpl = fn
}

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
