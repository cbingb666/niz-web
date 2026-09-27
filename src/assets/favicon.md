# NIZ Web favicon

The mark combines a mint N with a dark keyboard keycap and a green base. It follows the application's mint and charcoal palette.

`niz-web-icon.png` is the original 1254 × 1254 PNG with transparent edges, generated with the built-in ImageGen tool. `favicon.ico` contains PNG-compressed 16, 24, 32, 48, 64, 128, and 256 px images. The HTML references the ICO; Vite embeds it as a data URL for the standalone build.

## Generation prompt

```text
Use case: logo-brand
Asset type: original favicon artwork for NIZ Web, an open-source keyboard configurator.
Primary request: Create exactly one polished 1024x1024 square raster icon, optimized for recognition at 16x16 and 32x32 favicon sizes.
Scene/backdrop: Genuinely transparent background with a real alpha channel outside the icon silhouette, not a checkerboard image and not a white background.
Subject: One charcoal (#111416) rounded-square keyboard keycap, viewed perfectly straight-on and symmetrically. A very restrained dark-green or mint offset base peeks from the bottom, hinting at keyboard layers, rendered as flat solid geometry.
Text (verbatim): "N"
Typography: One oversized bold mint-green (#6de3bc) uppercase geometric N, centered on the keycap, with thick simple strokes and crisp corners. The N is the dominant recognizable element.
Style/medium: Flat vector-like app mark rendered as a raster PNG; crisp high contrast solid shapes.
Composition/framing: Centered single icon, generous 8-10% transparent safe margin on every side, rounded-square silhouette. Fill most of the keycap face with the large N while leaving balanced padding.
Constraints: Exactly one icon, exactly one letter N, no other text. Real transparent alpha around the outside. Sharp clean edges with antialiasing only at shape boundaries. Straight-on view, no perspective.
Avoid: Photographs, mockups, extra tiny keyboard keys, wordmarks, gradients, glow, cast shadows, textured shading, badges, ornaments, decorative elements, secondary objects, 3D rendering.
```

The generated image has subtle shading and a 1254 px canvas despite the requested flat style and 1024 px size. It is retained unchanged as the source.

## Export the ICO

With Python and Pillow available, run from the repository root:

```sh
python3 - <<'PY'
from PIL import Image

with Image.open('src/assets/niz-web-icon.png') as image:
    image.save(
        'src/assets/favicon.ico',
        format='ICO',
        sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)],
    )
PY
```
