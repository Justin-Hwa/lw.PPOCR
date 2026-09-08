"""使用经 SHA-256 验证的上游 SDK 快速打包；不需要本机安装 Emscripten。"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

TAG = "v0.1.0-preview.7"
URL = f"https://github.com/lxw112190/lw.PPOCR.C/releases/download/{TAG}/lw.PPOCR.C-0.1.0-ocr-demo.html"
SHA256 = "c9e8e47f4d9f13606adfdef894a1fb7d8bb250d8646a7d621ce790bd6b4f00ce"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("dist/offline-pdf-search.html"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = args.output.resolve()
    cache = output.parent / "release-cache"
    cache.mkdir(parents=True, exist_ok=True)
    upstream = cache / (TAG + ".html")
    if upstream.exists():
        data = upstream.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=120) as response:
            data = response.read(20_000_001)
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError("上游 HTML 校验失败，拒绝打包")
    if not upstream.exists():
        upstream.write_bytes(data)
    scripts = re.findall(r"<script>([\s\S]*?)</script>", data.decode("utf-8"))
    sdk_scripts = [s for s in scripts if "global.LwPpocr = Object.freeze({" in s]
    if len(sdk_scripts) != 1:
        raise ValueError("上游 SDK 结构不符合预期")
    sdk = cache / "lw-ppocr.js"
    sdk.write_text(sdk_scripts[0], encoding="utf-8", newline="\n")
    vendor = root / "web/vendor/pdfjs"
    command = [sys.executable, str(root / "web/package_ocr_html.py"),
        "--template", str(root / "web/ocr-demo.template.html"),
        "--sdk", str(sdk), "--ui", str(root / "web/ocr-demo-ui.js"),
        "--sponsor", str(root / "docs/assets/sponsor.jpg"),
        "--pdf-adapter", str(root / "web/pdf/lw_pdf_adapter.js"),
        "--pdfjs-version", "6.3.289", "--output", str(output)]
    for flag, filename in [("core", "pdf.min.mjs"), ("worker", "pdf.worker.min.mjs"),
                           ("jbig2", "jbig2.wasm"), ("openjpeg", "openjpeg.wasm"),
                           ("qcms", "qcms_bg.wasm")]:
        command += ["--pdfjs-" + flag, str(vendor / filename)]
    subprocess.run(command, check=True)
    print("SHA-256:", hashlib.sha256(output.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
