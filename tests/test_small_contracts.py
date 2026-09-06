from __future__ import annotations

import unittest

from converter.ppocr_contracts import (
    PP_OCRV6_REC_WIDTHS,
    PP_OCRV6_SMALL_REC_BASE_SHAPE,
    PP_OCRV6_SMALL_CLS_SHARED,
    PP_OCRV6_TINY_CLS_SHA256,
    SMALL_REC_DYNAMIC_OUTPUTS,
    small_rec_metadata,
)
from tools.run_ocr_scene_suite import parse_output
from tools.validate_small_rec_dynamic_rule import validate_report


def valid_report() -> dict[str, object]:
    return {
        "schema_version": 1,
        "input": {"base_shape": list(PP_OCRV6_SMALL_REC_BASE_SHAPE), "widths": list(PP_OCRV6_REC_WIDTHS)},
        "metadata_nodes": [
            {"op": "Shape", "outputs": [name]}
            for name in SMALL_REC_DYNAMIC_OUTPUTS
        ],
        "probes": [
            {
                "width": width,
                "input_shape": [1, 3, 48, width],
                "metadata": small_rec_metadata(width),
            }
            for width in PP_OCRV6_REC_WIDTHS
        ],
    }


class SmallContractTests(unittest.TestCase):
    def test_small_profile_reuses_pinned_tiny_cls(self) -> None:
        self.assertTrue(PP_OCRV6_SMALL_CLS_SHARED)
        self.assertEqual(len(PP_OCRV6_TINY_CLS_SHA256), 64)

    def test_dynamic_metadata_contract_accepts_all_five_widths(self) -> None:
        summary = validate_report(valid_report())
        self.assertEqual(summary["required_widths"], list(PP_OCRV6_REC_WIDTHS))
        self.assertEqual(summary["status"], "validated-analysis-only")

    def test_dynamic_metadata_contract_rejects_wrong_width_rule(self) -> None:
        report = valid_report()
        probes = report["probes"]
        assert isinstance(probes, list)
        probes[0]["metadata"]["Shape.1"] = [1, 120, 1, 25]
        with self.assertRaisesRegex(ValueError, "output Shape.1"):
            validate_report(report)

    def test_scene_header_separates_image_and_detector_dimensions(self) -> None:
        header, lines = parse_output(
            "config rec_max_width=960 adaptive=yes\n"
            "lines=1 image=2200x900 detector_input=960x384\n"
            "0 text=示例 rec=0.9 det=0.8 cls=0/1.0 rotate=0 "
            "[(1,2),(3,2),(3,4),(1,4)]\n"
        )
        self.assertEqual(header["image_width"], 2200)
        self.assertEqual(header["image_height"], 900)
        self.assertEqual(header["detector_width"], 960)
        self.assertEqual(header["detector_height"], 384)
        self.assertEqual(lines[0]["text"], "示例")


if __name__ == "__main__":
    unittest.main()
