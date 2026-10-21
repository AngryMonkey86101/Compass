#!/usr/bin/env python3
"""Генерирует иконки и заставку Android-приложения (Capacitor) из иконок PWA в public/.

Запуск из корня репозитория: python3 scripts/generate-android-assets.py  (нужен Pillow).
Перезаписывает шаблонные картинки Capacitor в android/app/src/main/res/.
"""
import glob
import os
from PIL import Image, ImageDraw

BG = (0x0D, 0x18, 0x20, 255)
RES = "android/app/src/main/res"
ICON = Image.open("public/icon-512.png").convert("RGBA")
MASKABLE = Image.open("public/icon-maskable-512.png").convert("RGBA")

# dp → px: mdpi ×1, hdpi ×1.5, xhdpi ×2, xxhdpi ×3, xxxhdpi ×4
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def resized(img, size):
    return img.resize((size, size), Image.LANCZOS)


for name, scale in DENSITIES.items():
    folder = f"{RES}/mipmap-{name}"
    # Обычная иконка 48 dp (Android до 8.0 и магазины)
    legacy = round(48 * scale)
    resized(ICON, legacy).save(f"{folder}/ic_launcher.png")
    mask = Image.new("L", (legacy, legacy), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
    round_icon = Image.new("RGBA", (legacy, legacy), (0, 0, 0, 0))
    round_icon.paste(resized(MASKABLE, legacy), (0, 0), mask)
    round_icon.save(f"{folder}/ic_launcher_round.png")

    # Адаптивная иконка: холст 108 dp, видимая часть — круг 72 dp в центре (66.7%).
    # У maskable-иконки PWA безопасная зона — 80% размера, поэтому она уменьшается
    # до 66.7 / 80 ≈ 83% холста, чтобы рисунок не обрезался маской лаунчера.
    canvas = round(108 * scale)
    inner = round(canvas * 0.667 / 0.8)
    fg = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    offset = (canvas - inner) // 2
    fg.paste(resized(MASKABLE, inner), (offset, offset))
    fg.save(f"{folder}/ic_launcher_foreground.png")

# Заставка при запуске: фон приложения и иконка по центру (≈ 28% меньшей стороны)
for path in glob.glob(f"{RES}/drawable*/splash.png"):
    width, height = Image.open(path).size
    splash = Image.new("RGBA", (width, height), BG)
    side = round(min(width, height) * 0.28)
    splash.paste(resized(ICON, side), ((width - side) // 2, (height - side) // 2), resized(ICON, side))
    splash.convert("RGB").save(path, optimize=True)

print("Иконки и заставки Android обновлены в", os.path.abspath(RES))
