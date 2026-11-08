#!/usr/bin/env python3
"""
Build the bundled sample catalog of real product photos.

Source: "Fashion Product Images" (Kaggle, MIT licence) via the high-res Hugging Face mirror
PestoRosso/lamoda-fashion-product-images (MIT). DuckDB reads the dataset's Parquet files over
HTTP with range requests: first only the small tag columns (to choose pieces), then only the
image bytes of the chosen rows — no 12 GB download, no API key.

    pip install duckdb pillow
    python3 scripts/fetch_samples.py

Inputs:  scripts/sample-spec.json   (which pieces we want, with our own tags)
Outputs: public/samples/<key>.webp  (600x800, white background)
         src/lib/sampleCatalog.json (tags + source attribution for each photo)
"""
import io
import json
import os
import sys
import time

import duckdb
from PIL import Image, ImageChops

DATASET = "PestoRosso/lamoda-fashion-product-images"
BASE = f"https://huggingface.co/datasets/{DATASET}/resolve/refs%2Fconvert%2Fparquet/default/train"
N_FILES = 45
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = json.load(open(os.path.join(ROOT, "scripts/sample-spec.json")))
OUT_IMG = os.path.join(ROOT, "public/samples")
OUT_JSON = os.path.join(ROOT, "src/lib/sampleCatalog.json")
GENDERS = {"m": ["Men"], "w": ["Women"], "u": ["Men", "Women", "Unisex"]}  # adult sizes only
CATEGORY = {
    "top": ["t-shirt", "long-sleeve", "shirt", "blouse", "polo", "tank", "sweater", "hoodie", "sweatshirt", "cardigan"],
    "bottom": ["jeans", "trousers", "chinos", "shorts", "skirt", "joggers", "leggings"],
    "onepiece": ["dress", "jumpsuit"],
    "outerwear": ["jacket", "denim-jacket", "leather-jacket", "blazer", "coat", "trench", "puffer", "raincoat"],
    "shoes": ["sneakers", "boots", "loafers", "dress-shoes", "heels", "flats", "sandals"],
    "bag": ["tote", "crossbody", "backpack", "clutch"],
    "accessory": ["hat", "cap", "scarf", "belt", "sunglasses", "jewelry", "watch"],
}


def category_of(sub):
    return next(c for c, subs in CATEGORY.items() if sub in subs)


def display_name(sub, color):
    c = {"light-blue": "light blue", "metallic": "silver"}.get(color, color)
    s = "T-shirt" if sub == "t-shirt" else sub.replace("-", " ")
    t = f"{c} {s}"
    return t[0].upper() + t[1:]


def tidy(raw: bytes) -> Image.Image:
    """Trim white margins, centre on a 600x800 white canvas."""
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg).convert("L").point(lambda p: 255 if p > 14 else 0)
    box = diff.getbbox()
    if box:
        im = im.crop(box)
    im.thumbnail((540, 740), Image.LANCZOS)
    canvas = Image.new("RGB", (600, 800), (255, 255, 255))
    canvas.paste(im, ((600 - im.width) // 2, (800 - im.height) // 2))
    return canvas


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs;")
    files = [f"{BASE}/{i:04d}.parquet" for i in range(N_FILES)]
    file_list = ", ".join(f"'{f}'" for f in files)

    t = time.time()
    meta = con.sql(
        f"""SELECT id, gender, article_type, base_color, product_display_name AS title, width, filename
            FROM read_parquet([{file_list}], filename = true)"""
    ).fetchall()
    print(f"read tags for {len(meta)} products in {time.time() - t:.0f}s", flush=True)

    used = set()
    picks = []
    for s in SPEC:
        genders = GENDERS[s["gender"]]
        pool = [
            r for r in meta
            if r[2] == s["article"] and r[3] in s["colors"] and r[1] in genders and (r[5] or 0) >= 600 and r[0] not in used
        ]
        excl = [w.lower() for w in s.get("exclude", [])]
        if excl:
            pool = [r for r in pool if not any(w in (r[4] or "").lower() for w in excl)]
        if s.get("nameLike"):
            needle = s["nameLike"].strip("%").lower()
            named = [r for r in pool if needle in (r[4] or "").lower()]
            pool = named or pool
        # Prefer the requested colour order (first listed = best).
        pool.sort(key=lambda r: (s["colors"].index(r[3]), r[0]))
        if not pool:
            print(f"✗ {s['key']}: no match", flush=True)
            continue
        used.add(pool[0][0])
        picks.append((s, pool[0]))

    # Fetch image bytes, grouped by file so each Parquet file is opened once.
    by_file = {}
    for s, r in picks:
        by_file.setdefault(r[6], []).append((s, r))
    catalog = {}
    for f, group in by_file.items():
        ids = ", ".join(str(r[0]) for _, r in group)
        # The mirror stores the image column as a plain BLOB of JPEG bytes.
        rows = dict(con.sql(f"SELECT id, image FROM read_parquet('{f}') WHERE id IN ({ids})").fetchall())
        for s, r in group:
            raw = rows.get(r[0])
            if not raw:
                print(f"✗ {s['key']}: image missing", flush=True)
                continue
            tidy(raw).save(os.path.join(OUT_IMG, f"{s['key']}.webp"), "WEBP", quality=76, method=6)
            catalog[s["key"]] = {
                "key": s["key"],
                "src": f"/samples/{s['key']}.webp",
                "name": display_name(s["sub"], s["color"]),
                "category": category_of(s["sub"]),
                "subcategory": s["sub"],
                "colors": [s["color"]],
                "pattern": s["pattern"],
                "formality": s["formality"],
                "warmth": s["warmth"],
                "seasons": s["seasons"],
                "styles": s["styles"],
                "gender": s["gender"],
                "source": {"dataset": DATASET, "id": r[0], "title": r[4]},
            }
            print(f"✓ {s['key']} ← {r[4]}", flush=True)

    ordered = [catalog[s["key"]] for s in SPEC if s["key"] in catalog]
    with open(OUT_JSON, "w") as fh:
        json.dump(ordered, fh, indent=1)
        fh.write("\n")
    print(f"\n{len(ordered)}/{len(SPEC)} samples written in {time.time() - t:.0f}s")
    return 0 if ordered else 1


if __name__ == "__main__":
    sys.exit(main())
