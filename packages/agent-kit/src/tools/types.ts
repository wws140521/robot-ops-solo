// Agent Tool 基础类型，和 OpenAI / Anthropic 的 function calling schema 对齐
// description 写得好不好直接影响模型会不会乱选工具
export interface ToolParameterSchema {
  type: string
  description?: string
  properties?: Record<string, ToolParameterSchema>
  required?: string[]
  enum?: string[]
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParameterSchema
  invoke: (args: Record<string, any>) => Promise<any>
}
