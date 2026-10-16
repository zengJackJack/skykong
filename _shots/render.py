"""Render mockup HTML -> 2x screenshot -> WebP in assets/img.

usage: python _shots/render.py <name.html> [width height]   (default 1600 1000)
"""
import os
import pathlib
import subprocess
import sys

from PIL import Image

here = pathlib.Path(__file__).resolve().parent
root = here.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def render(name, w=1600, h=1000):
    src = here / name
    tmp = here / ("_" + src.stem + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=2", f"--window-size={w},{h}",
                    "--virtual-time-budget=3000", f"--screenshot={tmp}", src.as_uri()],
                   check=True, capture_output=True)
    out = root / "assets" / "img" / (src.stem + ".webp")
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.open(tmp).convert("RGB").save(out, "WEBP", quality=88, method=6)
    tmp.unlink()
    print(out, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 3:
        render(a[0], int(a[1]), int(a[2]))
    else:
        render(a[0])
