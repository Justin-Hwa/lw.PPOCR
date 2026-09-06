#!/usr/bin/env python3
"""Compare fixed-shape Small DET LWM outputs with ONNX Runtime."""

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
    parser.add_argument("--height", type=int, action="append", dest="heights")
    parser.add_argument("--width", type=int, action="append", dest="widths")
    args = parser.parse_args()
    heights = args.heights or [640]
    widths = args.widths or [640]
    if len(heights) != len(widths):
        raise SystemExit("--height and --width must be supplied the same number of times")
    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    results = []
    for height, width in zip(heights, widths):
        input_values = (
            ((np.arange(3 * height * width, dtype=np.uint64) * 23) % 269)
            .astype(np.int32)
            - 134
        ).astype(np.float32) / 134.0
        onnx_output = session.run(
            None,
            {session.get_inputs()[0].name: input_values.reshape(1, 3, height, width)},
        )[0].reshape(-1)
        lwm_path = args.output_dir / f"small-det-lwm-{height}x{width}.f32"
        lwm_output = np.fromfile(lwm_path, dtype=np.float32)
        if lwm_output.size != onnx_output.size:
            raise SystemExit(
                f"shape {height}x{width}: output size mismatch "
                f"{lwm_output.size} != {onnx_output.size}"
            )
        delta = np.abs(onnx_output - lwm_output)
        results.append(
            {
                "height": height,
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
