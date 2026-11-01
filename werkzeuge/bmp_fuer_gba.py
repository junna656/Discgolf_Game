#!/usr/bin/env python3
"""Wandelt die gerenderten Bahnbilder (PNG) in 8-Bit-BMPs für Butano (palette_bitmap) um.

  python3 werkzeuge/bmp_fuer_gba.py <ordner mit bahn_NN.png> <zielordner>

- Farben auf 15 Bit (5 Bit je Kanal) wie der GBA, dann auf 255 Farben reduziert
- Index 0 bleibt frei (bei Butano durchsichtig), die Bildfarben liegen auf 1..255
"""
import json
import os
import sys

from PIL import Image


def umwandeln(quelle, ziel):
    bild = Image.open(quelle).convert("RGB").point(lambda v: (v >> 3) << 3)
    q = bild.quantize(255, dither=Image.Dither.NONE)
    palette = q.getpalette()[: 255 * 3]
    # Indizes um 1 verschieben: Index 0 = unbenutzt (schwarz)
    pixel = bytes(p + 1 for p in q.tobytes())
    neu = Image.frombytes("P", q.size, pixel)
    neu.putpalette([0, 0, 0] + palette + [0] * (768 - 3 - len(palette)))
    neu.save(ziel)


def main():
    quelle, ziel = sys.argv[1], sys.argv[2]
    os.makedirs(ziel, exist_ok=True)
    for name in sorted(os.listdir(quelle)):
        if not name.endswith(".png"):
            continue
        stamm = name[:-4]
        umwandeln(os.path.join(quelle, name), os.path.join(ziel, stamm + ".bmp"))
        with open(os.path.join(ziel, stamm + ".json"), "w") as f:
            json.dump({"type": "palette_bitmap"}, f)
            f.write("\n")


if __name__ == "__main__":
    main()
