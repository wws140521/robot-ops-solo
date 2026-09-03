/**
 * Agent Tool 基础类型
 */
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
