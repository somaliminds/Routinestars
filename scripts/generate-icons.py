"""
Generate all app icon assets from the master logo (4.png — icon-only).

Produces (in apps/mobile/assets/):
  icon.png                        1024x1024  iOS + Expo master — solid lavender bg
  splash-icon.png                 1024x1024  Splash screen — same as icon
  android-icon-foreground.png     1024x1024  Android adaptive foreground (transparent bg)
                                             Logo centred within 66% safe zone
  android-icon-background.png     1024x1024  Android adaptive background (solid lavender)
  android-icon-monochrome.png     1024x1024  Themed-icon variant (white logo, transparent bg)
  favicon.png                       48x48    Web favicon

Assumptions:
  - Input master at project root: 4.png (logo only, white background)
  - We treat near-white pixels as transparent so we can recompose on lavender.
"""
from PIL import Image, ImageOps, ImageFilter
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MASTER = os.path.join(ROOT, 'design', 'logo-source', '4.png')
OUT_DIR = os.path.join(ROOT, 'apps', 'mobile', 'assets')

# MY24 palette
LAVENDER_BG = (245, 240, 255)  # #F5F0FF  soft lavender (matches app bg)
BRAND_PURPLE = (124, 58, 237)  # #7C3AED  brand-primary (for splash if desired)

ICON_SIZE = 1024
SAFE_ZONE = 0.66  # Android adaptive icon safe zone is ~66% of canvas


def load_master_logo_transparent() -> Image.Image:
    """Load 4.png and convert the white background to transparent."""
    img = Image.open(MASTER).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Treat very light pixels (near-white) as transparent.
            # Logo colours are saturated enough that this is safe.
            if r > 245 and g > 245 and b > 245:
                pixels[x, y] = (255, 255, 255, 0)
    return img


def trim_transparent_borders(img: Image.Image) -> Image.Image:
    """Crop the image to the bounding box of non-transparent content."""
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def make_square_canvas(size: int, bg_color: tuple) -> Image.Image:
    return Image.new('RGBA', (size, size), bg_color + (255,))


def paste_logo_centred(canvas: Image.Image, logo: Image.Image, scale: float = 0.75) -> Image.Image:
    """Resize logo to fill `scale` proportion of the canvas, paste centred."""
    cw, ch = canvas.size
    target_w = int(cw * scale)
    # Maintain aspect ratio
    lw, lh = logo.size
    ratio = min(target_w / lw, target_w / lh)
    new_w = int(lw * ratio)
    new_h = int(lh * ratio)
    resized = logo.resize((new_w, new_h), Image.LANCZOS)
    pos = ((cw - new_w) // 2, (ch - new_h) // 2)
    canvas = canvas.copy()
    canvas.paste(resized, pos, resized)
    return canvas


def to_monochrome(logo: Image.Image, color: tuple = (255, 255, 255)) -> Image.Image:
    """Convert the logo to a flat single-colour silhouette on transparent bg."""
    out = Image.new('RGBA', logo.size, (0, 0, 0, 0))
    pixels = logo.load()
    out_pixels = out.load()
    w, h = logo.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 30:  # any visible pixel becomes solid colour
                out_pixels[x, y] = color + (a,)
    return out


def main() -> None:
    print(f'Loading master: {MASTER}')
    logo = load_master_logo_transparent()
    logo = trim_transparent_borders(logo)
    print(f'Trimmed logo size: {logo.size}')

    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. icon.png — iOS / Expo master. Solid lavender bg, logo at 75% scale.
    canvas = make_square_canvas(ICON_SIZE, LAVENDER_BG)
    icon = paste_logo_centred(canvas, logo, scale=0.78)
    out = os.path.join(OUT_DIR, 'icon.png')
    icon.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    # 2. splash-icon.png — same as icon, slightly smaller scale (splash has lots of bg)
    canvas = make_square_canvas(ICON_SIZE, LAVENDER_BG)
    splash = paste_logo_centred(canvas, logo, scale=0.55)
    out = os.path.join(OUT_DIR, 'splash-icon.png')
    splash.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    # 3. android-icon-foreground.png — transparent bg, logo at SAFE_ZONE scale
    fg_canvas = Image.new('RGBA', (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    fg = paste_logo_centred(fg_canvas, logo, scale=SAFE_ZONE)
    out = os.path.join(OUT_DIR, 'android-icon-foreground.png')
    fg.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    # 4. android-icon-background.png — solid lavender, no logo
    bg = make_square_canvas(ICON_SIZE, LAVENDER_BG)
    out = os.path.join(OUT_DIR, 'android-icon-background.png')
    bg.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    # 5. android-icon-monochrome.png — white silhouette of logo, transparent bg
    mono_logo = to_monochrome(logo, color=(255, 255, 255))
    mono_canvas = Image.new('RGBA', (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    mono = paste_logo_centred(mono_canvas, mono_logo, scale=SAFE_ZONE)
    out = os.path.join(OUT_DIR, 'android-icon-monochrome.png')
    mono.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    # 6. favicon.png — 48x48 web favicon
    fav_canvas = make_square_canvas(48, LAVENDER_BG)
    favicon = paste_logo_centred(fav_canvas, logo, scale=0.85)
    out = os.path.join(OUT_DIR, 'favicon.png')
    favicon.save(out, 'PNG', optimize=True)
    print(f'  Wrote {out}')

    print('\nDone. All 6 assets generated.')


if __name__ == '__main__':
    main()
