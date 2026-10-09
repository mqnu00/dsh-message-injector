/**
 * dsh 插件前端最小骨架（组合根：只做接线；dsh 0.2.0 模型）
 *
 * 目录约定（与 dsh-message-injector 仓库一致）：
 *  - types/     类型定义（ScopeLike/ConfigFormLike/RootCtx 等防御式服务类型）
 *  - api/       数据访问（如 api/skills.ts：remote.skills.list + 缓存 / 当前会话定位）
 *  - services/  业务服务（有生命周期/持续动作，如自动注入轮询——按需添加）
 *  - logic/     纯业务逻辑（无副作用，如 logic/index.ts 的 formatCount）
 *  - locales/   文案词典（zh/en）
 *  - utils/     通用工具（scroll.ts / css.ts / signal.ts / navigation.ts）
 *  - components/ UI 组件（ConfigCard.tsx 官方配置卡壳）
 *
 * 完整功能参考：dsh-message-injector 仓库的 src/client/index.tsx——
 *  - 500ms 轮询注入、注入守卫、技能存在性校验、设置直达（选择器菜单 → 插件详情页）
 *
 * dsh 0.2.0 数据读取：
 *  - ctx.configForms.get(条目id) → ConfigForm（稳定快照 + subscribe + set/mutate）
 *  - useSyncExternalStore 必须箭头函数包裹，getSnapshot 直接透传稳定快照
 *    （裸传方法丢 this；每次 new 对象会无限重渲染——坑 7）
 */
import { useSyncExternalStore } from 'react'
import type { RootCtx, ScopeLike } from './types'
import { dict } from './locales'
import { formatCount } from './logic'
import { openBundlePage } from './utils/navigation'
import { ConfigCard } from './components/ConfigCard'

/** 条目 id：= 包名 = cordis.patch.yml 的 insert id = 0.2.0 settings 命名空间 */
export const NS = 'dsh-hello-plugin'

export const inject = ['slots', 'locale', 'configForms'] as const

// ─── 组件：Plugins 页 bundle 详情里的配置卡（plugins.bundle.config 槽）─────
// 通用配置卡壳（官方样式 + 折叠标题栏 + 放弃/保存脚注）来自 components/ConfigCard.tsx；
// 字段样式类（psi-field / psi-head / psi-label / psi-hint 等）随 ConfigCard 一并注入
function HelloCard({ scope, t }: { scope: ScopeLike<{ count: number }>; t: (key: string) => string }) {
  // 坑 7：必须用箭头函数包一层（丢 this）；getSnapshot 直接透传官方稳定快照
  const snap = useSyncExternalStore(
    (listener: () => void) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const count = snap.status === 'ready' ? snap.value?.count ?? 0 : 0
  const writable = snap.writable !== false
  return (
    <ConfigCard
      title="Hello"
      description={t('desc')}
      dirty={false}
      saving={false}
      invalid={!writable}
      onSave={() => {}}
      onDiscard={() => {}}
      labels={{ save: t('save'), discard: t('discard') }}
    >
      <div className="psi-field">
        <div className="psi-head">
          <span className="psi-label">{t('count')}</span>
        </div>
        <p className="psi-hint">{formatCount(count)}</p>
      </div>
    </ConfigCard>
  )
}

// ─── 插件入口 ───────────────────────────────────────────────────────────
export function apply(ctx: RootCtx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, dict), 'hello: dictionaries')

    const form = ctx.configForms.get<{ count: number }>(NS)
    const scope: ScopeLike<{ count: number }> = {
      getSnapshot: () => form.getSnapshot(),
      subscribe: (listener: () => void) => form.subscribe(listener),
      set: (field: string, value: unknown) => form.set(field, value),
      // 多字段一致性（如"保存 A 时顺带清理 B"）必须放进同一次 mutate 原子提交——
      // 不要指望在宿主 loader/volatile-update 回调里回写（HMR 事务嵌套必拒，坑 17）
      mutate: (ops) => form.mutate(ops),
    }

    // 配置卡：Plugins 页 bundle 详情（key = 包名）；宿主服务该命名空间后才注册
    ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('plugins.bundle.config', () =>
      ctx.slots.register({
        name: 'plugins.bundle.config',
        key: NS,
        locale: NS,
        inject: () => ({ scope }),
      }, HelloCard),
    )), 'hello: bundle config card')

    // 「打开我的配置页」：官方导航服务（缺失时降级，见 utils/navigation.ts）
    void openBundlePage

    // 写数据一律 form.set/mutate（返回 boolean：false = 被拒绝/只读；传输错误才 reject）：
    // const accepted = await scope.set('count', count + 1)
  } catch (e) {
    console.error('[dsh-hello-plugin] client apply FAILED:', e)
    throw e
  }
}
