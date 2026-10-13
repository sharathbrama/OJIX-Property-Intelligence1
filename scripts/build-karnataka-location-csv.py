#!/usr/bin/env python3
"""Build the dropdown CSV from the statewide KGIS boundary snapshot.

Requires pyarrow (`python3 -m pip install pyarrow`). Geometry is deliberately
not loaded or written: the application only needs administrative codes/names.
"""

from __future__ import annotations

import argparse
import csv
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import pyarrow.parquet as parquet


SOURCE_ROOT = "https://data.source.coop/krishnaglodha/ksrsac-gis"
SOURCE_NAME = "Karnataka Geographic Information System (KSRSAC), Source Cooperative mirror"
SOURCE_DATE = "2024-09-01"
DISTRICT_FILES = [
    "01_Belagavi.parquet", "02_Bagalkote.parquet", "03_Vijayapura.parquet",
    "04_Kalaburgi .parquet", "05_Bidar.parquet", "06_Raichur.parquet",
    "07_Koppal.parquet", "08_Gadag.parquet", "09_Dharwad.parquet",
    "10_Uttara Kannada.parquet", "11_Haveri.parquet", "12_Ballari.parquet",
    "13_Chitradurga.parquet", "14_Davanagere.parquet", "15_Shivamogga.parquet",
    "16_Udupi.parquet", "17_Chikkamagaluru.parquet", "18_Tumakuru.parquet",
    "19_Kolara.parquet", "20_Bengaluru _Urban.parquet", "21_Bengaluru _Rural.parquet",
    "22_Mandya.parquet", "23_Hassan.parquet", "24_Dakshina Kannada.parquet",
    "25_Kodagu.parquet", "26_Mysuru.parquet", "27_Chamarajanagara.parquet",
    "28_Chikkaballapura.parquet", "29_Ramanagara.parquet", "30_Yadgir.parquet",
    "31_Vijayanagara.parquet",
]


def download(relative_path: str, destination: Path) -> None:
    url = f"{SOURCE_ROOT}/{urllib.parse.quote(relative_path, safe='/')}"
    print(f"Downloading {relative_path} ...", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "OJIX-location-import/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def rows(path: Path, columns: list[str]) -> list[dict]:
    return parquet.read_table(path, columns=columns).to_pylist()


def text(value: object) -> str:
    return "" if value is None else str(value).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?", default="database/karnataka-locations.csv")
    arguments = parser.parse_args()
    output_path = Path(arguments.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="ojix-karnataka-") as temporary:
        root = Path(temporary)
        district_path = root / "District.parquet"
        taluk_path = root / "Taluk.parquet"
        download("main/District.parquet", district_path)
        download("main/Taluk.parquet", taluk_path)

        districts = {
            text(row["KGISDistri"]): (text(row["KGISDist_1"]), text(row["LGD_Distri"]))
            for row in rows(district_path, ["KGISDistri", "KGISDist_1", "LGD_Distri"])
        }
        taluks = {
            text(row["KGISTalukC"]): (text(row["KGISTalukN"]), text(row["KGISDistri"]), text(row["LGD_TalukC"]))
            for row in rows(taluk_path, ["KGISTalukC", "KGISTalukN", "KGISDistri", "LGD_TalukC"])
        }

        hierarchy: dict[tuple[str, str, str, str], tuple[str, str, str, str]] = {}
        for filename in DISTRICT_FILES:
            hobli_path = root / f"hobli-{filename}"
            village_path = root / f"village-{filename}"
            download(f"hobli/{filename}", hobli_path)
            download(f"village/{filename}", village_path)
            hoblis = {
                text(row["KGISHobliI"]): (
                    text(row["KGISHobliC"]), text(row["KGISHobliN"]), text(row["KGISTalukC"])
                )
                for row in rows(hobli_path, ["KGISHobliI", "KGISHobliC", "KGISHobliN", "KGISTalukC"])
            }
            for village in rows(village_path, ["KGISVill_1", "KGISVill_2", "KGISHobliI"]):
                village_code = text(village["KGISVill_1"])
                village_name = text(village["KGISVill_2"])
                hobli = hoblis.get(text(village["KGISHobliI"]))
                if not village_code or not village_name or not hobli:
                    continue
                hobli_code, hobli_name, taluk_code = hobli
                taluk = taluks.get(taluk_code)
                if not taluk:
                    continue
                taluk_name, district_code, _lgd_taluk_code = taluk
                district = districts.get(district_code)
                if not district:
                    continue
                district_name, _lgd_district_code = district
                key = (district_code, taluk_code, hobli_code, village_code)
                hierarchy[key] = (district_name, taluk_name, hobli_name, village_name)

        headers = [
            "district_code", "district_name", "taluk_code", "taluk_name",
            "hobli_code", "hobli_name", "village_code", "village_name",
            "source_name", "source_date", "completeness", "notes",
        ]
        with output_path.open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            for codes in sorted(hierarchy):
                names = hierarchy[codes]
                writer.writerow({
                    "district_code": codes[0], "district_name": names[0],
                    "taluk_code": codes[1], "taluk_name": names[1],
                    "hobli_code": codes[2], "hobli_name": names[2],
                    "village_code": codes[3], "village_name": names[3],
                    "source_name": SOURCE_NAME, "source_date": SOURCE_DATE,
                    "completeness": "statewide",
                    "notes": "31-district KGIS boundary snapshot; geometry omitted; hierarchy joined by KGIS codes.",
                })

    print(f"Wrote {len(hierarchy):,} villages to {output_path}")


if __name__ == "__main__":
    main()
