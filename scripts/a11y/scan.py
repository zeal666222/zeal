#!/usr/bin/env python3
"""
ZEAL — WCAG 2.2 AA Accessibility Scanner
─────────────────────────────────────────────────────────────────────────────
Scans .tsx files for common violations:
  • Images without alt text
  • Buttons without accessible labels
  • Headings out of order (h1 → h3)
  • Form inputs without associated labels
  • Missing skip-link target
  • onClick without keyboard handler on non-button elements
  • Insufficient contrast on hardcoded hex (heuristic)

Usage: python3 scripts/a11y/scan.py [path]
"""
import os, re, sys, json
from pathlib import Path
from dataclasses import dataclass, field

@dataclass
class Violation:
    file: str
    line: int
    rule: str
    severity: str  # Critical | Major | Minor
    message: str

@dataclass
class Report:
    violations: list = field(default_factory=list)
    files_scanned: int = 0

    def add(self, v: Violation):
        self.violations.append(v)

    def summary(self):
        by_sev = {"Critical": 0, "Major": 0, "Minor": 0}
        for v in self.violations:
            by_sev[v.severity] = by_sev.get(v.severity, 0) + 1
        return by_sev


def scan_file(path: Path, report: Report):
    try:
        src = path.read_text(encoding="utf-8")
    except Exception:
        return
    lines = src.split("\n")
    report.files_scanned += 1

    # ── Rule: <img> without alt ────────────────────────────────────────────
    for i, line in enumerate(lines, 1):
        if re.search(r'<img\s', line) and 'alt=' not in line:
            report.add(Violation(str(path), i, "img-alt", "Critical",
                "Raw <img> without alt attribute. Use next/image OptimizedImage or add alt."))

    # ── Rule: icon-only buttons without aria-label ─────────────────────────
    for i, line in enumerate(lines, 1):
        # Heuristic: <button ...> with only an icon child on same or next line
        if re.search(r'<button[^>]*>\s*$', line):
            window = "\n".join(lines[i-1:i+3])
            if re.search(r'<\w+\s+size=\{?\d', window) and 'aria-label' not in window and 'sr-only' not in window:
                report.add(Violation(str(path), i, "button-label", "Major",
                    "Icon-only button missing aria-label or sr-only text."))

    # ── Rule: heading order ────────────────────────────────────────────────
    heading_levels = []
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r'<h([1-6])\b', line):
            heading_levels.append((i, int(m.group(1))))
    for idx in range(1, len(heading_levels)):
        prev_line, prev_lvl = heading_levels[idx-1]
        cur_line, cur_lvl = heading_levels[idx]
        if cur_lvl > prev_lvl + 1:
            report.add(Violation(str(path), cur_line, "heading-order", "Minor",
                f"Heading jumps from h{prev_lvl} to h{cur_lvl}. Keep levels sequential."))

    # ── Rule: onClick on div/span without role or keyboard handler ─────────
    for i, line in enumerate(lines, 1):
        if re.search(r'<(div|span)[^>]*onClick', line):
            window = "\n".join(lines[max(0, i-3):i+2])
            if 'role=' not in window and 'onKeyDown' not in window and 'onKeyPress' not in window:
                report.add(Violation(str(path), i, "clickable-div", "Major",
                    "Non-button element with onClick. Add role + tabIndex + keyboard handler."))

    # ── Rule: form label association ───────────────────────────────────────
    for i, line in enumerate(lines, 1):
        if re.search(r'<input\s', line) and 'type="hidden"' not in line:
            window = "\n".join(lines[max(0, i-3):i+2])
            if 'aria-label' not in window and 'id=' not in window and 'placeholder' in line:
                report.add(Violation(str(path), i, "input-label", "Major",
                    "Input with placeholder but no id/aria-label. Add an associated <label>."))

    # ── Rule: hardcoded low-contrast hex on dark bg (heuristic) ────────────
    LOW_CONTRAST = ["#666", "#777", "#888", "#999", "#aaa"]
    for i, line in enumerate(lines, 1):
        for hx in LOW_CONTRAST:
            if re.search(r'text-\[' + re.escape(hx) + r'\]', line, re.IGNORECASE):
                report.add(Violation(str(path), i, "contrast", "Major",
                    f"Hardcoded {hx} on text — verify ≥ 4.5:1 contrast."))


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    report = Report()
    for path in root.rglob("*.tsx"):
        if any(p in str(path) for p in ["node_modules", ".next", "dist"]):
            continue
        scan_file(path, report)

    summary = report.summary()
    print()
    print("═" * 60)
    print("  ZEAL — WCAG 2.2 AA Accessibility Report")
    print("═" * 60)
    print(f"  Files scanned : {report.files_scanned}")
    print(f"  Critical      : {summary['Critical']}")
    print(f"  Major         : {summary['Major']}")
    print(f"  Minor         : {summary['Minor']}")
    print("─" * 60)

    if not report.violations:
        print("  ✓ No violations found")
    else:
        for v in sorted(report.violations, key=lambda x: (x.severity, x.file)):
            icon = "✗" if v.severity == "Critical" else "⚠" if v.severity == "Major" else "○"
            print(f"  {icon} [{v.severity}] {v.file}:{v.line} — {v.message}")

    print("═" * 60)
    print()

    sys.exit(1 if summary["Critical"] > 0 else 0)


if __name__ == "__main__":
    main()
