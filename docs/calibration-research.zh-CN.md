# 校准工具支持可行性调研

[English](calibration-research.md) · **简体中文**

调研日期：2026-09-28。本文研究如何在 NIZ Web 中加入由用户主动启动的校准流程，不代表已经支持或通过实机验证。本次没有连接、读取、校准、复位或刷写键盘；原厂程序只作静态文件分析，没有执行。

具体范围、会话行为、清理规则和开发批次见[落地方案](calibration-implementation-plan.zh-CN.md)。

2026-09-30 可用性更新：按用户要求，已配置的 ATOM66 组合现已在开发环境和生产构建中默认提供，替代下文最初的分阶段开放建议。协议证据和待完成的实机验证限制没有改变，当前行为见[使用说明](usage.zh-CN.md#按键校准)。

**结论：协议证据已经足够开发本地实验版。** 旧版和 2026 版校准 DLL 的机器代码完全一致，释放校准、按下校准与锁键/解锁命令可以用现有报文传输方式表达。正式支持仍需在目标 ATOM66 固件上验证完成回复、持久化和解锁失败后的恢复。建议做成独立的分步校准工具，并按型号和固件限定开放范围。

## 范围与证据等级

首个目标沿用[触发行程读取调研](actuation-readback-research.zh-CN.md)中的设备：ATOM66，产品名 `66EC-S`，VID `0x0483`，PID `0x522A`，固件 `66EC(S);V1.4.4;V1.0;`。这是此前文档记录的用户提供信息，本次没有查询设备。

2026-09-30 范围更新：用户截图显示另一 ATOM66 变体 `66EC-XRGB`，VID `0x0483`，PID `0x502A`，固件 `66EC(XRGB)BLe;V1.2.5;V1.0;`。该精确组合沿用下文的 CalibrationLite 静态命令证据，以候选状态开放。这属于工程推断，不是原厂对该固件的适配保证。截图只能确认所显示的身份，不能证明校准回复、持久化或恢复行为；本轮没有执行实机校准。

| 证据等级 | 能说明什么 |
| --- | --- |
| 官方说明或下载目录 | 原厂公开提供了哪些资料；不能证明某个工具适配所有固件 |
| 原厂客户端静态分析 | 指定 EXE/DLL 怎样构造和处理报文；不等于完整固件规范 |
| 工程推断或设计建议 | 在所列前提成立时可采用的接入方式 |
| 实机验证 | 实际观测到的设备行为；本次没有执行 |

需要区分三种功能：

| 功能 | 含义与依据 |
| --- | --- |
| 静电容按键校准 | 重新校准释放和按下状态。原厂将 CalibrationLite 用于处理触发异常，当前包说明了先释放、再按住待校准键的流程。[支持文章](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this)、[2026 校准包](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) |
| 触发行程档位 | 通过键盘功能选择触发设置。型号手册和当前档位读取的限制见[单独调研](actuation-readback-research.zh-CN.md)。校准不能证明某个毫米值，也不能证明可以读出当前档位。 |
| 键位配置 | 现有编辑器处理的改键、宏、层和相关配置，遵循[配置写入事务](architecture.zh-CN.md#设备编辑与写入)。校准不能当成另一个键位字段。 |

## 官方工具现状

[官方固件页](https://www.nizkeyboard.com/pages/firmware-upgrade)分别链接 ATOM66 文件和 CalibrationLite 下载。[长期使用的校准目录](https://drive.google.com/drive/folders/10brHTpjXS-cU2HYCsKpm9cFY5skUeEDQ)仍保留旧 Windows 和 Mac 版本；[官方 FAQ](https://www.nizkeyboard.com/blogs/news/faq)链接的[总下载目录](https://drive.google.com/drive/folders/1MqQE4e2JKO8qT765Njj5Y2gKxznoY4aY)还另有 `NIZ-EC-CalibrationLite-2026.rar`。只检查旧校准子目录会漏掉这个包。

| 官方位置 | 本次看到的文件或范围 | 尚未证实的内容 |
| --- | --- | --- |
| [旧 Windows 目录](https://drive.google.com/drive/folders/1vFULx-aiuiXIQwPm4ggazsiHACR2zEUE) | `CalibrationLite.exe`、`KBDLL.dll`、MFC/C 运行库 | 精确的型号与固件兼容表 |
| [Mac 目录](https://drive.google.com/drive/folders/16MtzGdINrANBTKhv2xSNrI4aOMlJtG4S) | `MACv1.0.2.dmg` | 当前 macOS 兼容性，与两个 Windows 包是否等价 |
| [2026 校准包](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view) | `CalibrationLite.exe`、`KBDLL.dll`、六个运行库和双语 `使用说明Instructions.txt` | 随包文本未明确声明适配 ATOM66/V1.4.4，也没有固件兼容表 |
| [DRT 目录](https://drive.google.com/drive/folders/1a1gk-rxyLPWGmraL0a-ZNcDibGVzDlAK) | 单独命名的 Atom68pro、Micro82pro、mini84、S104、X87pro、X99、X108pro 软件分支 | 目录名称不能证明它们共用校准协议或兼容 ATOM66 |

这些是分发目录，不是经过验证的代际兼容表。压缩包名中的 `2026` 不能单独证明发布日期、协议代际或全型号兼容。随包说明使用 `KeyCalibrationTool V1.0` 名称，实际 EXE 名为 `CalibrationLite.exe`。

新硬件也可能有不同的校准方式。例如 [i84 ALU 官方产品页](https://www.nizkeyboard.com/products/i84-al)宣传启动时自动进行电容校准。这只说明该产品的宣传功能，不能套用到 ATOM66，也不能据此在网页连接时自动校准。

## 原厂校准流程

[2026 包](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view)中的双语说明可归纳为：

1. 接好键盘，打开工具，确认显示已连接。
2. **释放全部按键**，执行一次 **ReleaseCalib**。说明明确表示一次即可覆盖全键盘的释放校准。
3. **按住需要校准的一个或几个异常键**，执行 **PressCalib**。
4. **收到完成提示后再松开**。

说明没有要求逐个按遍所有键，也没有给出位移毫米值、力度数值、扫描时间、校准存储格式、备份命令、中断恢复方法或版本兼容性。网页需要保留等待完成提示这一条件，不能用固定倒计时替代设备完成通知。

[旧官方故障处理文章](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this)仍推荐 CalibrationLite，但具体步骤依赖旧 `wp-content/uploads/2019/07/` 路径下的 `Step-1.png` 和 `Step-2.png`。本次两张图均返回 HTTP 404，不能只凭该页还原详细操作。2026 随包说明是本次找到的可用原厂流程依据，但没有在目标旧固件上验证。

## 静态分析确认的协议

[旧 DLL](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view)和 [2026 包](https://drive.google.com/file/d/1HlD3fvHx5obZDIfgJ2PJogi16xE0I7Bo/view)中的 DLL 整文件哈希不同，但整个 `.text` 节完全相同：8,704 字节，SHA-256 为 `a26b7e701e4962f5e693f16627b05370ca3d6b7132f7839b9c7ea952565a7d90`，12 个导出函数的地址也相同。这能确认两份客户端通信代码一致，不能证明固件行为相同。

DLL 清零一个 65 字节的 Windows HID 缓冲区，其中第一个字节是额外的 Report ID，再通过 `WriteFile` 发送。换成项目的 WebHID 表达方式，应单独传入 Report ID `0`，数据区为 **64 字节**；下表从数据区第零字节开始，其余位置补零。不要把 Windows 的 Report ID 再塞进数据区。接收使用 `ReadFile`，这些导出中未发现使用 feature report 的校准路径。

| 操作 | WebHID 数据前缀 | DLL 导出 / RVA | 客户端识别的接收码 |
| --- | --- | --- | --- |
| 查询固件 | `00 F9 00` | `GetVersion` / `0x12D0` | `F9` |
| 锁定普通按键输出 | `00 D9 00` | `Keylock(0)` / `0x13C0` | 未找到独立的锁键确认回复 |
| 校准释放状态 | `00 DB 00` | `CalibrationInit` / `0x1320` | `DA`：释放/初始化校准完成 |
| 校准按住的键 | `00 DD 00` | `CalibrationPress` / `0x1370` | `DE`：按下校准完成 |
| 解锁普通按键输出 | `00 D9 01` | `Keylock(1)` / `0x13C0` | 未找到独立的解锁确认回复 |

DLL 在 RVA `0x1172`、`0x118A`、`0x11A2` 分别检查 `F9`、`DA`、`DE`，将后两者转为窗口消息 `0x7EB`、`0x7EC`。2026 EXE 的消息表项位于 RVA `0x1507C8`、`0x1507E0`，指向处理函数 `0x24B0`、`0x24F0`。这两个函数只显示释放/按下完成文案，没有解码转发的载荷。[旧 EXE](https://drive.google.com/file/d/1Y4ADVyphBBKAMaqh_u1JI913lVWnj7mt/view)在 `0x22E0`、`0x2430` 采用同样的处理方式。

对接入的直接影响：

- 必须等待对应的 `DA` 或 `DE`。发送成功、固定延迟、无关报文或重复通知，都不能作为另一阶段已完成的依据。完整返回格式、耗时、载荷含义与错误情况仍需目标固件抓包确认。
- 所查请求没有事务编号。超时后不能立即再发校准，并把迟到回复归给新操作；应先建立明确的恢复边界。如实记录回复关联的限制，不能用重试循环掩盖。
- `CalibrationPress` **没有携带键号或选择掩码**。目标是用户物理按住的键；网页上选中某个键，不能宣称命令只会校准它。
- 所查客户端没有解码每键成功状态、电容值或毫米位移。完成通知不能支撑实时传感器图、每键成功热图或百分比；未知载荷字段应继续视为未知。
- 两份校准 DLL 都没有导出校准读取、导出或恢复函数。不能据此证明固件没有这些能力，但当前没有已知的校准备份方案。

2026 EXE 会在连接事件里锁键（RVA `0x231D` 调用 `Keylock(0)`），在关闭窗口时尝试解锁（`0x21AE` 调用 `Keylock(1)`）。**网页不能照搬连接即锁键的行为**，只能在明确确认后的校准会话里执行。DLL 发现设备时检查 `vid_0483` 和 `mi_01` 字符串，也不能照搬这种宽松匹配；项目仍需按配置接口和固件唯一识别型号。

社区客户端源码也相互印证：[niz-tools-ruby](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/niz.rb)定义了 `D9`/`DB`/`DD`，[nizctl](https://github.com/NickCao/nizctl/blob/91aad9db8672595426c158704def428734109801/src/keyboard.rs)实现了相同操作。它们是一手实现资料，但不是原厂固件规范。Rust 的按下校准只读取一个回复而不校验命令码；Ruby 界面不等待初始化完成。不能直接照搬它们的传输缓冲区和完成判断。

## 浏览器可行性

**工程推断：**这些命令可以由现有 [PacketChannel](../src/hid.ts)承载，它已经使用 `sendReport(0, 64 字节数据)` 和 input-report 事件。[ATOM66 定义](../src/devices/atom66/model.ts)选择 usage page `0x8C`、usage `1`，`validateDescriptor` 要求 Report ID 为 `0`、输入输出各 64 字节。需要实机确认目标固件的校准也走这个可访问的集合，才能把传输层兼容从推断变成验证结论。

WebHID 支持输出报文、输入报文事件和双向 feature report。`sendReport()` 成功只代表报文已发送。Chrome 禁止访问普通键盘、鼠标等受保护顶层集合中的报告；应使用设备的配置接口，并用 `HIDDevice.collections` 检查报告描述。[Chrome 官方文档](https://developer.chrome.com/docs/capabilities/hid)

[WebHID 规范](https://wicg.github.io/webhid/)要求安全上下文，首次 `requestDevice()` 需要临时用户激活并满足 `hid` 权限策略；既有授权可以通过 `getDevices()` 枚举。这与当前按钮授权和恢复连接方式一致。校准应作为完成识别后的独立主动操作。[权限算法源码](https://github.com/WICG/webhid/blob/main/index.html)

仍需检测 API、验证描述符和操作系统访问条件；Chrome 官方文档也指出 Linux 的 `hidraw` 权限要求。已有配置通信不等于所有平台上的校准都已验证。[Chrome 官方文档](https://developer.chrome.com/docs/capabilities/hid)

实现可继续保持纯浏览器：用 TypeScript 实现已确认命令，无需执行 Windows DLL，也无需把原厂程序放进网页或新增本地代理。这是接入建议，沿用现有[独立 HTML 与连接架构](architecture.zh-CN.md)，尚不是已完成的移植。

## 接入方案

以下是设计建议，尚未实现。校准应独立于 `Profile`、改键编辑器和既有配置写入事务。

| 位置 | 建议调整及原因 |
| --- | --- |
| [src/devices/model.ts](../src/devices/model.ts)、ATOM66 定义 | 新增校准能力及经过验证的型号/固件范围，默认不可用。现有 `version.startsWith('66EC')` 型号匹配不足以保证校准兼容。 |
| 新增 `src/calibration.ts` | 将命令构造、预期回复、阶段、超时和错误独立于 React；分开处理释放与按下校准，不借用配置读写或扫描未知命令。 |
| [src/hid.ts](../src/hid.ts) | 由 `HIDSession` 管理绑定设备和连接世代的独占校准会话，等待用户操作时也不能插入配置读写或切换设备。跟踪可能已锁键的状态，提供有限的清理路径。 |
| [src/store/app-store.ts](../src/store/app-store.ts) | 增加校准状态、动作及消息标识，保留各设备的配置、草稿和撤销历史。重连后旧校准授权失效。 |
| [src/components/](../src/components/) | 为指定设备提供校准入口和短向导，复用 AlertDialog、Button、主题令牌与锁键示意。现有操作遮罩只处理 `read`/`write`，不能直接承担需要用户参与的校准阶段。 |
| [src/i18n/](../src/i18n/)、使用文档 | 同步中英文文案和恢复说明。WebMCP 不开放校准动作。 |

首版界面可以分为三步：

1. **释放全部按键。** 说明普通输入会被锁定，需要用鼠标或触控板操作；确认框默认聚焦取消。只有点击「开始校准」才授权发送 `D9 00`、`DB`，然后等待释放完成通知。连接或打开工具都不发送这两条命令。如果用户用目标键盘确认，发送前必须另行完成全部松开的步骤，不能在确认用的 Enter/Space 仍按住时采样。
2. **按住要校准的键。** 用户用力按住一个或几个异常键，点击「校准按住的键」后发送 `DD`，直到收到 `DE` 才提示松开。允许用户主动再处理一组，或进入结束步骤；不强制按遍所有键，也不自动重复释放校准。
3. **结束并测试。** 尝试发送 `D9 01`，随后在有焦点的本地测试区检查普通输入。分别记录设备报告校准完成、解锁报文发送成功、实际按键表现；其中任一项都不能单独证明所有传感器正常或数据已经持久保存。

保持背景 `inert` 和对话框内焦点限制。设备工作期间不能用 Escape 或背景点击关闭；在已完成的阶段之间，可通过明确的「结束校准并解锁」退出，但这不是回滚。失败后解除页面操作锁并保留可操作错误。只显示阶段文字和不定进度等待，不伪造百分比。目标键盘锁定时，可用另一把键盘导航；所有控件也必须可用鼠标或触控板操作。这些选择遵循[项目交互约定](../AGENTS.md)。

### 解锁与数据边界

[PacketChannel.send](../src/hid.ts)在发送错误或超时后会将通道置为失败，后续发送立即失败。因此只加 `finally { unlock() }` 不够；需要明确原设备、原连接世代和传输状态是否仍允许一次有限的清理尝试。不能清掉错误后盲目继续、给另一台设备解锁，或在重连后重放校准。发送超时也可能意味着物理执行结果未知。

当前未找到专门的解锁确认回复，必须如实记录清理失败或不确定。强制关闭标签页、浏览器崩溃、休眠或拔线之后，不能保证 `finally` 或卸载回调完成解锁。正式开放前必须验证人工恢复方式；网页恢复可操作不等于硬件已解锁。

[Profile.toJSON](../src/protocol.ts)保存键位报文、计数、可选灯光和兼容数据，[BackupStore](../src/storage.ts)存储这份 JSON，没有已知的校准快照。键位备份可以保留按键配置，不能承诺恢复校准。不要虚构自动回滚或改变兼容格式。现有配置写入仍保持「基线检查 → 检查外部改动 → 完成本地备份 → 写入 → 回读校验」。进入校准不能自动读取键位配置，配置读取继续由原有明确操作发起。

如果实机发现校准会改变配置基线涉及的数据，应只失效该设备的硬件基线，保留编辑器和草稿，要求用户按原流程主动重读后才能再次写入。不能在校准结束时自动重载编辑器。

## 开发和验证顺序

1. **现在可做：本地实验协议及模拟流程。** 生产校准入口保持不可用。验证 64 字节报文和补零、锁键参数、`DB → DA` / `DD → DE`、取消不发命令、错误或迟到回复、超时、重复点击、设备/世代变化、独占操作及清理失败。检查全部编辑器和草稿保留、背景/焦点锁、中英文布局。真正修改实现时运行项目要求的 `npm run check`。
2. **正式开放前：验证目标固件。** 在另行获准的硬件操作中，先核对描述符和固件，再记录适配原厂工具的完整双向通信，包括时间、Report ID、全部字节和用户操作标记；校准确实会改变设备状态。抓包保存在项目外。确认阶段格式、实际耗时、是否存在额外命令或独立接口、数据是在校准完成还是退出时保存。不扫描未知命令，不为补齐证据刷固件。
3. **随后：验证浏览器流程和恢复。** 使用真实 ATOM66 检查释放校准、异常键分批校准、完成提示、普通输入、重连/断电后的保持情况和键位配置保留。先建立恢复方法，再有控制地验证拔线、关闭标签页、超时和解锁结果不确定的路径。逐一验证承诺支持的浏览器/系统组合。配置前后比较仍走已有读取确认，不增加自动读取。

只开放通过验证的型号和固件组合。模拟回复只能证明应用时序，不能证明传感器校准、非易失存储或真实 WebHID 可访问性。本文没有实机通过结论。通用 NIZ 校准器、模拟位移显示、毫米编辑器和当前触发行程读取，仍是需要独立证据的功能。

## 可复现信息

2026 包只下载、解压到临时目录，未加载任何 EXE/DLL。以下 SHA-256 标识本次实际分析的文件：

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `NIZ-EC-CalibrationLite-2026.rar` | 5,417,486 | `87d1f2ac8f77c99244fa8cffc23c7ef9987aa8b1f4a0a8c41c4e1c8d53dc63ce` |
| `CalibrationLite.exe` | 1,835,008 | `86d5a16164761ecf88817b5d9afa992f989741db9e784cdd7efa3ae5bf2a2a9a` |
| `KBDLL.dll` | 17,408 | `4a73d74f378b5d6c0b731257eb6432482e8184efc27e7f611161db8a6e12fe32` |
| `使用说明Instructions.txt` | 1,060 | `0a03d04e337e23d7b72ef3c75e3c7c5d245d289b0f6dbbd23966c9db67212bf6` |

旧对照文件的 SHA-256 分别为 `c40e164fdbc022ad96b786c78bfbc0bf8aede527a72a8991598c3807c9a71b5f`（`KBDLL.dll`）和 `580049eadb6e331f44627214bbca136d540dede3f6e2367b6d6bb22de3d0b90d`（`CalibrationLite.exe`）。分析使用 PE 节、导入导出表、MFC 消息表、字符串引用与 x86 反汇编。下载原厂文件到临时目录后，可使用以下命令静态检查：

```sh
shasum -a 256 '/absolute/path/to/KBDLL.dll'
objdump -p '/absolute/path/to/KBDLL.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x100012d0 --stop-address=0x10001410 '/absolute/path/to/KBDLL.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x4024b0 --stop-address=0x402530 '/absolute/path/to/2026/CalibrationLite.exe'
```

双语说明采用兼容 GBK 的中文编码，按 UTF-8 读取会使中文乱码。没有把原厂二进制、私人抓包或反汇编文件加入项目，本次只新增调研文档。

旧图片失效、Google Drive 目录内容和产品说明均为调研当日的有限检查结果，不代表已遍历全部历史资料。
