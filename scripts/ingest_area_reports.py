#!/usr/bin/env python3
"""Extract structured facts from DXB Interact area-report PDFs.

The PDFs are user-supplied prints. Figures are copied only when the text layer
prints them. Blank yield markers stay null. Bedroom-level sale prices are
listed transactions and are never the area headline price.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

UPLOADS = Path("/home/ubuntu/.cursor/projects/workspace/uploads")
SUPPLIED_PATHS = [
    UPLOADS / "Tilal_Al_Ghaf__Al_Hebiah_Fourth_7989.pdf",
    UPLOADS / "Nad_Al_Sheba_a706.pdf",
    UPLOADS / "Downtown_Dubai_1287.pdf",
    UPLOADS / "Rashid_Yachts_And_Marina__Mina_Rashid_30d8.pdf",
    UPLOADS / "Dubai_Investment_Park_First_45ae.pdf",
    UPLOADS / "Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_3fc2.pdf",
    UPLOADS / "Jebel_Ali_c6d6.pdf",
    UPLOADS / "Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_0b18.pdf",
    UPLOADS / "Emaar_Beachfront__Dubai_Harbour_8662.pdf",
    UPLOADS / "Jebel_Ali_fc28.pdf",
    UPLOADS / "Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf",
    UPLOADS / "Emaar_Beachfront__Dubai_Harbour_3ded.pdf",
    UPLOADS / "Town_Square__Al_Yelayiss_2_2f80.pdf",
    UPLOADS / "Sobha_Hartland__Al_Merkadh_829b.pdf",
    UPLOADS / "The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf",
    UPLOADS / "Damac_Hills__Al_Hebiah_Third_ed43.pdf",
    UPLOADS / "Dubai_Hills_Estate_acbf.pdf",
    UPLOADS / "Dubai_Marina__Marsa_Dubai_5a24.pdf",
    UPLOADS / "Jumeirah_Village_Circle__JVC__b203.pdf",
    UPLOADS / "Business_Bay_4e00.pdf",
    UPLOADS / "Dubai_Creek_Harbour_638f.pdf",
    UPLOADS / "Dubai_South_bda4.pdf",
    UPLOADS / "Palm_Jebel_Ali_8316.pdf",
    UPLOADS / "Downtown_Dubai_e760.pdf",
]

INVENTORY = Path(
    "data/historical-intelligence/inputs/"
    "inventory-054f3f9aa34ddcf1194a4ee772f799c16e460ad4bcb1a1b86efc5573bd15c953.gz"
)

WORD_RE = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>',
    re.S,
)
PAGE_RE = re.compile(r"<page\b([^>]*)>(.*?)</page>", re.S)
MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}
NUMBER_RE = re.compile(r"^\d{1,3}(?:,\d{3})+(?:\.\d+)?$|^\d+(?:\.\d+)?$")
GAIN_RE = re.compile(r"^\(([+-]?\d+(?:\.\d+)?)%\)$")
PERCENT_RE = re.compile(r"^([+-]?\d+(?:\.\d+)?)%$")
DATE_ANCHOR_RE = re.compile(r"^\d{2},$")
STATUS_WORDS = {"Ready", "Offplan", "Off-plan"}
CHIP_WORDS = {"No.", "Yes."}
HEADER_WORDS = {
    "Location", "Price", "Specs", "Date", "Status", "Capital", "gain",
    "Sold", "by", "Property", "Sales", "History", "Details", "Median",
    "price", "/sqft", "Transactions", "Rental", "Yield", "YoY",
    "Performance", "Summary",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pdfinfo(path: Path) -> dict:
    text = subprocess.check_output(["pdfinfo", str(path)], text=True)
    info = {}
    for line in text.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            info[key.strip()] = value.strip()
    return info


def bbox_pages(path: Path) -> list[list[dict]]:
    raw = subprocess.check_output(
        ["pdftotext", "-bbox-layout", str(path), "-"], text=True, errors="replace"
    )
    pages = []
    for index, match in enumerate(PAGE_RE.finditer(raw), start=1):
        words = []
        for found in WORD_RE.finditer(match.group(2)):
            text = html.unescape(found.group(5)).replace("\xa0", " ").strip()
            if not text:
                continue
            words.append({
                "x": float(found.group(1)),
                "y": float(found.group(2)),
                "x2": float(found.group(3)),
                "y2": float(found.group(4)),
                "text": text,
                "page": index,
            })
        pages.append(words)
    return pages


def casefold(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def split_components(title: str) -> list[str]:
    parts = []
    buf = []
    depth = 0
    for char in title:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            part = "".join(buf).strip()
            if part:
                parts.append(part)
            buf = []
        else:
            buf.append(char)
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def load_catalogue(root: Path) -> tuple[dict, dict]:
    import gzip
    with gzip.open(root / INVENTORY, "rt", encoding="utf-8") as handle:
        inventory = json.load(handle)
    communities = defaultdict(list)
    projects = defaultdict(list)
    for record in inventory["communities"]:
        name = record["mapRecord"]["name"]
        communities[casefold(name)].append({
            "id": record["id"],
            "name": name,
            "kind": "community",
            "emirate": record["mapRecord"].get("emirate"),
        })
    for record in inventory["projects"]:
        name = record["mapRecord"]["name"]
        projects[casefold(name)].append({
            "id": record["id"],
            "name": name,
            "kind": "project",
            "emirate": record["mapRecord"].get("emirate"),
            "area": record["mapRecord"].get("area"),
        })
    return communities, projects


def lookup_exact(name: str, communities: dict, projects: dict) -> list[dict]:
    key = casefold(name)
    return [*communities.get(key, []), *projects.get(key, [])]


def classify_title(title: str, communities: dict, projects: dict) -> dict:
    components = split_components(title)
    full_hits = lookup_exact(title, communities, projects)
    component_notes = []
    for component in components:
        hits = lookup_exact(component, communities, projects)
        component_notes.append({
            "component": component,
            "exactHits": hits,
            "usedAsSubject": False,
        })
    subject = None
    status = "unresolved_area_context"
    basis = "Printed title is not an exact catalogue community or project name. Summary figures stay on the printed area label."
    if len(full_hits) == 1:
        subject = full_hits[0]
        status = "exact_full_title"
        basis = "The full printed title casefolds to exactly one catalogue record. No punctuation was folded and no extra token was dropped."
    elif len(full_hits) > 1:
        status = "ambiguous_area_context"
        basis = "The full printed title matches more than one catalogue record, so the summary stays area context."
    else:
        primary = component_notes[0]["exactHits"] if component_notes else []
        parent_hits = [hit for note in component_notes[1:] for hit in note["exactHits"]]
        if len(primary) == 1 and not parent_hits:
            subject = primary[0]
            status = "primary_component_exact"
            basis = (
                "The text before the first comma casefolds to exactly one catalogue record. "
                "Later printed area labels do not. Those labels stay unresolved area context and do not receive the summary."
            )
            component_notes[0]["usedAsSubject"] = True
        elif len(primary) == 1 and parent_hits:
            status = "ambiguous_area_context"
            basis = (
                "More than one component of the printed title exactly matches a different catalogue record. "
                "The summary is not assigned to either record."
            )
        elif len(primary) > 1:
            status = "ambiguous_area_context"
            basis = "The primary printed name matches more than one catalogue record. The summary stays area context."
        elif parent_hits:
            status = "unresolved_area_context"
            basis = (
                "A later component matches a catalogue record, but the primary printed name does not. "
                "The parent match is not promoted to the subject."
            )
    return {
        "printedTitle": title,
        "components": components,
        "status": status,
        "basis": basis,
        "catalogueSubject": subject,
        "componentNotes": component_notes,
        "summaryIsProjectTransaction": False,
    }


def parse_number(token: str):
    if not NUMBER_RE.fullmatch(token):
        return None
    return float(token.replace(",", ""))


def nearest_column(x: float, centers: dict[str, float]) -> str | None:
    metric = min(centers, key=lambda name: abs(centers[name] - x))
    if abs(centers[metric] - x) > 120:
        return None
    return metric


def parse_summary(words: list[dict], title_hint: str | None = None) -> tuple[str, list[dict]]:
    summary_y = min(word["y"] for word in words if word["text"] == "Summary")
    title_y = max(word["y"] for word in words if word["y"] < summary_y - 20)
    title = join_words([word for word in words if abs(word["y"] - title_y) <= 4])
    median_y = min(word["y"] for word in words if word["text"] == "Median")
    yoy_words = [word for word in words if word["text"] == "YoY"]
    if not yoy_words:
        raise RuntimeError(f"summary has no YoY markers: {title}")
    yoy_y = min(word["y"] for word in yoy_words)
    label_words = [word for word in words if median_y - 1 <= word["y"] <= median_y + 16]
    centers = {}
    for word in sorted(label_words, key=lambda item: item["x"]):
        if word["text"] == "Median" and "median_price_per_sqft_aed" not in centers:
            centers["median_price_per_sqft_aed"] = word["x"]
        elif word["text"] == "Median":
            centers["median_price_aed"] = word["x"]
        elif word["text"] == "Transactions":
            centers["transaction_count"] = word["x"]
        elif word["text"] == "Rental":
            centers["rental_yield_pct"] = word["x"]
    if set(centers) != {
        "median_price_per_sqft_aed", "median_price_aed", "transaction_count", "rental_yield_pct"
    }:
        raise RuntimeError(f"summary labels missing in {title}: {centers}")
    value_words = [
        word for word in words
        if median_y + 16 < word["y"] < yoy_y - 4 and (parse_number(word["text"]) is not None or PERCENT_RE.fullmatch(word["text"]) or word["text"] == "%")
    ]
    yoy_tokens = [word for word in words if abs(word["y"] - yoy_y) <= 6 and word["text"] != "YoY"]
    values = {metric: {"value": None, "state": "not_printed"} for metric in centers}
    for word in value_words:
        metric = nearest_column(word["x"], centers)
        if metric is None:
            continue
        if word["text"] == "%":
            values[metric] = {"value": None, "state": "marker_without_number"}
        else:
            matched = PERCENT_RE.fullmatch(word["text"])
            number = float(matched.group(1)) if matched else parse_number(word["text"])
            if number is None:
                continue
            values[metric] = {"value": number, "state": "printed"}
    yoys = {metric: {"value": None, "state": "not_printed"} for metric in centers}
    for word in yoy_tokens:
        metric = nearest_column(word["x"], centers)
        if metric is None:
            continue
        matched = PERCENT_RE.fullmatch(word["text"])
        if word["text"] == "%":
            yoys[metric] = {"value": None, "state": "marker_without_number"}
        elif matched:
            yoys[metric] = {"value": float(matched.group(1)), "state": "printed"}
    if any(item["state"] == "not_printed" for item in values.values()):
        raise RuntimeError(f"summary value missing for {title}: {values}")
    metrics = []
    for metric, unit, currency in (
        ("median_price_per_sqft_aed", "aed_per_sqft", "AED"),
        ("median_price_aed", "aed", "AED"),
        ("transaction_count", "count", None),
        ("rental_yield_pct", "percent", None),
    ):
        metrics.append({
            "kind": "area_summary_metric",
            "scope": "area_summary",
            "isProjectTransaction": False,
            "isHeadlinePrice": metric == "median_price_aed" and values[metric]["value"] is not None,
            "replacesCatalogueHeadlinePrice": False,
            "metric": metric,
            "value": values[metric]["value"],
            "valueState": values[metric]["state"],
            "yoyPct": yoys[metric]["value"],
            "yoyState": yoys[metric]["state"],
            "unit": unit,
            "currency": currency if values[metric]["value"] is not None else None,
            "page": 1,
            "printedTitle": title,
        })
    if title_hint and casefold(title_hint) != casefold(title):
        pass
    return title, metrics


def words_in_window(words, anchor, used):
    selected = []
    for index, word in enumerate(words):
        if index in used:
            continue
        if word["text"] == "Details":
            used.add(index)
            continue
        if anchor["y"] - 8 <= word["y"] <= anchor["y"] + 32:
            selected.append((index, word))
    return selected


def join_words(words: list[dict]) -> str:
    return " ".join(word["text"] for word in sorted(words, key=lambda item: item["x"]))


def parse_sale(window: list[dict], anchor: dict, page: int, row_index: int) -> dict:
    lower = [word for word in window if word["y"] > anchor["y"] + 12]
    location_words = [
        word for word in window
        if word["x"] < 330 and abs(word["y"] - anchor["y"]) <= 8 and word["text"] not in {"AED", "sqft"}
    ]
    location = join_words(location_words)
    date_words = [word for word in window if word["x"] > 540 and abs(word["y"] - anchor["y"]) <= 8]
    date_printed = join_words(date_words)
    date_match = re.fullmatch(r"(\d{2}), ([A-Z][a-z]{2}) (\d{4})", date_printed)
    if not date_match or date_match.group(2) not in MONTHS:
        raise RuntimeError(f"unparsed date {date_printed!r} on page {page} near {location}")
    iso_date = f"{date_match.group(3)}-{MONTHS[date_match.group(2)]:02d}-{int(date_match.group(1)):02d}"
    gain = next((word for word in window if GAIN_RE.fullmatch(word["text"]) and abs(word["y"] - anchor["y"]) <= 8), None)
    sqft = next((word for word in window if word["text"] == "sqft"), None)
    size_word = None
    if sqft is not None:
        candidates = [
            word for word in window
            if parse_number(word["text"]) is not None and word["x"] < sqft["x"] and abs(word["y"] - sqft["y"]) <= 8
        ]
        if candidates:
            size_word = max(candidates, key=lambda word: word["x"])
    price_candidates = [
        word for word in window
        if word is not size_word and parse_number(word["text"]) is not None
        and 300 < word["x"] < 540 and abs(word["y"] - anchor["y"]) <= 8 and not re.fullmatch(r"\d{4}", word["text"])
    ]
    if len(price_candidates) != 1:
        raise RuntimeError(f"price tokens {[word['text'] for word in price_candidates]} for {location} page {page}")
    price = parse_number(price_candidates[0]["text"])
    size = parse_number(size_word["text"]) if size_word else None
    status = next((word["text"] for word in lower if word["text"] in STATUS_WORDS), None)
    chip = next((word["text"] for word in lower if word["text"] in CHIP_WORDS), None)
    type_words = [
        word for word in lower
        if word["x"] < 300 and word["text"] not in STATUS_WORDS and word["text"] not in CHIP_WORDS
        and parse_number(word["text"]) is None
    ]
    property_type = join_words(type_words) or None
    pps_word = next((word for word in window if word["text"] == "/sqft"), None)
    pps = None
    if pps_word is not None:
        numbers = [
            word for word in window
            if parse_number(word["text"]) is not None and word["x"] < pps_word["x"] and abs(word["y"] - pps_word["y"]) <= 8
        ]
        if numbers:
            pps = parse_number(max(numbers, key=lambda word: word["x"])["text"])
    bedrooms = None
    unit_label = None
    bed_word = next((word for word in lower if word["text"] in {"Bed", "Beds"}), None)
    if bed_word is not None:
        counts = [word for word in lower if re.fullmatch(r"\d+", word["text"]) and word["x"] < bed_word["x"]]
        if not counts:
            raise RuntimeError(f"bedroom label without count on page {page}: {location}")
        bedrooms = int(counts[-1]["text"])
        unit_label = f"{bedrooms} {bed_word['text']}"
    studio = next((word for word in lower if word["text"] == "Studio"), None)
    if studio is not None:
        unit_label = "Studio"
        bedrooms = None
    seller_words = [word for word in lower if word["x"] > 540]
    seller_label = join_words(seller_words) or None
    seller_role = None
    seller_count = None
    if seller_label:
        matched = re.fullmatch(r"(Developer|Individual)(?: \((\d+) Times?\))?", seller_label)
        if not matched:
            raise RuntimeError(f"seller {seller_label!r} page {page} {location}")
        seller_role = matched.group(1)
        seller_count = int(matched.group(2)) if matched.group(2) else None
    cross = "not_checked"
    if price is not None and size and pps is not None and size > 0:
        implied = price / size
        cross = "consistent" if abs(implied - pps) <= max(2, 0.02 * pps) else "divergent"
    components = split_components(location)
    phase = None
    phase_match = re.search(r"\b((?:Building|Phase|Tower)\s+[A-Z0-9]+)\b", components[0] if components else location)
    if phase_match:
        phase = phase_match.group(1)
    truncated = "…" in location or location.endswith("...")
    return {
        "kind": "listed_sale",
        "scope": "listed_transaction",
        "isProjectTransaction": False,
        "isHeadlinePrice": False,
        "replacesCatalogueHeadlinePrice": False,
        "page": page,
        "rowIndex": row_index,
        "location": location,
        "locationTruncated": truncated,
        "projectLabel": components[0] if components else location,
        "areaLabels": components[1:] if len(components) > 1 else [],
        "printedPhaseOrBuilding": phase,
        "priceAed": price,
        "capitalGainPct": float(GAIN_RE.fullmatch(gain["text"]).group(1)) if gain else None,
        "capitalGainPrinted": gain is not None,
        "sizeSqft": size,
        "pricePerSqftAed": pps,
        "pricePerSqftCrossCheck": cross,
        "date": iso_date,
        "datePrinted": date_printed,
        "status": status,
        "propertyType": property_type,
        "bedrooms": bedrooms,
        "unitLabel": unit_label,
        "statusChip": chip,
        "statusChipMeaning": "unresolved" if chip else None,
        "sellerRole": seller_role,
        "sellerPrintedCount": seller_count,
        "sellerLabel": seller_label,
        "currency": "AED",
    }


def reconcile_listed_areas(identity: dict, sales: list[dict], communities: dict, projects: dict) -> dict:
    """A title match is withdrawn when listed areas name a different community."""
    subject = identity.get("catalogueSubject")
    if not subject:
        return identity
    counts = defaultdict(int)
    names = {}
    for sale in sales:
        for label in sale["areaLabels"]:
            if "…" in label:
                continue
            for hit in lookup_exact(label, communities, projects):
                if hit["kind"] != "community":
                    continue
                counts[hit["id"]] += 1
                names[hit["id"]] = hit
    others = {key: value for key, value in counts.items() if key != subject["id"]}
    if not others:
        return identity
    top_id, top_count = max(others.items(), key=lambda item: item[1])
    subject_count = counts.get(subject["id"], 0)
    if top_count < 20 or top_count <= subject_count:
        return identity
    revised = dict(identity)
    revised["status"] = "ambiguous_area_context"
    revised["catalogueSubject"] = None
    revised["basis"] = (
        "The printed title matches one catalogue record, and the listed sale locations more often name a different catalogue community. "
        "The summary stays area context and is not assigned to either record."
    )
    revised["titleMatchWithdrawn"] = subject
    revised["conflictingListedCommunity"] = names[top_id]
    revised["conflictingListedCommunityRows"] = top_count
    for note in revised["componentNotes"]:
        note["usedAsSubject"] = False
    return revised


def attach_project(sale: dict, projects: dict, communities: dict) -> None:
    label = sale["projectLabel"]
    if sale["locationTruncated"] and "…" in label:
        sale["catalogueProject"] = None
        sale["catalogueProjectStatus"] = "truncated"
        sale["isProjectTransaction"] = False
        return
    hits = projects.get(casefold(label), [])
    community_hits = communities.get(casefold(label), [])
    if community_hits and not hits:
        sale["catalogueProject"] = None
        sale["catalogueProjectStatus"] = "community_name_not_a_project_transaction"
        sale["isProjectTransaction"] = False
        return
    if len(hits) == 1 and not community_hits:
        sale["catalogueProject"] = {"id": hits[0]["id"], "name": hits[0]["name"], "match": "exact_casefold"}
        sale["catalogueProjectStatus"] = "exact"
        sale["isProjectTransaction"] = True
        sale["replacesCatalogueHeadlinePrice"] = False
        return
    if len(hits) > 1 or (hits and community_hits):
        sale["catalogueProject"] = None
        sale["catalogueProjectStatus"] = "ambiguous"
        sale["ambiguousCatalogueIds"] = [hit["id"] for hit in [*hits, *community_hits]]
        sale["isProjectTransaction"] = False
        return
    sale["catalogueProject"] = None
    sale["catalogueProjectStatus"] = "unresolved"
    sale["isProjectTransaction"] = False


def parse_document(path: Path, communities: dict, projects: dict) -> dict:
    pages = bbox_pages(path)
    title, summary = parse_summary(pages[0])
    sales = []
    residuals = []
    for page_number, words in enumerate(pages, start=1):
        if page_number == 1:
            continue
        used = set()
        anchors = [
            (index, word) for index, word in enumerate(words)
            if DATE_ANCHOR_RE.fullmatch(word["text"]) and word["x"] > 520
        ]
        for ordinal, (index, anchor) in enumerate(anchors, start=1):
            window_pairs = words_in_window(words, anchor, used)
            for word_index, _word in window_pairs:
                used.add(word_index)
            used.add(index)
            sale = parse_sale([word for _, word in window_pairs], anchor, page_number, len(sales) + 1)
            attach_project(sale, projects, communities)
            sales.append(sale)
        for index, word in enumerate(words):
            if index in used or word["text"] in HEADER_WORDS:
                continue
            if parse_number(word["text"]) is not None and "," in word["text"]:
                residuals.append({"page": page_number, "text": word["text"], "x": word["x"], "y": word["y"]})
    identity = classify_title(title, communities, projects)
    identity = reconcile_listed_areas(identity, sales, communities, projects)
    for metric in summary:
        metric["printedTitle"] = title
        metric["catalogueSubject"] = identity["catalogueSubject"]
        metric["identityStatus"] = identity["status"]
        metric["isProjectTransaction"] = False
    divergent = [sale for sale in sales if sale["pricePerSqftCrossCheck"] == "divergent"]
    missing_core = [
        sale for sale in sales
        if sale["priceAed"] is None or not sale["location"] or not sale["date"] or not sale["status"]
    ]
    return {
        "printedTitle": title,
        "identity": identity,
        "pageCount": len(pages),
        "summary": summary,
        "sales": sales,
        "residuals": residuals,
        "divergent": [
            {
                "page": sale["page"],
                "rowIndex": sale["rowIndex"],
                "location": sale["location"],
                "priceAed": sale["priceAed"],
                "sizeSqft": sale["sizeSqft"],
                "pricePerSqftAed": sale["pricePerSqftAed"],
            }
            for sale in divergent
        ],
        "missingCore": len(missing_core),
    }


def row_counts(document: dict) -> dict:
    sales = document["sales"]
    summary = document["summary"]
    transaction_count = next(metric["value"] for metric in summary if metric["metric"] == "transaction_count")
    return {
        "summaryMetrics": len(summary),
        "summaryTransactionCount": transaction_count,
        "listedRowsEqualSummaryCount": transaction_count == len(sales),
        "lowPrintedSalePrices": sum(1 for sale in sales if sale["priceAed"] is not None and sale["priceAed"] < 100000),
        "summaryValuesPrinted": sum(1 for metric in summary if metric["valueState"] == "printed"),
        "summaryValuesBlank": sum(1 for metric in summary if metric["value"] is None),
        "summaryYoyPrinted": sum(1 for metric in summary if metric["yoyState"] == "printed"),
        "summaryYoyBlank": sum(1 for metric in summary if metric["yoyPct"] is None),
        "saleRows": len(sales),
        "saleRowsWithCapitalGain": sum(1 for sale in sales if sale["capitalGainPrinted"]),
        "saleRowsWithoutCapitalGain": sum(1 for sale in sales if not sale["capitalGainPrinted"]),
        "truncatedLocations": sum(1 for sale in sales if sale["locationTruncated"]),
        "exactProjectSales": sum(1 for sale in sales if sale["catalogueProjectStatus"] == "exact"),
        "unresolvedProjectSales": sum(1 for sale in sales if sale["catalogueProjectStatus"] == "unresolved"),
        "ambiguousProjectSales": sum(1 for sale in sales if sale["catalogueProjectStatus"] == "ambiguous"),
        "truncatedProjectLabels": sum(1 for sale in sales if sale["catalogueProjectStatus"] == "truncated"),
        "listedRowsByStatus": dict(Counter(sale["status"] or "unparsed" for sale in sales)),
        "listedRowsByPropertyType": dict(Counter(sale["propertyType"] or "unparsed" for sale in sales)),
        "listedRowsByBedrooms": dict(Counter(
            sale["unitLabel"] or "not_printed" for sale in sales
        )),
        "listedBedroomTallyBasis": "derived_from_listed_rows_only_not_a_source_unit_mix_table",
        "unparsedPriceTokens": len(document["residuals"]),
        "pricePerSqftDivergent": len(document["divergent"]),
        "missingCoreFields": document["missingCore"],
        "printedPhaseOrBuildingRows": sum(1 for sale in sales if sale["printedPhaseOrBuilding"]),
        "statusChipCounts": dict(Counter(sale["statusChip"] or "not_printed" for sale in sales)),
    }


def canonical_payload(document: dict) -> str:
    summary = [
        {key: metric[key] for key in (
            "metric", "value", "valueState", "yoyPct", "yoyState", "isHeadlinePrice", "isProjectTransaction"
        )}
        for metric in document["summary"]
    ]
    sales = []
    for sale in document["sales"]:
        sales.append({
            key: sale[key] for key in (
                "location", "priceAed", "capitalGainPct", "sizeSqft", "pricePerSqftAed",
                "date", "status", "propertyType", "bedrooms", "unitLabel", "statusChip",
                "sellerLabel", "page", "rowIndex", "catalogueProjectStatus",
            )
        })
    return json.dumps({"title": document["printedTitle"], "summary": summary, "sales": sales}, sort_keys=True)


def fact_count(document: dict) -> dict:
    counts = row_counts(document)
    return {
        "summaryFacts": counts["summaryMetrics"],
        "listedSaleFacts": counts["saleRows"],
        "totalFacts": counts["summaryMetrics"] + counts["saleRows"],
        "rowCounts": counts,
    }


def build(root: Path, out_dir: Path) -> dict:
    communities, projects = load_catalogue(root)
    files = []
    parsed_by_sha = {}
    for path in SUPPLIED_PATHS:
        if not path.exists():
            raise SystemExit(f"missing PDF {path}")
        digest = sha256_file(path)
        info = pdfinfo(path)
        record = {
            "path": str(path),
            "basename": path.name,
            "sha256": digest,
            "bytes": path.stat().st_size,
            "pages": int(info["Pages"]),
            "pdfCreatedAt": info.get("CreationDate"),
            "pdfModifiedAt": info.get("ModDate"),
            "pdfTitle": info.get("Title"),
            "producer": info.get("Producer"),
        }
        files.append(record)
        if digest not in parsed_by_sha:
            print(f"parsing {path.name}", flush=True)
            parsed_by_sha[digest] = parse_document(path, communities, projects)
            parsed = parsed_by_sha[digest]
            if parsed["pageCount"] != record["pages"]:
                raise SystemExit(f"page count mismatch {path.name}")
            counts = row_counts(parsed)
            if counts["unparsedPriceTokens"] or counts["missingCoreFields"] or counts["summaryMetrics"] != 4:
                raise SystemExit(f"incomplete parse {path.name} {counts}")
            if counts["pricePerSqftDivergent"]:
                print(f"  divergent price/sqft rows {counts['pricePerSqftDivergent']}", flush=True)
            print(
                f"  {parsed['printedTitle']}: {counts['saleRows']} sales, "
                f"blank summary values {counts['summaryValuesBlank']}, identity {parsed['identity']['status']}",
                flush=True,
            )
    by_title = defaultdict(list)
    for record in files:
        title = parsed_by_sha[record["sha256"]]["printedTitle"]
        record["printedTitle"] = title
        by_title[title].append(record)
    groups = []
    extracts = {}
    for title, members in sorted(by_title.items()):
        unique = {}
        for member in members:
            unique.setdefault(member["sha256"], member)
        payloads = {}
        for digest, member in unique.items():
            payloads[digest] = canonical_payload(parsed_by_sha[digest])
        distinct_payloads = set(payloads.values())
        if len(unique) == 1:
            digest = next(iter(unique))
            relationship = "identical_bytes" if len(members) > 1 else "single_file"
            kept = [digest]
            conflicts = []
        else:
            relationship = "distinct_bytes_identical_facts" if len(distinct_payloads) == 1 else "conflicting_facts"
            kept = list(unique)
            conflicts = []
            if len(distinct_payloads) > 1:
                digests = list(unique)
                left = json.loads(payloads[digests[0]])
                right = json.loads(payloads[digests[1]])
                if left["summary"] != right["summary"]:
                    conflicts.append({"field": "summary", "leftSha256": digests[0], "rightSha256": digests[1]})
                left_sales = {(row["page"], row["rowIndex"]): row for row in left["sales"]}
                right_sales = {(row["page"], row["rowIndex"]): row for row in right["sales"]}
                for key in sorted(set(left_sales) | set(right_sales)):
                    if left_sales.get(key) != right_sales.get(key):
                        conflicts.append({
                            "field": "listed_sale",
                            "page": key[0],
                            "rowIndex": key[1],
                            "left": left_sales.get(key),
                            "right": right_sales.get(key),
                        })
                        if len(conflicts) > 50:
                            break
        for digest in kept:
            if digest not in extracts:
                document = parsed_by_sha[digest]
                counts = fact_count(document)
                extracts[digest] = {
                    "extractId": digest,
                    "printedTitle": document["printedTitle"],
                    "identity": document["identity"],
                    "factCounts": {
                        "summaryFacts": counts["summaryFacts"],
                        "listedSaleFacts": counts["listedSaleFacts"],
                        "totalFacts": counts["totalFacts"],
                    },
                    "rowCounts": counts["rowCounts"],
                    "pricePerSqftDivergent": document["divergent"],
                    "summary": document["summary"],
                    "sales": document["sales"],
                }
        groups.append({
            "printedTitle": title,
            "relationship": relationship,
            "files": [
                {
                    "path": member["path"],
                    "sha256": member["sha256"],
                    "pdfCreatedAt": member["pdfCreatedAt"],
                    "role": "extract" if member["sha256"] in unique and (
                        relationship != "identical_bytes" or member is members[0]
                    ) else "identical_duplicate"
                }
                for member in members
            ],
            "extractIds": kept,
            "factConflicts": conflicts,
            "aggregation": (
                "One extract is stored. Identical files are listed so every path is represented."
                if relationship == "identical_bytes"
                else "Both extracts are retained. Do not average them and do not sum them into one market total."
                if relationship != "single_file"
                else "Single supplied file."
            ),
        })
        if relationship == "identical_bytes":
            primary = members[0]["sha256"]
            for member in members:
                member["extractId"] = primary
                member["role"] = "primary_extract" if member is members[0] else "identical_duplicate"
        elif relationship == "single_file":
            members[0]["extractId"] = members[0]["sha256"]
            members[0]["role"] = "primary_extract"
        else:
            for member in members:
                member["extractId"] = member["sha256"]
                member["role"] = "distinct_extract"
    per_file = []
    for record in files:
        document = extracts[record["extractId"]]
        per_file.append({
            "path": record["path"],
            "sha256": record["sha256"],
            "role": record["role"],
            "extractId": record["extractId"],
            "printedTitle": record["printedTitle"],
            "summaryFacts": document["factCounts"]["summaryFacts"],
            "listedSaleFacts": document["factCounts"]["listedSaleFacts"],
            "totalFacts": document["factCounts"]["totalFacts"],
            "factsShared": record["role"] == "identical_duplicate",
        })
    analysis = build_analysis(extracts, groups)
    packet = {
        "packet": "area-reports-20261006",
        "schemaVersion": 1,
        "asOf": "2026-10-06",
        "publisherCoverMark": "DXB Interact",
        "publisherBasis": "Cover image on the area print. The PDF text layer title is PdfDevKit and does not repeat a narrative disclaimer.",
        "deployment": "not_deployed",
        "catalogue": {
            "path": str(INVENTORY),
            "matchRule": "casefold exact string only; punctuation, parentheses, and numeric suffixes are not folded",
            "communities": sum(len(items) for items in communities.values()),
            "projects": sum(len(items) for items in projects.values()),
        },
        "suppliedPaths": [str(path) for path in SUPPLIED_PATHS],
        "files": files,
        "perFileFactCounts": per_file,
        "duplicateGroups": groups,
        "extracts": list(extracts.values()),
        "analysis": analysis,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    packet_path = out_dir / "packet.json"
    packet_path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {packet_path}", flush=True)
    return packet


def build_analysis(extracts: dict, groups: dict) -> dict:
    supports = [
        "Each print states an area title and four summary metrics: median price per square foot, median price, transaction count, and rental yield, with a year-on-year marker where a number is printed.",
        "Each following page is a Property Sales History table. A parsed row keeps the printed location, sale price, capital-gain percentage when that percentage is printed, size, price per square foot, date, Ready or Offplan status, property type, bedroom or studio label, seller role, and printed seller count.",
        "Explicit Building, Phase, or Tower tokens inside a location are stored as printed phase or building labels.",
        "An exact casefold match to one catalogue project can attach a listed sale to that project. The area median remains a separate summary fact.",
    ]
    unresolved = [
        "The prints do not state the summary period, the population behind the median, or a sample-size definition. The transaction count is a neighboring summary figure, not proof of the median's sample. Where the visible history is shorter than that count, the row tally must not replace it.",
        "Some printed sale prices, sizes, and prices per square foot do not multiply through. Both printed figures are kept and the row is flagged. Neither figure is replaced with a calculated one.",
        "Some printed sale prices are very low for a dwelling but agree with the printed size and price per square foot. They are kept as printed and are not scaled up.",
        "A page title that exactly matches one catalogue community is still left unresolved when the listed locations more often name a different catalogue community.",
        "Rental yield is a single summary percentage. Several areas print a percent sign with no number. Those yields stay null. There are no rent-contract rows, asking-rent tables, or rent sample sizes.",
        "No service-charge, occupancy, unit-mix, or handover-date table is present. Ready and Offplan are the only status values. Bedroom tallies in the packet are counts of listed rows, not a source unit mix.",
        "The status chip printed as No. stays unresolved. It remains No. on rows that also print a capital-gain percentage, so it is not recorded as zero capital gain. Capital gain is null unless a percentage is printed beside the price.",
        "Long location labels are truncated with an ellipsis in the PDF text layer. The missing characters are not reconstructed.",
        "Compound titles that match two different catalogue records, and titles that only resemble a catalogue name, stay area context. Community summary figures are not rewritten as project transactions.",
        "No forecast, uplift, or future rent is printed. None is created. Extreme year-on-year figures are kept as printed and are not treated as a verified market change.",
        "Catalogue asking prices are untouched. A bedroom or unit sale price cannot become the area headline price.",
    ]
    duplicate_limits = []
    for group in groups:
        if group["relationship"] != "single_file":
            duplicate_limits.append({
                "printedTitle": group["printedTitle"],
                "relationship": group["relationship"],
                "factConflicts": len(group["factConflicts"]),
                "extractsRetained": len(group["extractIds"]),
            })
    return {
        "supports": supports,
        "unresolved": unresolved,
        "duplicateHandling": duplicate_limits,
        "doNotSumRepeatedExtracts": True,
        "headlineRule": "The only headline price is the area summary median price. Listed sale prices, including bedroom-specific prices, stay listed transactions.",
        "projectTransactionRule": "Area summary metrics have isProjectTransaction false. A listed sale is a project transaction only when its project label is an exact catalogue project name.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--out", type=Path, default=Path("enrichment/area-reports-20261006"))
    args = parser.parse_args()
    build(args.root.resolve(), args.out)


if __name__ == "__main__":
    main()
