#!/usr/bin/env python3
"""Extract user-supplied Dubai transaction-snapshot PDFs into a lossless packet.

The PDFs are observed sale evidence. Summary medians and year-over-year
figures are copied as printed. Monthly medians are computed only from the
printed sale rows, and only for the comparison described in the packet method.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path

RETRIEVAL_DATE = "2026-10-06"
PROVENANCE = "user-supplied"
OPEN_MONTH = "2026-10"
SPARSE_BELOW = 5
EXPORT_CEILING = 300
MIX_SHIFT_PP = 15.0

REQUIRED_UPLOADS = [
    "Jebel_Ali_fc28.pdf",
    "Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf",
    "Emaar_Beachfront__Dubai_Harbour_3ded.pdf",
    "Town_Square__Al_Yelayiss_2_2f80.pdf",
    "Sobha_Hartland__Al_Merkadh_829b.pdf",
    "The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf",
    "Damac_Hills__Al_Hebiah_Third_ed43.pdf",
    "Dubai_Hills_Estate_acbf.pdf",
    "Dubai_Marina__Marsa_Dubai_5a24.pdf",
    "Jumeirah_Village_Circle__JVC__b203.pdf",
    "Business_Bay_4e00.pdf",
    "Dubai_Creek_Harbour_638f.pdf",
    "Dubai_South_bda4.pdf",
    "Palm_Jebel_Ali_8316.pdf",
    "Downtown_Dubai_e760.pdf",
    "Tilal_Al_Ghaf__Al_Hebiah_Fourth_7989.pdf",
    "Nad_Al_Sheba_a706.pdf",
    "Downtown_Dubai_1287.pdf",
    "Rashid_Yachts_And_Marina__Mina_Rashid_30d8.pdf",
    "Dubai_Investment_Park_First_45ae.pdf",
    "Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_3fc2.pdf",
    "Jebel_Ali_c6d6.pdf",
    "Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_0b18.pdf",
    "Emaar_Beachfront__Dubai_Harbour_8662.pdf",
]

PRICE_LINE = re.compile(
    r"^(?P<location>.*?)\s+AED\s+(?P<price>[\d,]+)"
    r"(?:\s+\((?P<gain>[+-]?[\d,]+)%\))?"
    r"(?:\s+(?P<sqft>[\d,]+)\s*sqft)?"
    r"\s+(?P<date>\d{2}, [A-Z][a-z]{2} \d{4})\s*$"
)
STATUS_LINE = re.compile(
    r"^(?P<status>Ready|Offplan)\s+(?P<ptype>[A-Za-z]+)\s+No\.\s+"
    r"AED\s+(?P<psf>[\d,]+)\s*/sqft"
    r"(?:\s+(?P<beds>\d+\s+Beds?|Studio|Penthouse))?\s+"
    r"(?P<seller>Developer|Individual(?:\s+\(\d+\s+Times?\))?)\s*$"
)
SPECS_LINE = re.compile(
    r"^(?:(?P<sqft>[\d,]+)\s*sqft)?(?:\s*(?P<beds>\d+\s+Beds?|Studio))?\s*$"
)
MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

# Identity notes are exact-catalogue matches or explicit non-matches.
# They do not turn a community print into subject-project sales.
AREA_META = {
    "Jebel Ali": {
        "id": "jebel-ali",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:jebel-ali",
            "communityName": "Jebel Ali",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:downtown-jebel-ali", "communityName": "Downtown Jebel Ali", "reason": "Separate catalogue community. Some printed locations name Downtown Jebel Ali projects; the snapshot title is Jebel Ali, so the series stays the area print."},
            {"communityId": "community:Dubai:jebel-ali-village", "communityName": "Jebel Ali Village", "reason": "Separate catalogue community. Not the snapshot title."},
        ],
        "compositionContains": ["Downtown Jebel Ali"],
    },
    "Arancia Yards By Beyond (All Buildings), City of Arabia": {
        "id": "arancia-yards-by-beyond",
        "scope": "named_project_transactions",
        "catalogue": {
            "match": "exact_project_in_community",
            "communityId": "community:Dubai:city-of-arabia",
            "communityName": "City of Arabia",
            "emirate": "Dubai",
            "projectId": "project:arancia-yards-beyond-city-of-arabia-dubai",
            "projectName": "Arancia Yards",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": ["Arancia Yards By Beyond"],
        "scopeNote": "The title names one project, all buildings, and the printed rows are that project's buildings. City of Arabia is the parent community, not a community-wide transaction set.",
    },
    "Emaar Beachfront, Dubai Harbour": {
        "id": "emaar-beachfront",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:emaar-beachfront",
            "communityName": "Emaar Beachfront",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:dubai-harbour", "communityName": "Dubai Harbour", "reason": "Printed locality and a separate catalogue community. The snapshot title leads with Emaar Beachfront, so the series is not reassigned to every Dubai Harbour project."},
        ],
        "compositionContains": [],
    },
    "Town Square, Al Yelayiss 2": {
        "id": "town-square",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "obvious_normalized",
            "communityId": "community:Dubai:town-square-dubai",
            "communityName": "Town Square Dubai",
            "emirate": "Dubai",
            "normalization": "Snapshot title is Town Square. Catalogue name adds Dubai. Al Yelayiss 2 is the printed locality; catalogue Al Yalayis 1 is a different community and is not used.",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:al-yalayis-1", "communityName": "Al Yalayis 1", "reason": "Different locality number and a different catalogue community."},
        ],
        "compositionContains": [],
    },
    "Sobha Hartland, Al Merkadh": {
        "id": "sobha-hartland",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:sobha-hartland",
            "communityName": "Sobha Hartland",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:sobha-hartland-ii", "communityName": "Sobha Hartland II", "reason": "Separate catalogue community. The snapshot does not say Hartland II."},
        ],
        "compositionContains": [],
        "scopeNote": "Al Merkadh is the printed locality. It is not a separate catalogue community in the community-count file.",
    },
    "The Oasis (All Phases), Me'Aisem Second": {
        "id": "the-oasis",
        "scope": "named_development_transactions",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:the-oasis",
            "communityName": "The Oasis",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": ["The Oasis"],
        "scopeNote": "The title names The Oasis, all phases, in Me'Aisem Second. Me'Aisem Second is not a catalogue community. Rows are Oasis clusters, so this is that development's printed sales, not a locality-wide set.",
    },
    "Damac Hills, Al Hebiah Third": {
        "id": "damac-hills",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "obvious_normalized",
            "communityId": "community:Dubai:damac-hills",
            "communityName": "DAMAC Hills",
            "emirate": "Dubai",
            "normalization": "Snapshot spells Damac Hills. Catalogue name is DAMAC Hills. Al Hebiah Third is the printed locality.",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:damac-hills-2", "communityName": "DAMAC Hills 2", "reason": "Separate catalogue community. The snapshot does not say Hills 2."},
            {"communityId": "community:Dubai:tilal-al-ghaf", "communityName": "Tilal Al Ghaf", "reason": "Shares the Al Hebiah locality family (Fourth, not Third) and is a different snapshot."},
        ],
        "compositionContains": [],
    },
    "Dubai Hills Estate": {
        "id": "dubai-hills-estate",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:dubai-hills-estate",
            "communityName": "Dubai Hills Estate",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": [],
    },
    "Dubai Marina, Marsa Dubai": {
        "id": "dubai-marina",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:dubai-marina",
            "communityName": "Dubai Marina",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:marina", "communityName": "Marina", "reason": "Shorter catalogue name. The snapshot title is Dubai Marina. Marsa Dubai is the printed locality name, not a second series."},
        ],
        "compositionContains": [],
    },
    "Jumeirah Village Circle (JVC)": {
        "id": "jumeirah-village-circle",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:jumeirah-village-circle-jvc",
            "communityName": "Jumeirah Village Circle (JVC)",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:jumeirah-village-circle", "communityName": "Jumeirah Village Circle", "reason": "Second catalogue row with the parenthetical omitted. The print matches the row that includes (JVC). Not a second transaction series."},
            {"communityId": "community:Dubai:jvc", "communityName": "JVC", "reason": "Third catalogue row. Same place label, not a second series."},
        ],
        "compositionContains": [],
    },
    "Business Bay": {
        "id": "business-bay",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:business-bay",
            "communityName": "Business Bay",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": [],
    },
    "Dubai Creek Harbour": {
        "id": "dubai-creek-harbour",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:dubai-creek-harbour",
            "communityName": "Dubai Creek Harbour",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": [],
    },
    "Dubai South": {
        "id": "dubai-south",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:dubai-south",
            "communityName": "Dubai South",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:emaar-south", "communityName": "Emaar South", "reason": "Separate catalogue community inside the wider south district."},
            {"communityId": "community:dubai-south-residential-district", "communityName": "Dubai South Residential District", "reason": "Separate catalogue row. The snapshot title is Dubai South."},
        ],
        "compositionContains": [],
    },
    "Palm Jebel Ali": {
        "id": "palm-jebel-ali",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:palm-jebel-ali",
            "communityName": "Palm Jebel Ali",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:jebel-ali", "communityName": "Jebel Ali", "reason": "Different snapshot and a different catalogue community."},
        ],
        "compositionContains": [],
    },
    "Downtown Dubai": {
        "id": "downtown-dubai",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:downtown-dubai",
            "communityName": "Downtown Dubai",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [],
        "compositionContains": [],
    },
    "Tilal Al Ghaf, Al Hebiah Fourth": {
        "id": "tilal-al-ghaf",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:tilal-al-ghaf",
            "communityName": "Tilal Al Ghaf",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:damac-hills", "communityName": "DAMAC Hills", "reason": "Al Hebiah Third is a different snapshot. Not combined with Al Hebiah Fourth."},
        ],
        "compositionContains": [],
    },
    "Nad Al Sheba": {
        "id": "nad-al-sheba",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:nad-al-sheba",
            "communityName": "Nad Al Sheba",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:nad-al-sheba-gardens", "communityName": "Nad Al Sheba Gardens", "reason": "Separate catalogue community. The snapshot title does not say Gardens."},
        ],
        "compositionContains": ["Vision Iconic"],
        "scopeNote": "The area card is Nad Al Sheba. The printed rows in this file all name Vision Iconic. That is the composition of a four-row extract, not a reason to relabel the card as a project-wide history for other Nad Al Sheba projects.",
    },
    "Rashid Yachts And Marina, Mina Rashid": {
        "id": "rashid-yachts-and-marina",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "obvious_normalized",
            "communityId": "community:Dubai:rashid-yachts-and-marina",
            "communityName": "Rashid Yachts & Marina",
            "emirate": "Dubai",
            "normalization": "Snapshot spells And. Catalogue uses an ampersand.",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:mina-rashid", "communityName": "Mina Rashid", "reason": "Printed locality and a separate catalogue community. The series keeps the snapshot's leading name."},
        ],
        "compositionContains": [],
    },
    "Dubai Investment Park First": {
        "id": "dubai-investment-park-first",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "none",
            "communityId": None,
            "communityName": None,
            "emirate": "Dubai",
            "normalization": "No catalogue community is named Dubai Investment Park First. Dubai Investment Park 2 and Dubai Investments Park are different names and are not used.",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:dubai-investment-park-2", "communityName": "Dubai Investment Park 2", "reason": "Different park number."},
            {"communityId": "community:Dubai:dubai-investments-park", "communityName": "Dubai Investments Park", "reason": "Different catalogue name. Not substituted for First."},
        ],
        "compositionContains": [],
    },
    "Dubai Land Residence Complex, Wadi Al Safa 5": {
        "id": "dubai-land-residence-complex",
        "scope": "area_community_transaction_context",
        "catalogue": {
            "match": "exact",
            "communityId": "community:Dubai:dubai-land-residence-complex",
            "communityName": "Dubai Land Residence Complex",
            "emirate": "Dubai",
        },
        "notUsedAsThisSeries": [
            {"communityId": "community:Dubai:dubai-land-residence-complex-dlrc", "communityName": "Dubai Land Residence Complex (DLRC)", "reason": "Second catalogue row. The snapshot title has no (DLRC) marker, so the series is not attached to both rows."},
            {"communityId": "community:Dubai:wadi-al-safa", "communityName": "Wadi Al Safa", "reason": "Broader catalogue community. Wadi Al Safa 5 is the printed locality, not a licence to use the whole Wadi Al Safa series."},
        ],
        "compositionContains": [],
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pdf_text(path: Path) -> str:
    return subprocess.check_output(["pdftotext", "-layout", str(path), "-"], text=True)


def pdf_info(path: Path) -> dict:
    raw = subprocess.check_output(["pdfinfo", str(path)], text=True, stderr=subprocess.DEVNULL)
    info = {}
    for line in raw.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            info[key.strip()] = value.strip()
    pages = int(info.get("Pages", "0"))
    return {"pages": pages, "creationDate": info.get("CreationDate"), "modDate": info.get("ModDate"), "producer": info.get("Producer"), "title": info.get("Title")}


def parse_printed_date(value: str) -> str:
    day, mon, year = value.replace(",", "").split()
    return f"{int(year):04d}-{MONTHS[mon]:02d}-{int(day):02d}"


def parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    return int(value.replace(",", ""))


def parse_percent_token(token: str) -> int | None:
    if token == "%":
        return None
    return int(token.replace("%", ""))


def parse_summary(text: str) -> dict:
    match = re.search(r"Sales Performance Summary(.*?)Property Sales History", text, re.S)
    if not match:
        raise ValueError("Sales Performance Summary block missing")
    lines = [line.strip() for line in match.group(1).splitlines() if line.strip()]
    level_line = yoy_line = None
    for index, line in enumerate(lines):
        if "YoY" in line:
            yoy_line = line
            for previous in reversed(lines[:index]):
                if re.search(r"\d", previous):
                    level_line = previous
                    break
            break
    if not level_line or not yoy_line:
        raise ValueError(f"summary lines missing: {lines!r}")
    levels = re.search(r"([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\d+%|%)\s*$", level_line)
    yoys = re.search(r"(-?\d+%|%)\s*YoY\s+(-?\d+%|%)\s*YoY\s+(-?\d+%|%)\s*YoY", yoy_line)
    if not levels or not yoys:
        raise ValueError(f"summary parse failed: {level_line!r} / {yoy_line!r}")
    return {
        "medianPricePerSqftAed": parse_int(levels.group(1)),
        "medianPricePerSqftYoyPct": parse_percent_token(yoys.group(1)),
        "medianPriceAed": parse_int(levels.group(2)),
        "medianPriceYoyPct": parse_percent_token(yoys.group(2)),
        "transactions": parse_int(levels.group(3)),
        "transactionsYoyPct": parse_percent_token(yoys.group(3)),
        "rentalYieldPct": parse_percent_token(levels.group(4)),
        "rentalYieldYoyPct": None,
        "levelLine": level_line,
        "yoyLine": yoy_line,
    }


def beds_fields(label: str | None) -> tuple[str | None, int | None]:
    if not label:
        return None, None
    if label == "Studio":
        return "Studio", 0
    if label == "Penthouse":
        return "Penthouse", None
    count = int(label.split()[0])
    return label, count


def parse_rows(text: str) -> list[dict]:
    body = text.replace("\f", "\n")
    marker = body.find("Property Sales History")
    if marker < 0:
        raise ValueError("Property Sales History missing")
    lines = [line.rstrip() for line in body[marker:].splitlines()]
    date_indexes = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        if PRICE_LINE.match(stripped):
            date_indexes.append(index)
    if not date_indexes:
        raise ValueError("no sale rows")
    dated_tokens = re.findall(r"\d{2}, [A-Z][a-z]{2} \d{4}", body[marker:])
    if len(dated_tokens) != len(date_indexes):
        raise ValueError(f"date tokens {len(dated_tokens)} != price lines {len(date_indexes)}")
    rows = []
    for position, start in enumerate(date_indexes):
        end = date_indexes[position + 1] if position + 1 < len(date_indexes) else len(lines)
        block = []
        for line in lines[start:end]:
            stripped = re.sub(r"\s+Details\s*$", "", line.strip()).strip()
            if stripped and stripped != "Details":
                block.append(stripped)
        price = PRICE_LINE.match(block[0])
        if not price:
            raise ValueError(f"price line failed: {block[0]!r}")
        status_lines = [item for item in block[1:] if item.startswith("Ready") or item.startswith("Offplan")]
        if len(status_lines) != 1:
            raise ValueError(f"expected one status line in {block!r}")
        status = STATUS_LINE.match(status_lines[0])
        if not status:
            raise ValueError(f"status line failed: {status_lines[0]!r}")
        spec_sqft = None
        for item in block[1:]:
            if item == status_lines[0]:
                continue
            spec = SPECS_LINE.match(item)
            if spec and spec.group("sqft"):
                spec_sqft = parse_int(spec.group("sqft"))
        price_sqft = parse_int(price.group("sqft"))
        sqft = price_sqft if price_sqft is not None else spec_sqft
        sqft_conflict = price_sqft is not None and spec_sqft is not None and price_sqft != spec_sqft
        beds_label, beds_count = beds_fields(status.group("beds"))
        gain = price.group("gain")
        rows.append({
            "row": position + 1,
            "location": price.group("location").strip(),
            "locationTruncated": price.group("location").rstrip().endswith("…") or price.group("location").rstrip().endswith("..."),
            "priceAed": parse_int(price.group("price")),
            "printedCapitalGainPct": parse_int(gain) if gain is not None else None,
            "date": parse_printed_date(price.group("date")),
            "datePrinted": price.group("date"),
            "sqft": sqft,
            "sqftConflict": sqft_conflict,
            "sqftOnPriceLine": price_sqft,
            "sqftOnSpecsLine": spec_sqft,
            "status": status.group("status"),
            "propertyType": status.group("ptype"),
            "statusBadge": "No.",
            "pricePerSqftAed": parse_int(status.group("psf")),
            "bedsLabel": beds_label,
            "bedsCount": beds_count,
            "seller": status.group("seller"),
        })
    return rows


def median(values: list[float]) -> float | None:
    numbers = sorted(value for value in values if value is not None)
    if not numbers:
        return None
    mid = len(numbers) // 2
    if len(numbers) % 2:
        return numbers[mid]
    return (numbers[mid - 1] + numbers[mid]) / 2


def pct_change(start: float | None, end: float | None) -> float | None:
    if start in (None, 0) or end is None:
        return None
    return (end - start) / start * 100


def direction_of(change: float | None, flat_within: float = 0.0) -> str | None:
    if change is None:
        return None
    if abs(change) <= flat_within:
        return "flat"
    if change > 0:
        return "rose"
    if change < 0:
        return "fell"
    return "flat"


def opposite_directions(left: str | None, right: str | None) -> bool:
    return {left, right} == {"rose", "fell"}


def month_span(start: str, end: str) -> list[str]:
    year, month = map(int, start.split("-"))
    end_year, end_month = map(int, end.split("-"))
    output = []
    while (year, month) <= (end_year, end_month):
        output.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            month = 1
            year += 1
    return output


def count_map(rows: list[dict], key: str) -> dict:
    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        label = row.get(key)
        counts[str(label) if label is not None else "not printed"] += 1
    return dict(sorted(counts.items()))


def segment_stats(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    return {
        "printedSales": len(rows),
        "medianPricePerSqftAed": median([row["pricePerSqftAed"] for row in rows]),
        "medianPriceAed": median([row["priceAed"] for row in rows]),
        "pricePerSqftObservations": sum(row["pricePerSqftAed"] is not None for row in rows),
    }


def series_trend(periods: list[dict], segment: str) -> dict | None:
    points = []
    skipped = []
    for period in periods:
        stats = None if not period["comparable"] else period["segments"].get(segment)
        if not period["comparable"] or not stats or stats["printedSales"] < SPARSE_BELOW:
            if period["comparable"]:
                skipped.append({"period": period["period"], "printedSales": 0 if not stats else stats["printedSales"], "reason": "segment sparse or absent"})
            continue
        points.append({
            "period": period["period"],
            "printedSales": stats["printedSales"],
            "medianPricePerSqftAed": stats["medianPricePerSqftAed"],
            "medianPriceAed": stats["medianPriceAed"],
        })
    if len(points) < 2:
        return None
    gaps = [month for month in month_span(points[0]["period"], points[-1]["period"]) if month not in {point["period"] for point in points}]
    change = pct_change(points[0]["medianPricePerSqftAed"], points[-1]["medianPricePerSqftAed"])
    price_change = pct_change(points[0]["medianPriceAed"], points[-1]["medianPriceAed"])
    steps = []
    for left, right in zip(points, points[1:]):
        step = pct_change(left["medianPricePerSqftAed"], right["medianPricePerSqftAed"])
        steps.append({"from": left["period"], "to": right["period"], "medianPricePerSqftChangePct": step})
    signs = {direction_of(step["medianPricePerSqftChangePct"], 0.5) for step in steps}
    signs.discard("flat")
    signs.discard(None)
    latest_four = None
    if len(points) >= 4:
        window = points[-4:]
        four_change = pct_change(window[0]["medianPricePerSqftAed"], window[-1]["medianPricePerSqftAed"])
        latest_four = {
            "from": window[0]["period"],
            "to": window[-1]["period"],
            "points": window,
            "medianPricePerSqftChangePct": four_change,
            "medianPriceChangePct": pct_change(window[0]["medianPriceAed"], window[-1]["medianPriceAed"]),
            "direction": direction_of(four_change, 0.5),
        }
    return {
        "segment": segment,
        "comparablePeriods": len(points),
        "skippedInsideComparableMonths": skipped,
        "gapsBetweenEndpoints": gaps,
        "earliest": points[0],
        "latest": points[-1],
        "medianPricePerSqftChangePct": change,
        "medianPriceChangePct": price_change,
        "direction": direction_of(change, 0.5),
        "priceDirection": direction_of(price_change, 0.5),
        "pathReversed": len(signs) > 1,
        "steps": steps,
        "latestFourComparablePeriods": latest_four,
    }


def dominant_segment(rows: list[dict]) -> dict:
    total = len(rows) or 1
    by_type = count_map(rows, "propertyType")
    by_status = count_map(rows, "status")
    type_name, type_count = max(by_type.items(), key=lambda item: item[1])
    status_name, status_count = max(by_status.items(), key=lambda item: item[1])
    cross_key = f"{status_name} {type_name}"
    cross_count = sum(1 for row in rows if row["status"] == status_name and row["propertyType"] == type_name)
    return {
        "cross": {"name": cross_key, "share": cross_count / total},
        "propertyType": {"name": type_name, "share": type_count / total},
        "status": {"name": status_name, "share": status_count / total},
    }


def segment_is_type_blend(name: str) -> bool:
    return name in {"Ready", "Offplan", "all printed rows"}


def blend_mix_shift(periods: list[dict], segment_name: str) -> bool:
    if not segment_is_type_blend(segment_name):
        return False
    points = []
    for period in periods:
        if not period["comparable"]:
            continue
        stats = period["segments"].get(segment_name)
        if not stats or stats["printedSales"] < SPARSE_BELOW:
            continue
        counts = period["byPropertyType"] if segment_name == "all printed rows" else period["typeWithinStatus"].get(segment_name, {})
        total = sum(counts.values()) or 1
        if not counts:
            continue
        lead = max(counts, key=counts.get)
        points.append((lead, counts[lead] / total, counts))
    if len(points) < 2:
        return False
    lead = points[0][0]
    end_counts = points[-1][2]
    end_total = sum(end_counts.values()) or 1
    return abs(points[0][1] - end_counts.get(lead, 0) / end_total) * 100 > MIX_SHIFT_PP


def mix_shift(periods: list[dict], type_name: str) -> bool:
    comparable = [period for period in periods if period["comparable"]]
    if len(comparable) < 2:
        return False
    def share(period: dict) -> float:
        total = period["printedSales"] or 1
        return period["byPropertyType"].get(type_name, 0) / total
    return abs(share(comparable[0]) - share(comparable[-1])) * 100 > MIX_SHIFT_PP


def analyse_area(meta: dict, extracts: list[dict]) -> dict:
    primary = extracts[0]
    rows = primary["rows"]
    summary = primary["summary"]
    capped = len(rows) == EXPORT_CEILING and summary["transactions"] > len(rows)
    complete_population = summary["transactions"] == len(rows)
    dates = [row["date"] for row in rows]
    order_breaks = sum(1 for left, right in zip(dates, dates[1:]) if right > left)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["date"][:7]].append(row)
    observed = sorted(grouped)
    missing = [month for month in month_span(observed[0], observed[-1]) if month not in grouped] if observed else []
    periods = []
    for month in observed:
        month_rows = grouped[month]
        flags = []
        if len(month_rows) < SPARSE_BELOW:
            flags.append("sparse")
        if capped and month == observed[0]:
            flags.append("export_truncated")
        if month == OPEN_MONTH:
            flags.append("open_retrieval_month")
        segments = {}
        for status in sorted({row["status"] for row in month_rows}):
            segments[status] = segment_stats([row for row in month_rows if row["status"] == status])
        for ptype in sorted({row["propertyType"] for row in month_rows}):
            segments[ptype] = segment_stats([row for row in month_rows if row["propertyType"] == ptype])
        for status in sorted({row["status"] for row in month_rows}):
            for ptype in sorted({row["propertyType"] for row in month_rows}):
                chosen = [row for row in month_rows if row["status"] == status and row["propertyType"] == ptype]
                if chosen:
                    segments[f"{status} {ptype}"] = segment_stats(chosen)
        segments["all printed rows"] = segment_stats(month_rows)
        type_within_status = {}
        for status_name in sorted({row["status"] for row in month_rows}):
            type_within_status[status_name] = count_map(
                [row for row in month_rows if row["status"] == status_name], "propertyType"
            )
        # A segment month is comparable only when the calendar month is comparable
        # and that segment itself has at least SPARSE_BELOW printed sales.
        comparable_month = not flags
        periods.append({
            "period": month,
            "printedSales": len(month_rows),
            "flags": flags,
            "comparable": comparable_month,
            "medianPricePerSqftAed": median([row["pricePerSqftAed"] for row in month_rows]),
            "medianPriceAed": median([row["priceAed"] for row in month_rows]),
            "byStatus": count_map(month_rows, "status"),
            "byPropertyType": count_map(month_rows, "propertyType"),
            "typeWithinStatus": type_within_status,
            "byBedsLabel": count_map(month_rows, "bedsLabel"),
            "capitalGainStated": sum(row["printedCapitalGainPct"] is not None for row in month_rows),
            "segments": segments,
        })
    composition_parts = dominant_segment(rows)
    type_counts = count_map(rows, "propertyType")
    dominant_type = max(type_counts, key=type_counts.get)
    all_trend = series_trend(periods, "all printed rows")
    if all_trend is not None:
        all_trend["mixShiftExceeds15pp"] = blend_mix_shift(periods, "all printed rows")
        all_trend["dominantPropertyType"] = dominant_type
    segment_trends = {}
    for name in sorted({key for period in periods for key in period["segments"]}):
        trend = series_trend(periods, name)
        if trend:
            segment_trends[name] = trend
    card_opposite = opposite_directions(
        direction_of(summary["medianPricePerSqftYoyPct"]),
        direction_of(summary["medianPriceYoyPct"]),
    )
    candidate_names = []
    for key, threshold in (("cross", 0.7), ("propertyType", 0.7), ("status", 0.7)):
        part = composition_parts[key]
        if part["share"] >= threshold:
            candidate_names.append(part["name"])
    if composition_parts["propertyType"]["share"] >= 0.6 and composition_parts["propertyType"]["name"] not in candidate_names:
        candidate_names.append(composition_parts["propertyType"]["name"])
    candidate_names.append("all printed rows")
    printed_trend = None
    segment_name = None
    segment_share = None
    for name in candidate_names:
        trend = segment_trends.get(name)
        if trend is None or blend_mix_shift(periods, name):
            continue
        printed_trend = trend
        segment_name = name
        if name == composition_parts["cross"]["name"]:
            segment_share = composition_parts["cross"]["share"]
        elif name == composition_parts["propertyType"]["name"]:
            segment_share = composition_parts["propertyType"]["share"]
        elif name == composition_parts["status"]["name"]:
            segment_share = composition_parts["status"]["share"]
        else:
            segment_share = 1.0
        break
    split_parts = []
    if segment_name in type_counts or (segment_name or "").startswith(("Ready ", "Offplan ")):
        type_for_split = segment_name.split()[-1] if " " in (segment_name or "") else segment_name
        ready_name = f"Ready {type_for_split}"
        offplan_name = f"Offplan {type_for_split}"
        ready_trend = segment_trends.get(ready_name)
        offplan_trend = segment_trends.get(offplan_name)
        if ready_trend and offplan_trend and opposite_directions(ready_trend["direction"], offplan_trend["direction"]):
            split_parts = [
                {"segment": ready_name, **{key: ready_trend[key] for key in ("direction", "medianPricePerSqftChangePct", "earliest", "latest", "comparablePeriods", "pathReversed", "latestFourComparablePeriods")}},
                {"segment": offplan_name, **{key: offplan_trend[key] for key in ("direction", "medianPricePerSqftChangePct", "earliest", "latest", "comparablePeriods", "pathReversed", "latestFourComparablePeriods")}},
            ]
    if split_parts:
        price_verdict = {
            "kind": "printed_monthly_split",
            "metric": f"median AED per sqft of printed {split_parts[0]['segment'].split()[-1].lower()}s, ready and off-plan kept apart",
            "direction": "split",
            "magnitudePct": None,
            "fromPeriod": split_parts[0]["earliest"]["period"],
            "toPeriod": split_parts[0]["latest"]["period"],
            "comparablePeriods": min(part["comparablePeriods"] for part in split_parts),
            "latestFour": None,
            "pathReversed": any(part["pathReversed"] for part in split_parts),
            "parts": [
                {
                    "segment": part["segment"],
                    "direction": part["direction"],
                    "magnitudePct": part["medianPricePerSqftChangePct"],
                    "fromPeriod": part["earliest"]["period"],
                    "toPeriod": part["latest"]["period"],
                    "comparablePeriods": part["comparablePeriods"],
                    "latestFour": part["latestFourComparablePeriods"],
                    "pathReversed": part["pathReversed"],
                    "earliestSales": part["earliest"]["printedSales"],
                    "latestSales": part["latest"]["printedSales"],
                }
                for part in split_parts
            ],
            "cardMetricsDisagree": card_opposite,
            "sample": "printed sale rows in comparable months; ready and off-plan medians move in opposite directions, so they are not averaged",
        }
    elif printed_trend is not None:
        price_verdict = {
            "kind": "printed_monthly",
            "metric": f"median AED per sqft of printed {segment_name}",
            "direction": printed_trend["direction"],
            "magnitudePct": printed_trend["medianPricePerSqftChangePct"],
            "ticketPriceDirection": printed_trend["priceDirection"],
            "ticketPriceMagnitudePct": printed_trend["medianPriceChangePct"],
            "fromPeriod": printed_trend["earliest"]["period"],
            "toPeriod": printed_trend["latest"]["period"],
            "comparablePeriods": printed_trend["comparablePeriods"],
            "latestFour": printed_trend["latestFourComparablePeriods"],
            "pathReversed": printed_trend["pathReversed"],
            "segmentShare": round(segment_share, 4),
            "cardMetricsDisagree": card_opposite,
            "endpointSales": {
                "earliest": printed_trend["earliest"]["printedSales"],
                "latest": printed_trend["latest"]["printedSales"],
            },
            "sample": "printed sale rows in comparable months; not the summary-card population unless the two counts are equal",
        }
    elif card_opposite:
        price_verdict = {
            "kind": "metrics_disagree",
            "metric": "snapshot median AED per sqft YoY versus snapshot median price YoY",
            "direction": "split",
            "magnitudePct": None,
            "psfYoyPct": summary["medianPricePerSqftYoyPct"],
            "priceYoyPct": summary["medianPriceYoyPct"],
            "fromPeriod": "year-ago level not printed",
            "toPeriod": RETRIEVAL_DATE,
            "comparablePeriods": 0,
            "latestFour": None,
            "pathReversed": None,
            "sample": f"summary card transactions {summary['transactions']}; base-period count not printed",
        }
    elif summary["medianPricePerSqftYoyPct"] is not None:
        price_verdict = {
            "kind": "stated_yoy_only",
            "metric": "snapshot median AED per sqft, stated year-over-year",
            "direction": direction_of(summary["medianPricePerSqftYoyPct"]),
            "magnitudePct": summary["medianPricePerSqftYoyPct"],
            "ticketPriceDirection": direction_of(summary["medianPriceYoyPct"]),
            "ticketPriceMagnitudePct": summary["medianPriceYoyPct"],
            "fromPeriod": "year-ago absolute level and window dates not printed",
            "toPeriod": f"summary card on the {RETRIEVAL_DATE} snapshot",
            "comparablePeriods": 1,
            "latestFour": None,
            "pathReversed": None,
            "sample": f"summary card transactions {summary['transactions']}; this is one stated comparison, not a monthly path",
        }
    else:
        price_verdict = {
            "kind": "insufficient",
            "metric": None,
            "direction": None,
            "magnitudePct": None,
            "fromPeriod": None,
            "toPeriod": None,
            "comparablePeriods": 0,
            "latestFour": None,
            "pathReversed": None,
            "sample": "no stated price change and fewer than two comparable printed months",
        }
    too_little = price_verdict["kind"] in {"insufficient", "metrics_disagree"} or (
        price_verdict["kind"] == "stated_yoy_only" and summary["transactions"] is not None and summary["transactions"] < 30
    )
    gains = [row["printedCapitalGainPct"] for row in rows if row["printedCapitalGainPct"] is not None]
    composition = {needle: sum(needle in row["location"] for row in rows) for needle in meta.get("compositionContains", [])}
    return {
        "id": meta["id"],
        "title": primary["title"],
        "scope": meta["scope"],
        "scopeNote": meta.get("scopeNote"),
        "catalogue": meta["catalogue"],
        "notUsedAsThisSeries": meta["notUsedAsThisSeries"],
        "sources": [
            {
                "sourceId": item["sourceId"],
                "sha256": item["sha256"],
                "filenames": item["filenames"],
                "rowCount": len(item["rows"]),
                "pdf": item["pdf"],
            }
            for item in extracts
        ],
        "duplicateSourceNote": primary.get("duplicateSourceNote"),
        "summary": {key: value for key, value in summary.items() if key not in {"levelLine", "yoyLine"}},
        "summaryLines": {"levelLine": summary["levelLine"], "yoyLine": summary["yoyLine"]},
        "printed": {
            "rowCount": len(rows),
            "firstDate": min(dates) if dates else None,
            "lastDate": max(dates) if dates else None,
            "newestFirstBreaks": order_breaks,
            "exportCeiling": EXPORT_CEILING if capped else None,
            "summaryCountExceedsPrint": summary["transactions"] > len(rows),
            "printedCountEqualsSummaryTransactions": complete_population,
            "distinctLocations": len({row["location"] for row in rows}),
            "truncatedLocations": sum(1 for row in rows if row["locationTruncated"]),
            "byStatus": count_map(rows, "status"),
            "byPropertyType": count_map(rows, "propertyType"),
            "byBedsLabel": count_map(rows, "bedsLabel"),
            "bySellerClass": {
                "Developer": sum(row["seller"] == "Developer" for row in rows),
                "Individual": sum(row["seller"] != "Developer" for row in rows),
            },
            "capitalGain": {
                "rowsWithPrintedPercent": len(gains),
                "rowsWithoutPrintedPercent": len(rows) - len(gains),
                "medianPrintedPercent": median(gains),
            },
            "statusBadge": "Every printed row carries an unlabelled No. badge beside status and type. It is not the capital-gain percent.",
            "compositionContains": composition,
            "allRowsMedianPricePerSqftAed": median([row["pricePerSqftAed"] for row in rows]),
            "allRowsMedianPriceAed": median([row["priceAed"] for row in rows]),
            "periods": periods,
            "monthsNotInExtract": missing,
            "dominantSegment": {
                "chosen": segment_name,
                "shareOfPrintedRows": None if segment_share is None else round(segment_share, 4),
                "candidates": composition_parts,
            },
            "segmentTrends": segment_trends,
            "allPrintedRowsTrend": all_trend,
        },
        "priceTrend": price_verdict,
        "tooLittleHistoryForAPriceTrend": too_little,
        "rent": {
            "rentalYieldPct": summary["rentalYieldPct"],
            "rentAed": None,
            "note": "No rent amount is printed. Rental yield is a single card level, with no year-over-year figure, so it is not a rent trend.",
        },
    }


def numeric_signature(extract: dict) -> str:
    payload = {
        "summary": {key: value for key, value in extract["summary"].items() if key not in {"levelLine", "yoyLine"}},
        "rows": [
            {key: row[key] for key in (
                "row", "location", "priceAed", "printedCapitalGainPct", "date", "sqft",
                "status", "propertyType", "pricePerSqftAed", "bedsLabel", "seller",
            )}
            for row in extract["rows"]
        ],
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def build_extract(path: Path, filenames: list[str], user_listed: dict[str, bool]) -> dict:
    text = pdf_text(path)
    title = next(line.strip() for line in text.splitlines() if line.strip())
    if title not in AREA_META:
        raise ValueError(f"unmapped title {title!r} from {path.name}")
    meta = AREA_META[title]
    rows = parse_rows(text)
    summary = parse_summary(text)
    digest = sha256_file(path)
    return {
        "sourceId": f"{meta['id']}-{digest[:8]}",
        "areaId": meta["id"],
        "title": title,
        "sha256": digest,
        "retrievalDate": RETRIEVAL_DATE,
        "provenance": PROVENANCE,
        "filenames": filenames,
        "userListedFilenames": [name for name in filenames if user_listed.get(name)],
        "pdf": pdf_info(path),
        "summary": summary,
        "rows": rows,
        "textSha256": hashlib.sha256(text.encode()).hexdigest(),
    }


def fmt_num(value) -> str:
    if value is None:
        return "not printed"
    if isinstance(value, float):
        if abs(value - round(value)) < 1e-9:
            return f"{int(round(value)):,}"
        return f"{value:,.1f}"
    return f"{value:,}"


def fmt_pct(value) -> str:
    if value is None:
        return "not printed"
    number = float(value)
    if abs(number) < 1e-9:
        return "0%"
    if abs(number - round(number)) < 1e-6:
        return f"{int(round(number)):+d}%"
    return f"{number:+.1f}%"


def write_markdown(path: Path, packet: dict) -> None:
    areas = packet["areas"]
    lines = []
    add = lines.append
    add("# Transaction snapshot trends, 6 October 2026")
    add("")
    add("These PDFs are user-supplied transaction snapshots, retrieved 6 October 2026. Each page is a sales-performance card plus a property-sales history. Every summary figure below is copied from that card. Every monthly figure is calculated from the sale rows printed in the history. No forward price path is estimated, and no change is treated as a causal price effect.")
    add("")
    add("## How a trend was decided")
    add("")
    add("The card prints one median AED per sqft, one median price, one transaction count, sometimes a rental-yield percent, and year-over-year percents for the first three. It does not print the year-ago absolute levels or the dates of that comparison window. A year-over-year percent is therefore one stated comparison. It is not a monthly path, and the prior level was not back-calculated.")
    add("")
    add("The history is a list of sale rows. Most files stop at 300 rows while the card's transaction count is higher. Those 300-row files are treated as an export ceiling: the oldest printed month is incomplete and is not used as a trend endpoint. October 2026 is the retrieval month. The latest printed sale is on or before 5 October 2026, so October is an open month and is not used as a full-month endpoint. A comparable month needs at least five printed sales and neither of those exclusions. A printed-history trend is the change in the median of the row-level AED-per-sqft figures between the earliest and latest comparable month. Where at least four comparable months exist, the latest four-month change is reported as well.")
    add("")
    add("The monthly median is the median of the printed rows. It is not a substitute for the card median, and the card does not print a monthly median. Where the printed row count equals the card's transaction count, the print is the whole counted set. Where the card count is higher, monthly volumes are not market volumes.")
    add("")
    add(f"Months inside the printed date span with no row are listed as not in the extract. They are not filled with zeros or estimates. A month with fewer than {SPARSE_BELOW} printed sales is sparse and is not a trend endpoint. If the share of the leading property type shifts by more than {MIX_SHIFT_PP:.0f} percentage points between the first and last comparable month, the all-rows series is mix-shifted and is not used as the price trend. The reported printed trend then stays inside the dominant ready/off-plan and apartment/villa slice when that slice has two comparable months.")
    add("")
    add("Rental yield is used only where the card prints a percent. No row prints a rent. Yield has no year-over-year figure, so a yield is a level.")
    add("")
    add("Ranks stay inside one metric. Median AED-per-sqft year-over-year is ranked separately from median-price year-over-year and from transaction-count year-over-year. Printed monthly changes are ranked only inside the same segment label. Areas whose card shows the unit-rate year-over-year and the ticket-price year-over-year moving in opposite directions are not collapsed into one price direction.")
    add("")
    add("## Sources")
    add("")
    add(f"{packet['sourceCount']['files']} uploaded files, {packet['sourceCount']['uniqueSha256']} distinct SHA-256 values, {packet['sourceCount']['areas']} areas. Identical bytes are one source. Downtown Dubai is the only repeated title whose bytes differ.")
    add("")
    add("| Area | SHA-256 | Files | Printed rows | Card transactions |")
    add("| --- | --- | --- | ---: | ---: |")
    for area in areas:
        for source in area["sources"]:
            names = ", ".join(f"`{name}`" for name in source["filenames"])
            add(f"| {area['title']} | `{source['sha256'][:12]}…` | {names} | {source['rowCount']} | {fmt_num(area['summary']['transactions'])} |")
    add("")
    conflict = packet["conflicts"][0]
    add(f"Downtown Dubai files `{conflict['filenames'][0][0]}` and `{conflict['filenames'][1][0]}` have different SHA-256 values (`{conflict['sha256'][0][:12]}…` and `{conflict['sha256'][1][:12]}…`). The difference is PDF creation metadata: creation stamps {conflict['creationDates'][0]} and {conflict['creationDates'][1]}. The extracted card and every sale field match (`{conflict['numericSha256'][:12]}…`). There is no numeric conflict to average. Both files stay in the packet. One series is shown because the two extracts are the same observations, not because the figures were blended.")
    add("")
    add("Other repeated uploads (Jebel Ali, Arancia Yards, Emaar Beachfront, plus extra copies of Tilal Al Ghaf, Nad Al Sheba, Rashid Yachts, Dubai Investment Park First, and Dubai Land Residence Complex) share a SHA-256 with the file already listed. They are the same source.")
    add("")
    add("## Cross-area comparison")
    add("")
    add("### Stated median AED per sqft, year over year")
    add("")
    add("Same card metric. The window dates are not printed. The sample is the card's transaction count, which is not the same thing as the 300 printed rows.")
    add("")
    add("| Area | Level (AED/sqft) | YoY | Direction | Card transactions | Printed mix |")
    add("| --- | ---: | ---: | --- | ---: | --- |")
    for item in packet["ranks"]["statedMedianPricePerSqftYoy"]:
        add(f"| {item['title']} | {fmt_num(item['level'])} | {fmt_pct(item['yoyPct'])} | {item['direction']} | {fmt_num(item['transactions'])} | {item['mix']} |")
    add("")
    add("### Stated median price, year over year")
    add("")
    add("Same card metric, ticket size rather than unit rate. Do not read this rank as the unit-rate rank.")
    add("")
    add("| Area | Median price (AED) | YoY | Direction | Card transactions |")
    add("| --- | ---: | ---: | --- | ---: |")
    for item in packet["ranks"]["statedMedianPriceYoy"]:
        add(f"| {item['title']} | {fmt_num(item['level'])} | {fmt_pct(item['yoyPct'])} | {item['direction']} | {fmt_num(item['transactions'])} |")
    add("")
    add("### Where the two price metrics disagree")
    add("")
    add("On these cards the unit-rate year-over-year and the ticket-price year-over-year move in opposite directions. Both percents stay as printed. A printed monthly path, where the history has one, is a different comparison and is not used to replace either card percent.")
    add("")
    add("| Area | AED/sqft YoY | Median price YoY | Card transactions | Printed monthly path |")
    add("| --- | ---: | ---: | ---: | --- |")
    for item in packet["ranks"]["priceMetricsDisagree"]:
        add(f"| {item['title']} | {fmt_pct(item['psfYoyPct'])} | {fmt_pct(item['priceYoyPct'])} | {fmt_num(item['transactions'])} | {item['printedPath']} |")
    add("")
    add("### Stated transaction-count year over year")
    add("")
    add("Volume only. Arancia Yards prints no transaction year-over-year percent, so it is not in this rank. Jebel Ali prints +10867% and does not print the base count, so that percent cannot be recomputed from this packet.")
    add("")
    add("| Area | Card transactions | YoY | Direction |")
    add("| --- | ---: | ---: | --- |")
    for item in packet["ranks"]["statedTransactionYoy"]:
        add(f"| {item['title']} | {fmt_num(item['transactions'])} | {fmt_pct(item['yoyPct'])} | {item['direction']} |")
    add("")
    add("### Printed monthly AED per sqft, same segment only")
    add("")
    add("Endpoint change from the earliest comparable printed month to the latest. Ranked only inside one segment. A single snapshot month is not in this table.")
    add("")
    current = None
    for item in packet["ranks"]["printedMonthlyPricePerSqft"]:
        if item["segment"] != current:
            if current is not None:
                add("")
            current = item["segment"]
            add(f"**{current}**")
            add("")
            add("| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |")
            add("| --- | --- | --- | ---: | --- | ---: | ---: | --- |")
        four = item["latestFour"]
        four_text = "fewer than four comparable months" if not four else f"{four['from']} to {four['to']}: {fmt_pct(four['medianPricePerSqftChangePct'])} ({four['direction']})"
        add(f"| {item['title']} | {item['fromPeriod']} | {item['toPeriod']} | {fmt_pct(item['magnitudePct'])} | {item['direction']} | {item['comparablePeriods']} | {four_text} | {'yes' if item['pathReversed'] else 'no'} |")
    add("")
    if not packet["ranks"]["printedMonthlyPricePerSqft"]:
        add("No area has two comparable printed months inside a stable segment.")
        add("")
    add("## Areas with too little history for a price trend")
    add("")
    add("A price trend here means either two comparable printed months in one segment, or a card whose AED-per-sqft year-over-year and median-price year-over-year do not point in opposite directions. A card with a large transaction count and one coherent year-over-year percent is a one-step change, not an absence of history. October 2026 alone would be a level.")
    add("")
    insufficient = [area for area in areas if area["tooLittleHistoryForAPriceTrend"]]
    if not insufficient:
        add("None.")
    for area in insufficient:
        verdict = area["priceTrend"]
        summary = area["summary"]
        printed = area["printed"]
        add(f"- **{area['title']}**. Printed sales run {printed['firstDate']} to {printed['lastDate']} ({printed['rowCount']} rows; card transactions {fmt_num(summary['transactions'])}). The card's AED-per-sqft year-over-year is {fmt_pct(summary['medianPricePerSqftYoyPct'])} and its median-price year-over-year is {fmt_pct(summary['medianPriceYoyPct'])}, so the two price metrics do not share a direction. Comparable printed months: {sum(1 for period in printed['periods'] if period['comparable'])}.")
    add("")
    add("## Area evidence")
    add("")
    for area in areas:
        summary = area["summary"]
        printed = area["printed"]
        verdict = area["priceTrend"]
        catalogue = area["catalogue"]
        add(f"### {area['title']}")
        add("")
        match = catalogue.get("communityName") or "no exact catalogue community"
        scope_label = {
            "area_community_transaction_context": "area/community transaction context",
            "named_project_transactions": "named project transactions",
            "named_development_transactions": "named development transactions",
        }.get(area["scope"], area["scope"])
        add(f"Scope: {scope_label}. Catalogue: {match} ({catalogue.get('match')}).")
        if area.get("scopeNote"):
            add("")
            add(area["scopeNote"])
        if catalogue.get("projectName"):
            add("")
            add(f"Catalogue project `{catalogue['projectId']}` ({catalogue['projectName']}) in `{catalogue['communityId']}`.")
        add("")
        add(f"Printed coverage: {printed['firstDate']} to {printed['lastDate']}. Card median AED/sqft {fmt_num(summary['medianPricePerSqftAed'])} ({fmt_pct(summary['medianPricePerSqftYoyPct'])} year over year). Card median price AED {fmt_num(summary['medianPriceAed'])} ({fmt_pct(summary['medianPriceYoyPct'])} year over year). Card transactions {fmt_num(summary['transactions'])} ({fmt_pct(summary['transactionsYoyPct'])} year over year). Rental yield {fmt_pct(summary['rentalYieldPct']) if summary['rentalYieldPct'] is not None else 'not printed'}.")
        add("")
        status = ", ".join(f"{name} {count}" for name, count in printed["byStatus"].items())
        types = ", ".join(f"{name} {count}" for name, count in printed["byPropertyType"].items())
        beds = ", ".join(f"{name} {count}" for name, count in printed["byBedsLabel"].items())
        add(f"Printed mix: {status}. Types: {types}. Beds: {beds}. Seller class: Developer {printed['bySellerClass']['Developer']}, Individual {printed['bySellerClass']['Individual']}. Distinct location strings {printed['distinctLocations']} ({printed['truncatedLocations']} truncated by the page).")
        add("")
        gain = printed["capitalGain"]
        add(f"Capital-gain percent printed beside the price on {gain['rowsWithPrintedPercent']} rows (median of those percents {fmt_pct(gain['medianPrintedPercent']) if gain['medianPrintedPercent'] is not None else 'n/a'}). {gain['rowsWithoutPrintedPercent']} rows have no percent. The unlabelled No. badge is on every row and is not that percent.")
        add("")
        if printed["summaryCountExceedsPrint"]:
            add(f"The card counts {fmt_num(summary['transactions'])} transactions and the print has {printed['rowCount']} rows. Monthly counts below are printed rows, not the card's volume.")
        elif printed["printedCountEqualsSummaryTransactions"]:
            add(f"The print has {printed['rowCount']} rows and the card counts {fmt_num(summary['transactions'])} transactions. For this file the counted set and the printed rows are the same size.")
        add("")
        add("| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |")
        add("| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for period in printed["periods"]:
            flags = ", ".join(period["flags"]) if period["flags"] else "comparable" if period["comparable"] else "not comparable"
            ready = period["byStatus"].get("Ready", 0)
            offplan = period["byStatus"].get("Offplan", 0)
            apartment = period["byPropertyType"].get("Apartment", 0)
            villa = period["byPropertyType"].get("Villa", 0)
            add(f"| {period['period']} | {period['printedSales']} | {flags} | {fmt_num(period['medianPricePerSqftAed'])} | {fmt_num(period['medianPriceAed'])} | {ready} | {offplan} | {apartment} | {villa} |")
        if printed["monthsNotInExtract"]:
            add("")
            add("Months inside the first-to-last span with no printed row: " + ", ".join(printed["monthsNotInExtract"]) + ".")
        add("")
        if verdict["kind"] == "printed_monthly":
            four = verdict["latestFour"]
            four_sentence = "Fewer than four comparable months, so there is no four-period change."
            if four:
                four_sentence = f"Latest four comparable months, {four['from']} to {four['to']}: median AED/sqft {fmt_pct(four['medianPricePerSqftChangePct'])} ({four['direction']})."
            reverse = " The comparable-month path reversed inside the window." if verdict["pathReversed"] else " The comparable-month path did not reverse."
            thin = ""
            endpoint = verdict.get("endpointSales") or {}
            if endpoint.get("latest") is not None and endpoint["latest"] < 15:
                thin = f" The latest comparable month has {endpoint['latest']} printed sales in this segment."
            card_note = ""
            if verdict.get("cardMetricsDisagree"):
                card_note = " The card's own AED-per-sqft and median-price year-over-year figures point in opposite directions; that card comparison is not the same window as these months."
            add(f"Printed trend, {verdict['metric']}: {verdict['direction']} {fmt_pct(verdict['magnitudePct'])} from {verdict['fromPeriod']} to {verdict['toPeriod']} ({verdict['comparablePeriods']} comparable months). Ticket-price median in the same rows {verdict['ticketPriceDirection']} {fmt_pct(verdict['ticketPriceMagnitudePct'])}. {four_sentence}{reverse}{thin}{card_note}")
        elif verdict["kind"] == "printed_monthly_split":
            add(f"Printed trend is split. {verdict['metric']}. The two sides are not averaged.")
            for part in verdict["parts"]:
                four = part["latestFour"]
                four_text = "no four-period change" if not four else f"latest four months {four['from']} to {four['to']} {fmt_pct(four['medianPricePerSqftChangePct'])} ({four['direction']})"
                add(f"- {part['segment']}: {part['direction']} {fmt_pct(part['magnitudePct'])} from {part['fromPeriod']} to {part['toPeriod']} ({part['comparablePeriods']} months, {part['earliestSales']} then {part['latestSales']} printed sales; {four_text}; path reversed: {'yes' if part['pathReversed'] else 'no'}).")
            if verdict.get("cardMetricsDisagree"):
                add("The card's AED-per-sqft and median-price year-over-year figures also point in opposite directions. That is a separate comparison.")
        elif verdict["kind"] == "stated_yoy_only":
            add(f"No two comparable printed months. The only price change on the page is the card: median AED/sqft {fmt_pct(verdict['magnitudePct'])} ({verdict['direction']}), median price {fmt_pct(verdict.get('ticketPriceMagnitudePct'))} ({verdict.get('ticketPriceDirection')}). The year-ago levels are not printed. This is one comparison, not a path.")
        elif verdict["kind"] == "metrics_disagree":
            add(f"No single price trend. The card prints median AED/sqft {fmt_pct(verdict['psfYoyPct'])} and median price {fmt_pct(verdict['priceYoyPct'])}. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.")
        else:
            add("The page does not support a price trend. The card change is missing or the printed history has fewer than two comparable months.")
        add("")
        interesting = []
        for name, trend in sorted(printed["segmentTrends"].items()):
            if name == "all printed rows":
                continue
            if trend["comparablePeriods"] < 2:
                continue
            if name not in {"Ready", "Offplan", "Apartment", "Villa"} and " " not in name:
                continue
            interesting.append((name, trend))
        if interesting:
            add("Other printed segment paths with at least two comparable months:")
            add("")
            for name, trend in interesting:
                add(f"- {name}: median AED/sqft {trend['direction']} {fmt_pct(trend['medianPricePerSqftChangePct'])} from {trend['earliest']['period']} to {trend['latest']['period']} ({trend['comparablePeriods']} months, {trend['earliest']['printedSales']} then {trend['latest']['printedSales']} printed sales).")
            add("")
        absent = []
        for label, count_key in (("Ready", "Ready"), ("Offplan", "Offplan"), ("Apartment", "Apartment"), ("Villa", "Villa")):
            count = printed["byStatus" if label in {"Ready", "Offplan"} else "byPropertyType"].get(count_key, 0)
            if count == 0:
                absent.append(label)
        if absent:
            add("Not in this print: " + ", ".join(absent) + ".")
            add("")
        if printed["allPrintedRowsTrend"] and printed["allPrintedRowsTrend"].get("mixShiftExceeds15pp"):
            trend = printed["allPrintedRowsTrend"]
            add(f"All printed rows together move {fmt_pct(trend['medianPricePerSqftChangePct'])} in median AED/sqft from {trend['earliest']['period']} to {trend['latest']['period']}, and the {trend['dominantPropertyType']} share shifts by more than 15 percentage points. That all-rows figure is kept as a mixed series and is not the ranked price trend.")
            add("")
        for note in area["notUsedAsThisSeries"]:
            add(f"Not used as this series: {note['communityName']} (`{note['communityId']}`). {note['reason']}")
        if area["printed"]["compositionContains"]:
            add("")
            for needle, count in area["printed"]["compositionContains"].items():
                add(f"Rows whose printed location contains “{needle}”: {count} of {printed['rowCount']}.")
        add("")
    add("## Evidence limits")
    add("")
    add("- The card's year-over-year window is not dated. Two areas can both say +5% and still be describing windows the page never shows.")
    add("- A 300-row print is not the card's transaction population. Business Bay's card says 8,216 transactions; the print has 300 of the most recent dated rows, from 14 September 2026 to 5 October 2026.")
    add("- Location text is often cut with an ellipsis. Names were not repaired.")
    add("- The median on the card is the card's median. It was not recomputed. Monthly medians use the AED-per-sqft number printed on each row. Even-count medians average the two central values.")
    add("- Ready versus off-plan, and apartment versus villa, are taken from the row badges. The card itself does not split those medians.")
    add("- No rent series exists in these files. Yield is a level where a percent is printed, and blank where the card shows a bare percent sign.")
    add("- Identical extra uploads are one source. Downtown's two byte streams are both retained and were not averaged.")
    add("- Catalogue links are identity only. Community prints are area context. They are not subject-project sale histories. Arancia Yards and The Oasis are the two titles that name one development and whose rows stay inside that development.")
    add("- No price was projected, and no community change was attributed to a catalyst.")
    add("")
    add("The production historical snapshot was not rebuilt. This packet is the extract, the comparison, and the tests.")
    add("")
    path.write_text("\n".join(lines), encoding="utf-8")


def rank_stated(areas: list[dict], yoy_key: str, level_key: str) -> list[dict]:
    ranked = []
    for area in areas:
        yoy = area["summary"][yoy_key]
        if yoy is None:
            continue
        ranked.append({
            "areaId": area["id"],
            "title": area["title"],
            "level": area["summary"][level_key],
            "yoyPct": yoy,
            "direction": direction_of(yoy),
            "transactions": area["summary"]["transactions"],
            "mix": ", ".join(f"{name} {count}" for name, count in area["printed"]["byPropertyType"].items()),
        })
    ranked.sort(key=lambda item: (-(item["yoyPct"]), item["title"]))
    return ranked


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--doc", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="re-parse and compare to the packet instead of writing")
    args = parser.parse_args()
    files = sorted(path for path in args.pdf_dir.glob("*.pdf"))
    if not files:
        raise SystemExit(f"no PDFs in {args.pdf_dir}")
    required = set(REQUIRED_UPLOADS)
    present = {path.name for path in files}
    missing = sorted(required - present)
    if missing:
        raise SystemExit(f"missing required PDFs: {missing}")
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in files:
        groups[sha256_file(path)].append(path)
    user_listed = {name: name in required for name in present}
    extracts = []
    for digest, paths in sorted(groups.items(), key=lambda item: item[1][0].name):
        filenames = [path.name for path in paths]
        extract = build_extract(paths[0], filenames, user_listed)
        extract["numericSha256"] = numeric_signature(extract)
        extracts.append(extract)
    by_title: dict[str, list[dict]] = defaultdict(list)
    for extract in extracts:
        by_title[extract["title"]].append(extract)
    conflicts = []
    area_records = []
    for title, meta in AREA_META.items():
        found = by_title.get(title, [])
        if not found:
            raise SystemExit(f"no extract for {title}")
        if len(found) > 1:
            signatures = {item["numericSha256"] for item in found}
            if len(signatures) != 1:
                conflict_kind = "numeric_conflict"
            else:
                conflict_kind = "byte_difference_without_numeric_conflict"
            conflicts.append({
                "title": title,
                "kind": conflict_kind,
                "sha256": [item["sha256"] for item in found],
                "numericSha256": found[0]["numericSha256"],
                "filenames": [item["filenames"] for item in found],
                "creationDates": [item["pdf"]["creationDate"] for item in found],
                "rowCounts": [len(item["rows"]) for item in found],
            })
            if conflict_kind != "byte_difference_without_numeric_conflict":
                raise SystemExit(f"numeric conflict in {title}; refusing to average")
            found[0]["duplicateSourceNote"] = "A second PDF of this title has different bytes and the same extracted card and rows. The series is the shared extract, not an average."
        area_records.append(analyse_area(meta, found))
    disagree = []
    for area in area_records:
        psf = area["summary"]["medianPricePerSqftYoyPct"]
        price = area["summary"]["medianPriceYoyPct"]
        if psf is None or price is None:
            continue
        if not opposite_directions(direction_of(psf), direction_of(price)):
            continue
        verdict = area["priceTrend"]
        if verdict["kind"] == "printed_monthly":
            printed_path = f"{verdict['direction']} {fmt_pct(verdict['magnitudePct'])} on {verdict['metric']}, {verdict['fromPeriod']} to {verdict['toPeriod']}"
        elif verdict["kind"] == "printed_monthly_split":
            printed_path = "; ".join(
                f"{part['segment']} {part['direction']} {fmt_pct(part['magnitudePct'])} ({part['fromPeriod']} to {part['toPeriod']})"
                for part in verdict["parts"]
            )
        else:
            printed_path = "no two comparable printed months"
        disagree.append({
            "areaId": area["id"],
            "title": area["title"],
            "psfYoyPct": psf,
            "priceYoyPct": price,
            "transactions": area["summary"]["transactions"],
            "printedPath": printed_path,
        })
    printed_rank = []
    for area in area_records:
        verdict = area["priceTrend"]
        if verdict["kind"] == "printed_monthly":
            printed_rank.append({
                "areaId": area["id"],
                "title": area["title"],
                "segment": verdict["metric"].replace("median AED per sqft of printed ", ""),
                "fromPeriod": verdict["fromPeriod"],
                "toPeriod": verdict["toPeriod"],
                "magnitudePct": verdict["magnitudePct"],
                "direction": verdict["direction"],
                "comparablePeriods": verdict["comparablePeriods"],
                "latestFour": verdict["latestFour"],
                "pathReversed": verdict["pathReversed"],
            })
        elif verdict["kind"] == "printed_monthly_split":
            for part in verdict["parts"]:
                printed_rank.append({
                    "areaId": area["id"],
                    "title": area["title"],
                    "segment": part["segment"],
                    "fromPeriod": part["fromPeriod"],
                    "toPeriod": part["toPeriod"],
                    "magnitudePct": part["magnitudePct"],
                    "direction": part["direction"],
                    "comparablePeriods": part["comparablePeriods"],
                    "latestFour": part["latestFour"],
                    "pathReversed": part["pathReversed"],
                })
    printed_rank.sort(key=lambda item: (item["segment"], -(item["magnitudePct"] or 0), item["title"]))
    packet = {
        "retrievalDate": RETRIEVAL_DATE,
        "provenance": PROVENANCE,
        "method": {
            "summaryMetrics": "copied from the sales-performance card; not recomputed",
            "monthlyMetric": "median of the AED per sqft printed on each sale row",
            "evenMedian": "average of the two central values",
            "comparableMonth": f"at least {SPARSE_BELOW} printed sales, not the oldest month of a {EXPORT_CEILING}-row print whose card count is higher, and not {OPEN_MONTH}",
            "exportCeiling": "inferred because many prints stop at 300 rows while the card count is higher; the page does not label the list as capped",
            "missingMonths": "listed and not interpolated",
            "mixShiftPercentagePoints": MIX_SHIFT_PP,
            "rent": "yield percent only where the card prints one; no rent amount",
            "forecast": "none",
            "causalPriceEffect": "none",
        },
        "requiredUploadBasenames": REQUIRED_UPLOADS,
        "sourceCount": {
            "files": len(files),
            "uniqueSha256": len(groups),
            "areas": len(area_records),
            "printedRows": sum(len(item["rows"]) for item in extracts),
        },
        "files": [
            {
                "filename": path.name,
                "sha256": sha256_file(path),
                "userListed": path.name in required,
                "bytes": path.stat().st_size,
            }
            for path in files
        ],
        "conflicts": conflicts,
        "areas": area_records,
        "ranks": {
            "statedMedianPricePerSqftYoy": rank_stated(area_records, "medianPricePerSqftYoyPct", "medianPricePerSqftAed"),
            "statedMedianPriceYoy": rank_stated(area_records, "medianPriceYoyPct", "medianPriceAed"),
            "statedTransactionYoy": rank_stated(area_records, "transactionsYoyPct", "transactions"),
            "priceMetricsDisagree": disagree,
            "printedMonthlyPricePerSqft": printed_rank,
        },
    }
    if args.check:
        manifest_path = args.out / "manifest.json"
        existing = json.loads(manifest_path.read_text())
        problems = []
        if existing["sourceCount"]["printedRows"] != packet["sourceCount"]["printedRows"]:
            problems.append("printed row total changed")
        old_files = {item["filename"]: item["sha256"] for item in existing["files"]}
        new_files = {item["filename"]: item["sha256"] for item in packet["files"]}
        if old_files != new_files:
            problems.append("file hash manifest changed")
        for extract in extracts:
            stored = json.loads((args.out / "extracts" / f"{extract['sourceId']}.json").read_text())
            if len(stored["rows"]) != len(extract["rows"]):
                problems.append(f"row count {extract['sourceId']}")
            if stored.get("numericSha256") != extract["numericSha256"]:
                problems.append(f"numeric signature {extract['sourceId']}")
        if problems:
            raise SystemExit("packet check failed: " + "; ".join(problems))
        print("packet check ok", packet["sourceCount"])
        return
    out = args.out
    extract_dir = out / "extracts"
    extract_dir.mkdir(parents=True, exist_ok=True)
    for stale in extract_dir.glob("*.json"):
        stale.unlink()
    for extract in extracts:
        target = extract_dir / f"{extract['sourceId']}.json"
        target.write_text(json.dumps(extract, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = {
        "retrievalDate": RETRIEVAL_DATE,
        "provenance": PROVENANCE,
        "requiredUploadBasenames": REQUIRED_UPLOADS,
        "sourceCount": packet["sourceCount"],
        "files": packet["files"],
        "conflicts": conflicts,
        "sources": [
            {
                "sourceId": extract["sourceId"],
                "areaId": extract["areaId"],
                "title": extract["title"],
                "sha256": extract["sha256"],
                "numericSha256": extract["numericSha256"],
                "textSha256": extract["textSha256"],
                "filenames": extract["filenames"],
                "rowCount": len(extract["rows"]),
                "extract": f"extracts/{extract['sourceId']}.json",
                "pdf": extract["pdf"],
                "summary": {key: value for key, value in extract["summary"].items() if key not in {"levelLine", "yoyLine"}},
            }
            for extract in extracts
        ],
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "analysis.json").write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    args.doc.parent.mkdir(parents=True, exist_ok=True)
    write_markdown(args.doc, packet)
    print(json.dumps({
        "files": packet["sourceCount"]["files"],
        "uniqueSha256": packet["sourceCount"]["uniqueSha256"],
        "areas": packet["sourceCount"]["areas"],
        "printedRows": packet["sourceCount"]["printedRows"],
        "conflicts": [(item["title"], item["kind"]) for item in conflicts],
        "trends": [
            {
                "title": area["title"],
                "kind": area["priceTrend"]["kind"],
                "direction": area["priceTrend"]["direction"],
                "magnitudePct": area["priceTrend"]["magnitudePct"],
                "from": area["priceTrend"]["fromPeriod"],
                "to": area["priceTrend"]["toPeriod"],
                "metric": area["priceTrend"]["metric"],
                "tooLittle": area["tooLittleHistoryForAPriceTrend"],
                "periods": [
                    {"period": period["period"], "n": period["printedSales"], "flags": period["flags"]}
                    for period in area["printed"]["periods"]
                ],
            }
            for area in area_records
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
