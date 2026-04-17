"""CLI entry for the loop-coupling validation suite."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from loop_coupling.validation import (
    format_report,
    run_all,
    summary,
    write_csv,
    write_json,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="loop-coupling",
        description="Three-experiment validation suite for the harmonic-scattering loop-coupling framework.",
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
        help="skip stdout report",
    )
    args = parser.parse_args(argv)

    results = run_all()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "validation.json"
    csv_path = args.output_dir / "validation.csv"
    write_json(results, json_path)
    write_csv(results, csv_path)

    if not args.no_report:
        print(format_report(results))

    s = summary(results)
    print(f"\nwrote {json_path}")
    print(f"wrote {csv_path}")
    print(f"pass rate: {s['passed']}/{s['total']}")

    return 0 if s["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
