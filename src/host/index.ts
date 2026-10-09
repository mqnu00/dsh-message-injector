/**
 * dsh-message-injector — 后端（dsh 官方称 Host half）
 *
 * dsh 0.2.0 适配要点（旧 settings 架构被官方移除）：
 *  - 命名空间 = Loader 条目 id（bundle.patch.yml 的 id = 包名 dsh-message-injector）
 *  - 配置声明：导出 Config schema，可持久化字段一律 .volatile()；
 *    apply(ctx, config) 里经 config.<field>.get() 读实时值
 *  - 写入：ctx.get('settings')?.update(条目 id, patch)（正常写入由前端 configForms 发起）
 *  - 自绘配置卡（前端 plugins.bundle.config）→ settings.configure({ auto: false })
 *  - 结构校验：0.2.0 无 per-namespace validate 钩子；schema 兜住结构底线，
 *    跨字段硬校验（组名唯一/内容非空）由前端配置卡保存前拦截（见 docs/zh/架构.md）
 *  - 自动反选（F6-6）：不能在 loader/volatile-update 回调里回写（HMR 事务嵌套必拒，
 *    见 apply 内注释）——改由前端保存时原子清理 + 消费侧守卫
 *  - 一次性导入 0.1.x 的 $DSH_HOME/settings.yaml(.imported) 中 message-injector 段落
 *
 * 需求：docs/zh/需求.md（F1 / F3 / F6）
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { PresetGroup, PresetConfig } from '../shared/types'

/** 领域类型（唯一来源 src/shared/types.ts；此处 re-export 保持对外接口不变） */
export type { PresetGroup, PresetConfig }

const presetGroupSchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  content: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
})

export const Config = z.object({
  groups: z.array(presetGroupSchema).default([]).volatile(),
  /** 当前选中组名称；空字符串 = 未选中（F3） */
  selected: z.string().default('').volatile(),
})

export const name = 'dsh-message-injector'

/** volatile 字段在 apply 中是只读引用（schemastery Volatile），读取一律 .get() */
interface VolatileLike<T> {
  get(): T
}

interface RuntimeConfig {
  groups: VolatileLike<PresetGroup[]>
  selected: VolatileLike<string>
}

/** settings 服务（dsh 0.2.0 SettingsForms 的防御式形状；只用 describe/update） */
interface SettingsLike {
  describe(): { ns: string; user?: unknown }[]
  update(ns: string, patch: object, expectedRevision?: number): Promise<void>
}

/** Loader 条目（取本条目的 id；0.2.0 的 settings 命名空间即条目 id） */
interface FiberLike {
  entry?: { options?: { id?: unknown; name?: unknown } }
}

interface LoaderLike {
  entries(): Iterable<{ options?: { id?: unknown; name?: unknown }; fiber?: unknown; disabled?: unknown }>
  await?(): Promise<unknown>
}

/**
 * 本条目的 Loader 条目 id（= settings 命名空间 = 前端 configForms 的 entryId）。
 * 优先取 ctx.fiber.entry（loader 增补）；兜底按包名反查 loader 条目（参考 dsh-better-sidebar 的 ownEntryId）。
 */
function ownEntryId(ctx: Context): string | undefined {
  const fiber = (ctx as unknown as { fiber?: FiberLike }).fiber
  const direct = fiber?.entry?.options?.id
  if (typeof direct === 'string' && direct !== '') return direct
  try {
    const loader = (ctx as unknown as { loader?: LoaderLike }).loader
    if (!loader || typeof loader.entries !== 'function') return undefined
    let fallback: string | undefined
    for (const entry of loader.entries()) {
      const id = entry.options?.id
      if (entry.options?.name !== name || typeof id !== 'string' || id === '') continue
      if (entry.fiber === fiber) return id
      if (entry.disabled !== true && fallback === undefined) fallback = id
    }
    return fallback
  } catch {
    return undefined
  }
}

function settingsOf(ctx: Context): SettingsLike | undefined {
  try {
    return ctx.get('settings') as SettingsLike | undefined
  } catch {
    return undefined
  }
}

// ─── 旧数据一次性导入（0.1.x → 0.2.0 迁移）─────────────────────────────
// 0.1.x 把预设组存在 $DSH_HOME/settings.yaml 的 message-injector 段落；
// 0.2.0 启动时该文件被重命名为 settings.yaml.imported，且官方只自动迁移内建段落。
// 仅在条目 user 层为空时导入，绝不覆盖升级后的修改；重复执行是 no-op。

const LEGACY_SECTION = 'message-injector'
const LEGACY_FIELDS = new Set(['groups', 'selected'])

async function readLegacySection(home: string): Promise<Record<string, unknown> | undefined> {
  for (const filename of ['settings.yaml.imported', 'settings.yaml']) {
    let text: string
    try {
      text = await readFile(join(home, filename), 'utf8')
    } catch {
      continue
    }
    let document: unknown
    try {
      document = parse(text)
    } catch {
      continue
    }
    if (typeof document !== 'object' || document === null || Array.isArray(document)) continue
    const section = (document as Record<string, unknown>)[LEGACY_SECTION]
    if (typeof section !== 'object' || section === null || Array.isArray(section)) continue
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(section)) {
      if (LEGACY_FIELDS.has(key)) filtered[key] = value
    }
    if (Object.keys(filtered).length > 0) return filtered
  }
  return undefined
}

async function importLegacyConfig(ctx: Context, settings: SettingsLike, entryId: string): Promise<void> {
  try {
    const home = (ctx as unknown as { profileContext?: { home?: string } }).profileContext?.home
    if (typeof home !== 'string' || home === '') return
    const row = settings.describe().find((candidate) => candidate.ns === entryId)
    if (row === undefined) return
    const user = row.user
    if (user !== null && typeof user === 'object' && Object.keys(user).length > 0) return
    const section = await readLegacySection(home)
    if (section === undefined) return
    await settings.update(entryId, section)
  } catch {
    // 导入失败不影响插件运行（用户可手动重建预设）
  }
}

// ─── 插件入口 ───────────────────────────────────────────────────────────

export function apply(ctx: Context, config: RuntimeConfig) {
  // F6-6 自动反选说明（0.2.0）：
  //  不能在 loader/volatile-update 回调里 settings.update 回写 selected——该事件在 HMR
  //  事务内同步触发，嵌套 runExclusive 必被拒（"HMR transactions cannot be nested"）。
  //  现在的实现位置：前端配置卡保存时与 groups 同一次 mutate 原子清理（见 PresetConfigCard.save），
  //  消费侧（选择器/注入轮询）另有兜底守卫：selected 指向不存在/禁用的组时不注入、不显示选中。

  ctx.inject(['settings'], (sctx) => {
    // 本插件自带配置卡（前端 plugins.bundle.config）→ 关掉官方自动生成的设置页
    try {
      sctx.effect(() => {
        const face = settingsOf(sctx) as (SettingsLike & {
          configure?: (presentation: { auto?: boolean }, owner?: unknown) => () => void
        }) | undefined
        const dispose = face?.configure?.({ auto: false }, ctx.fiber)
        return () => { dispose?.() }
      }, 'dsh-message-injector: settings presentation')
    } catch {
      // 服务形态不符：跳过，不影响其余能力
    }

    const entryId = ownEntryId(ctx)
    if (entryId === undefined) return
    const settings = settingsOf(ctx)
    if (settings === undefined) return
    // 等 Loader 队列就绪后再导入（确保 describe() 能看到本条目）
    try {
      const loader = (ctx as unknown as { loader?: LoaderLike }).loader
      Promise.resolve(loader?.await?.()).then(
        () => importLegacyConfig(ctx, settings, entryId),
        () => importLegacyConfig(ctx, settings, entryId),
      )
    } catch {
      void importLegacyConfig(ctx, settings, entryId)
    }
  })
}
