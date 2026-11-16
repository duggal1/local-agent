from __future__ import annotations


def looping(s: str) -> bool:
    """True if the tail of s is the same chunk repeated back-to-back (a degenerate loop)."""
    n = len(s)
    for p in range(6, 301):
        reps = 8 if p < 24 else 4 if p < 100 else 3
        unit = s[-p:]
        if len(set(unit)) <= 3:  # low-entropy units ("0000", "----") need many more repeats
            reps = max(reps, 220 // p + 1)
        need = p * reps
        if n >= need and s[-need:] == unit * reps:
            return True
    return False