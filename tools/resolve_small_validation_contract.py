#!/usr/bin/env python3
"""Resolve the pinned Small CI asset contract and optional manual overrides."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
URL_RE = re.compile(r"^https://.+")
ALLOWED_WIDTHS = (192, 320, 480, 640, 960)


def resolve_contract(
    contract_path: Path,
    assets_url_override: str | None = None,
    assets_sha256_override: str | None = None,
    expected_text_sha256_override: str | None = None,
) -> dict[str, Any]:
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    if contract.get("schema_version") != 1 or contract.get("variant") != "ppocrv6-small":
        raise ValueError("unsupported Small validation contract")
    url = assets_url_override or contract.get("url")
    archive_sha256 = assets_sha256_override or contract.get("archive_sha256")
    if not isinstance(url, str) or not URL_RE.fullmatch(url):
        raise ValueError("Small validation asset URL must be HTTPS")
    if not isinstance(archive_sha256, str) or not SHA256_RE.fullmatch(archive_sha256):
        raise ValueError("Small validation archive SHA-256 is missing or invalid")
    assets = contract.get("assets")
    if not isinstance(assets, dict):
        raise ValueError("Small validation contract is missing assets")
    for role in ("det", "rec", "dictionary", "cls"):
        item = assets.get(role)
        if not isinstance(item, dict) or not SHA256_RE.fullmatch(str(item.get("sha256", ""))):
            raise ValueError(f"Small validation asset hash is invalid: {role}")
    widths = contract.get("rec_widths")
    if widths != list(ALLOWED_WIDTHS):
        raise ValueError(f"Small validation REC widths must be {list(ALLOWED_WIDTHS)}")
    full_ocr = contract.get("full_ocr")
    if not isinstance(full_ocr, dict) or full_ocr.get("rec_max_width") not in ALLOWED_WIDTHS:
        raise ValueError("Small validation full_ocr.rec_max_width is invalid")
    expected_text_sha256 = expected_text_sha256_override
    if expected_text_sha256 is None or expected_text_sha256 == "":
        expected_text_sha256 = full_ocr.get("expected_text_sha256") or ""
    if expected_text_sha256 and not SHA256_RE.fullmatch(expected_text_sha256):
        raise ValueError("expected full OCR text SHA-256 is invalid")
    return {
        "assets_url": url,
        "assets_sha256": archive_sha256.lower(),
        "expected_full_text_sha256": expected_text_sha256.lower(),
        "rec_max_width": int(full_ocr["rec_max_width"]),
        "expected_lines": int(full_ocr.get("expected_lines", 0)),
        "contract_sha256": hashlib.sha256(contract_path.read_bytes()).hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--assets-url-override")
    parser.add_argument("--assets-sha256-override")
    parser.add_argument("--expected-full-text-sha256-override")
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    resolved = resolve_contract(
        args.contract,
        args.assets_url_override,
        args.assets_sha256_override,
        args.expected_full_text_sha256_override,
    )
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8", newline="\n") as output:
            for key, value in resolved.items():
                output.write(f"{key}={value}\n")
    print(json.dumps(resolved, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
