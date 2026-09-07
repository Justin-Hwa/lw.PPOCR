from __future__ import annotations

import unittest

from tools.evaluate_ocr_dataset import (
    bbox_iou,
    clamp_bbox,
    edit_distance,
    match_lines,
    normalize_text,
    parse_native_output,
)


class OcrDatasetTests(unittest.TestCase):
    def test_native_output_parser_preserves_unicode_and_scores(self) -> None:
        output = (
            "config rec_max_width=960 adaptive=yes\n"
            "lines=1 image=100x80 detector_input=96x96\n"
            "0 text=纯臻营养护发素 rec=0.95 det=0.93 cls=0/0.99 rotate=0 "
            "[(10.0,20.0),(90.0,20.0),(90.0,40.0),(10.0,40.0)]\n"
        )
        declared, lines = parse_native_output(output)
        self.assertEqual(declared, 1)
        self.assertEqual(lines[0]["text"], "纯臻营养护发素")
        self.assertAlmostEqual(lines[0]["rec_score"], 0.95)
        self.assertEqual(lines[0]["box"], (10.0, 20.0, 90.0, 40.0))

    def test_parser_rejects_declared_line_count_drift(self) -> None:
        with self.assertRaisesRegex(ValueError, "declared 2 lines"):
            parse_native_output(
                "lines=2 image=10x10 detector_input=10x10\n"
                "0 text=only rec=1 det=1 cls=0/1 rotate=0 "
                "[(0,0),(1,0),(1,1),(0,1)]\n"
            )

    def test_geometry_matching_is_one_to_one(self) -> None:
        ground_truth = [(0.0, 0.0, 10.0, 10.0), (20.0, 0.0, 30.0, 10.0)]
        predicted = [
            {"box": (0.0, 0.0, 10.0, 10.0)},
            {"box": (20.0, 0.0, 30.0, 10.0)},
        ]
        self.assertEqual(match_lines(ground_truth, predicted, 0.5), [(0, 0, 1.0), (1, 1, 1.0)])

    def test_bbox_and_text_metrics_are_deterministic(self) -> None:
        self.assertAlmostEqual(bbox_iou((0, 0, 10, 10), (5, 0, 15, 10)), 1.0 / 3.0)
        self.assertEqual(clamp_bbox([-1, 2, 12, 20], 10, 15), (0.0, 2.0, 10.0, 15.0))
        self.assertEqual(normalize_text("e\u0301\r\n"), "é\n")
        self.assertEqual(edit_distance("OCR", "OXR"), 1)

    def test_project_manifest_requires_our_generator(self) -> None:
        from tools.evaluate_ocr_dataset import read_dataset
        import json
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "metadata.json").write_text(
                json.dumps({"version": 1, "images": []}), encoding="utf-8"
            )
            with self.assertRaisesRegex(ValueError, "dataset generator"):
                read_dataset(root)


if __name__ == "__main__":
    unittest.main()
