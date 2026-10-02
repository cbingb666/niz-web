# 官方原版软件

统一存放各型号的官方驱动、配置工具及其配套文件，供协议核对和后续移植参考。它们不是 Web 应用运行时依赖，也不随网页构建发布。

## 收集约定

- 按型号建立子目录，例如 `drivers/ATOM66/`，不同型号的 EXE、DLL 不混放。
- 保留官方文件名、文件内容及配套关系；不要用自行修改或构建的程序覆盖原文件。
- 同一型号有多个版本时，放入 `drivers/<型号>/<版本或发布日期>/`，各版本分别保留。
- 新增软件时可补充来源、版本和下载日期；未确认的信息不要猜测。
- 此处有文件不代表 Web 版已支持该型号；接入型号仍需核对协议并测试。

## 当前内容

`ATOM66/`：从原项目 `ATOM66/` 目录原样迁入的三个原厂文件，迁移前后 SHA-256 校验一致。

- `66EC(XRGB)Ble.exe`
- `66EC(XRGB)BleHWI.dll`
- `66EC(XRGB)BleRES.dll`

未执行、修改或重新打包这些程序。保留已有来源资料；未额外推断其发布版本或适配范围。

`ATOM68/`：2026-10-01 从 [NiZ 官网下载入口](https://www.nizkeyboard.com/pages/order)所链接的 [ATOM68 原有系列 Software 目录](https://drive.google.com/drive/folders/1CWGM9N1DIR4i6YdScP-Sr2yV9YhgItqL)及上层型号目录下载，原样保留：

- `68EC.exe`
- `68ECHWI.dll`
- `68ECRES.dll`
- `68EC(XRGB)Ble User Manual.doc`

客户端显示软件版本 1.1.4，三个程序的 PE 时间戳为 2022-08-17；时间戳不等于发布日。来源链接、大小、SHA-256 和静态协议核对见 [ATOM68 研究记录（英文）](../docs/atom68-research.md)。仅静态检查，没有执行程序、修改文件或刷新固件。文件与图片仍归原权利人所有，不包含在代码 MIT 许可内；这些原厂资料不随网页构建发布。本次适配为 ATOM68 普通 68EC 系列，未实机验证，不包含使用独立客户端的 ATOM68 Pro。

`MICRO82/` 和 `MICRO84/`：2026-10-02 从上述官网入口所链接的 [MICRO82 原有系列 Software 目录](https://drive.google.com/drive/folders/1M2kOd-e4gNo3FU-jh9dlqEb-lv82EDZI)和 [MICRO84 Software 目录](https://drive.google.com/drive/folders/106W4xfbITvpnk1Wy2_gJTIn4xEAGWkQI)下载，原样保留各自的三个配套文件：

- `82EC(XRGB)Ble.exe`、`82EC(XRGB)BleHWI.dll`、`82EC(XRGB)BleRES.dll`
- `84EC(XRGB)Ble.exe`、`84EC(XRGB)BleHWI.dll`、`84EC(XRGB)BleRES.dll`

MICRO82 客户端显示软件版本 1.2.3，MICRO84 为 1.1.4；EXE 的 PE 时间戳为 2022-08-17，DLL 为 2022-06-23，不能据此推断发布日期。文件大小、SHA-256、USB / 固件、键位与三组报文证据见 [MICRO 核对记录（英文）](../docs/micro-research.md)。只做静态检查，没有执行程序、刷新固件或读取硬件；两款均未实机验证，不包含 MICRO82 Pro、MINI84 或其他 84 键系列。文件版权归原权利人，不包含在 MIT 许可内，也不随网页构建发布。
