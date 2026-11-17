"""Erzeugt die App-Icons (PNG) ohne Zusatzbibliotheken.

Motiv: drei Zeilen eines Satzes, der letzte Baustein farbig – das Verb am Ende.
Aufruf: python tools/make_icons.py
"""
import pathlib
import struct
import zlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"
BG, BAR, ACCENT = (13, 13, 13), (88, 88, 84), (57, 135, 229)


def png(size):
    px = [[BG] * size for _ in range(size)]

    def rect(x0, y0, x1, y1, color):
        for y in range(int(y0 * size), int(y1 * size)):
            for x in range(int(x0 * size), int(x1 * size)):
                px[y][x] = color

    # innerhalb der sicheren Zone für maskierbare Icons (mittlere 60 %)
    rect(0.24, 0.30, 0.76, 0.38, BAR)
    rect(0.24, 0.46, 0.66, 0.54, BAR)
    rect(0.24, 0.62, 0.50, 0.70, BAR)
    rect(0.54, 0.62, 0.76, 0.70, ACCENT)

    raw = b"".join(b"\x00" + bytes(c for p in row for c in p) for row in px)

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


OUT.mkdir(exist_ok=True)
for s in (192, 512):
    (OUT / f"icon-{s}.png").write_bytes(png(s))
    print(f"icons/icon-{s}.png")
