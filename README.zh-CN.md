# NIZ Web

[English](README.md) · **简体中文**

在浏览器里为 NIZ 键盘改键、设置宏和备份配置。通过 USB 直接连接，无需安装配置软件。

![ATOM66 三层映射界面，数字 1 键的左 Fn 映射 F1 已选中。](docs/images/three-layer-keymap.jpg)

**[打开 NIZ Web](https://cbingb666.github.io/niz-web/)** · [使用指南](docs/usage.zh-CN.md) · [报告问题](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml)

> [!WARNING]
> ATOM68 为实验性适配，尚未实机验证。所有型号的校准效果仍待实机验证。
> 首次使用请先读取并下载备份，核对内容后再尝试写入。[查看验证记录](VALIDATION.md)

## 支持型号

| 型号 | 实机验证 |
| --- | --- |
| ATOM66 | 已验证 |
| ATOM68 | 未实机验证 |

ATOM68 适配原有 68EC 系列，依据 [NiZ 官方软件核对记录（英文）](docs/atom68-research.md)。本次不包含 ATOM68 Pro。

## 开始使用

准备一台支持的键盘、一根 USB 数据线，以及桌面版 Chrome 或 Edge。先退出其他键盘配置工具。

1. **连接键盘。** 打开网页，点击「连接设备」，按引导确认型号、接线并授权。
2. **读取配置。** 返回设备管理，点击对应键盘的「配置设备」，确认后开始读取。
3. **下载备份。** 读取成功后，先点击「导出配置」，保存原始 JSON 文件。
4. **修改按键。** 点击键帽上的映射，选择新功能。快捷键和宏编辑完成后需要点击「应用」。
5. **写入键盘。** 点击「核对并写入」，查看改动并确认，等待写入和校验完成。

**读写期间键盘会暂时锁定，无法输入。** 请等待操作完成，保持数据线连接。

只想试用界面，可在设备管理空状态或「连接设备」页面点击「离线演示」。在下一页选择 ATOM66 或 ATOM68，再点击「开始演示」，无需连接键盘。普通编辑和导入只修改页面中的配置；写入配置和启动校准都需要确认。

## 可以做什么

- **改键与宏：** 编辑普通层、右 Fn 层和左 Fn 层；设置快捷键、连发和宏，支持撤销与重做。
- **保存配置：** 导入 JSON 和 ATOM66 和 ATOM68 的 Windows `.pro` 文件，导出 JSON，管理浏览器本地备份。
- **查看设备：** 管理多台键盘、读取按键计数；RGB 型号可设置逐键颜色。
- **按键校准：** 对[已开放的型号与固件](docs/usage.zh-CN.md#按键校准)，按向导执行释放和按住校准。
- **离线编辑：** 无需连接键盘即可试用、导入和编辑。界面支持简体中文与英文。

## 配置保存在哪里

修改暂存在当前页面，**关闭前请导出配置**。本地备份保存在当前浏览器中，更换浏览器或网址后不会自动迁移；清理站点数据也可能删除备份。

网页加载后不会上传键盘配置或按键计数，没有云端同步。下载的 JSON 可以自行保管和恢复，详见[备份与恢复](docs/usage.zh-CN.md#备份与恢复)。

## 当前限制

- 不提供固件升级或全局宏录制。校准效果仍需实机验证。
- 写入中断可能只完成部分修改，不会自动回滚。请重新读取并核对，必要时从写入前备份恢复。
- 连接需要浏览器支持 WebHID。不支持的浏览器只能使用离线功能。

连接失败、导入受限或写入报错时，请查看[常见问题](docs/usage.zh-CN.md#常见问题)。

## 本地运行

使用 Node.js 24 和 npm。在终端执行：

```sh
git clone https://github.com/cbingb666/niz-web.git
cd niz-web
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。

运行 `npm run build` 可生成独立网页 `dist/index.html`，用于离线编辑或静态托管。

直接打开本地 HTML 时，USB 和备份权限尚未经过实机验证；连接键盘请使用 HTTPS 页面或本地开发服务。

## 反馈与贡献

遇到问题，可填写[问题反馈](https://github.com/cbingb666/niz-web/issues/new?template=bug-report.yml)；有改进想法，可提交[功能建议](https://github.com/cbingb666/niz-web/issues/new?template=feature-request.yml)。表单字段使用英文。

欢迎改进代码、文档和翻译。开发环境、检查命令与提交说明见[贡献指南](CONTRIBUTING.zh-CN.md)。

## 许可证

原创源码采用 [MIT License](LICENSE)。第三方组件、设备图片和原厂软件保留各自的版权与许可，详见 [shadcn/ui 许可](src/components/ui/LICENSE)、[图片来源](src/assets/README.md)和[原厂软件说明](drivers/README.md)。
