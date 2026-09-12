"""校验并内嵌泰语 OCR 的运行时、模型和许可证；仅构建阶段访问网络。"""
from __future__ import annotations
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

DATA_REV = "87416418657359cb625c412a48b6e1d6d41c29bd"
ASSETS = {
    "tesseract.js-7.0.0.tgz": ("https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz", "9a93bf51c3387f945d10a24bf8b3a4bf2e45c7c7161b8242aafbaf9d3c4b606a"),
    "tesseract.js-core-7.0.0.tgz": ("https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz", "ba584355515eaff877552022853c0e71f2cb70466e759d1d6940484929718ee0"),
    "tha.traineddata": (f"https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{DATA_REV}/tha.traineddata", "294227cc2d1292b0acb28d61d4115c88252b96d466ca90b417cf4cf0c67bf07c"),
    "eng.traineddata": (f"https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{DATA_REV}/eng.traineddata", "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2"),
    "tessdata.LICENSE": (f"https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{DATA_REV}/LICENSE", "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"),
}

def read_asset(cache: Path, name: str) -> bytes:
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / name
    url, expected = ASSETS[name]
    if path.exists():
        data = path.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read(30_000_001)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"泰语资源 SHA-256 校验失败：{name}")
    if not path.exists():
        path.write_bytes(data)
    return data

def member(archive: bytes, name: str) -> bytes:
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        file = tar.extractfile("package/" + name)
        if file is None:
            raise ValueError(f"压缩包缺少 {name}")
        return file.read()

def load_thai_resources(cache: Path) -> tuple[str, str]:
    js = read_asset(cache, "tesseract.js-7.0.0.tgz")
    core = read_asset(cache, "tesseract.js-core-7.0.0.tgz")
    assets = {
        "worker": member(js, "dist/worker.min.js"),
        "scalarJs": member(core, "tesseract-core-lstm.js"),
        "scalarWasm": member(core, "tesseract-core-lstm.wasm"),
        "simdJs": member(core, "tesseract-core-simd-lstm.js"),
        "simdWasm": member(core, "tesseract-core-simd-lstm.wasm"),
        "tha": read_asset(cache, "tha.traineddata"),
        "eng": read_asset(cache, "eng.traineddata"),
    }
    licenses = {
        "tesseract.js 7.0.0": member(js, "LICENSE.md").decode(),
        "tesseract.js API bundled dependencies": member(js, "dist/tesseract.min.js.LICENSE.txt").decode(),
        "tesseract.js bundled dependencies": member(js, "dist/worker.min.js.LICENSE.txt").decode(),
        "tesseract.js-core 7.0.0": member(core, "LICENSE").decode(),
        "tessdata_fast " + DATA_REV: read_asset(cache, "tessdata.LICENSE").decode(),
        "sources": {name: {"url": url, "sha256": sha} for name, (url, sha) in ASSETS.items()},
    }
    return (json.dumps({k: base64.b64encode(v).decode("ascii") for k, v in assets.items()}, separators=(",", ":")),
            json.dumps(licenses, ensure_ascii=False).replace("<", "\\u003c"))
