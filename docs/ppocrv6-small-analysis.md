# PP-OCRv6 Small analysis snapshot

Status: **experimental fixed/dynamic validation only**. This report is not a
production runtime or release-support claim. The Small ONNX files are not
bundled in this repository.

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
values. It remains analysis-only: the dynamic path is a graph-specific
prototype, not a production dynamic-width LWM contract. No Small dictionary
packaging, C ABI support, Android/WASM integration, or release asset is
implied.
`Pow`/`Sqrt`/`Sub` also have experimental scalar/LWM support, but none of these
paths are used by a released model. Until the dynamic REC, model contract,
accuracy, and cross-platform gates pass, Small remains outside the production
model package, Android, WASM, and release packages.

## REC metadata probe

`tools/probe_rec_shape_metadata.py` was run against the local Small REC asset
with widths 192, 320, 480, 640, and 960. ONNX Runtime identified six Shape-derived
metadata nodes; ordinary floating-point Slice nodes were intentionally not
included. The observed width-dependent values were:

| Input width | sequence width (`Shape.1` / `Shape.3`) | attention width (`Shape.7` / `Shape.13`) | sliced width (`Slice.1`) |
|---:|---:|---:|---:|
| 192 | 24 | 24 | 24 |
| 320 | 40 | 40 | 40 |
| 480 | 60 | 60 | 60 |
| 640 | 80 | 80 | 80 |
| 960 | 120 | 120 | 120 |

`tools/validate_small_rec_dynamic_rule.py` now checks this report as a
fail-closed converter gate. It requires all five widths, the exact six
Shape/Slice outputs, and the `input_width / 8` relation. This remains an
analysis contract only: it does not add Shape execution or dynamic metadata
to LWM v0.1.

To reproduce the gate after probing an external model:

```bash
python tools/validate_small_rec_dynamic_rule.py \
  build/ppocrv6-small-rec-metadata.json
```

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

## Dynamic-width LWM prototype

The experimental converter now also accepts `--dynamic`. This path removes
only the six Shape/Slice metadata values when they are used as Reshape control,
specializes the production batch-one contract, and leaves the width-varying
tensor axis unresolved. The existing runtime Reshape resolver fills that one
axis from the concrete input element count; it rejects more than one unresolved
axis or an inconsistent element count.

Example invocation (the Small ONNX asset is external and is not committed):

```bash
python tools/convert_small_rec_experimental.py \
  --model PP-OCRv6_small_rec.onnx \
  --dynamic \
  --output build/small-rec-dynamic.lwm \
  --report build/small-rec-dynamic.json
```

Dynamic conversion is fail-closed: it verifies the pinned Small REC SHA-256,
probes all five contract widths, and runs the exact metadata-rule validator
before writing an LWM. The matching REC/dictionary class contract can be
checked separately with:

```bash
python tools/validate_small_dictionary_contract.py \
  --rec-model path/to/PP-OCRv6_small_rec.onnx \
  --dictionary path/to/PP-OCRv6_small_rec_dict.txt
```

For a complete model directory containing `model.json`, the reusable contract
validator also checks manifest hashes and the REC output-class/dictionary
relationship:

```bash
python tools/validate_model_contract.py models/ppocrv6-tiny
```

The same command can be used with an external Small validation directory once
its manifest is prepared; it does not make Small a bundled production model.

For the currently pinned external assets, the local validation directory can
be staged without modifying the repository:

```bash
python tools/stage_small_validation_bundle.py \
  --det path/to/PP-OCRv6_small_det.onnx \
  --cls models/ppocrv6-tiny/cls.onnx \
  --rec path/to/PP-OCRv6_small_rec.onnx \
  --dictionary path/to/PP-OCRv6_small_rec_dict.txt \
  --output-dir build-model-foundation/ppocrv6-small-validation
python tools/validate_model_contract.py \
  build-model-foundation/ppocrv6-small-validation
```

The staged manifest records `variant: small`, `runtime_status: analysis-only`,
and the shared Tiny CLS identity. The bundle is a local validation artifact,
not a redistributed model package.

The current Small profile deliberately reuses the exact bundled Tiny
classifier. Its SHA-256 is pinned in `converter/ppocr_contracts.py`; the
identity tool remains available as a guard if a future package proposes a
different classifier:

```bash
python tools/compare_cls_identity.py \
  --reference-cls models/ppocrv6-tiny/cls.onnx \
  --candidate-cls path/to/PP-OCRv6_small_cls.onnx
```

Only an identical SHA-256 receives the `reuse-tiny-cls-contract` recommendation;
a structurally similar but different classifier still requires independent
conversion and numerical/full-OCR gates.

The same generated LWM file was executed by the C runtime at widths 192, 320,
480, 640, and 960. All sessions resolved to the expected output shapes and
matched ONNX Runtime under the existing numerical gate (mean absolute error
below `1e-6`, fraction above `1e-4` below `1e-4`). This is a dynamic execution
prototype, not a release model: the Small dictionary contract, golden corpus,
cross-platform results, memory budget, and packaging contracts remain
outstanding. The CLS input is the pinned shared Tiny asset.

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

The comparison scripts now support optional hard-gate thresholds. Without
threshold flags they retain report-only behavior. A CI job can fail closed on
non-finite output, mean error, or the fraction of elements above a selected
error threshold, for example:

```bash
python tools/compare_small_rec_execution.py \
  --model PP-OCRv6_small_rec.onnx \
  --output-dir build/small-rec \
  --error-threshold 1e-4 \
  --max-mean-abs-error 1e-6 \
  --max-fraction-over 1e-4
```

The DET comparison tool accepts the same `--error-threshold`,
`--max-abs-error`, `--max-mean-abs-error`, and `--max-fraction-over` options.
Output element counts remain exact requirements in both tools, and NaN/Inf is
always a failure when a gate is enabled. The current values are numerical
conversion gates only; they do not promote Small to a supported model or make
an accuracy claim.

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

The single dynamic DET LWM prototype was also executed at the same three
spatial shapes and passed the identical numerical thresholds. Dynamic DET is
therefore ready for the experimental end-to-end pipeline, but it is not yet a
production converter feature.

## Experimental end-to-end OCR

The DET prototype was emitted with dynamic spatial dimensions using `--dynamic`,
and the REC prototype now uses the same dynamic LWM path. The existing session
shape resolver accepted the DET graph at 320×320 and 640×640, and the REC graph
at all five target widths. Combined with the pinned shared Tiny CLS model,
the existing `lw-ocr-ppm` pipeline completed on the bundled 500×500 sample
image and returned 16 lines. The first lines were:

```text
纯臻营养护发素
产品信息/参数
(45元/每公斤，100公斤起订)
每瓶22元，1000瓶起订)
```

The reproducible experiment uses the external Small DET/REC models and their
matching dictionary, plus the shared Tiny CLS model:

```bash
python tools/convert_small_det_experimental.py \
  --model PP-OCRv6_small_det.onnx --height 640 --width 640 --dynamic \
  --output build/small-det-dynamic.lwm
python tools/convert_small_rec_experimental.py \
  --model PP-OCRv6_small_rec.onnx --dynamic \
  --output build/small-rec-dynamic.lwm
build/Release/lw-ocr-ppm \
  build/small-det-dynamic.lwm build/models/cls.lwm \
  build/small-rec-dynamic.lwm PP-OCRv6_small_rec_dict.txt \
  build/models/sample.ppm 320
```

This is a pipeline compatibility check, not an accuracy benchmark: the Small
dictionary/model contract, golden-corpus, and cross-platform release gates
remain outstanding; the shared Tiny CLS identity is fixed.

The experiment uses the shared Tiny CLS model for orientation classification,
while DET/REC and the dictionary come from the external Small assets. This is
a pipeline compatibility check, not an accuracy benchmark: punctuation
differences versus Tiny are expected until a Small-specific golden corpus and
thresholds are established.

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
the sample SHA-256, all four model/dictionary SHA-256 identities, 16-line text
ordering, boxes, classification metadata, and score stability. The current
dynamic DET/REC baseline replay completed successfully on the local Windows
x64 build; its JSON remains an ignored build artifact.

## Deterministic OCR scene set

For local experiments, `tools/generate_ocr_test_scenes.py` creates six
copyright-free, deterministic raster scenes with a UTF-8 manifest containing
the source strings and layout metadata. The set covers a clean receipt, dense
mixed Chinese/Latin text, low contrast, rotated blocks, sparse layout, and
long lines. PNG files are convenient for visual inspection; PPM copies can be
fed directly to the dependency-free OCR executable:

```bash
python tools/generate_ocr_test_scenes.py \
  --output-dir build-model-foundation/ocr-scenes
```

Run the complete suite and write a machine-readable summary with:

```bash
python tools/run_ocr_scene_suite.py \
  --manifest build-model-foundation/ocr-scenes/manifest.json \
  --ocr build/Release/lw-ocr-ppm \
  --detector build-model-foundation/ppocrv6-small-det-dynamic.lwm \
  --classifier build/models/cls.lwm \
  --recognizer build-model-foundation/ppocrv6-small-rec-dynamic.lwm \
  --dictionary PP-OCRv6_small_rec_dict.txt \
  --rec-max-width 960
```

The runner writes `scene-suite-results.json` beside the manifest and exits
non-zero for a process failure, malformed quadrilateral, non-finite score, or
empty detection result. It deliberately reports recognized text instead of
requiring exact strings, so experimental model comparisons remain useful.

The generated directory is a build artifact and is intentionally not part of
the release package. On the local Windows x64 build, the dynamic Small
DET/REC pipeline completed all six scenes with finite scores; the rotated,
sparse, and long-line scenes each produced the expected five OCR regions.
Receipt and dense-layout scenes intentionally contain multiple adjacent
regions, so their detector line counts are higher than the logical source-line
count in the manifest. The generator auto-detects Microsoft YaHei, Noto CJK,
WenQuanYi, and PingFang candidates; use `--font /path/to/font.ttc` when a CI
image does not provide one of these fonts.

## Reproducible CI validation

The repository contains a manual workflow named `PP-OCRv6 Small validation`:
`.github/workflows/ppocrv6-small-validation.yml`. It is intentionally not part
of the normal release workflow because Small is still analysis-only and its
model archive is not redistributed by this repository.

The workflow accepts two inputs:

* `assets_url`: a pinned ZIP URL containing the external Small DET, REC, and
  dictionary files;
* `assets_sha256`: the SHA-256 of that exact ZIP file.

The archive may contain either the short names `det.onnx`, `rec.onnx`, and
`ppocr_keys.txt`, or the upstream names
`PP-OCRv6_small_det.onnx`, `PP-OCRv6_small_rec.onnx`, and
`PP-OCRv6_small_rec_dict.txt`. The workflow rejects path traversal, verifies
the archive checksum before extraction, and normalizes the three files into a
temporary CI directory. The bundled Tiny `cls.onnx` is used deliberately: the
Small profile has no separate classifier and the exact Tiny CLS identity is
pinned by `converter/ppocr_contracts.py`.

The same pipeline can be run locally without copying assets into the source
tree:

```bash
python tools/run_small_validation.py \
  --assets-dir path/to/small-assets \
  --build-dir build \
  --output-dir build-model-foundation/small-validation-run
```

It stages a manifest-checked analysis bundle, probes the REC dynamic metadata,
converts DET and REC prototypes, executes all three DET shapes and all five
REC widths, applies the numerical gates, and runs the complete OCR sample. A
successful run writes the report and intermediate outputs under the selected
output directory. This is a repeatable compatibility gate, not a production
support or release-package claim.
