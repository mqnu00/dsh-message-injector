/**
 * types（类型定义目录，dsh 0.2.0 模型）
 *
 * 存放跨模块流转的"形状"定义：防御式服务类型（ScopeLike/ConfigFormLike/RootCtx 等），
 * 运行时按需取用，避免对 dsh 内部包（cordis 等）的强类型依赖。
 *
 * 领域数据对象（PresetGroup/PresetConfig）的唯一来源在 src/shared/types.ts（跨端共用），
 * 需要时从 `../../shared/types` 导入，不在本目录重复定义。
 */

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
 * 配置作用域（dsh 0.2.0 由 ctx.configForms.get(条目id) 提供的 ConfigForm 适配而来）。
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

/** 客户端根上下文（apply 入参的防御式形状） */
export interface RootCtx {
  effect(fn: () => void | (() => void), label?: string): void
  slots: {
    inject(key: string, cb: () => unknown): () => void
    register(opts: Record<string, unknown>, comp: unknown): () => void
  }
  locale: { register(ns: string, dict: Record<string, Record<string, string>>): void }
  configForms: ConfigFormsLike
  sessions: {
    list: { getSnapshot(): { byId?: Record<string, { id: string; retainedBy?: { mainView?: number } }> } }
    scope(id: string): { get(name: string): unknown } | undefined
  }
  remote: {
    skills: {
      list(req: { sessionId: string }, signal?: AbortSignal): Promise<{ ok?: boolean; value?: { skills?: { name?: string }[] } }>
    }
  }
  get(name: string): unknown
}
