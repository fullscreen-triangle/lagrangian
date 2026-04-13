"""Command-line entry: run the paper's validation table and save results."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict
from pathlib import Path

from shader_astronomy.validation import Benchmark, format_report, run_all


def _benchmark_dict(b: Benchmark) -> dict[str, object]:
    return {
        "name": b.name,
        "computed": b.computed,
        "reference": b.reference,
        "relative_error": b.relative_error,
        "tolerance": b.tolerance,
        "passed": b.passed,
        "unit": b.unit,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="shader-astronomy",
        description="Validation harness for shader-based astronomy",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output"),
        help="directory for JSON + CSV output (default: ./output)",
    )
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="skip human-readable stdout report",
    )
    args = parser.parse_args(argv)

    results = run_all()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "validation.json"
    csv_path = args.output_dir / "validation.csv"

    payload = [_benchmark_dict(b) for b in results]
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    fieldnames = list(payload[0].keys())
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in payload:
            writer.writerow(row)

    if not args.no_report:
        print(format_report(results))

    total = len(results)
    passed = sum(1 for b in results if b.passed)
    print(f"\nwrote {json_path}")
    print(f"wrote {csv_path}")
    print(f"pass rate: {passed}/{total}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
