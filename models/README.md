# Model assets

The repository currently includes only the platform-independent PP-OCRv6 tiny
ONNX models, UTF-8 dictionary, and sample image needed for converter analysis
and the private REC golden test. Deployment-specific TensorRT engines are
intentionally excluded.

The Tiny directory also contains `model.json`, a schema-versioned model
package manifest with asset hashes and recommended preprocessing parameters.
Small and Medium are not bundled or release-supported yet. Their ONNX assets
can be analyzed without changing the runtime ABI:

```bash
python converter/analyze_onnx.py \
  --model-dir path/to/ppocrv6-small \
  --json-output ppocrv6-small-analysis.json \
  --markdown-output ppocrv6-small-analysis.md
```

If a source distribution does not ship a CLS file, pass explicit `--model`
arguments and record any shared CLS asset separately; do not silently assume
that Tiny and Small CLS weights are interchangeable.

The analysis-only path is intentional: passing ONNX validation does not claim
that the current LWM converter or full OCR pipeline supports that variant.

To compare a candidate report with the checked-in Tiny baseline:

```bash
python tools/compare_model_analysis.py \
  docs/ppocrv6-tiny-analysis.json \
  ppocrv6-small-analysis.json
```

The diff highlights graph size, estimated FLOPs, dynamic values, new operator
types, and operators that are not represented by the current LWM table.

For a CI-style compatibility gate, add `--fail-on-unsupported`. It returns a
non-zero status when the candidate graph contains an operator outside the
current LWM table; this is still only a converter/runtime gate, not a release
approval.

To inspect the dynamic REC metadata before implementing a converter lowering,
use the ONNX Runtime probe:

```bash
python tools/probe_rec_shape_metadata.py \
  --model path/to/PP-OCRv6_small_rec.onnx \
  --json-output ppocrv6-small-rec-metadata.json
```

The probe records Shape/Slice values at representative widths. It does not
produce LWM and does not change runtime or release support.

The ONNX files are converter inputs. They will not be parsed by or distributed
as dependencies of the future pure-C runtime package.
