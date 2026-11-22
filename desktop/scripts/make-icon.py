"""Generate build/icon.ico (and icon.png) for PlanMark with Pillow."""
import os, sys
from PIL import Image, ImageDraw

out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'build')
os.makedirs(out_dir, exist_ok=True)
S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=190, fill=(30, 87, 170, 255))
# page with folded corner
px0, py0, px1, py1, fold = 250, 170, 774, 854, 150
d.polygon([(px0, py0), (px1 - fold, py0), (px1, py0 + fold), (px1, py1), (px0, py1)], fill=(255, 255, 255, 255))
d.polygon([(px1 - fold, py0), (px1 - fold, py0 + fold), (px1, py0 + fold)], fill=(196, 210, 232, 255))
# "plan" lines
for i, y in enumerate(range(330, 700, 80)):
    d.rounded_rectangle([px0 + 70, y, px1 - 70 - (120 if i % 2 else 0), y + 26], radius=13, fill=(160, 178, 205, 255))
# red markup cloud/ellipse and check
d.ellipse([330, 560, 700, 790], outline=(220, 45, 45, 255), width=34)
img.save(os.path.join(out_dir, 'icon.png'))
img.save(os.path.join(out_dir, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icon written to', os.path.abspath(out_dir))
