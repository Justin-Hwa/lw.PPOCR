"""Compare fixed-width Small REC LWM outputs with ONNX Runtime."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--width", type=int, action="append", dest="widths")
    args = parser.parse_args()
    widths = args.widths or [320, 480, 640, 960]
    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    results = []
    for width in widths:
        input_values = (
            ((np.arange(1 * 3 * 48 * width, dtype=np.uint64) * 17) % 257)
            .astype(np.int32)
            - 128
        ).astype(np.float32) / 127.0
        onnx_output = session.run(
            None, {session.get_inputs()[0].name: input_values.reshape(1, 3, 48, width)}
        )[0].reshape(-1)
        lwm_path = args.output_dir / f"small-lwm-w{width}.f32"
        lwm_output = np.fromfile(lwm_path, dtype=np.float32)
        if lwm_output.size != onnx_output.size:
            raise SystemExit(
                f"width {width}: output size mismatch {lwm_output.size} != {onnx_output.size}"
            )
        delta = np.abs(onnx_output - lwm_output)
        results.append(
            {
                "width": width,
                "elements": int(onnx_output.size),
                "max_abs_error": float(np.max(delta)),
                "mean_abs_error": float(np.mean(delta)),
                "fraction_abs_error_gt_1e-4": float(np.mean(delta > 1.0e-4)),
                "finite": bool(np.isfinite(lwm_output).all()),
            }
        )
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
