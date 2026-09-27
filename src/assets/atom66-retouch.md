# ATOM66 商业精修记录

- 日期：2026-09-27
- 方式：内置 `image_gen` 编辑；随后以 ImageMagick 清理 alpha 蒙版，使用 cwebp 无损编码。
- 输入：`atom66-product.webp`，来源和版权见同目录 README。
- 输出：`atom66-product-retouched.webp`，2014 × 780，透明背景。
- 精修图用于产品展示；细小副刻经过生成式修复，不作为键位或功能标注依据。原始照片单独保留。

## 主体精修提示词

```text
Use case: precise-object-edit.
Asset type: commercially retouched, photorealistic keyboard product cutout for an existing dark keyboard configurator.

Image 1 is the EDIT TARGET: the original NIZ ATOM66 white-and-gray keyboard product photograph. Retouch this exact photographed product; do not redesign or replace it.

Primary request: create a clean, restrained, premium commercial product photograph. Correct the slight camera skew so the keyboard is level and centered, with natural straight edges and the original near-top-down viewing angle. Improve genuine detail, controlled microcontrast, neutral white balance and edge quality. Remove minor dust/handling blemishes. Retain realistic matte PBT keycap grain, subtle molded bevels and the white case material; avoid a plastic CGI look. Use broad, even, neutral studio diffusion, soft natural shading between keys and clean, controlled highlights on the case. No dramatic lighting, no glare, no oversharpened halos.

CRITICAL INVARIANTS: preserve the exact original 66-key layout, staggered rows, every key shape and width, the spacebar, arrow keys and entire case silhouette. Preserve every visible key legend, secondary Fn printing, Windows mark and NIZ logo in their original positions. Do not invent, replace, merge, duplicate or omit keys or lettering. Keep all key legends and case details in focus. Keep the white and light-gray keycap color pattern identical to the reference. Correct only the photograph's finish, alignment, clarity and lighting.

Composition: one complete horizontal keyboard, fully visible, centered, wide landscape aspect close to 3:1, only a small even transparent margin. No rotation, no fashionable oblique angle, no perspective exaggeration. High-resolution, suitable for a 2400-pixel-wide product asset.

Background: genuinely TRANSPARENT alpha background, not a checkerboard, not solid white or black. Clean anti-aliased edges without a white fringe. Do not bake in a spotlight, gradient, glow, reflection, floor, scenery or drop shadow. No props, captions, advertising text, added logos or watermarks.
```

## 透明边缘清理提示词

```text
Use case: background-extraction.
Image 1 is the edit target: the commercially retouched NIZ ATOM66 keyboard cutout.

Make ONE change only: repair the alpha cutout. Remove ALL stray white speckles, fringe, dust-shaped islands and pixel residue outside the keyboard's smooth outer case boundary. The entire region outside the physical keyboard must be truly transparent (alpha zero), including the strips above, below, left and right. The physical keyboard, including every key, lettering, dark gaps, white case and logo, must be fully opaque. Preserve only a very thin clean antialiased contour at the case boundary.

Keep the keyboard image itself identical: same 66 keys, identical exact legends and secondary printing, same proportions, white/gray color pattern, studio lighting, clean horizontal alignment and photorealistic material. Do not redraw the keyboard or change any labels. Do not add shadows, backgrounds, gradients or checkerboards. Preserve the 2016 × 780 wide canvas with the entire product visible. Output a clean commercially usable transparent PNG cutout.
```

## 最终蒙版和编码

下列处理仅替换 alpha 通道；处理前后忽略 alpha 比较，RGB 像素差异为 0。将第二轮输出保存为 `retouched-source.png` 后执行：

```sh
magick retouched-source.png -alpha extract -threshold 50% \
  -define connected-components:area-threshold=10000 \
  -define connected-components:mean-color=true -connected-components 8 \
  -morphology Open Disk:2 -morphology Close Disk:2 \
  -blur 0x0.45 -level 5%,95% retouched-mask.png
magick retouched-source.png retouched-mask.png -alpha off \
  -compose CopyOpacity -composite retouched.png
cwebp -lossless -m 6 -exact -metadata all retouched.png -o atom66-product-retouched.webp
```
