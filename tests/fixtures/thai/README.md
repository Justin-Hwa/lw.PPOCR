# Synthetic Thai fixtures

Original test sentences, not user documents:

```
สัญญาเช่า เลขที่ 12345
วันที่ชำระเงิน 12 กันยายน 2569
จำนวนเงิน 15000 บาท
สัญญาเช่า Contract ABC 123
```

`text.pdf` has a searchable text layer and an embedded subset of Noto Sans Thai.
`scan.png` is the same text rasterized with Pillow. The browser test wraps it in
repeated PDF pages, so scans, page counts and mixed Thai/English search are checked
without any network access or font dependencies in CI.

Generated using Noto Sans Thai, SIL Open Font License 1.1 (see `OFL.txt`):
https://github.com/google/fonts/tree/main/ofl/notosansthai
Original variable font SHA-256:
`5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8`.
The PDF uses a wght=400, wdth=100 instance; PNG uses the same 48px font on a
1600×650 white canvas at (70, 50 + line_index × 120). PDF text is 18pt on a
640×300pt page at (25, 250 − line_index × 55).
