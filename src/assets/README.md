# 设备照片

- `atom66-product.webp`：NIZ ATOM66 白灰键帽整机实拍，3000 × 1159，透明背景、无损 WebP，用于设备管理与连接完成步骤。
  - 来源：[Flashquark 的 NIZ Atom66 产品图库](https://flashquark.com/product/niz-atom66-bluetooth-rgb-electro-capacitative-keyboard/)。
  - [高分辨率原始 JPEG（DSC_5217.jpg）](https://flashquark.com/wp-content/uploads/2018/07/DSC_5217.jpg)，5384 × 3712，获取日期：2026-09-27。
  - 按用户选择，使用 ImageMagick 传统抠图与轻度锐化：提取闭合外壳轮廓、填充主体蒙版、平滑抗锯齿边缘，裁掉多余背景后缩小至键盘宽 2800 像素，并增加透明留白。保留真实照片中的键帽、文字、键位、配色与透视，不采用生成式修图结果。
  - 通过 `cwebp -lossless -m 6 -exact -metadata all` 无损编码，保留真实 alpha 透明通道；键盘内部完全不透明，外部完全透明，仅轮廓抗锯齿像素使用中间透明度。
  - 图片版权归原权利人所有；来源未提供开放图片许可，不包含在本项目代码的 MIT 许可内。

图片展示 ATOM66 系列的真实 66 键布局。[NIZ 官方产品页](https://www.nizkeyboard.com/products/niz-2019-new-member-atom66-the-smallest-electro-capactive-bluetooth-keyboard-with-rgb-or-non-rgb)说明 USB、蓝牙和 RGB 版本布局相同，因此 66EC-XRGB 与 66EC-S 共用这张产品照片；照片不用于表示当前灯效或识别用户更换的键帽。

照片作为本地素材导入组件，由 Vite 内联到独立 HTML，保持离线使用与现有 CSP，不在运行时访问图片来源站点。连接引导前两步继续使用 `connection-illustration.tsx` 中基于 Lucide 图标的 USB 接线图和浏览器选择设备示意，其动效展示操作顺序，不用于判断真实设备状态。

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
