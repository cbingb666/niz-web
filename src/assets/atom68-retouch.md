# ATOM68 商业精修记录

- 日期：2026-10-01。
- 方式：内置 `image_gen` 主体精修与透明边缘编辑，随后沿用 ATOM66 的 ImageMagick alpha 蒙版收尾与 cwebp 无损编码。
- 主体输入：[NiZ 官方无广告标题的 ATOM68 正面照片](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/9dd518a6a1f59edc5f8cc4bd763cfca.png?v=1626686411)，1600 × 1600。来源为 [NiZ 官方产品页](https://www.nizkeyboard.com/products/niz-2019-new-atom-68-ec-bluetooth-keyboard-rgb-or-non-rgb)，原图 SHA-256：`45d29d3c7297e6a568109460b919efccd398650f589b6c5c566902286bc52cf8`。
- 风格参考：`atom66-product-retouched.webp`，仅参考光线、白平衡、材质及构图；ATOM68 的 68 键布局、长空格键和照片中的 Fn 顺序保留。
- 输出：`atom68-product-retouched.webp`，2151 × 731，1,006,452 字节（约 983 KiB），真实 alpha、无损 WebP。
- 仓库内的原始 `atom68-product.jpg` 单独保留。精修图沿用 NiZ 或原权利人的版权归属，不包含在代码 MIT 许可内。
- 精修是生成式摄影修复；细小字符可能经过重绘，照片不作为协议键位、默认配置、型号识别或固件功能的依据。

## 主体精修提示词

```text
Use case: precise-object-edit / background-extraction.
Asset type: photorealistic commercially retouched keyboard product cutout for the existing NIZ Web configurator.

Image 1 is the EDIT TARGET: the original official NIZ ATOM68 white-and-gray 68-key keyboard photograph. Retouch this exact keyboard; do not redesign, substitute, or reinterpret the product.
Image 2 is a STYLE REFERENCE ONLY: the project's retouched ATOM66 photo. Match its restrained neutral studio finish, clean white balance, natural PBT texture, horizontal framing and transparent-background product presentation. Never copy its 66-key geometry, key legends, Fn arrangement, or shortened spacebar.

Primary request: extract the complete ATOM68 keyboard from its gray photo background and produce a polished, evenly lit product photograph. Correct subtle perspective skew and align the keyboard horizontally, keeping the original near-top-down angle and realistic depth. Improve sharpness and restrained microcontrast, neutralize the gray color cast, remove minor dust and blemishes, preserve real matte PBT grain and molded case bevels. Retain gentle dark shading between keys and realistic highlights; avoid a CGI/plastic look, glare, halos, or dramatic lighting.

CRITICAL INVARIANTS: exactly 68 keys in the original five rows of 15,15,14,14,10; preserve every stagger, every key's position and width, the full-length spacebar, separate up-arrow and the three bottom-right arrows, and the full rounded white case. Preserve the exact photographed gray modifier / white alphanumeric pattern. Preserve all visible lettering, small secondary legends, Windows mark and NIZ spacebar logo in their original photographed positions. In this target photo the key immediately to the right of Space is Fn, then Alt, then Ctrl; the far-right column is backtick, Delete, PgUp, PgDn, Right arrow. Keep that photographed arrangement, regardless of the software's default captions. Do not add, omit, merge, duplicate, or move keys or characters. The goal is photographic retouching, not hardware documentation or a newly invented keyboard.

Composition: one complete horizontal keyboard, centered on a wide landscape canvas approximately 3:1, with a small even transparent margin. Frame the subject at roughly the same scale and camera angle as the reference. Keep the entire outer case visible, crisp and smooth. Aim for an approximately 2000–2400-pixel-wide asset.

Background: genuinely transparent alpha everywhere outside the physical keyboard, not a checkerboard, white, black, gray, or gradient background. The whole physical keyboard including all dark gaps and case must be opaque. Preserve only a thin antialiased contour. No residual white speckles, disconnected pixels, fringes, drop shadows, floor reflections, glow, props, captions, poster headlines, advertising text, extra logos, or watermarks.
```

## 透明边缘编辑提示词

```text
Use case: background-extraction.
Image 1 is the EDIT TARGET: the already retouched NIZ ATOM68 keyboard photograph with an imperfect alpha cutout.

Make ONE targeted change only: repair the transparency mask. Do not redraw or relight the keyboard.
Remove every pale speckle, disconnected residue, cloud-shaped fragment, faint gray film and fringe OUTSIDE the smooth physical keyboard case boundary. The pixels outside the product must have alpha exactly zero. Current non-product residue is especially visible in the transparent margin ABOVE the case; erase all of it, leaving a clean continuous empty transparent margin.

Make the physical product completely opaque, including white case, gray/white keycaps, black key gaps, all text and logos. Only a very thin antialiased contour on the true rounded case boundary may have partial alpha. No background, floor, glow, shadow, gradients or checkerboard. Do not change RGB detail, product lighting, color balance, material grain or shape.

Preserve the complete existing horizontal 68-key keyboard and its five rows of 15,15,14,14,10. Preserve every key and exact key width, long spacebar, the separate up and three bottom-right arrows, lettering and secondary printing, Windows symbol and NIZ logo. Keep the original photographed Fn/Alt/Ctrl order. Keep all product edges fully visible and keep the approximately 2151x731 landscape framing with even transparent margins. Output a clean genuine transparent PNG suitable for an asset on both dark and light interfaces. No stray pixels anywhere outside the case.
```

## 最终 alpha 蒙版与编码

第二轮生成图的主体透明度略低于完全不透明，外部也存在低透明度残留，因此按 ATOM66 的既有流程处理 alpha。下列处理只替换透明度；以 8 位 RGBA 解码逐像素比较，收尾和无损编码前后的 RGB 像素差异为 0。

将第二轮输出另存为 `generated-retouched.png` 后执行：

```sh
magick generated-retouched.png -alpha extract -threshold 50% \
  -define connected-components:area-threshold=10000 \
  -define connected-components:mean-color=true -connected-components 8 \
  -morphology Open Disk:2 -morphology Close Disk:2 \
  -blur 0x0.45 -level 5%,95% retouched-mask.png
magick generated-retouched.png retouched-mask.png -alpha off \
  -compose CopyOpacity -composite retouched.png
cwebp -lossless -m 6 -exact -metadata all retouched.png -o atom68-product-retouched.webp
```

## 检查结果

- 在深色和白色背景合成预览中检查主体、68 键布局、轮廓和边缘残留；完整外壳保留，没有广告标题或额外阴影。
- 输出周边四条边的 alpha 全为 0，键帽和主体内部的 alpha 全为 255。非零 alpha 的包围盒为 `(41, 40)–(2108, 708)`，只在真实轮廓保留抗锯齿透明度。
- 设备卡与连接完成步骤使用精修图，复用 ATOM66 的完整图片显示方式，移除原 JPEG 的 CSS 裁切；构建时内联到独立 HTML。
- 原始输入、两轮生成图及预览只作为素材工作文件，不作为硬件验证，也不进入应用配置、原厂软件目录或构建运行时。
