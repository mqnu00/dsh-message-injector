/**
 * dsh 插件后端最小入口（最小回路验证用，dsh 0.2.0 模型）
 *
 * 完整功能参考：dsh-message-injector 仓库的 src/host/index.ts——
 *  - Config schema（schemastery）的 .volatile() 字段（参与配置卡/持久化）
 *  - apply(ctx, config) 里 config.<字段>.get() 读实时值
 *  - loader/volatile-update 变更响应、settings.configure 自绘配置页
 *  - 旧数据一次性导入（settings.yaml.imported）
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-hello-plugin'

/** 配置声明：只有 .volatile() 字段会出现在配置表单/可被写入；命名空间 = Loader 条目 id */
export const Config = z.object({
  count: z.number().default(0).volatile(),
})

/** volatile 字段在 apply 中是只读引用，读取一律 .get() */
interface RuntimeConfig {
  count: { get(): number }
}

export function apply(ctx: Context, config: RuntimeConfig) {
  // 最小回路验证：用户安装 + 重启 dsh 后，终端应打印此行
  console.log('[dsh-hello-plugin] plugin loaded! count =', config.count.get())

  // 配置变更（用户在配置卡保存后）：按 fiber 派发，只发给本条目。
  // ⚠️ 此事件在 HMR 写事务内同步触发：只读/记录可以，**千万别在这里再 settings.update**
  //    （嵌套事务必被拒 "HMR transactions cannot be nested"，坑 17）；
  //    需要"配置变更后再改配置"，请放到写入方同一次 mutate 里做。
  ctx.on('loader/volatile-update', () => {
    console.log('[dsh-hello-plugin] config updated, count =', config.count.get())
  })

  // 自绘配置页时声明（否则官方会在 Plugins 页自动生成一份表单）
  ctx.inject(['settings'], (sctx) => {
    sctx.effect(() => {
      // cordis 4 的 effect 回调必须返回 disposer（坑 16）
      const dispose = (sctx.get('settings') as { configure?: (p: { auto?: boolean }, owner?: unknown) => () => void } | undefined)
        ?.configure?.({ auto: false }, ctx.fiber)
      return () => { dispose?.() }
    }, 'dsh-hello-plugin: settings presentation')
    // 写入示例（正式写由前端 configForms 发起；后端也可：）：
    // void (sctx.get('settings') as any)?.update(ctx.fiber.entry?.options.id, { count: 1 })
  })

  // 通过 ctx 注册的资源卸载时自动清理；需手动清理的（定时器/订阅/连接）用 ctx.effect()
  // ctx.effect(() => { const t = setInterval(...); return () => clearInterval(t) })
  // 类型桩注意：给真模块补声明（模块增强）必须放在有 import/export 的 .d.ts 里（坑 14）；
  // 给 node 内置模块写桩则放在无 import/export 的全局 .d.ts 里。
  // 注意：ctx.logger 是服务工厂，直接 .info 静默无效（坑 6）——用 console.log
}
