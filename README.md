# dsh-message-injector

> English: [README_EN.md](README_EN.md)

dsh（DeepSeek Harness）插件：预设常用"消息注入内容"组合（任意文本 / 技能调用），**每条消息自动注入**到输入框首行，一键启用、切换、停止——不需要每条消息手动输入固定的指令前缀或格式要求。

> 版本对应：**本版本（v0.2.x）适配 dsh 0.2.0**（插件管理入口随官方改版移动到侧边栏「插件」页）；dsh 0.1.x 用户请安装 [v0.1.0](https://github.com/wf-ping/dsh-message-injector/releases/tag/v0.1.0)。

## 功能

- **预设组管理**：侧边栏「插件（Plugins）」页 → 本插件详情 中增删改查、启用/禁用、组排序、组折叠；官方同款配置卡外观
- **一键选择**：输入框左下角的「预设」选择器，点击选中，再点反选
- **设置直达**：选择器菜单底部「设置」，一键打开本插件配置页并展开配置卡
- **自动注入**：空输入框 ~500ms 自动注入内容（如 `/grill-me /domain-modeling ` 或 "请用中文回答"）
- **技能校验**：以 `/` 开头的内容视为技能调用，缺失时配置卡警告、注入时跳过
- **智能守卫**：输入框已有内容时不注入，绝不打扰已有内容
- **全局持久化**：选择状态跨会话、刷新、标签页保持

## 配置存储位置

预设组与选中状态保存在插件所在的 profile 配置补丁中：**`$DSH_HOME/profiles/<profile>/cordis.patch.yml`**（默认 web profile 即 `~/.dsh/profiles/web/cordis.patch.yml`），条目 `dsh-message-injector`（含 `groups` + `selected`）。跨会话、跨刷新、跨标签页保持；备份/迁移 = 复制该文件（或其中 `dsh-message-injector:` 片段）。**请通过插件界面增删改**，不要手改文件（绕过界面可能破坏格式或校验）。

> 从 0.1.x 升级：旧数据（`$DSH_HOME/settings.yaml` 的 `message-injector` 段落）由插件在首次启动时自动导入（仅在尚未配置时执行一次）。

## 快速安装

```bash
dsh plugin --profile web add github:wf-ping/dsh-message-injector          # 从 GitHub 安装（默认 = 最新，跟随 main）
dsh plugin --profile web add github:wf-ping/dsh-message-injector#v0.2.0  # 固定版本安装（可选）
dsh plugin --profile web add <本仓库路径>                # 本地/开发时安装
```

> 首次安装均无需构建（`lib/` 产物已提交）。详见[安装文档](docs/zh/安装.md)。

## 重新构建

改代码后需要重新生成 `lib/` 并重启生效：

```bash
pnpm install      # 安装运行环境
pnpm build        # 生成产物
dsh web           # 启动服务
```

## 更新

**本地路径安装（软链接）** —— 更新 = 改代码 + 重新构建，无需重装：

```bash
pnpm build        # 重新生成 lib/
# 重启 dsh web 生效
```

**GitHub 安装（克隆副本）** —— 已装副本与本地代码无关，更新需重新拉取：

```bash
dsh plugin --profile web add github:wf-ping/dsh-message-injector    # 重新拉取最新版本
# 重启 dsh web 生效
```

> 若重新 add 后仍未更新，先卸载再重装（见[卸载](#卸载)）。

## 卸载

```bash
dsh plugin --profile web remove dsh-message-injector    # 卸载
# 或在仓库目录内：pnpm uninstall:plugin
```

## 文档

- [安装](docs/zh/安装.md)
- [使用说明](docs/zh/使用说明.md)
- [架构](docs/zh/架构.md)
- [迭代记录](docs/zh/迭代记录.md)
- [更新日志](CHANGELOG.md)

> 开发者：需求文档见 `docs/zh/需求.md`，开发经验（踩坑记录）见 `docs/zh/开发经验.md`，术语表见 `CONTEXT.md`。
