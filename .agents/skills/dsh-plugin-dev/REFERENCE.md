# REFERENCE — dsh 插件开发速查（自包含）

> 与 SKILL.md 配套的详细参考：踩坑速查、术语表、关键代码片段、FAQ。
> 本文件自包含，不依赖任何仓库路径，可随技能整体搬迁。

## 1. 踩坑速查（症状 → 根因 → 修复）

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | 研究阶段烧掉 30M+ token | 没先建最小回路就全面深挖源码 | 先 hello world 跑通，再按需深入；优先读官方现成插件当模板 |
| 2 | 以为浏览器能加载 TS 前端 | 浏览器加载器用 `new Function` 执行，不认 TS/JSX | 前端必须 esbuild 预构建为纯 JS（`__ModuleLoader__.load` 形态）；JSX 必须写在 `.tsx` |
| 3 | 宿主加载成功但 UI 永不出现 | insert 的 name 指向 `.ts` 文件，`require.resolve(<name>/package.json)` 探测失败 | name 指向**包根目录**（含 package.json 的目录） |
| 4 | cordis.yml 要写绝对路径 | `--patch` 本地加载天生如此 | 放弃 `--patch`，只走官方 `dsh plugin add/remove`；仓库不维护 cordis.yml |
| 5 | `dsh plugin add` 显示成功但毫无变化 | 缺 `dsh.bundle` 声明，被当普通依赖装（安装输出有警告） | 三声明齐活：`dsh.bundle.patch` + `exports["./client"]` + 入口；装后查 bundles 列表 |
| 6 | `ctx.logger?.info('loaded')` 静默无效 | cordis 4.x 的 `ctx.logger` 是服务工厂 | `ctx.logger('名字')` 拿实例，或直接用 `console.log` |
| 7 | UI 渲染崩溃 `reading 'store'` of undefined | `useSyncExternalStore(scope.subscribe, scope.getSnapshot)` 裸传方法丢 this | 箭头函数包裹：`useSyncExternalStore((cb) => scope.subscribe(cb), () => scope.getSnapshot())`；getSnapshot 必须**直接透传稳定快照**（每次 new 一个对象会触发无限重渲染） |
| 8 | 每条消息重复注入技能，token 滚雪球 | 技能是**会话级激活**的，重复注入无去重 | 技能调用行只注入一次；普通文本每条带没问题（定位转折点） |
| 9 | git 事故三连 | `.pnpm-store`（33MB 缓存）被 add -A 误提交；amend 时 index 状态混乱 | `.gitignore` 加 `.pnpm-store/`；提交前 `git status`；soft reset 找回内容（不动工作区） |
| 10 | 开源前发现绝对路径/真实姓名/邮箱在历史里 | 未做隐私审计 | 扫绝对路径/用户名/邮箱/IP；git 作者匿名化（noreply）；`reflog expire` + `gc --prune=now`；`git fsck` 验证 |
| 11 | README 越写越长、术语混乱 | 文档组织无规划 | README 精简为门面页，细节拆 docs/zh + docs/en；术语统一"前端/后端" |
| 12 | `require("@deepseek-ai/dsh-client-store")` 报 missed the module table | **基线版本错位**：包在 master 基线里有，装的版本没有（0.1.1-rc.2 时期） | 开发前先确认 harness 版本与官方支持面；0.2.0 起 store 与 configForms 已随 web app 发布，可直接用 |
| 13 | 0.2.0 上插件拖垮整个 web：宿主 `sctx.settings.register is not a function`、前端 `pending (waiting for service: settingsScope)`、页面停在 `Failed to load plugins` | 0.2.0 **settings 架构重构**：`installSettingsSection`/`settingsNamespace`/`settingsScope`/`settings.plugin.item` 全删，改为「Loader 条目 id 命名空间 + `.volatile()` 字段 + `configForms` + `plugins.bundle.config`」 | 按新版模型整体迁移（见 §3.3-3.5 与官方对照.md）；旧 helper 不能留"兼容分支"（0.2.0 上模块链接期就坏） |
| 14 | 满屏 `Module "x" has no exported member ...`，连无关代码都报错 | 把 `declare module '真模块'` 写在了**没有 import/export 的 .d.ts**（全局脚本）里——它成了"环境模块声明"，直接遮蔽真模块的全部导出 | 模块增强必须写进**模块文件**（加 `import type {} from 'x'` 或 `export {}`）；给不存在类型的内置模块写桩则相反，放全局脚本 .d.ts |
| 15 | `pnpm install` 卡死/超时，日志在拉整个 dsh（含几百 MB wasm 包） | pnpm 默认 `autoInstallPeers: true`，把 `peerDependencies` 里的 `@deepseek-ai/dsh` 真装下来 | `pnpm-workspace.yaml` 设 `autoInstallPeers: false`（与 dsh profile 一致）；peers 照留（启动门禁按它判断兼容性） |
| 16 | `ctx.effect(() => service?.configure?.(...))` 编译报 `TS2769` | cordis 4 的 Effect 只接受 `Disposable | Iterable<Disposable>`，不接受 undefined | 回调统一 `return () => { d?.() }` |
| 17 | 自动反选/自愈写配置静默失效（`.catch` 吞了 `HMR transactions cannot be nested`） | `loader/volatile-update` 在 HMR 写事务内**同步**触发，回调里再 `settings.update` → 嵌套 `runExclusive` 必被拒（ALS 上下文还会随异步资源传播，延后也逃不掉） | 回写放在**写入方**：把相关字段放进**同一次 `form.mutate([...])`** 原子提交；消费侧对失效数据加守卫。**任何"配置变更后再改配置"的侦听器都要先问：是不是在写事务里？** |
| 18 | 槽位组件渲染即崩：“Element type is invalid” | 0.2.0 primitives 图标名换代：`Icon*OutlineRegular/Medium`（旧的 `Icon*Outline14/16` 全部不存在；拿 `any` 类型桩时 tsc 也查不出） | 升级时先核对真包导出清单（`grep -o "Icon[A-Za-z0-9]*" node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js \| sort -u`），或直接加 primitives 的 devDependency 用真类型 |

## 2. 术语表

| 术语 | 含义 |
|---|---|
| host half / client half | dsh 官方叫法，即**后端 / 前端**（本项目文档统一用后者） |
| bundle（组合包） | 附带一个配置层的 npm 包，manifest 声明 `dsh.bundle`，回答"这个包贡献什么" |
| profile | `$DSH_HOME/profiles/<name>` 下的可启动组合目录，manifest 声明 `dsh.profile.bundles` |
| `dsh.bundle.patch` | package.json 里指向 patch 文件的字段，安装时挂载为 profile 层；**patch 里 insert 的 id = 0.2.0 settings 命名空间** |
| `exports["./client"]` | 前端产物约定子路径，dsh 找浏览器代码就认它（`lib/client.js`） |
| `dsh.client.inject` | package.json 里的**包名清单**（informational，影响客户端模块到达顺序），**不是** Cordis 服务注入 |
| `dsh.client.platform` | 客户端声明，取 `"web"` |
| PLATFORM_MODULES | shell 冻结模块表（react、cordis、ui-primitives…），插件 bundle 的 external 引用从这里解析 |
| `apply(ctx, config)` | 插件启动函数；导出 `Config`（schemastery）时第二参收到解析后的配置（`.volatile()` 字段为 `Volatile` 引用，用 `.get()` 读） |
| `inject` | 运行时依赖服务声明（前端代码里的 `export const inject = [...]`），框架保证就绪后才加载插件 |
| `ctx.effect()` | 手动资源（定时器、订阅）注册，卸载时执行返回的清理函数；**回调必须返回 disposer** |
| volatile 字段 | 0.2.0 配置模型里对 `Config` 字段的 `.volatile()` 声明——只有 volatile 字段会出现在设置表单/可被写入 |
| `loader/volatile-update` | 0.2.0 配置变更事件（按 fiber 派发，只发给条目自身），用于响应配置热更新 |
| ConfigForm / `ctx.configForms` | 0.2.0 浏览器侧配置读写门面：`get(条目id)` → `{getSnapshot, subscribe, set, unset, mutate}`；`set` resolve false = 拒绝/只读 |
| `plugins.bundle.config` 等槽 | 0.2.0 插件管理的 UI 槽（Plugins 页）：bundle 详情 / 行详情 / 列表卡片；旧 `settings.plugin.item` 已删 |
| `__ModuleLoader__.load` | 前端 bundle 的浏览器端标准包装形态 |
| `--dump-config` | 官方离线验证命令：`dsh --profile <name> --dump-config` 打印各层配置 |

## 3. 关键代码片段

### 3.1 配置读取（0.2.0：ConfigForm → useSyncExternalStore）

```tsx
// 入口接线：const form = ctx.configForms.get<PresetConfig>(条目id)（条目id = patch 里的 id = 包名）
// 组件里：必须箭头函数包裹（丢 this），getSnapshot 直接透传稳定快照（重建对象 = 无限重渲染）
const snap = useSyncExternalStore(
  (listener: () => void) => scope.subscribe(listener),
  () => scope.getSnapshot(),
)
const config = snap.status === 'ready' ? snap.value : undefined
// 写入：set 返回 boolean（false = 宿主拒绝/只读；传输错误才 reject）
const accepted = await scope.set('groups', next)
```

### 3.2 显示配置卡（0.2.0：plugins.bundle.config 槽）

```tsx
// key = 包名；宿主服务该命名空间后才注册（whileServed 门控，避免空卡）
ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('plugins.bundle.config', () =>
  ctx.slots.register({ name: 'plugins.bundle.config', key: NS, locale: NS, inject: () => ({ scope }) }, Card),
)), 'label')
```

### 3.3 后端配置声明与变更（0.2.0：volatile 模型）

```ts
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  groups: z.array(groupSchema).default([]).volatile(),
  selected: z.string().default('').volatile(),
})

export function apply(ctx: Context, config: { groups: Volatile<Group[]>; selected: Volatile<string> }) {
  ctx.on('loader/volatile-update', () => { /* 配置已提交，此时 .get() 读到新值 */ })
  ctx.inject(['settings'], (sctx) => {
    // 自绘配置页（否则官方会在 Plugins 页自动生成一份表单）
    sctx.effect(() => {
      const d = sctx.get('settings')?.configure?.({ auto: false }, ctx.fiber)
      return () => { d?.() }
    }, 'label')
  })
}
```

### 3.4 取本条目 id 与旧数据导入（0.2.0）

```ts
// 条目 id：优先 ctx.fiber.entry?.options.id；兜底遍历 ctx.loader.entries() 按包名反查（见 dsh-better-sidebar）
// 旧数据（0.1.x 的 $DSH_HOME/settings.yaml 命名空间抽屉）：0.2.0 启动时被改名 settings.yaml.imported，
// 官方只迁移内建段落；插件自建一次性导入（仅在条目 user 层为空时写，绝不覆盖新配置）：
const row = settings.describe().find((c) => c.ns === entryId)
if (!row.user || Object.keys(row.user).length === 0) await settings.update(entryId, legacySection)
```

### 3.5 「打开我的配置页」导航（0.2.0）

```ts
// 官方导航服务：切 Plugins 面板 + 打开本包详情（配置卡就在详情页）
ctx.get('pluginNavigation')?.openBundle?.(包名)
// 降级：ctx.get('layout')?.selectPanel?.('plugins')（只到列表）→ DOM 兜底 li[data-plugin-package]
```

### 3.6 构建要点（build.mjs）

- 后端：esbuild `format: 'esm'`，`@deepseek-ai/schemastery`（及 `yaml` 等纯 JS 依赖）保持 external。
- 前端：esbuild `format: 'cjs'` + `jsx: 'automatic'`，external：`react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-ui-primitives`；产物包一层 `window.__ModuleLoader__.load({id, factory})`。

## 4. FAQ

**Q：插件怎么工作的？** 后端管配置（`Config` schema + volatile 字段 + 持久化投影），前端管 UI（槽位组件）；两端通过官方服务通信（配置走 `configForms`/settings RPC，技能目录走 `remote.skills` 等）。改代码：只改前端刷新浏览器；改后端或不确定就重启 dsh（后端模块启动时读进内存，不重载）。

**Q：为什么不能直接改输入框 DOM？** 输入框是 React 受控组件，直接改 DOM 不同步 React 状态；必须走官方通道（如 `input.setDraft(text)`，一次事务可撤销）。

**Q：本地安装和 GitHub 安装区别？** 本地路径 = 软链接（改代码 build + 重启即生效）；GitHub = 克隆副本（拉的是源码，如含构建步骤需 `prepare` 脚本 + pnpm `allowBuilds` 授权，且建议锁定 commit；或发布 npm / 交付 `pnpm pack` tarball 免构建权限）。详见官方对照.md。

**Q：为什么不用 `--patch`？** 它要绝对路径（开源泄露隐私）。`--patch` 是官方教程的开发 overlay，`dsh plugin add` 是官方安装路径，本项目统一后者。

**Q：dsh 0.2.0 的 settings 存哪？** 存 profile 补丁 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的「条目 id」段落（由官方 settings 服务与 config-editor 写入），不再是 `$DSH_HOME/settings.yaml`（旧文件会被改名 `settings.yaml.imported`）。

**Q：这些经验对新插件最值钱的是？** 先确认机制再定产品、最小回路先行、三声明缺一不可、开发前确认 harness 版本与官方支持面、**大版本升级先看官方发布说明 + 拿已适配插件当参照**、测试走官方路径由用户执行、产物提交、开源前隐私审计。
