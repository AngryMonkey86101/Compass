#!/usr/bin/env python3
"""Генерирует PWA-ресурсы в public/: иконки и картинки запуска iOS (apple-touch-startup-image).

Запуск из корня репозитория: python3 scripts/generate-pwa-assets.py  (нужен Pillow).
Печатает теги <link rel="apple-touch-startup-image"> для index.html.
"""
import math
import os
from PIL import Image, ImageDraw

BG = "#0d1820"

# (CSS-ширина, CSS-высота, devicePixelRatio) в портретной ориентации
DEVICES = [
    (375, 667, 2),   # iPhone SE, 8
    (414, 896, 2),   # iPhone XR, 11
    (375, 812, 3),   # iPhone X, XS, 11 Pro, 12/13 mini
    (414, 896, 3),   # iPhone XS Max, 11 Pro Max
    (390, 844, 3),   # iPhone 12, 13, 14
    (428, 926, 3),   # iPhone 12/13 Pro Max, 14 Plus
    (393, 852, 3),   # iPhone 14 Pro, 15, 16
    (430, 932, 3),   # iPhone 14 Pro Max, 15/16 Plus
    (402, 874, 3),   # iPhone 16 Pro
    (440, 956, 3),   # iPhone 16 Pro Max
    (744, 1133, 2),  # iPad mini 6
    (810, 1080, 2),  # iPad 10.2
    (820, 1180, 2),  # iPad 10.9, Air
    (834, 1194, 2),  # iPad Pro 11
    (834, 1210, 2),  # iPad Pro 11 (M4)
    (1024, 1366, 2), # iPad Pro 12.9
    (1032, 1376, 2), # iPad Pro 13 (M4)
]


def draw_dial(size, radius_frac, background=BG):
    s = size * 4  # рисуем с запасом и уменьшаем — сглаженные края
    im = Image.new("RGBA", (s, s), background)
    d = ImageDraw.Draw(im)
    c = s / 2
    r = s * radius_frac
    d.ellipse([c - r, c - r, c + r, c + r], fill="#13222c", outline="#c9d6de", width=max(2, s // 96))
    for deg in range(0, 360, 30):
        t = math.radians(deg)
        r1, r2 = r * 0.86, r * 0.97
        d.line([(c + r1 * math.sin(t), c - r1 * math.cos(t)), (c + r2 * math.sin(t), c - r2 * math.cos(t))],
               fill="#c9d6de", width=max(2, s // 128))
    a = r * 0.72
    d.polygon([(c, c - a), (c - a * 0.42, c + a * 0.62), (c, c + a * 0.36), (c + a * 0.42, c + a * 0.62)], fill="#4fc3f7")
    d.polygon([(c, c - r * 0.99), (c - r * 0.1, c - r * 0.8), (c + r * 0.1, c - r * 0.8)], fill="#f28b6e")
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs("public/splash", exist_ok=True)
    draw_dial(192, 0.44).save("public/icon-192.png", optimize=True)
    draw_dial(512, 0.44).save("public/icon-512.png", optimize=True)
    # maskable: Android обрезает по маске — всё важное внутри безопасной зоны (круг радиусом 40%)
    draw_dial(512, 0.34).save("public/icon-maskable-512.png", optimize=True)
    # iOS: без прозрачности, углы скругляет система
    draw_dial(180, 0.40).convert("RGB").save("public/apple-touch-icon.png", optimize=True)

    tags = []
    for w, h, dpr in DEVICES:
        for orientation, (pw, ph) in (("portrait", (w * dpr, h * dpr)), ("landscape", (h * dpr, w * dpr))):
            name = f"splash/splash-{pw}x{ph}.png"
            icon = draw_dial(round(min(pw, ph) * 0.28), 0.48)
            im = Image.new("RGB", (pw, ph), BG)
            im.paste(icon, ((pw - icon.width) // 2, (ph - icon.height) // 2), icon)
            # палитра вместо полноцвета: файл в разы меньше, заставка однотонная
            im.convert("P", palette=Image.ADAPTIVE, colors=64).save(f"public/{name}", optimize=True)
            tags.append(
                f'<link rel="apple-touch-startup-image" href="/{name}" media="(device-width: {w}px) '
                f'and (device-height: {h}px) and (-webkit-device-pixel-ratio: {dpr}) and (orientation: {orientation})" />'
            )
    print("\n".join(tags))


if __name__ == "__main__":
    main()
