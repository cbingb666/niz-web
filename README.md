# ATOM66 Web

ATOM66 配置工具的纯 Web 移植测试版。浏览器通过 WebHID 直接访问键盘的 USB 配置接口：没有本地 USB 中转程序、后端服务或云端配置存储。界面采用 React + TypeScript（strict）+ Vite + shadcn/ui，应用状态由 Zustand 管理；所有运行时代码随网页打包，不使用 CDN。目前仅保留 Web 版作为在用版本，源码位于项目根目录；官方原版软件按型号统一收集在 `drivers/`。

## 目录结构

```text
.
├── drivers/             # 官方原版驱动 / 配置软件，仅作参考
├── src/
│   ├── components/      # React 界面，ui/ 为 shadcn 源码组件
│   ├── store/           # Zustand 应用状态、操作与 React 订阅
│   ├── i18n/            # 中英文文案、按键名称与语言偏好
│   ├── types/           # WebHID 配置接口类型
│   ├── lib/             # 浏览器环境、下载与样式工具
│   ├── protocol.ts     # 报文解析与配置模型
│   ├── hid.ts          # 设备通信、连接状态与写入保护
│   ├── editor.ts       # 独立于 React 的编辑模型
│   ├── storage.ts      # IndexedDB 事务备份
│   ├── legacy.ts       # Windows .pro 转换
│   └── model-tools.ts  # 可选 WebMCP 页面工具
├── scripts/             # 单文件构建插件与私人样本回放
├── tests/               # Vitest：协议、状态、React 交互与产物测试
├── .openai/hosting.json # Sites 配置，发布目录为 dist
├── components.json      # shadcn/ui 配置
├── index.html           # Vite 页面入口
├── package-lock.json    # npm 依赖锁文件
└── dist/index.html      # 构建生成的独立网页
```

后续型号的官方软件放入 `drivers/<型号>/`，同一型号有多个版本时再按版本或日期分目录，具体约定见 [drivers/README.md](drivers/README.md)。此目录只收集原始资料，不意味着网页已经支持相应型号；当前协议实现仍针对 ATOM66。

原 `web/` 的文件（包括隐藏配置）已全部迁至根目录。原生 Mac 版、旧归档和交付 ZIP 不属于当前项目内容。

## 打开与连接

成品是 `dist/index.html`，所有代码与样式均包含在这一个文件中。

1. 用支持 WebHID 的桌面版 Chrome 或 Edge 打开。若默认浏览器不支持，请使用浏览器的“打开文件”选择此文件。离线演示、导入和编辑不需要连接键盘。
2. USB 连接和本地备份需要浏览器允许当前页面来源。正式使用推荐将 `dist/` 部署到 HTTPS 静态托管；直接打开 `file://` 时的权限取决于浏览器实现，未做实机确认。页面会显示环境检查结果。Safari 不提供此页面所需的 WebHID 接口时，只能使用离线功能。
3. 先退出其他 ATOM66 配置工具，再连接 USB 数据线。首次点击“连接键盘”，在浏览器弹窗中选中设备。网页不能跳过首次用户授权。
4. 对已授权、可用且唯一的 ATOM66 配置接口，页面会自动尝试连接、读取固件版本和全部配置，并保存本地备份；无需再点读取。首次授权连接成功后和插拔重连后也会执行。检测到多把键盘时需手动选择；主动断开后暂停自动连接。
5. 自动读取每次连接只尝试一次，失败后不会循环读取，可点“重新读取配置”重试。连接状态与配置解析状态是分开的；配置解析失败不会误报为没有连接键盘。如果编辑区已有未写入修改、未保存输入或离线导入，自动读取会保留编辑内容，并提示手动重新载入；不会静默丢失修改。
6. 编辑并保存修改后，点击“写入键盘”，核对确认弹窗。设备会被再次读取，确认没有外部改动；本地备份事务完成后才开始写入，最后回读验证。

浏览器要求与授权机制参考 [Chrome 官方 WebHID 文档](https://developer.chrome.com/docs/capabilities/hid)。不要通过关闭浏览器安全限制来解决连接问题。嵌入页面可能被 `Permissions-Policy` 阻止，应使用允许 `hid=(self)` 的独立 HTTPS 页面。

## 已移植功能

- 66 键布局；普通层、右 Fn 层、左 Fn 层。
- 单键、同时组合键、连发、固定次数 / 按住 / 再次按下停止三种宏；统一间隔或逐步延迟。
- 可分配原厂多媒体、鼠标、灯效、模式切换等功能码。Fn 赋值会同步三个可编辑层，写入前检查 Fn 一致性且至少保留一个 Fn。
- RGB 型号逐键颜色与全部按键颜色；读取 66 个按键计数。
- 导入原生版 JSON 和 Windows `.pro`；导出兼容原生版的完整 JSON；IndexedDB 本地备份、备份下载与导入。
- 支持完整三组或九组配置。V1.4.4 九组共 594 条，界面仅编辑前三组；其余六组原始报文保留，读写校验逐字节比较扩展组。三组文件导入已读取的九组键盘时补入设备原有扩展组，不将其清空。
- 读取诊断本地下载；异常不会上传。诊断不是可恢复配置，不能直接导入写入。
- 支持页面工具的浏览器可选注册三个 WebMCP 工具：状态、已载入按键读取、批量暂存改键。工具没有 USB 授权或硬件写入能力，写入只能在页面点击确认。

离线导入 / 演示不等于当前设备状态。连接并自动读取当前键盘后，再导入希望写入的文件。不同固件版本的 JSON 不直接跨版本写入。

## 重要边界

这是基于原版 DLL 协议、已有原生移植与真实读取样本的移植测试版，**网页端 USB 授权、读写和 RGB 尚未完成实机验收**。请先只连接、读取、下载备份；确认读取内容正常后再考虑改键。

固件升级、传感器校准、全局宏录制、Windows 驱动安装，以及尚未验证的全局设备参数不在本版中。鼠标、媒体等功能码在不同固件上是否生效仍由键盘决定。

写入不是设备级原子事务。拔线、休眠或设备错误可能导致部分写入；程序不会自动重试或自动回滚，应重新连接、读取并核对，再根据需要导入写入前备份恢复。任何软件校验都不能取代设备实测。

备份属于**当前浏览器、当前来源**。更换网址、浏览器、清除站点数据或浏览器回收存储可能使备份不可用，因此建议额外下载 JSON。网页加载后不上传键盘配置或按键计数，CSP 禁止网络连接；下载的配置 / 诊断可能含设备信息，请自行保管。

## 界面语言

支持简体中文和英文，可在页面右上角切换。优先使用当前来源中保存的语言选择；没有保存记录时按浏览器语言偏好匹配，不支持的语言回退为简体中文。浏览器禁止本地存储时，语言切换仍在当前页面生效。

界面、设备提示、校验错误、确认弹窗、操作记录、备份标签和日期格式随语言更新。中英文按键名称都可输入；切换语言不会清空未保存的输入、改变按键配置或重新连接设备。JSON / `.pro` 格式与已有 IndexedDB 备份保持兼容。

翻译资源全部随单文件网页打包，离线也可切换，不调用外部翻译服务。资源位于 `src/i18n/zh-CN.ts`、`src/i18n/en.ts`，按键名称位于 `src/i18n/key-names.ts`。类型检查约束文案键与插值参数，Vitest 验证中英文键和占位符一致。状态与日志保存消息标识，因此已生成的记录也能切换语言。

## 开发与静态部署

需要 Node.js 22.13+（22.x）或 24+，建议使用 Node.js 24。在项目根目录执行：

```sh
npm ci
npm run dev
```

开发服务器默认在 `http://127.0.0.1:5173`；浏览器要求首次 USB 授权必须由按钮点击触发。开发服务器仅提供网页和热更新，没有设备代理或后台数据处理。

```sh
npm run typecheck   # TypeScript strict，包含应用、工具与 TypeScript 测试
npm run lint        # ESLint、TypeScript、React Hooks、未处理 Promise 检查
npm test            # Vitest 单次测试
npm run test:watch  # Vitest 监听模式
npm run build       # 类型检查 + Vite 生产构建
npm run preview     # 预览生产产物
npm run check       # 完整检查
```

`npm run build` 输出独立的 `dist/index.html`，React、shadcn、样式和应用代码全部内联。`scripts/standalone.ts` 在 Vite 构建后计算脚本 SHA-256 CSP，将经典脚本放在页面挂载节点之后，并生成 `dist/_headers`。生产 CSP 保留 `connect-src 'none'`；开发环境需要 Vite 热更新连接，使用独立的开发配置。

`dist/_headers` 为支持此约定的静态托管提供 `Permissions-Policy: hid=(self)`；其他托管需要自行配置该响应头。Sites 继续使用现有项目及 `static.directory: dist`。部署只使用 `dist/`，不要公开源码、测试或 `drivers/`。

shadcn/ui 组件保存在 `src/components/ui/`，采用 Radix 基础组件，主题令牌在 `src/styles.css`。`components.json` 配置了 `@/` 别名，后续可用 shadcn CLI 添加组件。当前保留深色键盘编辑界面与原有交互。

`HIDSession` 由应用入口管理生命周期，React StrictMode 不会重新创建连接；Zustand 通过设备事件同步视图。编辑模型、配置报文和备份格式独立于 React，切换组件不会触发硬件写入。测试中的 FakeHID 只能验证协议和调用顺序，不能替代真实键盘验收。

已有私人读取样本可在**项目外**本地回放，不要放入源码、发布目录或 Git：

```sh
npm run replay -- /absolute/path/to/read-capture.json
```

验证范围与当前环境限制见 [VALIDATION.md](VALIDATION.md)。

## 许可证

本项目原创源码采用 [MIT License](LICENSE)，版权署名为 cbingb666。

第三方文件保留各自的版权与许可；shadcn/ui 组件的许可见 [src/components/ui/LICENSE](src/components/ui/LICENSE)。`drivers/` 中的官方 EXE / DLL 不适用本项目的 MIT 许可，其权利归原权利人所有。
