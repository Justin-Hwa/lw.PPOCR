#!/usr/bin/env python3
"""Convert a fixed-width PP-OCRv6 Small REC prototype to LWM.

This is intentionally an analysis tool, not a release converter.  It first
materializes Shape-derived metadata at one fixed input width, then rewrites
constant Slice control inputs into LWM parameters and emits an experimental
LWM file.  The output must be compared with ONNX Runtime before any model
support claim is made.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnx import numpy_helper, shape_inference

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from converter.lwm_v0 import _materialize_slice_inputs, _normalize_same_upper, _write_model
from tools.probe_rec_shape_metadata import _instrument, staticize


def normalize_padding(model: onnx.ModelProto) -> onnx.ModelProto:
    converted = copy.deepcopy(model)
    rewritten = []
    for node in converted.graph.node:
        if node.op_type in ("Conv", "MaxPool"):
            rewritten.append(_normalize_same_upper(node))
        else:
            rewritten.append(copy.deepcopy(node))
    del converted.graph.node[:]
    converted.graph.node.extend(rewritten)
    return converted


def concretize_shapes(model: onnx.ModelProto, width: int) -> onnx.ModelProto:
    """Attach runtime-observed shapes so the fixed-width LWM plan is bounded."""
    concretized = copy.deepcopy(model)
    input_name = concretized.graph.input[0].name
    output_names = list(dict.fromkeys(
        output for node in concretized.graph.node for output in node.output if output
    ))
    instrumented = _instrument(concretized, output_names)
    sample = np.random.default_rng(0).standard_normal((1, 3, 48, width), dtype=np.float32)
    values = ort.InferenceSession(
        instrumented.SerializeToString(), providers=["CPUExecutionProvider"]
    ).run(output_names, {input_name: sample})
    values_by_name = dict(zip(output_names, values))
    shapes = {name: np.asarray(value).shape for name, value in values_by_name.items()}
    input_shape = concretized.graph.input[0].type.tensor_type.shape
    for axis, dimension in enumerate((1, 3, 48, width)):
        input_shape.dim[axis].ClearField("dim_param")
        input_shape.dim[axis].dim_value = dimension
    for value in (*concretized.graph.value_info, *concretized.graph.output):
        shape = shapes.get(value.name)
        if shape is None:
            continue
        del value.type.tensor_type.shape.dim[:]
        for dimension in shape:
            value.type.tensor_type.shape.dim.add(dim_value=int(dimension))
    value_info = {
        value.name: value
        for value in (
            *concretized.graph.input,
            *concretized.graph.value_info,
            *concretized.graph.output,
        )
    }
    constant_names = {item.name for item in concretized.graph.initializer}
    retained_nodes = []
    folded_initializers = []
    for node in concretized.graph.node:
        outputs = [name for name in node.output if name]
        can_fold = bool(outputs) and all(
            name in constant_names for name in node.input if name
        )
        can_fold = can_fold and all(
            value_info.get(name) is not None
            and value_info[name].type.tensor_type.elem_type != onnx.TensorProto.FLOAT
            for name in outputs
        )
        if not can_fold:
            retained_nodes.append(node)
            continue
        for name in outputs:
            folded_initializers.append(numpy_helper.from_array(
                np.asarray(values_by_name[name]), name=name
            ))
            constant_names.add(name)
    del concretized.graph.node[:]
    concretized.graph.node.extend(retained_nodes)
    concretized.graph.initializer.extend(folded_initializers)
    return concretized


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    if args.width <= 0:
        raise SystemExit("--width must be positive")

    with tempfile.TemporaryDirectory(prefix="lw-small-rec-") as directory:
        static_path = Path(directory) / "static.onnx"
        static_report = staticize(args.model, args.width, static_path)
        static_model = concretize_shapes(
            onnx.load(str(static_path), load_external_data=True), args.width
        )
        model = normalize_padding(_materialize_slice_inputs(static_model))
        # The materialized form is an internal lowering representation: ONNX
        # opset 11 requires Slice controls as inputs, while LWM stores them in
        # the node parameter record. Reuse the already inferred static graph.
        inferred = static_model
        args.output.parent.mkdir(parents=True, exist_ok=True)
        info = _write_model(model, args.output, inferred)

    report = {
        "schema_version": 1,
        "tool": "tools/convert_small_rec_experimental.py",
        "status": "analysis-only",
        "model": str(args.model),
        "width": args.width,
        "output": str(args.output),
        "staticization": static_report,
        "conversion": {
            **info.__dict__,
            "checksum": f"0x{info.checksum:016x}",
        },
    }
    encoded = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(encoded, encoding="utf-8", newline="\n")
    print(encoded, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
