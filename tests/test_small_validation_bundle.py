from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from tools.extract_small_validation_assets import extract
from tools.stage_small_validation_bundle import create_bundle, sha256
from tools.validate_model_contract import validate_model_contract


ROOT = Path(__file__).resolve().parents[1]
TINY = ROOT / "models" / "ppocrv6-tiny"


class SmallValidationBundleTests(unittest.TestCase):
    def test_staged_bundle_is_contract_valid(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            sources = {
                "det": TINY / "det.onnx",
                "cls": TINY / "cls.onnx",
                "rec": TINY / "rec.onnx",
                "dictionary": TINY / "ppocr_keys.txt",
            }
            with patch.multiple(
                "tools.stage_small_validation_bundle",
                PP_OCRV6_SMALL_DET_SHA256=sha256(sources["det"]),
                PP_OCRV6_TINY_CLS_SHA256=sha256(sources["cls"]),
                PP_OCRV6_SMALL_REC_SHA256=sha256(sources["rec"]),
                PP_OCRV6_SMALL_DICT_SHA256=sha256(sources["dictionary"]),
            ):
                create_bundle(
                    sources["det"], sources["cls"], sources["rec"],
                    sources["dictionary"], output
                )
            contract = validate_model_contract(output)
        self.assertEqual(contract["variant"], "small")
        self.assertEqual(contract["runtime_status"], "analysis-only")
        self.assertEqual(contract["rec_classes"], 6906)

    def test_validation_archive_is_verified_and_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "small.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("upstream/PP-OCRv6_small_det.onnx", b"det")
                bundle.writestr("upstream/PP-OCRv6_small_rec.onnx", b"rec")
                bundle.writestr("upstream/PP-OCRv6_small_rec_dict.txt", b"dict\n")
            output = root / "assets"
            extract(archive, output, sha256(archive))
            self.assertEqual((output / "det.onnx").read_bytes(), b"det")
            self.assertEqual((output / "rec.onnx").read_bytes(), b"rec")
            self.assertEqual((output / "ppocr_keys.txt").read_bytes(), b"dict\n")

    def test_validation_archive_rejects_duplicate_normalized_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "duplicate.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("one/det.onnx", b"first")
                bundle.writestr("two/det.onnx", b"second")
                bundle.writestr("rec.onnx", b"rec")
                bundle.writestr("ppocr_keys.txt", b"dict\n")
            with self.assertRaisesRegex(ValueError, "duplicate normalized"):
                extract(archive, root / "assets", sha256(archive))


if __name__ == "__main__":
    unittest.main()
