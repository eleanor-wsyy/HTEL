"""Create paper-background display copies, preserving originals and colored pixels.

Requires Pillow and NumPy. Only neutral near-white pixels (R=G=B >= 245)
are changed; dimensions, alpha, all colored marks and darker text stay exact.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
report = []
for source in sorted((ROOT / 'assets/figma').glob('*.png')):
    if source.stem.endswith(('-paper', '-hires')):
        continue
    hires = source.with_stem(source.stem + '-hires')
    input_file = hires if hires.exists() else source
    original = np.array(Image.open(input_file).convert('RGBA'))
    result = original.copy()
    changed = 0
    for y in range(0, original.shape[0], 128):
        src = original[y:y+128]
        dst = result[y:y+128]
        rgb = src[:, :, :3]
        mask = (rgb[:, :, 0] == rgb[:, :, 1]) & (rgb[:, :, 1] == rgb[:, :, 2]) & (rgb[:, :, 0] >= 245)
        weight = (rgb[:, :, 0][mask].astype(float) - 245) / 10
        dst[:, :, :3][mask] = np.rint(rgb[mask].astype(float) - weight[:, None] * np.array([8, 9, 16])).astype('uint8')
        assert np.array_equal(dst[~mask], src[~mask])
        assert np.array_equal(dst[:, :, 3], src[:, :, 3])
        changed += int(mask.sum())
    output = source.with_stem(source.stem + '-paper')
    Image.fromarray(result).save(output, optimize=True)
    assert Image.open(output).size == Image.open(input_file).size
    report.append({'chart': source.stem, 'backgroundPixels': changed, 'coloredPixelsUnchanged': True})
print(json.dumps(report, ensure_ascii=False))

# Apply the approved layout and Chinese-label overrides after background conversion.
from refine_chart_assets import refine
refine(ROOT)
