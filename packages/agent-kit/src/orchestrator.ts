// Agent Orchestrator，把 tool 列表转成 LLM function calling 要的 schema，并按 name 路由执行
// 现在没 LLM，agent.ts 直接走 mock，但这里保持纯编排，后面换真模型不用改
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

// 把内部 tool 列表转成 OpenAI / Anthropic 要的 function schema
export function getToolDefinitions(): ToolDefinition[] {
  // OpenAI / Anthropic 要求 functions 数组每项为 { type: 'function', function: {...} }
  return ALL_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// 按名字找到 tool 并执行，找不到就返回 error，LLM 下轮可以自己纠
export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const tool = findTool(name)
  // 找不到工具时不抛异常，返回结构化 error，方便 LLM 在下一轮纠正
  if (!tool) return { error: `tool not found: ${name}` }
  return tool.invoke(args)
}

export { ALL_TOOLS, findTool }
export type { Tool }
