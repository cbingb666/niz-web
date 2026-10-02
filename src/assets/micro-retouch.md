# MICRO82 / MICRO84 product-image retouching

Date: 2026-10-02. The two project assets were created with the built-in `image_gen` tool using official product photographs as edit targets and `atom66-product-retouched.webp` as a style reference. ImageMagick then cleaned only the alpha masks; cwebp encoded the final images losslessly. No fallback API or CLI image-generation model was used.

## Sources and ownership

- MICRO82: [official product page](https://www.nizkeyboard.com/products/2019-new-micro-82-ec-keyboard-s-ble-ble-rgb-or-non-rgb), [original front-view PNG](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/3b75ebb933cf0a920e610ac9d9568d7.png?v=1626745204), 3840 × 3840. SHA-256: `08e5f022169ca184d9e05e3c7ffca8dba0a6b7719bd8bb067a2edf8c36619644`.
- MICRO84: [official product page](https://www.nizkeyboard.com/products/new-micro84-bluetooth-usb-ec-keyboard-with-rgb-non-rgb), [original front-view PNG](https://cdn.shopify.com/s/files/1/0033/5708/1712/products/c83b10537a5681f0e8e19f2b01ea339.png?v=1626745747), 3840 × 3840. SHA-256: `1b0a00c2ce9e4f85a7849cf6de4a748bc59a28ec281bb857782a24720265075d`.

These are the original gallery photos. The MICRO82 target has a long spacebar and one Fn; the MICRO84 target has a short spacebar and two Fn keys. MICRO82 Pro, MINI84 and L84 images were not used. The original photographs and generated source PNGs remain outside the repository; the generated originals are retained in Codex's generated-images directory. The final WebP assets are stored in this directory.

The images are derivatives of vendor photographs. NiZ or the original rights holder retains copyright; no open image license was identified. They are outside the source code's MIT license. Small legends may have been reconstructed by generative retouching and are not protocol evidence, factory-keymap evidence or proof of hardware support. The photographed bottom-row legends differ from the inspected software's captions, so the retouching preserves the photographs' arrangement.

## Final assets and checks

| Asset | Dimensions | Bytes | Nonzero alpha bounding box |
| --- | --- | ---: | --- |
| `micro82-product-retouched.webp` | 1942 × 809 | 976,232 | `(64, 69)–(1870, 782)` |
| `micro84-product-retouched.webp` | 1938 × 811 | 985,878 | `(47, 64)–(1891, 790)` |

Both images retain all six rows and all 82 / 84 keys, their distinct spacebars, photographed Fn positions, original colors and full cases. They were inspected against dark and white backgrounds. The canvas borders have alpha zero, the tested interior rectangle is fully opaque, and only the contour has partial alpha. Alpha cleanup changed zero RGB pixels; lossless WebP encoding preserved the entire 8-bit RGBA image exactly.

The shared `DeviceIllustration` component displays each model's own image on device cards, the connected step of the guide and the offline demo chooser. It retains the existing contain sizing, intrinsic dimensions, disabled dragging and localized accessible names. Vite embeds both assets in the standalone HTML; there are no runtime source-site requests. Image inspection does not constitute real-browser layout testing or hardware validation.

## Alpha cleanup and encoding

The initial tool outputs had low-opacity external white speckles and mostly 253-alpha interiors. The existing ATOM66 / ATOM68 finishing process removed those residues and made the products opaque without redrawing their RGB contents. Run the following for each generated source, replacing `generated.png` and the output name:

```sh
magick generated.png -alpha extract -threshold 50% \\
  -define connected-components:area-threshold=10000 \\
  -define connected-components:mean-color=true -connected-components 8 \\
  -morphology Open Disk:2 -morphology Close Disk:2 \\
  -blur 0x0.45 -level 5%,95% mask.png
magick generated.png mask.png -alpha off \\
  -compose CopyOpacity -composite retouched.png
cwebp -quiet -lossless -m 6 -exact -metadata all retouched.png \\
  -o micro82-product-retouched.webp
```

## Complete built-in tool prompts

### MICRO82

```text
Use case: precise-object-edit / background-extraction.
Asset type: commercially retouched product photograph cutout for the existing NIZ Web keyboard configurator.
Image 1 is the EDIT TARGET: the official white-and-gray NIZ keyboard photograph. Image 2 is a STYLE REFERENCE ONLY: the project's retouched ATOM66 keyboard. Match its neutral studio white balance, restrained material detail and product-only transparent presentation. Do not copy its key geometry or lettering.
Retouch the target photograph, correcting slight camera skew and soft contrast, improving clarity, natural PBT grain and neutral white balance. Use even diffuse studio lighting and realistic subtle dark gaps. Remove the entire gray background and cast shadow. Keep the full white rounded case and every key. Do not redesign, add, omit, duplicate, move or merge any keys.
Composition: one complete keyboard, perfectly horizontal, centered on a wide landscape canvas about 2.4:1, approximately 2200–2400 pixels wide, with only a small even transparent margin. Preserve the near-top-down camera angle and physical depth. Keep the entire outer case visible. No props, advertising headings, added logos or watermarks.
Background: genuinely transparent alpha outside the physical keyboard. Every part of the keyboard, including dark gaps, case, keycaps, lettering and logos, must be fully opaque. Only the thin antialiased case edge may be partially transparent. No haze, pale speckles, floating residue, external shadows, floor, gradient or checkerboard.
Preserve the photographed keycap colors, all main legends, secondary legends, Windows icon and NIZ spacebar logo. This is photographic retouching, never hardware redesign.
CRITICAL MODEL INVARIANTS: original MICRO82 / 82EC, exactly 82 keys in six rows of 14,15,15,14,14,10. Preserve the separate function row Esc, F1–F12, Del, including the physical spaces between F-key groups. Preserve the long 6.25-unit spacebar. In the source photograph the bottom row is Ctrl, Windows, Alt, long Space, Alt, Fn, Menu, Left, Down, Right; preserve this photographed order. Keep Home, PgUp, PgDn, End on the far-right column and the separate Up key. Never use the ATOM66 short spacebar or MICRO84 dual-Fn bottom row.
```

### MICRO84

```text
Use case: precise-object-edit / background-extraction.
Asset type: commercially retouched product photograph cutout for the existing NIZ Web keyboard configurator.
Image 1 is the EDIT TARGET: the official white-and-gray NIZ keyboard photograph. Image 2 is a STYLE REFERENCE ONLY: the project's retouched ATOM66 keyboard. Match its neutral studio white balance, restrained material detail and product-only transparent presentation. Do not copy its key geometry or lettering.
Retouch the target photograph, correcting slight camera skew and soft contrast, improving clarity, natural PBT grain and neutral white balance. Use even diffuse studio lighting and realistic subtle dark gaps. Remove the entire gray background and cast shadow. Keep the full white rounded case and every key. Do not redesign, add, omit, duplicate, move or merge any keys.
Composition: one complete keyboard, perfectly horizontal, centered on a wide landscape canvas about 2.4:1, approximately 2200–2400 pixels wide, with only a small even transparent margin. Preserve the near-top-down camera angle and physical depth. Keep the entire outer case visible. No props, advertising headings, added logos or watermarks.
Background: genuinely transparent alpha outside the physical keyboard. Every part of the keyboard, including dark gaps, case, keycaps, lettering and logos, must be fully opaque. Only the thin antialiased case edge may be partially transparent. No haze, pale speckles, floating residue, external shadows, floor, gradient or checkerboard.
Preserve the photographed keycap colors, all main legends, secondary legends, Windows icon and NIZ spacebar logo. This is photographic retouching, never hardware redesign.
CRITICAL MODEL INVARIANTS: original MICRO84 / 84EC, exactly 84 keys in six rows of 14,15,15,14,14,12. Preserve the separate function row Esc, F1–F12, Delete, including the physical spaces between F-key groups. Preserve the short spacebar and two Fn keys. In the source photograph the bottom row is Ctrl, Fn, Windows, Alt, short Space, Fn, Alt, Menu, Ctrl, Left, Down, Right; preserve this photographed order. Keep Home, PgUp, PgDn, End on the far-right column and the separate Up key. Never replace the bottom row with MICRO82's long spacebar or ATOM66's five rows.
```
