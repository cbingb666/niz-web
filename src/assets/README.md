# 图片素材

## 应用图标

- `niz-web-icon.png`：NIZ Web 的薄荷绿 N 字键帽图源，1254 × 1254，透明背景 PNG。使用内置 ImageGen 生成，提示词和导出方法见 [favicon notes (English)](favicon.md)。
- `favicon.ico`：由上述图源导出的多尺寸图标，包含 16、24、32、48、64、128、256 像素版本及透明通道；构建时内联到 HTML。

## 设备照片

- `atom66-product.webp`：NIZ ATOM66 白灰键帽整机实拍，3000 × 1159，透明背景、无损 WebP。保留为原始素材和商业精修的输入。
  - 来源：[Flashquark 的 NIZ Atom66 产品图库](https://flashquark.com/product/niz-atom66-bluetooth-rgb-electro-capacitative-keyboard/)。
  - [高分辨率原始 JPEG（DSC_5217.jpg）](https://flashquark.com/wp-content/uploads/2018/07/DSC_5217.jpg)，5384 × 3712，获取日期：2026-09-27。
  - 按用户选择，使用 ImageMagick 传统抠图与轻度锐化：提取闭合外壳轮廓、填充主体蒙版、平滑抗锯齿边缘，裁掉多余背景后缩小至键盘宽 2800 像素，并增加透明留白。保留真实照片中的键帽、文字、键位、配色与透视，不采用生成式修图结果。
  - 通过 `cwebp -lossless -m 6 -exact -metadata all` 无损编码，保留真实 alpha 透明通道；键盘内部完全不透明，外部完全透明，仅轮廓抗锯齿像素使用中间透明度。
  - 图片版权归原权利人所有；来源未提供开放图片许可，不包含在本项目代码的 MIT 许可内。

- `atom66-product-retouched.webp`：根据用户后续的商业精修要求，使用内置 `image_gen` 编辑原始素材，改善水平透视、白平衡、材质和清晰度。2014 × 780，透明背景、无损 WebP，约 1.06 MB；目前用于设备管理和连接完成步骤。
  - 沿用原始照片的来源归属，属于该照片的精修衍生素材，不包含在代码 MIT 许可内。
  - 最后仅以传统蒙版处理透明边缘的残留和主体透明度；清理前后 RGB 像素不变。
  - 完整提示词和处理参数见 [精修记录](atom66-retouch.md)。细小副刻经过生成式修复，不作为键位或功能标注依据。

图片展示 ATOM66 系列的 66 键布局。[NIZ 官方产品页](https://www.nizkeyboard.com/products/niz-2019-new-member-atom66-the-smallest-electro-capactive-bluetooth-keyboard-with-rgb-or-non-rgb)说明 USB、蓝牙和 RGB 版本布局相同，因此 66EC-XRGB 与 66EC-S 共用产品图；图片不用于表示当前灯效或识别用户更换的键帽。

产品图作为本地素材导入组件，由 Vite 内联到独立 HTML，保持离线使用与现有 CSP，不在运行时访问图片来源站点。型号确认步骤使用键盘背面与铭牌放大示意；无设备页与数据线步骤使用基于 Lucide 图标的 USB 接线示意，授权步骤使用浏览器选择设备示意。这些示意不作为具体机型的精确结构图，动效不用于判断真实设备状态。

- `atom68-product.jpg`：从 [NiZ 官方 ATOM68 产品页](https://www.nizkeyboard.com/products/niz-2019-new-atom-68-ec-bluetooth-keyboard-rgb-or-non-rgb)获取的 1600 × 1600 JPEG，获取日期：2026-10-01。
  - [原始图片](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/68.jpg?v=1626934057)原样保存，作为独立的原始参考素材。
  - 照片的键帽标注与所核对客户端版本存在差异；协议键位顺序以客户端为依据，照片不用于推断键码、默认配置或固件。
  - 图片版权归 NiZ 或原权利人所有；官网未提供开放图片许可，不包含在本项目代码的 MIT 许可内。

- `atom68-product-retouched.webp`：使用内置 `image_gen` 精修[官网无广告标题的正面原图](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/9dd518a6a1f59edc5f8cc4bd763cfca.png?v=1626686411)，以 ATOM66 精修图作为光线与材质参考，改善水平透视、白平衡和清晰度，保留 68 键布局与长空格键。2151 × 731，真实透明背景、无损 WebP，约 983 KiB。
  - 当前用于 ATOM68 设备卡与连接完成步骤，随构建内联。复用完整图片显示方式，保留主体全部轮廓与透明留白。
  - 最后按 ATOM66 的既有蒙版流程仅清理 alpha：外部残留归零、主体完全不透明，保留轮廓抗锯齿。收尾和编码前后 8 位 RGB 像素差异为 0。
  - 属于官方照片的精修衍生素材，沿用原权利人版权，不包含在代码 MIT 许可内。细小字符经过生成式修复，不作为键位或功能证据。完整提示词和处理参数见 [ATOM68 精修记录](atom68-retouch.md)。

- `micro82-product-retouched.webp`：以 [NiZ 官网普通 MICRO82 正面照片](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/3b75ebb933cf0a920e610ac9d9568d7.png?v=1626745204)为主体，使用内置 `image_gen` 沿用 ATOM66 的透明背景精修风格。1942 × 809，976,232 字节，无损 WebP。
  - 来源为 [MICRO82 官方产品页](https://www.nizkeyboard.com/products/2019-new-micro-82-ec-keyboard-s-ble-ble-rgb-or-non-rgb)，获取日期：2026-10-02。选择官网图库中的原有 82 键长空格版本，未使用 Pro 图片。
  - 保留六行、82 键、长空格、实际照片中的 Fn / Menu 顺序、白灰配色与完整外壳。当前用于设备卡、连接完成步骤和离线演示选择页，随独立 HTML 内联。

- `micro84-product-retouched.webp`：以 [NiZ 官网 MICRO84 正面照片](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/c83b10537a5681f0e8e19f2b01ea339.png?v=1626745747)为主体，采用相同精修方式。1938 × 811，985,878 字节，无损 WebP。
  - 来源为 [MICRO84 官方产品页](https://www.nizkeyboard.com/products/new-micro84-bluetooth-usb-ec-keyboard-with-rgb-non-rgb)，获取日期：2026-10-02。保留六行、84 键、双 Fn、短空格、白灰配色与完整外壳，未使用 MINI84 / L84 图片。
  - 当前用于设备卡、连接完成步骤和离线演示选择页，随独立 HTML 内联。照片中的左 Fn 在 Ctrl 与 Win 之间，与所核对客户端的默认说明位置不同；照片不作为协议键位或出厂配置证据。

两款 MICRO 素材均沿用原权利人的版权归属，官网未提供开放图片许可，不包含在项目代码的 MIT 许可内。原始官网照片和生成图作为项目外工作文件保留，来源 SHA-256、完整提示词和处理参数见 [MICRO 精修记录（英文）](micro-retouch.md)。主体由 `image_gen` 精修，收尾仅按既有 ImageMagick 蒙版流程替换 alpha，RGB 像素差异为 0；外部残留透明化，主体完全不透明，轮廓保留抗锯齿。生成式修复可能重绘细小字符，不用于型号识别或硬件功能说明。

## 处理参数

从上面的原始 JPEG 下载为 `DSC_5217.jpg` 后，可在素材工作目录复现：

```sh
magick DSC_5217.jpg -colorspace gray -blur 0x1 -threshold 58% -type TrueColor \
  -fill red -draw 'color 0,0 floodfill' -fill white +opaque red -fill black -opaque red \
  -colorspace gray -morphology Close Disk:3 -blur 0x0.65 -level 2%,98% atom66-mask.png
magick DSC_5217.jpg atom66-mask.png -alpha off -compose CopyOpacity -composite \
  -compose Over -trim +repage -resize 2800x -channel RGB -unsharp 0x0.9+0.85+0.025 \
  +channel -bordercolor none -border 100x80 atom66-product.png
cwebp -lossless -m 6 -exact -metadata all atom66-product.png -o atom66-product.webp
```
