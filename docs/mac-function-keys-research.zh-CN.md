# Mac 顶排功能键可行性

[English](mac-function-keys-research.md) · **简体中文**

研究日期：2026-10-05。用户确认目标为 ATOM66 / 66EC RGB BLE，固件 `66EC(RGB)BLe;V1.5.1;V1.0;`。以下是静态证据，不代表实机验收。本次没有向键盘发送配置或固件。

实机状态更新（2026-10-05）：用户已确认 Mac 系统键在真实键盘上可用。以下静态研究早于这次确认，其中系统键待验证的表述记录的是当时的证据状态。详见[后续实机验证](#后续实机验证)。

## 原厂固件已有能力

已核对本地解密 APROM 的 SHA-256 为 `8ecb2cef8172ca37a5e42a75b2748af6a8c930c174c5ae6c67776207d13fa43a`。[USB 映射函数](../niz-firmware/recovered/firmware/decompiled/functions/0000a258_usb_key_event.c)、[BLE 映射函数](../niz-firmware/recovered/firmware/decompiled/functions/0000329c_ble_key_event.c)和 [ROM 表](../niz-firmware/firmware/src/rom.S)给出以下内部码映射：

| 操作 | NIZ 内部码 | HID 页 / 用途码 |
| --- | --- | --- |
| 屏幕亮度降低 / 提高 | 208 / 209 | Consumer `0x0C / 0x70`、`0x0C / 0x6F` |
| 下一曲 / 上一曲 | 108 / 109 | Consumer `0x0C / 0xB5`、`0x0C / 0xB6` |
| 播放 / 暂停 | 111 | Consumer `0x0C / 0xCD` |
| 静音 | 112 | Consumer `0x0C / 0xE2` |
| 音量提高 / 降低 | 113 / 114 | Consumer `0x0C / 0xE9`、`0x0C / 0xEA` |
| 搜索，Spotlight 候选 | 119 | Consumer `0x0C / 0x221`（AC Search） |

亮度表位于 ROM `0xC46C..0xC46F`，媒体表从 `0xC448` 开始。USB Consumer Report ID 1 的数组元素为 16 位，Usage/Logical Maximum 为 `0x23C`，描述符从 `0xCD0C` 开始。[Apple Consumer 驱动](https://github.com/apple-oss-distributions/IOHIDFamily/blob/main/IOHIDFamily/IOHIDConsumer.cpp)会把标准亮度、播放、音量码转成系统事件。切歌与按住快退/快进是不同动作，需要分别实测。

初次研究时，网页把 208、209 命名为保留代码。[解析器](../src/protocol.ts)已接受 `#208`、`#209`，[动作选择器](../src/components/action-picker.tsx)也可以按这些数字码搜索。因此现有配置格式已经能承载原厂屏幕亮度动作；补充易读的选择项不要求改固件。不能把这些含义直接推广到其他型号或版本。144/145 调节 NIZ 自身灯光，不是 Mac 屏幕或 Mac 内置键盘背光。

## 需要扩展的原生系统动作

[QMK 官方映射](https://github.com/qmk/qmk_firmware/blob/master/tmk_core/protocol/report.h)将调度中心映射到 Consumer `0x29F`，Launchpad 映射到 `0x2A0`；[按键文档](https://docs.qmk.fm/keycodes_basic)将它们标为 macOS 动作。两者均超过原厂描述符上限 `0x23C`。原生实现需要同时扩展描述符、内部码分派和按下/释放处理。直接把 HID 用途码当成 NIZ 配置字节发送不可行。新版 macOS 的 Launchpad 行为需另行实测。

对于现代 Mac 顶排，Spotlight `0x0C/0x221` 和听写 `0x0C/0xCF` 目前是候选，尚未验证这台设备上的系统效果。勿扰 `0x01/0x9B` 已被 [Apple 事件解析器](https://github.com/apple-oss-distributions/IOHIDFamily/blob/main/IOHIDFamily/IOHIDEventDriver.cpp)接受；原厂 System Control 报告只声明 `0x81..0x83`，所以原生实现也需要扩展报告。标准用途定义见 [USB HID Usage Tables](https://usb.org/sites/default/files/hut1_7.pdf)。

快捷键方案无需新增 HID 报告：调度中心可用 Control-Up，Spotlight 可用 Command-Space，取决于用户的 [macOS 快捷键设置](https://support.apple.com/en-us/102650)。听写可以使用[用户自定义快捷键](https://support.apple.com/en-gb/guide/mac-help/mh40584/26/mac/26)。其他系统动作也可绑定用户设置的快捷键，不应假定统一默认值。

## Fn 与传输限制

内部码 207 在 Mac 模式下设置/释放键盘报告末尾字节。`0xCDF0` 的 Mac 键盘描述符声明页 `0x00FF`、用途 3，与 [Apple TopCase KeyboardFn 定义](https://github.com/apple-oss-distributions/IOHIDFamily/blob/IOHIDFamily-1035.41.2/IOHIDFamily/AppleHIDUsageTables.h)一致。它与 NIZ 层切换 Fn 156/166 不同。Apple 解析器对此 vendor 用途检查 `AppleVendorSupported`；原厂会发出报告，并不能证明 NIZ USB 身份会被识别为原生 Fn/🌐。

APROM 将 BLE 报告转发给独立模块，其内部固件和 HID 描述符不在已恢复镜像内。USB 补丁不代表蓝牙也支持。

## 实现边界

先在精确目标设备上验证原厂亮度、媒体键。原生整排固件变体应保留 stock 构建、配置兼容格式、NIZ Fn 层行为和已有报告布局；分配新内部码前检查全部分派路径。先验证生成的描述符范围、实际 ARM 报告输出与释放，再进行 macOS USB 实机验证。蓝牙和原生 Fn/🌐 独立验收。

初次研究时，网页[固件工具](../src/firmware.ts)只接受固定散列的原厂包，未识别的修改包仍会被拒绝。接受实验变体需要另行实现独立包身份与验证。本次研究没有改变白名单，也没有发布。

## 后续实现

用户随后要求整排全部使用原生码。已实现独立 V1.5.1-F.1 构建及网页精确包白名单，详见 [实现与验收边界](../niz-firmware/firmware/MAC_NATIVE.zh-CN.md)。选择器已命名 207–209、222–230，并检查载入的型号和版本。Spotlight、听写的可用性另有 [ZSA 官方 macOS 实测](https://blog.zsa.io/2212-macos-keycodes/)证据。

后续本地检查确认，原厂 Mac 初始化已选择 `05AC:0220` 身份，并非始终保留 NIZ USB 身份。本机 macOS 27.0 的 AppleHIDKeyboard 元数据为此身份设置 TopCase Fn 页 `0xFF` / 用途 3。新变体保留原厂身份行为，并对 USB 背光发送 Apple TopCase 9/8 用途码。此次静态检查时，实际枚举、驱动绑定、Fn/🌐 和背光行为尚未验证；静态检查本身没有访问硬件。

## 后续实机验证

用户于 2026-10-05 确认 Mac 系统键已实机验证。当前文档记录此功能已通过实机验证，界面仅显示固件要求与使用限制；用户反馈取代此前系统键效果未验证的状态。蓝牙支持、网页刷写与恢复继续独立验收。详见[验证记录](../VALIDATION.md#2026-10-05mac-系统键用户实机验证)。
