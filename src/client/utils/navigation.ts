/**
 * 插件管理页导航（0.2.0「设置直达」的落点）
 *
 * 0.2.0 起配置卡位于侧边栏 Plugins 页的 bundle 详情（plugins.bundle.config 槽），
 * 旧「设置 → 插件 → 插件配置」入口已随官方设置面板改版移除。
 * 打开顺序（逐级降级，任一步失败静默）：
 *   1. 官方导航服务 ctx.pluginNavigation.openBundle(包名)（切面板 + 打开包详情）
 *   2. ctx.layout.selectPanel('plugins')（只到列表）+ DOM 点击 bundle 卡片
 *   3. DOM：按官方 aria/文案点击侧边栏「插件」入口 + bundle 卡片（100ms×20 重试）
 */
import type { RootCtx } from '../types'

/** 打开 Plugins 页并定位到指定 bundle 的详情页 */
export function openBundlePage(ctx: RootCtx, packageName: string): void {
  if (typeof document === 'undefined') return
  // 1) 官方导航服务
  try {
    const navigation = ctx.get('pluginNavigation') as { openBundle?(name: string): void } | undefined
    if (navigation?.openBundle) {
      navigation.openBundle(packageName)
      return
    }
  } catch {
    // 降级
  }
  // 2) 布局服务：切到 Plugins 面板（视图重置为列表）
  try {
    const layout = ctx.get('layout') as { selectPanel?(id: string): void } | undefined
    layout?.selectPanel?.('plugins')
  } catch {
    // 降级
  }
  // 3) DOM 兜底：点击侧边栏入口 + bundle 卡片
  domOpenBundle(packageName)
}

function domOpenBundle(packageName: string): void {
  if (typeof document === 'undefined') return
  // 侧边栏 Plugins 入口（官方 aria 文案，中英）
  const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('nav button'))
  const entry = navButtons.find((button) => /插件|Plugins/.test(button.getAttribute('aria-label') ?? ''))
  if (entry && entry.getAttribute('aria-current') !== 'page') entry.click()
  // 等列表渲染后点击目标 bundle 卡片（标题按钮；避开行内开关 role="switch"）
  let attempts = 0
  const timer = setInterval(() => {
    attempts += 1
    const card = document.querySelector<HTMLElement>(`li[data-plugin-package="${packageName}"]`)
    if (card) {
      clearInterval(timer)
      card.querySelector<HTMLButtonElement>('button[type="button"]:not([role="switch"])')?.click()
      return
    }
    if (attempts >= 20) clearInterval(timer)
  }, 100)
}
