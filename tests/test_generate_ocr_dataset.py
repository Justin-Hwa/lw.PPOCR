from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.generate_ocr_dataset import generate_dataset


class GenerateOcrDatasetTests(unittest.TestCase):
    def test_seeded_ascii_dataset_is_reproducible_and_in_bounds(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            texts = (("english", "OCR 123"), ("identifier", "PPOCR test"))
            first_manifest = generate_dataset(
                Path(first), 3, 1234, image_format="png", text_pool=texts
            )
            second_manifest = generate_dataset(
                Path(second), 3, 1234, image_format="png", text_pool=texts
            )
            self.assertEqual(first_manifest, second_manifest)
            for image in first_manifest["images"]:
                width = int(image["width"])
                height = int(image["height"])
                for line in image["lines"]:
                    x1, y1, x2, y2 = line["bbox"]
                    self.assertGreaterEqual(x1, 0)
                    self.assertGreaterEqual(y1, 0)
                    self.assertLessEqual(x2, width)
                    self.assertLessEqual(y2, height)
                    self.assertLess(x1, x2)
                    self.assertLess(y1, y2)

    def test_generated_manifest_contains_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manifest = generate_dataset(
                Path(directory), 1, 9, image_format="png", text_pool=(("x", "OCR"),)
            )
            self.assertEqual(manifest["version"], 1)
            self.assertEqual(manifest["seed"], 9)
            self.assertEqual(manifest["generator"]["name"], "lw.PPOCR.C")
            self.assertEqual(len(manifest["images"]), 1)
            self.assertTrue(manifest["images"][0]["sha256"])


if __name__ == "__main__":
    unittest.main()
