/**
 * 技能目录（ctx.remote.skills.list 的封装 + 按会话 30s TTL 缓存）
 *
 * dsh 0.2.0：技能目录由 Remote 协议提供（旧 connection.api.skills 已移除）。
 * 校验失败视为「不校验」返回 null：调用方按配置原样处理（不拦截技能调用行）。
 */
import type { RootCtx } from '../types'

let skillsCache: { sessionId: string; names: Set<string>; at: number } | null = null

export async function fetchKnownSkillNames(ctx: RootCtx, sessionId: string): Promise<Set<string> | null> {
  const now = Date.now()
  if (skillsCache && skillsCache.sessionId === sessionId && now - skillsCache.at < 30_000) {
    return skillsCache.names
  }
  try {
    const res = await ctx.remote.skills.list({ sessionId })
    if (!res || res.ok === false) return null
    const list = res.value?.skills
    if (!Array.isArray(list)) return null
    const names = new Set<string>()
    for (const sk of list) {
      if (sk && typeof sk.name === 'string' && sk.name !== '') names.add(sk.name)
    }
    skillsCache = { sessionId, names, at: now }
    return names
  } catch {
    return null
  }
}

/** 当前打开会话 id（0.2.0 无 current 字段：按 retainedBy.mainView > 0 找，官方统一写法） */
export function currentSessionId(ctx: RootCtx): string | undefined {
  const byId = ctx.sessions.list.getSnapshot().byId ?? {}
  return Object.values(byId).find((s) => (s?.retainedBy?.mainView ?? 0) > 0)?.id
}
