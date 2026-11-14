#!/usr/bin/env python3
"""Audit a locally retained RAK RERA list without redistributing its rows."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
HEATMAP = ROOT / "data/recovery/accepted-uae-heatmap-20261102.json"
OUTPUT = ROOT / "data/uae-evidence/ras-al-khaimah/rera-project-list-candidate-audit-20261114.json"
SOURCE_SHA256 = "2cdf539fbbc528f8f7f90a68414159779bde5a91cd96b0bc82dbd1aee223748e"


class FirstTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.finished = False
        self.in_cell = False
        self.cell = ""
        self.row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "table" and not self.finished:
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.row = []
        elif self.in_table and tag in ("td", "th"):
            self.in_cell = True
            self.cell = ""

    def handle_data(self, data):
        if self.in_cell:
            self.cell += data

    def handle_endtag(self, tag):
        if self.in_table and tag in ("td", "th") and self.in_cell:
            self.row.append(" ".join(self.cell.split()))
            self.in_cell = False
        elif self.in_table and tag == "tr" and self.row:
            self.rows.append(self.row)
        elif self.in_table and tag == "table":
            self.in_table = False
            self.finished = True


def normalized_name(value):
    return " ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", value.casefold())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-html", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source = args.source_html.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("RAK source HTML changed; audit the new capture before using it")
    table = FirstTable()
    table.feed(source.decode("utf-8"))
    rows = [row for row in table.rows if len(row) == 3 and row[0].isdigit()]
    if len(rows) != 81 or [int(row[0]) for row in rows] != list(range(1, 82)):
        raise ValueError("RAK source table did not reconcile to 81 numbered rows")

    heatmap_bytes = HEATMAP.read_bytes()
    heatmap = json.loads(heatmap_bytes)
    features = [
        item["properties"]
        for item in heatmap["projectFeatures"]["features"]
        if item["properties"].get("emirate") == "Ras Al Khaimah"
    ]
    if len(features) != 89:
        raise ValueError("Accepted RAK map baseline changed")
    names = {}
    for feature in features:
        names.setdefault(normalized_name(feature["name"]), []).append(feature["id"])
    exact = [names.get(normalized_name(row[1]), []) for row in rows]
    report = {
        "sourceId": "rak-rera-sanad-offplan-list-candidate-20261114",
        "sourceUrl": "https://sanad.mun.rak.ae/docs/en/rera-updated-developers-list",
        "captureDate": "2026-11-14",
        "sourceHtmlSha256": SOURCE_SHA256,
        "sourceRows": len(rows),
        "sourceDate": None,
        "sourceDateBasis": "The reviewed page does not establish a list publication or observation date.",
        "acceptedV48RakMappedFeatures": len(features),
        "acceptedHeatmapSha256": hashlib.sha256(heatmap_bytes).hexdigest(),
        "exactNormalizedNameCandidateRows": sum(bool(matches) for matches in exact),
        "oneToOneNameCandidateRows": sum(len(matches) == 1 for matches in exact),
        "ambiguousNameCandidateRows": sum(len(matches) > 1 for matches in exact),
        "sourceRowsWithoutExactNameCandidate": sum(not matches for matches in exact),
        "identityLinksApproved": 0,
        "publisher": "Ras Al Khaimah Municipality Real Estate Regulatory Administration",
        "copyrightUrl": "https://mun.rak.ae/home/open-data/website/copyrights/",
        "termsUrl": "https://mun.rak.ae/terms-conditions/",
        "publicationStatus": "internal_candidate_only",
        "rightsStatus": "No redistribution permission established for this all-rights-reserved list.",
        "limits": "Row numbers are page order, not verified stable project IDs. Name equality is a review candidate only; developer, aliases, phases, dates and identity need separate checks. The list has no verified coordinates or live availability. No source rows, names or developer values are redistributed by this audit.",
    }
    if args.check:
        if json.loads(OUTPUT.read_text()) != report:
            raise ValueError("RAK source audit report changed")
    else:
        OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"sourceRows": report["sourceRows"], "exactNameCandidates": report["exactNormalizedNameCandidateRows"], "approvedIdentityLinks": 0, "publicationStatus": report["publicationStatus"]}))


if __name__ == "__main__":
    main()
