# 贡献指南

[English](CONTRIBUTING.md) · **简体中文**

欢迎修复问题、改进文档和翻译。较大的交互改动或新型号适配，请先提交 Issue，说明要解决的问题及已有资料。

## 报告问题

使用[问题反馈表单](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml)，按提示提供：

- 键盘型号与固件版本。
- 操作系统、浏览器及版本。
- 复现步骤、预期结果和实际结果。
- 页面中的错误提示；读取失败时可查看「操作记录」。

配置和读取诊断可能包含设备信息。不要直接提交私人配置或完整读取样本；优先提供错误文字和复现步骤。

改进想法和新型号适配可使用[功能建议表单](https://github.com/cbingb666/niz-web/issues/new?template=feature-request.yml)。表单字段使用英文；不适合模板的内容仍可使用空白 Issue。

## 开发环境

按 [README](README.zh-CN.md) 克隆并启动项目。使用 Node.js 24 和 pnpm 11.0.1，与 CI 保持一致；也支持 Node.js 22.13+ 的 22.x 版本，完整范围见 [package.json](package.json)。

`package.json` 固定 pnpm 版本，只维护 `pnpm-lock.yaml`，不要生成 npm、Yarn 或 Bun 锁文件。包管理器检查会拒绝其他安装器，npm 还会通过 `devEngines` 拒绝安装和运行命令。CI 使用 `pnpm install --frozen-lockfile` 安装依赖。

开发地址为 <http://127.0.0.1:5173>。开发服务只提供网页和热更新，不代理 USB。没有键盘时，可在设备管理空状态或连接引导点击「离线演示」，在下一页选择型号，再点击「开始演示」检查界面。

项目使用 React、TypeScript strict、Vite、Zustand 和 shadcn/ui。模块入口及硬件协议约束见[架构说明](docs/architecture.zh-CN.md)。

### 固件子模块

[niz-firmware](https://github.com/cbingb666/niz-firmware) 以 Git 子模块的形式放在 `niz-firmware/`，包含由独立仓库维护的固件研究与重建源码。运行和构建 Web 应用不需要初始化它。

克隆或拉取项目后，执行以下命令获取本仓库记录的子模块版本：

```sh
git submodule update --init --recursive
```

首次克隆也可使用 `git clone --recurse-submodules https://github.com/cbingb666/niz-web.git`。固件开发请遵循子模块自身的 README。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm run dev` | 启动本地开发服务 |
| `pnpm run typecheck` | 检查 TypeScript 类型 |
| `pnpm run lint` | 检查代码和未处理的 Promise |
| `pnpm test` | 运行一次全部测试 |
| `pnpm run test:watch` | 监听变更并运行测试 |
| `pnpm run build` | 类型检查并构建独立网页 |
| `pnpm run preview` | 预览已有构建产物 |
| `pnpm run check` | 类型检查、lint、测试和构建 |

提交代码前运行 `pnpm run check`。仅修改文档时，核对链接、命令与实际行为，并运行 `git diff --check`。

## 校准开发

开发服务器和生产构建均默认提供校准，使用正常的 `pnpm run dev` 或 `pnpm run build` 即可，不需要环境开关。

已开放的 ATOM66 组合为 `0483:522A` 搭配固件 `66EC(S);V1.4.4;V1.0;`，以及 `0483:502A` 搭配固件 `66EC(XRGB)BLe;V1.2.5;V1.0;`。两者均须匹配完整固件及 64 字节配置报文描述，其他组合不能启动校准。默认提供功能不改变验证状态，目前仍没有固件通过实机资格验证。连接只识别设备；校准仍须由用户打开工具并确认「开始校准」。

详见[操作流程和恢复限制](docs/usage.zh-CN.md#按键校准)、[模块行为](docs/architecture.zh-CN.md#校准)和[落地方案](docs/calibration-implementation-plan.zh-CN.md)。每次校准回复暂定 10 秒截止，发送时限为 5 秒；它们是临时失败边界，不是实测设备耗时。FakeHID 测试使用合成回复，真实设备仍需通过明确发起的硬件操作、原厂通信对比、持久化检查和恢复流程验证。

可选校准诊断只保留在内存，由用户主动下载，格式为 `niz-calibration-capture`，不复用配置读取诊断。私人抓包放在项目和构建产物之外，不要用现有配置 replay 命令处理校准记录。

## 修改代码

- 复用 `src/components/ui/` 的基础组件和 `src/styles.css` 的主题令牌。
- 界面文案同时维护 `src/i18n/zh-CN.ts` 与 `src/i18n/en.ts`。按键全名和键帽缩写分别位于 `key-names.ts` 与 `key-labels.ts`。
- 文档以英文为默认版本，中文使用 `*.zh-CN.md`；修改用途、步骤或限制时同步两种语言。Issue 模板仅维护英文。
- 让每一步只有一个主要任务，使用短句、清晰的焦点和持续可见的错误提示。考虑文字阅读障碍、ADHD、键盘操作和减少动态效果偏好。
- 修复行为问题时，增加能复现问题的测试。协议变更需要核对报文往返、型号归属、备份与写后回读；新增型号按[扩展型号流程](docs/architecture.zh-CN.md#扩展型号)处理。

持有私人读取样本时，可以在本地回放：

```sh
pnpm run replay /absolute/path/to/read-capture.json
```

样本应保留在项目外，不进入 Git 或构建产物。原厂软件的收集规则见 [drivers/README.md](drivers/README.md)。

## 提交 Pull Request

说明解决了什么问题、现在会如何表现，以及完成了哪些验证。界面变更可附截图；涉及设备时请写明型号、固件和是否使用了真实键盘。

FakeHID 和 jsdom 测试不能代替真实浏览器与硬件验收。不要将模拟测试结果写成实机验证；当前已测范围和未完成项见 [VALIDATION.md](VALIDATION.md)。

## 构建与静态部署

`pnpm run build` 生成 `dist/index.html` 与 `dist/_headers`。HTML 包含全部运行时脚本、样式、图片和翻译，可独立保存。只将 `dist/` 用于静态托管，不包含源码、测试或 `drivers/`。

`dist/_headers` 提供 `Permissions-Policy: hid=(self)` 等响应头，是否生效取决于托管服务。GitHub Pages 不读取该文件；页面本身另有 CSP `<meta>`。连接设备时使用允许 WebHID 的独立 HTTPS 页面，不要关闭浏览器安全限制。

保留 `vite.config.ts` 的 `base: './'`，让产物适用于仓库子路径、站点根路径和离线 HTML。应用内页面切换使用 `#/connect`、`#/demo`、`#/demo/atom68` 等 hash 路由，网址路径不变，因此 Pages 和独立 HTML 无需配置 SPA 路由回退。

### GitHub Pages

仓库提供 [Deploy to GitHub Pages](.github/workflows/deploy-pages.yml) 工作流：推送到 `main` 时自动部署；手动运行其他分支只检查和构建。

为自己的 fork 启用 Pages：

1. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，参见 [GitHub 设置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
2. 推送到 `main`，或在 Actions 中手动运行该工作流并选择 `main`。
3. 等待 `build` 和 `deploy` 成功，使用部署任务给出的地址。

工作流使用 Node.js 24、`pnpm install --frozen-lockfile` 和 `pnpm run check`，通过后只上传 `dist/`。使用 GitHub 自动提供的令牌，无需配置个人访问令牌、提交构建产物或创建 `gh-pages` 分支。

更换站点网址后，需要重新授权键盘，本地备份也不会自动迁移。
