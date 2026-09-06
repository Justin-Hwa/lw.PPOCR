from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import unittest


class Conv3x3Stride2BenchmarkTest(unittest.TestCase):
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
            [(item["input"], item["output"]) for item in cases],
            [
                ([1, 3, 48, 320], [1, 48, 24, 160]),
                ([1, 96, 24, 160], [1, 48, 12, 80]),
            ],
        )
        for item in cases:
            for field in (
                "scalar_ms",
                "dispatched_ms",
                "speedup",
                "packed_ms",
                "packed_speedup",
            ):
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
