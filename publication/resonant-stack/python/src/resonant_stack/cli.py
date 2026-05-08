"""CLI entry point for the resonant stack package."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from resonant_stack.validation import format_report, run_all, summary, write_csv, write_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="resonant-stack",
        description="Validation and plots for The Resonant Spectral Stack.",
    )
    sub = parser.add_subparsers(dest="cmd")

    v_parser = sub.add_parser("validate", help="Run all validation experiments")
    v_parser.add_argument("--output-dir", type=Path, default=Path("output"))
    v_parser.add_argument("--quiet", action="store_true")

    p_parser = sub.add_parser("plots", help="Generate figure panels")
    p_parser.add_argument("--output-dir", type=Path, default=Path("figures"))

    args = parser.parse_args(argv)

    if args.cmd == "validate":
        results = run_all()
        write_json(results, args.output_dir / "validation.json")
        write_csv(results, args.output_dir / "validation.csv")
        if not args.quiet:
            print(format_report(results))
        s = summary(results)
        print(f"\n{s['passed']}/{s['total']} passed ({100 * s['pass_rate']:.1f}%)")
        return 0 if s["failed"] == 0 else 1

    if args.cmd == "plots":
        from resonant_stack.plots import generate_all
        paths = generate_all(args.output_dir)
        for p in paths:
            print(f"wrote {p}")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
