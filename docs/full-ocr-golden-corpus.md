# Full-OCR golden corpus

The v0.1 full-OCR regression gate is versioned in
`tests/fixtures/ocr-golden-corpus.json`. The manifest pins the SHA-256 of the
source image, DET/CLS/REC ONNX models, and recognition dictionary so a model or
fixture change cannot silently reuse stale expectations.

`full_ocr_golden_corpus` runs seven deterministic cases through the public
three-model OCR pipeline:

- the original 500x500 image with direction classification enabled;
- the same image with direction classification disabled;
- integer-defined nearest-neighbor resizing to 375x375 and 750x750;
- the source on a 500x600 white canvas;
- a byte-exact 90-degree counterclockwise rotation;
- a 640x192 white image with no text.

The derived pixels do not depend on Pillow or OpenCV resizing implementations.
The test defines nearest-neighbor indices with integer arithmetic and uses NumPy
only to apply those indices, rotations, and canvas operations. Pillow decodes
the one bundled JPEG, as it does in the existing reference tests.

Every case freezes the exact UTF-8 result and reading order, detected count,
DET resize shape, classifier labels, and applied rotations. Scores use explicit
lower bounds instead of exact floating-point comparison. Every quadrilateral
must remain within the source image and have nonzero area. The original image
also compares all eight coordinates of all 16 boxes with a two-pixel tolerance.
The blank case freezes the valid zero-line/zero-text result.

This corpus broadens pipeline regression coverage across scale, aspect ratio,
empty input, classifier options, and rotated text, but it is derived from one
redistributable source image. It is not a general OCR accuracy benchmark.
Future additions should prefer independently sourced redistributable images,
record their hashes, and review changed expectations separately from runtime
optimizations.

## Project-owned generated datasets

For repeatable model comparison, use the repository-owned generator instead of
depending on an external evaluator or an external image corpus. The generator
records the seed, Pillow version, font file names and SHA-256 values, image
dimensions, image SHA-256 values, text categories, font settings, orientation,
rotation, and bounded non-overlapping line boxes in `metadata.json`. If a
requested density does not fit a particular canvas, the generator records the
requested and placed line counts instead of painting one text line over another.
The default text pool is project-specific: it covers PP-OCRv6 model profiles,
DET/CLS/REC, LWM and WASM, Android/Java and C ABI integration, SIMD backends,
PDF handling, reading order, and TXT/JSON export.

Generated images and reports belong under `build-local-data/`, which is ignored
by Git. The generator, manifest schema, evaluator, and unit tests are tracked;
the generated image files are not. This keeps CI and release packages small
while allowing any developer to reproduce the same local dataset with the
same seed, Pillow version, and fonts.

Generate the default 100-image local corpus on Windows with CJK fonts:

```bash
python tools/generate_ocr_dataset.py \
  --output build-local-data/lw-generated-ocr \
  --count 100 \
  --seed 20260907 \
  --font C:/Windows/Fonts/msyh.ttc \
  --font C:/Windows/Fonts/simsun.ttc
```

Evaluate that local corpus with the project-native OCR driver:

```bash
python tools/evaluate_ocr_dataset.py \
  --dataset build-local-data/lw-generated-ocr \
  --driver build/Release/lw-ocr-ppm.exe \
  --detector build/models/det.lwm \
  --classifier build/models/cls.lwm \
  --recognizer build/models/rec.lwm \
  --dictionary models/ppocrv6-tiny/ppocr_keys.txt \
  --model-name ppocrv6-tiny \
  --rec-max-width 960 \
  --output build-local-data/tiny-generated-ocr-960.json
```

For the Small profile, keep the shared Tiny CLS model and switch only DET,
REC, and the dictionary:

```bash
python tools/evaluate_ocr_dataset.py \
  --dataset build-local-data/lw-generated-ocr \
  --driver build/Release/lw-ocr-ppm.exe \
  --detector build-model-foundation/ppocrv6-small-det-dynamic.lwm \
  --classifier build/models/cls.lwm \
  --recognizer build-model-foundation/ppocrv6-small-rec-dynamic.lwm \
  --dictionary models/ppocrv6-shared/PP-OCRv6_small_rec_dict.txt \
  --model-name ppocrv6-small \
  --rec-max-width 960 \
  --output build-local-data/small-generated-ocr-960.json
```

The evaluator verifies image hashes and dimensions, converts JPEG input to
temporary PPM, invokes the existing native driver, and matches predicted boxes
to generated boxes by one-to-one greedy IoU. It reports detection
precision/recall/F1, matched-box IoU, CER on matched lines, exact reference-line
rate, missing lines, and extra lines. It is a local model-analysis tool, not a
release gate. Generated images must not be added to Git; any future checked-in
fixture still needs an independent provenance and redistribution review.
