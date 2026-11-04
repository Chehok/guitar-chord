"""Draw the six-string chord mark using only Python's standard library."""
from pathlib import Path
import math
import struct
import zlib

BACKGROUND = (36, 91, 71)
PAPER = (246, 244, 236)
LIME = (223, 234, 156)


def icon(size):
    scale = 3
    edge = size * scale
    pixels = bytearray(BACKGROUND * (edge * edge))

    def line(x1, y1, x2, y2, width, color):
        x1, y1, x2, y2, width = [v * edge for v in (x1, y1, x2, y2, width)]
        dx, dy = x2 - x1, y2 - y1
        for y in range(max(0, int(min(y1, y2) - width)), min(edge, math.ceil(max(y1, y2) + width))):
            for x in range(max(0, int(min(x1, x2) - width)), min(edge, math.ceil(max(x1, x2) + width))):
                t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) if dx or dy else 0
                if (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= (width / 2) ** 2:
                    pos = (y * edge + x) * 3
                    pixels[pos:pos + 3] = bytes(color)

    # Entire mark stays within the maskable central safe circle.
    left, right, top, bottom = .27, .73, .26, .74
    for i in range(4):
        y = top + (bottom - top) * i / 3
        line(left, y, right, y, .018 if i else .032, PAPER)
    for i in range(6):
        x = left + (right - left) * i / 5
        line(x, top, x, bottom, .009, PAPER)
    for string, fret in [(3, .5), (1, 1.5), (2, 1.5)]:
        x = left + (right - left) * string / 5
        y = top + (bottom - top) * fret / 3
        line(x, y, x, y, .066, LIME)

    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            for c in range(3):
                rows.append(round(sum(pixels[((y * scale + dy) * edge + x * scale + dx) * 3 + c]
                                      for dy in range(scale) for dx in range(scale)) / scale ** 2))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1] / 'icons'
    root.mkdir(exist_ok=True)
    for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
        (root / name).write_bytes(icon(size))
