/**
 * dsh-message-injector — 前端（dsh 官方称 Client half）入口（组合根）
 *
 * dsh 0.2.0 适配要点（settingsScope / settings.plugin.item 均被官方移除）：
 *  - 配置作用域：ctx.configForms.get(条目 id)（ConfigForm）→ 适配为 ScopeLike
 *  - 管理入口：配置卡注册到 Plugins 页 bundle 详情槽 `plugins.bundle.config`
 *    （旧「设置 → 插件 → 插件配置」卡片列表在 0.2.0 已不存在），
 *    用 configForms.whileServed 门控（宿主未服务该命名空间时不注册）
 *  - 技能目录：ctx.remote.skills.list（旧 connection.api.skills 已移除）
 *  - 「设置直达」：ctx.get('pluginNavigation').openBundle(包名)（官方导航服务）
 *
 * 业务实现按职责拆分：
 *  - components/PresetSelector.tsx     预设选择器（conversation.input.left，F2）
 *  - components/PresetConfigCard.tsx   预设组配置卡（plugins.bundle.config，F1）
 *  - components/ConfigCard.tsx         通用配置卡壳（官方样式，可复用）
 *  - services/injector.ts              500ms 轮询自动注入（F4）+ 注入守卫（F5）
 *  - api/skills.ts                     技能目录（remote.skills + 30s TTL 缓存）
 *  - logic/index.ts                    领域纯逻辑（归一化/技能行判定）
 *  - locales/index.ts                  词典（zh/en）
 *  - utils/                            滚动（scroll）、CSS 注入（css）、一次性信号（signal）、
 *                                      会话定位（session）、插件页导航（navigation）
 *
 * 本文件由 scripts/build.mjs 预构建为 lib/client.js（window.__ModuleLoader__.load 形态），
 * 浏览器端无 TS 编译。
 */
import type { ConfigPathOp, RootCtx } from './types'
import type { PresetConfig } from '../shared/types'
import { dict } from './locales'
import { createOneShotSignal } from './utils/signal'
import { openBundlePage } from './utils/navigation'
import { currentSessionId } from './utils/session'
import { fetchKnownSkillNames } from './api/skills'
import { startAutoInject } from './services/injector'
import { PresetSelector } from './components/PresetSelector'
import { PresetConfigCard } from './components/PresetConfigCard'

/** 条目 id（= 包名 = bundle.patch.yml 的 id = 0.2.0 settings 命名空间） */
export const NS = 'dsh-message-injector'

export const inject = ['slots', 'locale', 'sessions', 'configForms', 'remote', 'remote.skills'] as const

// ─── 设置直达：选择器菜单「设置」→ 打开 Plugins 页的 bundle 详情并展开配置卡 ───
// 0.2.0 官方导航服务 pluginNavigation.openBundle（切 Plugins 面板 + 打开包详情页）；
// 展开用一次性信号（utils/signal.ts）：已挂载立即展开；未挂载挂起、挂载即消费。
// 全程优雅降级：任一步失败 = 用户手动补一步，不报错。
const cardExpand = createOneShotSignal()

function openCardPage(ctx: RootCtx) {
  cardExpand.request()
  openBundlePage(ctx, NS)
}

// ─── 插件入口 ───────────────────────────────────────────────────────────
export function apply(ctx: RootCtx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, dict), 'message-injector: dictionaries')

    // 配置作用域：预设组 + 选中状态（F3；0.2.0 由 ConfigForm 直接提供稳定快照）
    const form = ctx.configForms.get<PresetConfig>(NS)
    const scope = {
      getSnapshot: () => form.getSnapshot(),
      subscribe: (listener: () => void) => form.subscribe(listener),
      set: (field: string, value: unknown) => form.set(field, value),
      mutate: (ops: readonly ConfigPathOp[]) => form.mutate(ops),
    }

    // F2 预设选择器：输入框左下角官方座位（conversation.input.left，additive list 槽）
    ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
      name: 'conversation.input.left',
      id: 'message-injector-preset-selector',
      order: 100,
      locale: NS,
      inject: () => ({ scope, onOpenSettings: () => openCardPage(ctx) }),
    }, PresetSelector))

    // F1 配置卡：Plugins 页 bundle 详情槽（key = 包名）；宿主服务该命名空间后才注册
    ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: NS,
      locale: NS,
      inject: () => ({
        scope,
        expandSignal: cardExpand,
        fetchKnownSkillNames: () => {
          const sessionId = currentSessionId(ctx)
          if (!sessionId) return Promise.resolve(null)
          return fetchKnownSkillNames(ctx, sessionId)
        },
      }),
    }, PresetConfigCard))), 'message-injector: bundle config card')

    // F4/F5 自动注入轮询（500ms，用户拍板的实现方案）
    ctx.effect(() => startAutoInject(ctx, scope), 'message-injector: auto-inject polling')
  } catch (e) {
    console.error('[dsh-message-injector] client apply FAILED:', e)
    throw e
  }
}
