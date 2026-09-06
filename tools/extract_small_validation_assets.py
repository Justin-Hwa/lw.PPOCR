#!/usr/bin/env python3
"""Verify and normalize a Small validation archive for CI."""

from __future__ import annotations

import argparse
import hashlib
import zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath


ROLE_NAMES = {
    "det.onnx": ("det.onnx", "PP-OCRv6_small_det.onnx"),
    "rec.onnx": ("rec.onnx", "PP-OCRv6_small_rec.onnx"),
    "ppocr_keys.txt": ("ppocr_keys.txt", "PP-OCRv6_small_rec_dict.txt"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_name(name: str) -> str:
    normalized = name.replace("\\", "/")
    posix_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(normalized)
    if (
        posix_path.is_absolute()
        or windows_path.is_absolute()
        or bool(windows_path.drive)
        or ".." in posix_path.parts
    ):
        raise ValueError(f"unsafe archive member: {name}")
    return posix_path.name


def extract(archive: Path, output_dir: Path, expected_sha256: str) -> None:
    actual = sha256(archive)
    if actual.lower() != expected_sha256.lower():
        raise ValueError(f"archive SHA-256 mismatch: {actual} != {expected_sha256}")
    with zipfile.ZipFile(archive) as bundle:
        members = {}
        for info in bundle.infolist():
            if info.is_dir():
                continue
            normalized = safe_name(info.filename)
            if normalized in members:
                raise ValueError(f"archive contains duplicate normalized member: {normalized}")
            members[normalized] = info
        output_dir.mkdir(parents=True, exist_ok=True)
        for target, candidates in ROLE_NAMES.items():
            source = next((name for name in candidates if name in members), None)
            if source is None:
                raise ValueError(f"archive is missing {target} (accepted names: {candidates})")
            (output_dir / target).write_bytes(bundle.read(members[source]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    extract(args.archive, args.output_dir, args.sha256)
    print(f"extracted Small validation assets to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
