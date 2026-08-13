#!/usr/bin/env python3
"""Render icon-192.png and icon-512.png from the same design as icon.svg.

Stdlib only (zlib + struct), so the icons are reproducible without installing
anything. Draws at 3x and box-downsamples for antialiasing.

    python3 tools/make-icons.py
"""

import struct
import zlib
from math import hypot

BG = (0x0C, 0x0E, 0x11)
DOT = (0x5B, 0x67, 0x73)
ACCENT = (0xFF, 0xB0, 0x20)

SS = 3  # supersample factor


def design(size):
    """Shapes in a 512-unit design space, scaled to `size`."""
    k = size / 512.0
    shapes = []
    for gx in range(128, 385, 64):
        for gy in range(128, 385, 64):
            shapes.append(("circle", gx * k, gy * k, 12 * k, DOT))
    shapes.append(("seg", 128 * k, 384 * k, 384 * k, 256 * k, 13 * k, ACCENT))
    shapes.append(("circle", 128 * k, 384 * k, 34 * k, ACCENT))
    shapes.append(("circle", 384 * k, 256 * k, 34 * k, BG))
    shapes.append(("ring", 384 * k, 256 * k, 34 * k, 6 * k, ACCENT))
    return shapes


def render(size):
    n = size * SS
    rows = [bytearray(BG * n) for _ in range(n)]

    def put(x, y, colour):
        if 0 <= x < n and 0 <= y < n:
            i = x * 3
            rows[y][i:i + 3] = bytes(colour)

    for shape in design(n):
        kind = shape[0]
        if kind == "circle":
            _, cx, cy, r, col = shape
            for y in range(max(0, int(cy - r) - 1), min(n, int(cy + r) + 2)):
                for x in range(max(0, int(cx - r) - 1), min(n, int(cx + r) + 2)):
                    if hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                        put(x, y, col)
        elif kind == "ring":
            _, cx, cy, r, w, col = shape
            outer = r + w / 2
            for y in range(max(0, int(cy - outer) - 1), min(n, int(cy + outer) + 2)):
                for x in range(max(0, int(cx - outer) - 1), min(n, int(cx + outer) + 2)):
                    d = hypot(x + 0.5 - cx, y + 0.5 - cy)
                    if r - w / 2 <= d <= outer:
                        put(x, y, col)
        elif kind == "seg":
            _, x1, y1, x2, y2, w, col = shape
            dx, dy = x2 - x1, y2 - y1
            ll = dx * dx + dy * dy
            lo_x, hi_x = int(min(x1, x2) - w) - 1, int(max(x1, x2) + w) + 2
            lo_y, hi_y = int(min(y1, y2) - w) - 1, int(max(y1, y2) + w) + 2
            for y in range(max(0, lo_y), min(n, hi_y)):
                for x in range(max(0, lo_x), min(n, hi_x)):
                    px, py = x + 0.5 - x1, y + 0.5 - y1
                    t = max(0.0, min(1.0, (px * dx + py * dy) / ll))
                    if hypot(px - t * dx, py - t * dy) <= w:
                        put(x, y, col)

    # Box downsample SS x SS -> one pixel.
    out = []
    f = SS * SS
    for y in range(size):
        row = bytearray()
        src = rows[y * SS:y * SS + SS]
        for x in range(size):
            r = g = b = 0
            for sy in src:
                i = x * SS * 3
                for s in range(SS):
                    r += sy[i]; g += sy[i + 1]; b += sy[i + 2]
                    i += 3
            row += bytes((r // f, g // f, b // f))
        out.append(row)
    return out


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    print("wrote", path, size, "x", size)


if __name__ == "__main__":
    for s in (192, 512):
        write_png("icon-%d.png" % s, s, render(s))
