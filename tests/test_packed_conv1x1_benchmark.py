from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import unittest


class PackedConv1x1BenchmarkTest(unittest.TestCase):
    def test_small_rec_geometries_are_correct_and_machine_readable(self) -> None:
        completed = subprocess.run(
            [ARGS.driver, "320", "1"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        report = json.loads(completed.stdout)
        self.assertEqual(report["schema_version"], 1)
        self.assertEqual(report["target_width"], 320)
        self.assertEqual(report["iterations"], 1)
        self.assertTrue(report["backend"])
        cases = report["cases"]
        self.assertEqual(
            [(item["input_channels"], item["output_channels"], item["height"], item["width"])
             for item in cases],
            [
                (96, 192, 12, 80),
                (192, 384, 6, 80),
                (384, 768, 3, 80),
                (768, 384, 3, 80),
            ],
        )
        for item in cases:
            for field in ("scalar_ms", "dispatched_ms", "speedup"):
                self.assertTrue(math.isfinite(item[field]), (field, item))
                self.assertGreater(item[field], 0.0, (field, item))
            self.assertRegex(item["checksum"], re.compile(r"^0x[0-9a-f]{16}$"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--driver", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    ARGS = parse_args()
    unittest.main(argv=[__file__], verbosity=2)
