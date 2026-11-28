"""Export native-resolution Runder-Spiegel maps. Requires NumPy and Pillow.

Run from any directory: python scripts/export-runder-spiegel.py
Outputs clean and 30-degree-graticule PNGs in exports/. Uses the full local
Natural Earth texture, independent of the interactive viewer's current settings.
"""

from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "world-map-natural-earth.jpg"


def render(source: Image.Image) -> Image.Image:
    # A square with the source's full longitudinal resolution. Supersampling
    # reduces aliasing where sin(longitude/2) compresses the map's outer edges.
    size = source.width
    samples = size * 2
    pixels = np.asarray(source.convert("RGB"))
    source_height, source_width = pixels.shape[:2]
    image = Image.new("RGB", (samples, samples))

    x = (np.arange(samples, dtype=np.float64) + 0.5) * 2 / samples - 1
    longitude = 2 * np.arcsin(x)
    source_x = (longitude / (2 * math.pi) + 0.5) * source_width - 0.5
    left = np.floor(source_x).astype(np.int32)
    fraction_x = (source_x - left).astype(np.float32)[None, :, None]
    right = (left + 1) % source_width
    left %= source_width

    # Small row blocks bound temporary memory even at the full export size.
    for start in range(0, samples, 32):
        end = min(samples, start + 32)
        y = 1 - (np.arange(start, end, dtype=np.float64) + 0.5) * 2 / samples
        latitude = 2 * np.arctan(y)
        source_y = np.clip((0.5 - latitude / math.pi) * source_height - 0.5, 0, source_height - 1)
        top = np.floor(source_y).astype(np.int32)
        bottom = np.minimum(top + 1, source_height - 1)
        fraction_y = (source_y - top).astype(np.float32)[:, None, None]

        upper = pixels[top[:, None], left].astype(np.float32) * (1 - fraction_x)
        upper += pixels[top[:, None], right] * fraction_x
        lower = pixels[bottom[:, None], left].astype(np.float32) * (1 - fraction_x)
        lower += pixels[bottom[:, None], right] * fraction_x
        block = np.rint(upper * (1 - fraction_y) + lower * fraction_y).astype(np.uint8)
        image.paste(Image.fromarray(block), (0, start))

    return image.resize((size, size), Image.Resampling.LANCZOS)


def add_graticule(image: Image.Image, spacing: int = 30) -> Image.Image:
    image = image.copy()
    draw = ImageDraw.Draw(image)
    size = image.width
    width = max(1, size // 2048)
    for longitude in range(-180, 181, spacing):
        x = round((math.sin(math.radians(longitude) / 2) + 1) * size / 2)
        x = min(size - 1, x)
        draw.line([(x, 0), (x, size - 1)], fill="white", width=width)
    last_latitude = ((90 - 1) // spacing) * spacing
    for latitude in range(-last_latitude, last_latitude + 1, spacing):
        y = round((1 - math.tan(math.radians(latitude) / 2)) * size / 2)
        draw.line([(0, y), (size - 1, y)], fill="white", width=width)
    return image


def main() -> None:
    with Image.open(SOURCE) as source:
        image = render(source)
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Title", "Runder-Spiegel")
    metadata.add_text("Creator", "Noel Friedrich — https://noel-friedrich.de")
    metadata.add_text("Projection", "x = sin(longitude / 2); y = tan(latitude / 2); angles in radians")
    metadata.add_text("Source", "Natural Earth I, NE1_50M_SR_W; public domain; local 4096 x 2048 texture")
    directory = ROOT / "exports"
    directory.mkdir(exist_ok=True)
    for suffix, result in [("", image), ("-graticule-30", add_graticule(image))]:
        path = directory / f"runder-spiegel-{image.width}{suffix}.png"
        result.save(path, pnginfo=metadata)
        print(f"Exported {path.name}: {result.width} x {result.height}, {path.stat().st_size:,} bytes", flush=True)


if __name__ == "__main__":
    main()
