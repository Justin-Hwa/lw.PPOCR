"""Build-only downloads/conversion of the official Thai recognizer. Runtime is offline."""
from __future__ import annotations
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import venv
from prepare_thai_resources import member
import urllib.request

REV = "9e25080455925d3943f5db885fddc79db6a07ca3"
BASE = f"https://huggingface.co/PaddlePaddle/th_PP-OCRv5_mobile_rec/resolve/{REV}/"
ONNX_SHA = "b5271c801ca144b4728c326eb601c847a4707d938f8e741d921c465bf284e680"
ASSETS = {
    'ort-ThirdPartyNotices.txt': ("https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/ThirdPartyNotices.txt", "e9e90971a8e75a9a8ac0c6412e29c1202d079998389915aa485f46c816c3b4cc"),
    'ort-LICENSE': ("https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/LICENSE", "2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c"),
    "inference.json": (BASE + "inference.json", "b92a9442af5ac6da3c6ba30ce1672d00a2d7a0fbd8068ed543ac6dcb9d5c7764"),
    "inference.pdiparams": (BASE + "inference.pdiparams", "45ec91f2322b58b8d30ba27d18fcfdbb8bf388b918dd978162d2af91e0c66d4b"),
    "inference.yml": (BASE + "inference.yml", "f6ba7fefc38ca1ff398ddafa75d67d16e0b3757c4e6c833adffee98a981766c9"),
    "ort.tgz": ("https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.22.0.tgz", "e293551f9d36d003e293d0f2937fee7b3dfdcef76d71d1449b55e2d4157c7aea"),
}

def read(cache: Path, name: str) -> bytes:
    path = cache / name
    url, expected = ASSETS[name]
    if path.exists():
        data = path.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read(30_000_001)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"PP-OCRv5 Thai resource checksum mismatch: {name}")
    if not path.exists():
        path.write_bytes(data)
    return data

def converted_model(cache: Path) -> bytes:
    path = cache / "thai.onnx"
    if not path.exists():
        for name in ("inference.json", "inference.pdiparams"):
            read(cache, name)
        # Isolated build environment: do not change the native converter's dependencies.
        env = cache / "converter-venv"
        if not env.exists():
            venv.EnvBuilder(with_pip=True).create(env)
        python = env / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        subprocess.run([str(python), "-m", "pip", "install", "paddlepaddle==3.0.0",
                        "setuptools==75.8.0", "onnx==1.17.0", "numpy==1.26.4", "protobuf==5.29.5", "PyYAML==6.0.2"], check=True)
        # We deliberately disable the optional onnxoptimizer: preserve official weights/graph.
        subprocess.run([str(python), "-m", "pip", "install", "--no-deps", "paddle2onnx==2.0.1"], check=True)
        temporary = cache / "thai.converting.onnx"
        subprocess.run([str(python), "-m", "paddle2onnx.command", "--model_dir", str(cache),
                        "--model_filename", "inference.json", "--params_filename", "inference.pdiparams",
                        "--save_file", str(temporary), "--opset_version", "14", "--optimize_tool", "None"], check=True)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != ONNX_SHA:
            raise ValueError("Converted PP-OCRv5 Thai checksum mismatch")
        temporary.replace(path)
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != ONNX_SHA:
        raise ValueError("Cached PP-OCRv5 Thai checksum mismatch")
    return data

def load_v5_thai_resources(cache: Path) -> tuple[str, str]:
    import yaml
    cache.mkdir(parents=True, exist_ok=True)
    config = yaml.safe_load(read(cache, "inference.yml"))
    dictionary = config["PostProcess"]["character_dict"] + [" "]
    if len(dictionary) != 525:
        raise ValueError("Unexpected PP-OCRv5 Thai dictionary")
    archive = read(cache, "ort.tgz")
    assets = {
        "js": member(archive, "dist/ort.wasm.min.js"),
        "mjs": member(archive, "dist/ort-wasm-simd-threaded.mjs"),
        "wasm": member(archive, "dist/ort-wasm-simd-threaded.wasm"),
        "model": converted_model(cache),
    }
    encoded = {key: base64.b64encode(value).decode("ascii") for key, value in assets.items()}
    encoded["dictionary"] = dictionary
    notices = {
        "model": "PaddlePaddle/th_PP-OCRv5_mobile_rec (Apache-2.0), revision " + REV,
        "model_license": Path(__file__).with_name("ppocrv5-thai.LICENSE").read_text(),
        "conversion": "PaddlePaddle 3.0.0 / Paddle2ONNX 2.0.1 / opset 14 / optimize_tool None",
        "onnx_sha256": ONNX_SHA,
        "onnxruntime-web 1.22.0": read(cache, "ort-LICENSE").decode(),
        "ONNX Runtime third party notices": read(cache, "ort-ThirdPartyNotices.txt").decode(),
        "sources": {name: {"url": url, "sha256": sha} for name, (url, sha) in ASSETS.items()},
    }
    return json.dumps(encoded, ensure_ascii=True, separators=(",", ":")), json.dumps(notices).replace("<", "\\u003c")
