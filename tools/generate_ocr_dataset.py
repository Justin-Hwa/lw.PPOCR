#!/usr/bin/env python3
"""Generate a deterministic, metadata-backed local OCR stress dataset.

Generated images belong under build-local-data/ and are intentionally not
release assets. Real-font paths are supplied by the caller and are recorded by
basename plus SHA-256 so the manifest does not expose machine-specific paths.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont


DEFAULT_TEXTS: tuple[tuple[str, str], ...] = (
    ("mixed-cn-en", "纯托管推理引擎不依赖 native library 并且支持多个动态输入尺寸"),
    ("long-line", "这是一段明显较长的中文文本用于测试动态识别宽度和压缩行为"),
    ("english", "OpenVINO and pure managed CSharp performance comparison 2026"),
    ("english", "The quick brown fox jumps over the lazy dog while OCR reads every word"),
    ("identifier", "Invoice number 20260830 amount 128.50 date 2026-08-30 validation text"),
    ("identifier", "PPOCRSharp dynamic recognition benchmark with variable width input"),
    ("mixed-cn-en", "检测后处理与文字方向分类应该保持和 PaddleOCR 官方结果一致"),
    ("mixed-cn-en", "这是用于性能基准的更长文本行包含中文 English 以及数字 1234567890"),
    ("short-cn", "文本识别结果"),
    ("short-cn", "边界框与旋转"),
    ("short-cn", "可重复性测试"),
    ("short-cn", "方向分类 180 度"),
    ("identifier", "OpenVINO dynamic width"),
    ("identifier", "Dynamic shape session"),
    ("identifier", "Batch size eight"),
    ("mixed-cn-en", "纯托管 C# 推理"),
)

ASCII_FALLBACK_TEXTS: tuple[tuple[str, str], ...] = (
    ("english", "OCR deterministic dataset"),
    ("english", "OpenVINO dynamic width"),
    ("identifier", "Invoice 20260830 amount 128.50"),
    ("identifier", "Batch size eight"),
    ("identifier", "PPOCR validation 1234567890"),
)

CANVAS_SIZES: tuple[tuple[int, int], ...] = (
    (640, 480),
    (864, 976),
    (1024, 768),
    (1280, 960),
    (1536, 864),
    (1664, 480),
    (1792, 1392),
)
FONT_SIZES: tuple[int, ...] = (14, 16, 18, 22, 26, 30, 36, 44, 52, 60)
ORIENTATIONS: tuple[int, ...] = (0, 0, 0, 0, 180, 90, -90)


@dataclass(frozen=True)
class FontSpec:
    path: Path | None
    label: str
    sha256: str | None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def default_font_candidates() -> list[Path]:
    candidates = [
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "msyh.ttc",
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "simsun.ttc",
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    ]
    return list(dict.fromkeys(path for path in candidates if path.is_file()))


def resolve_fonts(font_paths: Sequence[Path]) -> list[FontSpec]:
    paths = list(font_paths) if font_paths else default_font_candidates()
    if not paths:
        return [FontSpec(None, "Pillow-default", None)]
    specs: list[FontSpec] = []
    for path in paths:
        path = path.resolve()
        if not path.is_file():
            raise FileNotFoundError(f"font file not found: {path}")
        specs.append(FontSpec(path, path.name, sha256_file(path)))
    return specs


def load_font(spec: FontSpec, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if spec.path is None:
        return ImageFont.load_default()
    return ImageFont.truetype(str(spec.path), size=size)


def render_text(
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    orientation: int,
    angle: float,
    color: tuple[int, int, int],
) -> tuple[Image.Image, int]:
    left, top, right, bottom = font.getbbox(text)
    padding = 8
    width = max(1, right - left) + padding * 2
    height = max(1, bottom - top) + padding * 2
    sprite = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(sprite).text(
        (padding - left, padding - top),
        text,
        font=font,
        fill=(*color, 255),
    )
    if orientation:
        sprite = sprite.rotate(orientation, expand=True, resample=Image.Resampling.BICUBIC)
    if abs(angle) > 0.001:
        sprite = sprite.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    natural_width = max(1, right - left) * 48 // max(1, bottom - top)
    return sprite, natural_width


def fit_sprite(sprite: Image.Image, canvas: tuple[int, int], margin: int = 12) -> Image.Image:
    max_width = max(1, canvas[0] - margin * 2)
    max_height = max(1, canvas[1] - margin * 2)
    scale = min(1.0, max_width / sprite.width, max_height / sprite.height)
    if scale >= 1.0:
        return sprite
    size = (max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale)))
    return sprite.resize(size, Image.Resampling.LANCZOS)


def rect_intersection(first: tuple[int, int, int, int], second: tuple[int, int, int, int]) -> int:
    x1 = max(first[0], second[0])
    y1 = max(first[1], second[1])
    x2 = min(first[2], second[2])
    y2 = min(first[3], second[3])
    return max(0, x2 - x1) * max(0, y2 - y1)


def place_sprite(
    rng: random.Random,
    canvas: tuple[int, int],
    sprite: Image.Image,
    occupied: list[tuple[int, int, int, int]],
) -> tuple[int, int]:
    width, height = canvas
    max_x = max(0, width - sprite.width)
    max_y = max(0, height - sprite.height)
    for _ in range(120):
        x = rng.randint(0, max_x)
        y = rng.randint(0, max_y)
        candidate = (x, y, x + sprite.width, y + sprite.height)
        if all(rect_intersection(candidate, previous) == 0 for previous in occupied):
            return x, y
    return rng.randint(0, max_x), rng.randint(0, max_y)


def generate_dataset(
    output: Path,
    count: int,
    seed: int,
    font_paths: Sequence[Path] = (),
    image_format: str = "jpg",
    text_pool: Iterable[tuple[str, str]] = DEFAULT_TEXTS,
    force: bool = False,
) -> dict[str, object]:
    if count <= 0:
        raise ValueError("count must be positive")
    if image_format not in ("jpg", "png"):
        raise ValueError("image_format must be 'jpg' or 'png'")
    output = output.resolve()
    if output.exists() and any(output.iterdir()) and not force:
        raise FileExistsError(f"output directory is not empty; use --force: {output}")
    output.mkdir(parents=True, exist_ok=True)
    specs = resolve_fonts(font_paths)
    pool = tuple(text_pool)
    if not pool:
        raise ValueError("text pool must not be empty")
    if all(spec.path is None for spec in specs) and pool == DEFAULT_TEXTS:
        pool = ASCII_FALLBACK_TEXTS
    rng = random.Random(seed)
    image_records: list[dict[str, object]] = []
    for image_index in range(1, count + 1):
        width, height = rng.choice(CANVAS_SIZES)
        background = tuple(rng.randint(12, 248) for _ in range(3))
        base = Image.new("RGB", (width, height), background)
        occupied: list[tuple[int, int, int, int]] = []
        line_records: list[dict[str, object]] = []
        line_count = rng.randint(6, 14)
        for _ in range(line_count):
            category, text = rng.choice(pool)
            font_spec = rng.choice(specs)
            font_size = rng.choice(FONT_SIZES)
            orientation = rng.choice(ORIENTATIONS)
            angle = round(rng.uniform(-15.0, 15.0), 3)
            brightness = sum(background) / 3.0
            if brightness < 128:
                color = tuple(rng.randint(180, 255) for _ in range(3))
            else:
                color = tuple(rng.randint(0, 80) for _ in range(3))
            font = load_font(font_spec, font_size)
            sprite, natural_width = render_text(text, font, orientation, angle, color)
            sprite = fit_sprite(sprite, (width, height))
            x, y = place_sprite(rng, (width, height), sprite, occupied)
            occupied.append((x, y, x + sprite.width, y + sprite.height))
            base.paste(sprite, (x, y), sprite)
            line_records.append(
                {
                    "text": text,
                    "bbox": [x, y, x + sprite.width, y + sprite.height],
                    "natural_width_at_height_48": natural_width,
                    "angle_degrees": angle,
                    "orientation_degrees": orientation,
                    "font": font_spec.label,
                    "font_size": font_size,
                    "color_rgb": list(color),
                    "category": category,
                }
            )
        suffix = "jpg" if image_format == "jpg" else "png"
        image_path = output / f"img-{image_index:03d}.{suffix}"
        if image_format == "jpg":
            base.save(image_path, format="JPEG", quality=95, subsampling=0, optimize=False, progressive=False)
        else:
            base.save(image_path, format="PNG", optimize=False)
        image_records.append(
            {
                "file": image_path.name,
                "width": width,
                "height": height,
                "background_rgb": list(background),
                "sha256": sha256_file(image_path),
                "lines": line_records,
            }
        )
    manifest = {
        "version": 1,
        "seed": seed,
        "generator": {
            "name": "lw.PPOCR.C",
            "tool": "tools/generate_ocr_dataset.py",
            "renderer": "Pillow",
            "renderer_version": Image.__version__,
            "image_format": image_format,
            "fonts": [
                {"file": spec.label, "sha256": spec.sha256} for spec in specs
            ],
        },
        "images": image_records,
    }
    (output / "metadata.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("build-local-data/lw-generated-ocr"))
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260907)
    parser.add_argument("--font", type=Path, action="append", default=[])
    parser.add_argument("--format", choices=("jpg", "png"), default="jpg")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    manifest = generate_dataset(
        args.output,
        args.count,
        args.seed,
        args.font,
        args.format,
        force=args.force,
    )
    print(
        json.dumps(
            {
                "output": str(args.output.resolve()),
                "images": len(manifest["images"]),
                "seed": args.seed,
                "format": args.format,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
