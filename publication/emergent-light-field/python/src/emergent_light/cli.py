"""CLI entry for the emergent-light-field validation suite."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from emergent_light.validation import (
    format_report,
    run_all,
    summary,
    write_csv,
    write_json,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="emergent-light")
    parser.add_argument("--output-dir", type=Path, default=Path("output"))
    parser.add_argument("--no-report", action="store_true")
    args = parser.parse_args(argv)

    results = run_all()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(results, args.output_dir / "validation.json")
    write_csv(results, args.output_dir / "validation.csv")

    if not args.no_report:
        print(format_report(results))

    s = summary(results)
    print(f"\nwrote {args.output_dir / 'validation.json'}")
    print(f"wrote {args.output_dir / 'validation.csv'}")
    print(f"pass rate: {s['passed']}/{s['total']}")
    return 0 if s["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
