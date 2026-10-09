/**
 * types（类型定义目录）
 *
 * 存放跨模块流转的"形状"定义：防御式服务类型（ScopeLike/InputLike/RootCtx 等）。
 * 运行时按需取用，避免对 dsh 内部包（cordis 等）的强类型依赖——只声明实际用到的成员，
 * dsh 升级改内部结构时此处可独立调整。
 *
 * 领域数据对象（PresetGroup/PresetConfig）的唯一来源在 src/shared/types.ts（跨端共用），
 * 需要时从 `../../shared/types` 导入，不在本目录重复定义。
 */
import type { PresetConfig } from '../../shared/types'

/** 配置快照（ConfigFormSnapshot 的防御式子集；对象引用稳定，可直接交给 useSyncExternalStore） */
export interface ScopeSnapshot<T> {
  status: string
  value?: T
  writable?: boolean
}

/** 配置路径写操作（SettingsPathOpView 的防御式形状） */
export type ConfigPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/**
 * 配置作用域（dsh 0.2.0 由 ctx.configForms.get(entryId) 提供的 ConfigForm 适配而来）。
 * set/mutate 返回宿主是否接受（false = 被拒绝/只读；传输错误才 reject）。
 */
export interface ScopeLike<T> {
  getSnapshot(): ScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  mutate(ops: readonly ConfigPathOp[]): Promise<boolean>
}

/** dsh 0.2.0 客户端配置表单服务（ConfigForm 的防御式形状） */
export interface ConfigFormLike<T> {
  getSnapshot(): ScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  mutate(ops: readonly ConfigPathOp[], expectedRevision?: number): Promise<boolean>
}

/** dsh 0.2.0 客户端配置表单注册表（ctx.configForms 的防御式形状） */
export interface ConfigFormsLike {
  get<T>(entryId: string): ConfigFormLike<T>
  whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void
}

/** 输入框官方写入通道（conversation.input.for(actx) 的防御式形状） */
export interface InputLike {
  setDraft(text: string): void
  state: { getSnapshot(): { draft: string; phase: string } }
}

/** 会话摘要（SessionSummary 的防御式子集） */
export interface SessionSummaryLike {
  id: string
  retainedBy?: { mainView?: number }
}

/** dsh 0.2.0 客户端技能目录（ctx.remote.skills 的防御式形状；RemoteResult 包装） */
export interface SkillsRemoteLike {
  list(
    req: { sessionId: string },
    signal?: AbortSignal,
  ): Promise<{ ok?: boolean; value?: { skills?: { name?: string }[] } }>
}

/** 客户端根上下文（apply 入参的防御式形状） */
export interface RootCtx {
  effect(fn: () => void | (() => void), label?: string): void
  slots: {
    inject(key: string, cb: () => unknown): () => void
    register(opts: Record<string, unknown>, comp: unknown): () => void
  }
  locale: { register(ns: string, dict: Record<string, Record<string, string>>): void }
  sessions: {
    list: { getSnapshot(): { byId?: Record<string, SessionSummaryLike> } }
    scope(id: string): { get(name: string): unknown } | undefined
  }
  configForms: ConfigFormsLike
  remote: { skills: SkillsRemoteLike }
  get(name: string): unknown
}

/** 绑定后的配置作用域（供组件 props 引用，避免到处 import type） */
export type PresetScope = ScopeLike<PresetConfig>
