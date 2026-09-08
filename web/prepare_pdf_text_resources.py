"""构建时准备 PDF.js 字体/CMap；用户打开 HTML 时无需网络。"""
from __future__ import annotations

import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

VERSION = "6.3.289"
URL = f"https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-{VERSION}.tgz"
SHA256 = "06f25e887adc6489f04c9fcb14198c77e4e5623a59a0bba5c4cea5838a4f1241"


def load_resources(cache_dir: Path) -> tuple[str, str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    archive = cache_dir / f"pdfjs-dist-{VERSION}.tgz"
    if archive.exists():
        data = archive.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=90) as response:
            data = response.read(30_000_001)
        if len(data) > 30_000_000:
            raise ValueError("PDF.js archive exceeds build-time size limit")
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError("PDF.js archive SHA-256 mismatch; refusing to package")
    if not archive.exists():
        archive.write_bytes(data)
    resources, licenses = {}, {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for kind, folder in [("cMapUrl", "cmaps"), ("standardFontDataUrl", "standard_fonts")]:
            resources[kind] = {}
            prefix = "package/" + folder + "/"
            for member in tar.getmembers():
                if not member.isfile() or not member.name.startswith(prefix):
                    continue
                name = member.name[len(prefix):]
                if "/" in name or name in ("", ".", ".."):
                    raise ValueError("Unexpected PDF.js resource path")
                content = tar.extractfile(member).read()
                if name.startswith("LICENSE"):
                    licenses[folder + "/" + name] = content.decode("utf-8")
                else:
                    resources[kind][name] = base64.b64encode(content).decode("ascii")
    if len(resources["cMapUrl"]) != 168 or len(resources["standardFontDataUrl"]) != 14:
        raise ValueError("Unexpected PDF.js CMap/font inventory")
    return json.dumps(resources, separators=(",", ":")), json.dumps(licenses, ensure_ascii=True)
