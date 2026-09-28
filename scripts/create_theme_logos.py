import argparse
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / "public" / "logos"

PALETTES = {
    "light": ((242, 242, 242), (255, 255, 255), (5, 5, 5), (105, 105, 105)),
    "dark": ((13, 11, 16), (81, 65, 95), (242, 238, 246), (150, 116, 181)),
    "pastel": ((232, 98, 103), (145, 83, 225), (104, 77, 121), (255, 255, 255)),
    "hacker": ((2, 6, 4), (6, 16, 8), (51, 255, 102), (69, 173, 92)),
    "gothic": ((9, 7, 8), (36, 23, 26), (208, 163, 99), (157, 52, 72)),
    "zen": ((229, 241, 239), (215, 238, 247), (23, 61, 58), (105, 169, 154)),
}


def mix(left, right, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(left, right))


def make_variant(image, palette):
    start, end, foreground, line = palette
    source = image.convert("RGB")
    width, height = source.size
    output = Image.new("RGBA", source.size)
    source_pixels = source.load()
    output_pixels = output.load()

    for y in range(height):
        for x in range(width):
            red, green, blue = source_pixels[x, y]
            minimum, maximum = min(red, green, blue), max(red, green, blue)
            if maximum < 65:
                color = foreground
            elif minimum > 220 and maximum - minimum < 28:
                color = line
            else:
                color = mix(start, end, x / max(1, width - 1))
            output_pixels[x, y] = (*color, 255)

    mask = Image.new("L", source.size, 0)
    radius = round(min(width, height) * 0.19)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    output.putalpha(mask)
    return output


def main():
    parser = argparse.ArgumentParser(description="Create rounded F.T.B. logo variants for every app theme.")
    parser.add_argument("source", type=Path, help="Path to the original square F.T.B. PNG")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.source).resize((512, 512), Image.Resampling.LANCZOS)
    for name, palette in PALETTES.items():
        variant = make_variant(source, palette)
        variant.save(OUTPUT / f"ftb-{name}.png", optimize=True)

    default = Image.open(OUTPUT / "ftb-pastel.png")
    default.resize((192, 192), Image.Resampling.LANCZOS).save(OUTPUT / "ftb-icon-192.png", optimize=True)
    default.resize((512, 512), Image.Resampling.LANCZOS).save(OUTPUT / "ftb-icon-512.png", optimize=True)


if __name__ == "__main__":
    main()
