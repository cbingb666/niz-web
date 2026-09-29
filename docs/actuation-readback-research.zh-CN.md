# ATOM66 当前触发行程读取可行性

[English](actuation-readback-research.md) · **简体中文**

研究日期：2026-09-28。这是可行性调查，不是实机验收结果，也不代表已经支持该功能。

## 范围与当前结论

用户提供的目标设备是 ATOM66，设备名称 `66EC-S`，VID `0x0483`，PID `0x522A`，固件 `66EC(S);V1.4.4;V1.0;`。本次没有向设备发送命令核验这些信息。

要调查的是：软件能否通过 USB HID 读取**当前选中的触发行程档位**。用于切换档位的按键分配、每键校准数据、按键此刻的物理位移，是不同的数据。

对配置与校准 DLL 的报文构造和接收路径进行静态分析，并核对公开资料后，**尚未找到当前档位的查询命令或解码方法**，因此没有可以直接接入 NIZ Web 的已知方案。用户这版固件的可读性仍待确认；这些证据不能证明 V1.4.4 没有未公开的返回字段或命令。

## 公开资料确认的内容

### 型号说明书介绍了切换功能，没有提供读取协议

NIZ 的[官方固件页面](https://www.nizkeyboard.com/pages/firmware-upgrade)链接到 [ATOM66 目录](https://drive.google.com/drive/folders/1uFy1kPoQUHyo8z_4PXmxHVeTmqxKPgX0)，其中的[说明书目录](https://drive.google.com/drive/folders/18UQ4VyLRHLeljHfmk_KgcIS-pS1vxnSK)分别提供有线、蓝牙和蓝牙 RGB 文档。

有线版 [`66EC(S) User Manual.doc`](https://drive.google.com/file/d/1k3Vg7hB_TJU9YnCvDY_zkc43GSpnhRkG/view)（英文）的特殊按键表将触发点切换分配给**右 Fn + 7**，描述了高/低档及关机后不保留。它没有注明适用固件版本、具体毫米值或查询当前档位的命令。配置软件章节介绍键位分配、配置文件、计数和固件版本读取，没有介绍当前触发档位的显示。不能单凭这份说明书确定 V1.4.4 的档位数量或保存规则。

下载的有线说明书为 460,288 字节，SHA-256 为 `0dab546c18993b5b249b71a00cf6bb6031dfd696f68212b571b3fbc7dd115884`。仅提取文字，没有执行原厂软件。

不同说明书存在差异。Epomaker 于 2022-09-01 发布的 [ATOM66 说明书页面](https://epomaker.com/blogs/manuals/niz-atom-66-manual)实际链接到[蓝牙版英文说明书](https://epomaker.com/cdn/shop/files/66EC_S_Ble_User_Manual.pdf?v=17780642986330550205)，第一页也使用右 Fn + 7、高/低档的描述；[NiZ Plum 66/68 Extended Manual v1.0](https://m.media-amazon.com/images/I/81lXmBjwZoL.pdf)（英文）第 5 页则写 Fn + 引号键和高/中/低档。应匹配实际硬件与固件，不能据此假定统一的快捷键、档位数量或毫米值。

### 找到的固件与用户版本不一致

官方 [ATOM66 EC-S 固件目录](https://drive.google.com/drive/folders/1lv1Lf1l5OfxAzrov6kNhhUXUO0VyLr7p)列出的日期子目录截至 `2023.6`。检查的最新三个子目录包含：

| 子目录 | 固件文件名 | 来源 |
| --- | --- | --- |
| `2021.04 update` | `66EC(S)_V1.1.6_20210307.bin` | [文件](https://drive.google.com/file/d/1_3UJmkrOrEUX-kGYxpIg5neVAXUpJagV/view) |
| `2022.8` | `66EC(S)_V1.1.8_20220505.bin` | [文件](https://drive.google.com/file/d/11fQhR7fw6tEppPS3f4h3EDluJBGiFTg1/view) |
| `2023.6` | `66EC(S)_V1.4.1_20230520.bin` | [文件](https://drive.google.com/file/d/1aa0uQIqgfIYKPJRzSkNzxXRXpG14anTX/view) |

在检查的 EC-S 目录中未找到 V1.4.4；这不代表其他位置一定没有原厂副本。没有刷写或执行这些固件。早期固件的分析结论也需要在用户版本上核验。

[官方 ATOM66 软件目录](https://drive.google.com/drive/folders/1TKMJdtVenduhFT4T0OSxVlmQR5W7BFey)列出 `66EC(XRGB)Ble.exe`、`66EC(XRGB)BleHWI.dll` 和 `66EC(XRGB)BleRES.dll`，与[仓库参考软件](../drivers/README.md)同名。下载的 HWI DLL 与仓库副本内容不同，下面分析了两者。它们的 PE 头时间戳分别在 2022 年和 2018 年，但该时间戳不能证明发布日期或适配范围。

### 校准工具是另一条协议路径

NIZ 的[校准支持文章](https://www.nizkeyboard.com/blogs/news/some-keys-doesn-t-work-look-at-this)将 CalibrationLite 用于修复按键触发问题。[固件页面](https://www.nizkeyboard.com/pages/firmware-upgrade)另有[校准工具下载目录](https://drive.google.com/drive/folders/10brHTpjXS-cU2HYCsKpm9cFY5skUeEDQ)，其中 [Windows 目录](https://drive.google.com/drive/folders/1vFULx-aiuiXIQwPm4ggazsiHACR2zEUE)提供 [`CalibrationLite.exe`](https://drive.google.com/file/d/1Y4ADVyphBBKAMaqh_u1JI913lVWnj7mt/view) 和 [`KBDLL.dll`](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view)。公开页面没有说明当前档位查询或校准返回字段的含义。

社区源码可以证明相应实现做了什么，但不是 NIZ 固件规范。`niz-tools-ruby` 的提交 `185077c4de8a22c9d66431e12990b08dfa5154a1` 中，[`niz.rb`](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/niz.rb)将代码 149 标注为触发点切换，并将校准初始化、按下校准与配置读取分开实现；[`calib.rb`](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/calib.rb)要求用户释放或按住按键，没有解码当前档位。[README 样例](https://github.com/cho45/niz-tools-ruby/blob/185077c4de8a22c9d66431e12990b08dfa5154a1/README.md)的固件是 `66EC(S)BLe;V1.0.37;V1.0;`，与目标不同。

`nizctl` 的提交 `91aad9db8672595426c158704def428734109801` 中，[`keyboard.rs`](https://github.com/NickCao/nizctl/blob/91aad9db8672595426c158704def428734109801/src/keyboard.rs)也实现了版本、计数、键位读取和校准操作，没有当前档位解码。两个项目都没有实现读取，并不能证明固件没有该能力。不能把校准命令当作只读探测命令。

## 二进制静态分析

分析使用 PE 导入/导出表、字符串引用和 x86 反汇编。没有加载或运行原厂 EXE/DLL。下载文件和反汇编保存在临时目录，未替换仓库内的原厂文件。

### 配置 DLL

[仓库 HWI DLL](../drivers/ATOM66/66EC%28XRGB%29BleHWI.dll)和[官方下载 HWI DLL](https://drive.google.com/file/d/1NJQlk11EyqNYpbCyR7aVpTrMOS89vwMw/view)均导出相同的 22 个入口。沿普通读取函数追踪得到以下命令。地址为相对虚拟地址（RVA），对本次检查的两个副本都适用。

| 用途 | 导出入口 → 实现 RVA | 写入命令字节的 RVA | WebHID 命令 |
| --- | --- | --- | --- |
| 键位定义 | `readKeyDefinationFromDev` `0x2390` → `0x14D0` | `0x150B` | `00 F2 …` |
| 每键灯光 | `readKeyLightFromDev` `0x23A0` → `0x1A80` | `0x1AA7` | `00 E2 …` |
| 按键计数 | `getPressCounterFromDev` `0x23F0` → `0x1B70` | `0x1B97` | `00 E3 …` |
| 固件版本 | `ReadKeyboardVersion` `0x23D0` → 虚方法 `0x2460` | `0x2488` | `00 F9 …` |

仓库 DLL 的 I/O 虚函数表位于 RVA `0xD47C`，指向 `0x3A80` 的 `WriteFile` 包装和 `0x3AB0` 的 `ReadFile` 包装。Windows 使用含额外 Report ID 字节的 65 字节缓冲区，读取包装会移除该字节。表中命令采用项目的 64 字节 WebHID 表示。其余追踪到的发送属于配置写入、灯光写入、结束包或固件传输，没有找到触发档位查询。DLL 导入了 `HidD_GetHidGuid`，没有导入 `HidD_GetFeature` / `HidD_SetFeature`；检查的动态函数查找用于运行库和 Windows 辅助函数，没有发现另一套 HID 查询 API。

键位读取循环处理 `F0` 定义，遇到 `F6` 结束；灯光和计数循环复制相应数据流，遇到 `E6` 结束；版本读取将返回数据转为文字。这些路径都没有解释当前触发档位。该结论只描述客户端实现，不能证明固件返回但客户端忽略的字节没有含义。

[仓库 EXE](../drivers/ATOM66/66EC%28XRGB%29Ble.exe)在构造按键功能表时，于 RVA `0x23EA5` 写入 `0x95`（149），并在 `0x23EBA` 和 `0x23EFB` 引用中文“按键触发行程切换”及英文功能名称。这印证了[项目的按键功能映射](../src/devices/atom66/legacy.ts)，不是当前档位或毫米值。

### 校准 DLL

官方 [`KBDLL.dll`](https://drive.google.com/file/d/17WC9k3V1y9xSvDaBNjdLQc4mr36xaWeY/view)导出 12 个函数，其中构造报文的四个方法为：

| 导出 / RVA | 命令 | 观察到的用途 |
| --- | --- | --- |
| `GetVersion` / `0x12D0` | `F9` | 请求版本 |
| `CalibrationInit` / `0x1320` | `DB` | 开始校准 |
| `CalibrationPress` / `0x1370` | `DD` | 校准按住的按键 |
| `Keylock` / `0x13C0` | `D9`，带参数 | 改变键盘锁定状态 |

接收线程在 RVA `0x1172`、`0x118A`、`0x11A2` 比较返回码 `F9`、`DA`、`DE`，然后把载荷转发给应用窗口。这些是接收码，不能据此认为发送 `DA` 或 `DE` 就能查询设置。该 DLL 中没有找到当前档位查询或解码。拟议的只读对比不包含校准操作。

### 复核方法

以下 SHA-256 标识本次分析的准确文件：

| 文件 | SHA-256 |
| --- | --- |
| 仓库 `66EC(XRGB)BleHWI.dll` | `c2502d5bf939c298df4b120891ed93b0507b6ea43a17844d41030a846bb41bec` |
| 仓库 `66EC(XRGB)Ble.exe` | `fac3fe86c0e8f6b6d5addd4d4ebc250ba3f434b198a0da255dc3abbebe4ff4d3` |
| 官方下载 `66EC(XRGB)BleHWI.dll` | `1ca6c2141ff2aac1d38c03533ac56a64c27beb9e4e82eae9a1f6c9abf5c108d3` |
| 官方下载 `KBDLL.dll` | `c40e164fdbc022ad96b786c78bfbc0bf8aede527a72a8991598c3807c9a71b5f` |

例如，以下命令使用 LLVM `objdump` 静态检查仓库 DLL，不会执行它：

```sh
shasum -a 256 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
objdump -p 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
objdump -d --x86-asm-syntax=intel --start-address=0x100014d0 --stop-address=0x10001580 'drivers/ATOM66/66EC(XRGB)BleHWI.dll'
```

下载的 V1.4.1 固件为 114,718 字节的冒号开头十六进制文字更新文件，SHA-256 为 `d7b961633fc4ebe973cc29020418a216e7acea0b6dceddf068cc987faaf2f0a2`。只检查了文件容器，未还原固件的命令分发逻辑，不能替代对 V1.4.4 的分析。

## 仍待确认的事项

- V1.4.4 是否在现有回复、尾部字节、结束包或主动输入报文中返回档位。
- 是否存在其他原厂查询命令，包括独立校准接口的命令。
- 候选值表示全局档位、每键阈值还是校准测量值，以及它在不同固件上的含义是否一致。
- 用户版本的准确档位数量、毫米值含义和保存规则。

[架构文档](architecture.zh-CN.md#兼容格式)记录了 V1.4.4 的九组键位配置。组数不能证明有三个键程档位；本次没有找到这些组与当前触发设置的对应证据。

## 为什么现有诊断导出不能定论

当前 [`readVersion`](../src/hid.ts)只返回解码后的版本字符串；`readKeyReports` 保存 `F0` 键位包，但丢弃 `F6` 结束包。[`makeCapture`](../src/protocol.ts)序列化这些键位包和版本字符串，并非完整双向通信记录。计数/RGB 回复和主动报文不在该导出中。因此，两份现有诊断相同，只能说明捕获的键位包未变，不能排除其他 HID 数据中包含档位。

## 使用已知读取操作的验证步骤

以下步骤尚未执行，需要使用用户实际的 `66EC(S);V1.4.4;V1.0;` 设备。私人抓包保存在仓库外。

1. 记录固件、设备名、USB 接口和报文描述符、Office/Program 模式，以及用于辨认档位的设备指示。记下原始状态，以便比较结束后手动恢复。
2. 完整记录时间、方向、Report ID 和所有字节，包括版本回复、结束包、填充区及主动报文。先被动观察手动切换键程时的通信，再通过应用原有读取确认和操作流程执行已知读取。该非 RGB 型号已有的查询是 `F9`、`F2`、`E3`，不加入 `E2` 灯光查询或校准/锁定命令。等读取结束、键盘恢复可用后再切档。必须在解析和过滤前记录；完整 USB 抓包可以提供这些数据，现有诊断导出不能。
3. 同档位连续读取两次（A/A）；用户只改变键程档位，读取 B，再切回 A 读取（A/B/A），覆盖实际可用的每一档。保持连接和其他设置一致；如果断电会重置档位，样本间不要断电。
4. 通过对照观察排除按键计数、事务状态、时间变化及其他设置的影响。一次字节变化不够；候选字段应随档位稳定复现，并且不受无关操作影响。
5. 找到候选字段后，再单独验证重连、断电重启，并观察实际恢复到的档位。先验证原始报文含义，再添加限定固件的解码器。未经独立确认毫米值的枚举，只显示档位。
6. 没有找到候选字段时，只能说明本次测试的读取路径和主动报文没有暴露它。之后需要原厂查询说明或匹配版本的固件/校准工具静态分析。不扫描未知命令，不执行校准、复位、改键写入或刷固件来回答这个问题。

本次未执行实机读写、浏览器 WebHID 验证、校准或固件更新，未修改运行时代码。下一步是目标固件上的完整 A/A 和 A/B/A 报文对比；取得可重复的证据后，再考虑生产解码器。
