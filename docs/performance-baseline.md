# Scalar REC performance baseline

`lw-rec-benchmark` establishes the measurement contract used before changing
the scalar kernels. It loads the public recognizer once, performs warm-up calls,
checks that every result is bit-deterministic, and emits one JSON object.

The report contains recognizer creation time, model size, planned workspace,
preallocated input/output bytes, mean/median/P95/min/max latency, throughput,
RSS after warm-up, final RSS, RSS growth, and peak RSS. RSS is an operational
signal only; it is not by itself proof that a process is leak-free.

## Reproduce

From a Release build tree:

```powershell
.\build-ninja-c\lw-rec-benchmark.exe `
  .\build-ninja-c\models\rec.lwm `
  .\models\ppocrv6-tiny\ppocr_keys.txt `
  .\build-ninja-c\models\sample-crop.ppm `
  3 20
```

The final two arguments are warm-up count and measured iteration count. Both
must be in `1..10000`. The output is UTF-8 JSON with `schema_version: 1`.
The `backend` field reports the selected `scalar`, `sse2`, or `avx2` kernel
level.

For the complete DET/CLS/REC path, use the reusable-handle benchmark. The final
argument is `lw_ocr_options.worker_count`:

```powershell
.\build-ninja-c\lw-ocr-benchmark.exe `
  .\build-ninja-c\models\det.lwm `
  .\build-ninja-c\models\cls.lwm `
  .\build-ninja-c\models\rec.lwm `
  .\models\ppocrv6-tiny\ppocr_keys.txt `
  .\build-ninja-c\models\sample.ppm `
  3 8 4 960
```

The final two values select the line-worker count and maximum REC width. Values
above 320 exercise the adaptive-width path used by the Web and C# applications.
The JSON separates DET latency from full OCR latency and reports the derived
crop/CLS/REC remainder, line count, selected worker count and REC width,
throughput, and RSS. Every warm-up and measured call must return identical
packed UTF-8 text.

The current fixed-pool DET plus line-worker implementation was measured on the
same local Windows x64 host in five independent processes. Each process used
three warm-ups and twenty measured calls on the bundled 500x500/16-line fixture;
the table reports the median process result:

| Workers | Full OCR mean | P95 | Throughput | RSS after warm-up |
|---:|---:|---:|---:|---:|
| 1 | 295.14 ms | 298.13 ms | 3.39/s | 72.46 MiB |
| 4 | 122.46 ms | 130.17 ms | 8.17/s | 109.22 MiB |

The four-worker configuration reduced complete OCR latency by 58.51% and ran
2.41x as fast as one worker on this host. This is a local engineering result,
not a portable latency guarantee.

## PP-OCRv6 Tiny/Small/Medium 960 baseline

This is the current model-selection and optimization baseline for the complete
DET+CLS+REC path. All three profiles used the project test image
`build/models/sample.ppm`, `REC width=960`, one warm-up, and three measured
iterations through the same `lw-ocr-benchmark` executable on Windows x64 AVX2.
Small and Medium reused the shared Tiny CLS asset and the shared
`PP-OCRv6_small_rec_dict.txt` dictionary. Every run returned 16 lines.

| Model | 1 worker mean | 4 worker mean | 1 worker peak RSS | 4 worker peak RSS |
|---|---:|---:|---:|---:|
| Tiny | 355.30 ms | 154.44 ms | 92.2 MiB | 177.4 MiB |
| Small | 1,491.89 ms | 706.74 ms | 217.1 MiB | 499.1 MiB |
| Medium | 7,797.50 ms | 3,904.37 ms | 649.9 MiB | 1,396.6 MiB |

Relative to Tiny, Small is about 4.20x/4.58x slower and Medium about
21.95x/25.28x slower for one/four workers. Medium's detector alone accounts
for roughly 4.46 seconds in this run, so Medium optimization should start with
DET profiling. The full JSON reports and the three-model summary remain local
under `build-local-data/`; this table is the versioned reference point, not a
cross-machine performance promise or a release gate.

## REC worker immutable-resource sharing

The REC worker pool loads the model bytes and dictionary once. The first
recognizer owns the loaded resources; additional workers clone an independent
session and workspace while retaining the same immutable model and dictionary.
The clone now also retains the source session's immutable prepared-node table and
packed-weight arena. Mutable tensors, activation buffers, and execution
workspaces remain session-local. This is an internal lifecycle change and does
not alter the public C ABI or the byte-level OCR result contract.

A local follow-up run used the same sample, AVX2 build, REC width 960, one
warm-up, and one measured iteration. Peak RSS changed as follows relative to the
preceding baseline (single-iteration measurements are directional, not release
gates):

| Model | Workers | Previous peak RSS | Model/dictionary sharing | Packed-constant sharing |
|---|---:|---:|---:|---:|
| Tiny | 4 | 177.4 MiB | 165.9 MiB | 161.6 MiB |
| Small | 4 | 499.1 MiB | 450.2 MiB | 433.7 MiB |
| Medium | 4 | 1,396.6 MiB | 1,118.6 MiB | 1,074.9 MiB |

The packed-constant phase removes another approximately 16.5 MiB from the Small
four-worker peak and 43.7 MiB from the Medium four-worker peak in this run. The
one-worker numbers remain effectively unchanged because there is no duplicate
worker allocation to eliminate. Latency is not claimed from these one-iteration
runs; the checksum and line count remained unchanged.

The sharing is intentionally conservative: it aliases the constants prepared
for the clone's initial REC width. If a session later switches to another
adaptive width, that session may prepare a width-specific constant arena locally.
A future compiled-model cache can deduplicate those width variants, but that is
separate from this ABI-neutral worker-pool change.

## Local baseline

The following is one local measurement, not a general performance promise:

- host: AMD Ryzen 7 7735H, 16 logical processors;
- OS: Windows 10.0.19045 x64;
- compiler: MSVC 19.40, Release `/O2`, C11;
- backend: scalar, FP32, single-threaded;
- model/image: bundled PP-OCRv6 tiny REC and 295x46 PPM crop;
- protocol: 3 warm-up calls followed by 20 measured calls.

| Process | Mean | Median | P95 | Min | Max | Throughput | RSS growth | Peak RSS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 570.752 ms | 571.315 ms | 573.565 ms | 565.017 ms | 582.988 ms | 1.752/s | 0 B | 13.45 MiB |
| Windows x86 | 1416.520 ms | 1411.053 ms | 1438.057 ms | 1393.362 ms | 1457.315 ms | 0.706/s | -84 KiB | 14.75 MiB |

Both runs produced exactly `纯臻营养护发素` on every warm-up and measured call.
The runtime planned 2,948,160 workspace bytes and 1,289,280 preallocated
input/output bytes. Future optimization reports must use the same fixture and
protocol, retain the Golden Tests, and compare both latency and memory.

## Full OCR line-worker A/B

The full-OCR benchmark on the same local x64 host used the 500x500 bundled
16-line fixture, AVX2, three warm-ups, and eight measured iterations. Both
processes used the same optimized binary; only `worker_count` changed.

| Workers | DET mean | Full OCR mean | After DET | Throughput | RSS after warm-up |
|---:|---:|---:|---:|---:|---:|
| 1 | 506.096 ms | 862.322 ms | 356.226 ms | 1.160/s | 67.58 MiB |
| 4 | 506.596 ms | 626.414 ms | 119.818 ms | 1.596/s | 98.02 MiB |

Four workers reduced complete OCR latency by 27.36% (1.377x) and the
crop/CLS/REC portion by 66.36% (2.973x). The measured steady RSS increased by
30.44 MiB because every worker owns independent CLS/REC models, sessions, and
workspaces. DET remained single-threaded and statistically unchanged. This is
a local engineering result, not a release-wide performance guarantee.

## First optimized result

The first profile-directed Scalar Conv change used the same machine, build,
fixture, and 3+20 protocol:

| Process | Baseline mean | Optimized mean | Reduction | Speedup | Optimized throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|
| Windows x64 | 570.752 ms | 381.206 ms | 33.21% | 1.497x | 2.623/s | 0 B |
| Windows x86 | 1416.520 ms | 669.329 ms | 52.75% | 2.116x | 1.494/s | 0 B |

The profile, implementation boundary, correctness checks, and complete A/B
report are recorded in [`kernel-optimization.md`](kernel-optimization.md).

## Pointwise optimized result

Node-level profiling identified the 25 pointwise Conv nodes as 96.24% of Conv
time after the first change. A cache-contiguous 1x1 path produced this second
result under the same 3+20 protocol:

| Process | Original baseline | First optimized | Pointwise optimized | Overall speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|
| Windows x64 | 570.752 ms | 381.206 ms | 51.495 ms | 11.084x | 19.419/s | 0 B |
| Windows x86 | 1416.520 ms | 669.329 ms | 139.297 ms | 10.169x | 7.179/s | 0 B |

The full node profile and implementation constraints are recorded in
[`kernel-optimization.md`](kernel-optimization.md).

## 3x3 downsampling optimized result

The two remaining ordinary 3x3 downsampling nodes received a cache-local
portable-C path. Under the same 3+20 protocol:

| Process | Original baseline | Pointwise optimized | 3x3 optimized | Overall speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|
| Windows x64 | 570.752 ms | 51.495 ms | 44.444 ms | 12.842x | 22.500/s | 0 B |
| Windows x86 | 1416.520 ms | 139.297 ms | 126.773 ms | 11.174x | 7.888/s | 0 B |

The 3x3 result uses the median reported mean and throughput from five repeated
3+20 runs; all five runs had zero measured RSS growth.

## MatMul optimized result

The two REC MatMul nodes now scan each shared weight row contiguously and reuse
it across a four-row output block. Under the same five repeated 3+20 protocol:

| Process | 3x3 optimized | MatMul optimized | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 44.444 ms | 37.405 ms | 15.84% | 1.188x | 15.259x | 26.734/s | 0 B |
| Windows x86 | 126.773 ms | 115.728 ms | 8.71% | 1.095x | 12.240x | 8.641/s | 0 B |

The x64 node profile measured median MatMul time at 5.970 ms, down 57.23%
from 13.957 ms. Every measured call retained the exact text and score, and all
ten runs had zero measured RSS growth.

The latest operator profile is distributed across Conv, MatMul, and
elementwise work. Further specialization should therefore be selected using
CPU-dispatched SIMD measurements rather than adding another narrow scalar
shape path.

## SSE2 MatMul result

The first explicit SIMD milestone adds runtime CPU detection and a four-column
SSE2 MatMul loop while retaining the scalar implementation as the fallback.
Under the same five repeated 3+20 protocol:

| Process | Scalar MatMul stage | SSE2 stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 37.405 ms | 35.344 ms | 5.51% | 1.058x | 16.148x | 28.293/s | 0 B |
| Windows x86 | 115.728 ms | 114.763 ms | 0.83% | 1.008x | 12.343x | 8.714/s | 0 B |

The x64 MatMul operator median fell from 5.970 ms to 2.845 ms, a 52.34%
reduction. The x86 MatMul median fell from 5.860 ms to 2.869 ms, a 51.04%
reduction; its smaller end-to-end change reflects the remaining Conv and
elementwise cost and normal run-to-run variance. Every run reported `sse2`,
retained the exact text and score, and had zero measured RSS growth.

## AVX2 MatMul result

The next SIMD milestone adds OS-safe AVX2 detection and an eight-column MatMul
loop, while retaining SSE2 and scalar fallbacks. Under the same five repeated
3+20 protocol:

| Process | SSE2 stage | AVX2 stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 35.344 ms | 33.324 ms | 5.72% | 1.061x | 17.128x | 30.009/s | 0 B |
| Windows x86 | 114.763 ms | 112.594 ms | 1.89% | 1.019x | 12.581x | 8.881/s | 0 B |

The x64 MatMul operator median fell from 2.845 ms with SSE2 to 1.906 ms with
AVX2, a 33.01% reduction. The x86 MatMul median fell from 2.869 ms to 1.898 ms,
a 33.84% reduction. Every run reported `avx2`, retained the exact text and
score, and had zero measured RSS growth.

## SIMD pointwise Conv result

The same OS-safe runtime dispatch now selects eight-lane AVX2, four-lane SSE2,
or scalar pointwise Conv. Under the same five repeated 3+20 protocol:

| Process | AVX2 MatMul stage | SIMD pointwise stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 34.164 ms | 29.504 ms | 13.64% | 1.158x | 19.345x | 33.893/s | 0 B |
| Windows x86 | 114.499 ms | 59.540 ms | 48.00% | 1.923x | 23.791x | 16.795/s | 0 B |

The x64 pointwise Conv node total fell from 10.000 ms to 5.502 ms, a 44.98%
reduction. The x86 total fell from 69.400 ms to 14.350 ms, a 79.32% reduction.
The larger x86 result reflects that its prior MSVC build kept this loop scalar,
while the x64 compiler had already generated some SSE2 instructions. Every run
reported `avx2`, retained the exact text and score, and had zero measured RSS
growth.

## Flat binary SIMD result

Profiling classified all 87 Add/Mul/Div nodes by their resolved runtime shapes.
The 55 same-shaped or right-scalar nodes now bypass general broadcast coordinate
tracking and use AVX2/SSE2/scalar flat loops. Under the same five repeated 3+20
protocol:

| Process | Pointwise SIMD stage | Flat binary SIMD stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 29.537 ms | 25.295 ms | 14.36% | 1.168x | 22.564x | 39.534/s | 0 B |
| Windows x86 | 59.349 ms | 49.291 ms | 16.95% | 1.204x | 28.738x | 20.288/s | 0 B |

The x64 Add/Mul/Div operator median total fell from 7.854 ms to 3.066 ms, a
60.97% reduction (2.562x). The x86 total fell from 15.981 ms to 6.511 ms, a
59.26% reduction (2.454x). Every run reported `avx2`, retained the exact text
and score, and had zero measured RSS growth.

## Single-axis binary broadcast result

The remaining 32 binary nodes all use one non-unit right dimension. NCHW
channel broadcasts now execute one right-scalar SIMD block per channel, and
trailing-vector broadcasts execute one contiguous-pair SIMD block per outer
slice. Under a fresh five repeated 3+20 A/B protocol:

| Process | Flat binary stage | Broadcast-block stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 26.221 ms | 23.672 ms | 9.72% | 1.108x | 24.111x | 42.244/s | 0 B |
| Windows x86 | 51.674 ms | 45.874 ms | 11.22% | 1.126x | 30.878x | 21.799/s | 0 B |

The x64 single-axis broadcast median fell from 2.743 ms to 0.303 ms, an
88.95% reduction (9.050x). The x86 median fell from 6.277 ms to 0.400 ms, a
93.63% reduction (15.700x). Every run reported `avx2`, retained the exact text
and score, and had zero measured RSS growth.

## Stride-1 Depthwise 3x3 SIMD result

Seven REC nodes share the same Depthwise 3x3, stride-1, dilation-1, pad-1
shape. They now process eight output columns with AVX2 or four with SSE2 while
preserving each output's scalar nine-weight accumulation order. Under a fresh
five repeated 3+20 A/B protocol:

| Process | Broadcast-block stage | Depthwise SIMD stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 24.142 ms | 21.345 ms | 11.59% | 1.131x | 26.739x | 46.849/s | 0 B |
| Windows x86 | 46.368 ms | 43.023 ms | 7.21% | 1.078x | 32.925x | 23.243/s | 0 B |

The x64 target-node median fell from 3.039 ms to 0.266 ms, a 91.26% reduction
(11.439x). The x86 median fell from 4.753 ms to 0.383 ms, a 91.95% reduction
(12.415x). Every run reported `avx2`, retained the exact text and score, and
had zero measured RSS growth.

## Ordinary stride-2 3x3 SIMD result

The two REC stem nodes use ordinary 3x3, stride-2, dilation-1, pad-1 Conv. Their
input widths of 320 and 160 allow most output columns to use safe deinterleaving
loads: AVX2 advances eight independent outputs and SSE2 advances four, while
each output retains the original input-channel and nine-weight accumulation
order. Under a fresh five repeated 3+20 A/B protocol:

| Process | Depthwise stage | Stride-2 SIMD stage | Further reduction | Further speedup | Original baseline speedup | Throughput | RSS growth |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows x64 | 21.367 ms | 18.865 ms | 11.71% | 1.133x | 30.255x | 53.010/s | 0 B |
| Windows x86 | 41.951 ms | 38.833 ms | 7.43% | 1.080x | 36.477x | 25.751/s | 0 B |

The x64 target-node median fell from 5.435 ms to 1.989 ms, a 63.40% reduction
(2.732x). The x86 median fell from 4.969 ms to 2.582 ms, a 48.03% reduction
(1.924x). Every run reported `avx2`, retained the exact text and score, and had
zero measured RSS growth.

## Medium DET regular 7x7 SIMD result

The Medium DET 960 profile identified regular `7x7`, stride-1, pad-3 Conv as
the largest remaining detector hotspot. The new AVX2 path streams eight output
columns while preserving the scalar accumulation order and disabling FMA. ARM,
WASM, and unsupported geometries retain the portable reference path.

Across the positive regular-7x7 nodes, the three-run instrumented average fell
from approximately 166.8 ms to 25.4 ms on the local Windows x64 host. The full
OCR checksum stayed `ededc8978c6a78ee` with 16 lines. Because this is node-level
instrumentation, it is a hotspot checkpoint rather than a release latency claim;
the next A/B candidate is Medium DET regular 5x5.
