/**
 * Agent Orchestrator
 * - 提供工具定义注册表（OpenAI / Anthropic Function Calling 格式）
 * - 提供工具路由执行
 */
import { ALL_TOOLS, findTool } from './registry'
import type { Tool } from './tools/types'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export function getToolDefinitions(): ToolDefinition[] {
  return ALL_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const tool = findTool(name)
  if (!tool) return { error: `tool not found: ${name}` }
  return tool.invoke(args)
}

export { ALL_TOOLS, findTool }
export type { Tool }
