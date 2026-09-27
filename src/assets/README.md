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
