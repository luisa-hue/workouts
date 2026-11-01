"""Generates the original Workouts app icon (a barbell on black). Run once: python3 scripts/make-icons.py"""
import os
from PIL import Image, ImageDraw, ImageFilter

RED = (250, 17, 79)
GREEN = (146, 232, 42)
BAR = (235, 235, 245)
SIZE = 1024


def barbell(scale: float) -> Image.Image:
    img = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))

    # soft red glow behind the bar
    glow = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((212, 312, 812, 712), fill=(120, 8, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.blend(img, glow, 1.0)

    d = ImageDraw.Draw(img)
    c = SIZE / 2

    def box(x0, y0, x1, y1):
        return (c + (x0 - c) * scale, c + (y0 - c) * scale, c + (x1 - c) * scale, c + (y1 - c) * scale)

    def rr(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle(box(x0, y0, x1, y1), radius=r * scale, fill=fill)

    rr(150, 480, 874, 544, 32, BAR)      # bar
    rr(270, 332, 340, 692, 28, RED)      # inner plates
    rr(684, 332, 754, 692, 28, RED)
    rr(196, 387, 256, 637, 24, GREEN)    # outer plates
    rr(768, 387, 828, 637, 24, GREEN)
    return img


out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(out, exist_ok=True)

full = barbell(1.0)
full.resize((192, 192), Image.LANCZOS).save(os.path.join(out, "icon-192.png"))
full.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon-512.png"))
full.resize((180, 180), Image.LANCZOS).save(os.path.join(out, "apple-touch-icon.png"))
barbell(0.72).resize((512, 512), Image.LANCZOS).save(os.path.join(out, "icon-maskable-512.png"))
print("icons written to", os.path.abspath(out))
