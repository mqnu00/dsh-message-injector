/**
 * 当前打开会话定位（dsh 0.2.0：SessionListState 只有 byId，无 current 字段）
 *
 * 官方统一写法：mainView 保留计数 > 0 的会话即当前打开的会话
 * （见 dsh-client-ui-layout / dsh-client-ui-cordis 等官方包）。
 */
import type { RootCtx } from '../types'

export function currentSessionId(ctx: RootCtx): string | undefined {
  const byId = ctx.sessions.list.getSnapshot().byId ?? {}
  return Object.values(byId).find((summary) => (summary?.retainedBy?.mainView ?? 0) > 0)?.id
}
