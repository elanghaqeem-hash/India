#!/usr/bin/env python3
"""Generate batched D1 SQL from a pinned, public Indonesian postal reference dataset.
No customer data leaves INDIA. The generated files are NOT automatically applied.
"""
import argparse
import csv
import io
import json
from pathlib import Path
from urllib.request import urlopen

DATA_SHA = "33d362f827030606ab15a4f29a42c22c2eba3c7b"
SOURCE_URL = f"https://raw.githubusercontent.com/mrayhanfadil/kodepos-id/{DATA_SHA}/kodepos_parsed.csv"
COLUMNS = ("region_code", "postal_code", "province_code", "province_name", "regency_code",
           "regency_name", "district_code", "district_name", "village_name",
           "village_kind", "source_version")
ROWS_PER_FILE = 1000
ROWS_PER_STATEMENT = 40


def sql_value(text):
    return "'" + str(text).replace("'", "''") + "'"


def map_row(r):
    code = r["kode_wilayah"].strip()
    postal = r["kode_pos"].strip()
    province = r["prov_code"].strip()
    regency = province + "." + r["kab_code"].strip()
    district = regency + "." + r["kec_code"].strip()
    if not (len(postal) == 5 and postal.isascii() and postal.isdigit()):
        return None
    if not (len(province) == 2 and len(regency) == 5 and len(district) == 8):
        return None
    if not code or not r["desa"].strip():
        return None
    return (code, postal, province, r["provinsi"].strip(), regency,
            r["dt2"].strip() + " " + r["kabupaten"].strip(), district,
            r["kecamatan"].strip(), r["desa"].strip(),
            "Kelurahan" if r["is_kelurahan"].strip() == "1" else "Desa", DATA_SHA)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", help="Optional downloaded local CSV (otherwise pinned upstream)")
    parser.add_argument("--out", default="postal-import-uat", help="Output directory outside repository")
    args = parser.parse_args()
    data = Path(args.csv).read_text(encoding="utf-8-sig") if args.csv else urlopen(SOURCE_URL, timeout=90).read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(data)))
    parsed = [r for r in (map_row(raw) for raw in rows) if r]
    dedup = {r[0]: r for r in parsed}
    if len(dedup) < 80000:
        raise SystemExit(f"Source coverage too small ({len(dedup)}); refusing partial import.")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cols = ",".join(COLUMNS)
    entries = list(sorted(dedup.values()))
    for i in range(0, len(entries), ROWS_PER_FILE):
        block = entries[i:i + ROWS_PER_FILE]
        statements = ["-- Source commit: " + DATA_SHA]
        for k in range(0, len(block), ROWS_PER_STATEMENT):
            values = ",".join("(" + ",".join(sql_value(v) for v in record) + ")" for record in block[k:k+ROWS_PER_STATEMENT])
            statements.append(f"INSERT OR REPLACE INTO india_postal_areas({cols}) VALUES {values};")
        (out / f"{i//ROWS_PER_FILE + 1:03d}.sql").write_text("\n".join(statements) + "\n", encoding="utf-8")
    (out / "manifest.json").write_text(json.dumps({
        "source_url": SOURCE_URL, "source_version": DATA_SHA, "rows": len(entries),
        "files": (len(entries) + ROWS_PER_FILE - 1) // ROWS_PER_FILE,
        "expected_provinces": len({r[2] for r in entries}),
        "expected_postal_codes": len({r[1] for r in entries})
    }, indent=2), encoding="utf-8")
    print(f"Generated {len(entries)} postal reference rows in {out}/ (not applied to D1).")


if __name__ == "__main__":
    main()
