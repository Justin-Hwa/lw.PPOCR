# PP-OCRv6 Small analysis snapshot

Status: **analysis-only**. This report is not a runtime or release-support
claim. The Small ONNX files are not bundled in this repository.

The snapshot was produced with `converter/analyze_onnx.py` and compared with
`tools/compare_model_analysis.py`. The local source assets were the PP-OCRv6
Small DET/REC files used by the sibling OpenCV project; their identities are
recorded here so a future model package can reproduce the probe:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| Small DET | 9,880,512 | `d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e` |
| Small REC | 21,159,378 | `5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634` |
| Small REC dictionary | 74,944 | `118d0f0714ad2a37668c23d6541f2c3feb65b8214041265b567f7fd5b3365d8e` |

## Summary

| Component | Nodes | Operator types | Dynamic values | Estimated FLOPs | Result |
|---|---:|---:|---:|---:|---|
| DET | 242 | 14 | 243 | 9.0035G | graph surface matches Tiny; not converted into a release asset |
| REC | 481 | 25 | 467 | 2.1636G | requires dynamic Shape/Slice paths; `Pow`/`Sqrt`/`Sub` are experimental only |

The Small REC input and output shapes remain compatible with the existing
recognition preprocessing contract (`[N,3,48,W]` input). Its output alphabet is
larger than Tiny and therefore requires the matching Small dictionary; the Tiny
dictionary must not be reused for a production package.

The current production converter deliberately rejects these external files.
An analysis-only fixed-width converter prototype now materializes the
Shape/Slice metadata path, normalizes SAME_UPPER padding, folds constant
integer metadata, and emits one LWM file per selected width. The runtime also
has a portable broadcast-batch MatMul fallback for the attention-shaped
matrices used by Small REC. The prototype executes successfully at widths 320,
480, 640, and 960, with output sizes matching ONNX Runtime and finite output
values. It remains a fixed-width experiment: no dynamic-width LWM contract,
Small dictionary packaging, C ABI support, Android/WASM integration, or release
asset is implied.
`Pow`/`Sqrt`/`Sub` also have experimental scalar/LWM support, but none of these
paths are used by a released model. Until the full gate passes, Small remains
outside C ABI, Android, WASM, and release packages.

## REC metadata probe

`tools/probe_rec_shape_metadata.py` was run against the local Small REC asset
with widths 320, 480, 640, and 960. ONNX Runtime identified six Shape-derived
metadata nodes; ordinary floating-point Slice nodes were intentionally not
included. The observed width-dependent values were:

| Input width | sequence width (`Shape.1` / `Shape.3`) | attention width (`Shape.7` / `Shape.13`) | sliced width (`Slice.1`) |
|---:|---:|---:|---:|
| 320 | 40 | 40 | 40 |
| 480 | 60 | 60 | 60 |
| 640 | 80 | 80 | 80 |
| 960 | 120 | 120 | 120 |

The values follow `input_width / 8` for this graph. This is evidence for a
REC-specific metadata lowering rule, not a general symbolic-shape engine; the
next prototype must still compare complete outputs against ONNX Runtime before
any LWM operator or runtime change is considered.

The fixed-width prototype mode (`--staticize-output`) materialized the six
Shape-derived outputs at width 320, removed the corresponding six metadata
nodes, and compared the original and rewritten graph outputs. The maximum
absolute output difference was `4.77e-7` (with `rtol=1e-4`, `atol=1e-5`). This
is a successful converter experiment only; it does not prove that a dynamic
width LWM representation is ready.

## Fixed-width LWM execution gate

`tools/convert_small_rec_experimental.py` and
`tools/compare_small_rec_execution.py` were run against the local Small REC
asset using the deterministic input shared by `tests/rec_graph_driver.c`.
Each generated LWM graph executed twice in the C Runtime and matched the ONNX
Runtime output element count:

| Width | Output elements | Max absolute error | Mean absolute error | Values above `1e-4` |
|---:|---:|---:|---:|---:|
| 320 | 748,400 | `6.84e-5` | `3.36e-9` | 0 |
| 480 | 1,122,600 | `1.40e-4` | `6.20e-9` | `4.45e-6` |
| 640 | 1,496,800 | `1.60e-4` | `3.40e-9` | `1.34e-6` |
| 960 | 2,245,200 | `4.71e-4` | `8.69e-9` | `1.51e-5` |

The small non-zero differences are expected from different FP32 accumulation
orders; this gate is numerical equivalence evidence, not a release-quality
accuracy or performance claim.

## Fixed-shape DET execution gate

`tools/convert_small_det_experimental.py` reuses the existing DET lowering
rules after attaching concrete shapes observed from a legal ONNX Runtime run.
`tools/compare_small_det_execution.py` then compares the complete detector
output with the same deterministic input used by `tests/det_graph_driver.c`:

| Input shape | Output elements | Max absolute error | Mean absolute error | Values above `1e-4` |
|---:|---:|---:|---:|---:|
| 320×320 | 102,400 | `3.30e-7` | `2.86e-8` | 0 |
| 640×640 | 409,600 | `1.48e-6` | `1.44e-7` | 0 |
| 640×960 | 614,400 | `1.74e-6` | `1.93e-7` | 0 |

All three fixed-shape graphs executed twice in the C Runtime and produced
finite outputs. This confirms that Small DET currently needs no new operator
types beyond the existing DET surface. It is still an analysis-only result:
the production converter keeps its exact Tiny model identity gate, and Small
DET is not yet a bundled model, public API, Android/WASM asset, or release
package.

## Experimental end-to-end OCR

The DET prototype was also emitted with dynamic spatial dimensions using
`--dynamic`. The existing session shape resolver accepted both 320×320 and
640×640 inputs. Combined with the fixed-width Small REC prototype at width
320, the existing `lw-ocr-ppm` pipeline completed on the bundled 500×500
sample image and returned 16 lines. The first lines were:

```text
纯臻营养护发素
产品信息/参数
(45元/每公斤，100公斤起订)
每瓶22元，1000瓶起订)
```

The experiment used the released Tiny CLS model only to exercise the
orientation-classification stage, while DET/REC and the dictionary came from
the external Small assets. This is a pipeline compatibility check, not an
accuracy benchmark: punctuation differences versus Tiny are expected until a
Small-specific golden corpus and thresholds are established.

## Preliminary performance baseline

The existing `lw-ocr-benchmark` was run on the same 500×500 PPM image with
two warm-ups, five measured iterations, and a fixed REC target width of 320.
Small used the dynamic DET prototype and fixed-width Small REC; Tiny used the
bundled release models. The measurements are local Windows x64 AVX2 results,
not cross-platform claims:

| Model set | Workers | DET mean | OCR mean | Combined mean | Peak RSS |
|---|---:|---:|---:|---:|---:|
| Tiny | 1 | 81.71 ms | 213.67 ms | 295.39 ms | 74.98 MiB |
| Small | 1 | 289.99 ms | 795.31 ms | 1,085.31 ms | 161.45 MiB |
| Tiny | 4 | 93.58 ms | 109.94 ms | 203.52 ms | 115.66 MiB |
| Small | 4 | 273.78 ms | 330.64 ms | 604.42 ms | 311.18 MiB |

Both model sets returned 16 lines and remained deterministic across all timed
runs. Small is therefore materially more expensive in this first prototype:
approximately 3.67× the single-worker combined latency and 2.15× the peak RSS.
This is useful for planning but is not yet a reason to reject Small; the next
step is a real-image golden corpus and profiling to identify whether the gap is
mostly the larger REC graph, the DET graph, or thread-pool memory replication.

An initial three-iteration `rec-profile-driver` run at REC width 320 points to
the larger convolution graph as the dominant cost. The largest single Conv
node consumed about 12.1 ms over three runs, while the two new broadcast-batch
MatMul nodes together consumed about 0.54 ms. This means the generic MatMul
fallback is functionally necessary but is not the first performance target;
Small-specific Conv shapes should be profiled before adding SIMD specializations.

`tools/record_small_ocr_baseline.py` records an analysis-only JSON baseline
containing source/model SHA-256 values, all recognized text, quadrilateral
coordinates, detection/recognition scores, and classification metadata. The
generated sample baseline remains outside the repository build tree for now;
future real-image cases can be appended without changing the production Tiny
corpus or release artifacts.
`tools/validate_small_ocr_baseline.py` replays the same model set and checks
all 16 lines, text, boxes, classification metadata, and score stability.
