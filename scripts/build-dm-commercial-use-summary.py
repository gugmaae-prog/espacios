#!/usr/bin/env python3
"""Derive labelled commercial-use card counts from verified Dubai Municipality shards."""

import argparse
from collections import Counter, defaultdict
from datetime import date
import gzip
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/uae-evidence/dubai"
SHARDS = DATA / "dm-building-cards-20261026"
OUTPUT = DATA / "dm-commercial-use-card-summary-20261115.json"
RECEIPT = DATA / "dm-commercial-use-card-summary-validation.json"
TOKENS = ("Commercial", "Offices", "Warehouse", "Shopping Centre", "Factory", "Workshops")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def build():
    manifest_bytes = (SHARDS / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    assert manifest["sourceId"] == "dm-building-summary-information-20261026"
    assert manifest["sourceRows"] == manifest["uniqueBuildingIds"] == 536946
    fields = {name: index for index, name in enumerate(manifest["sourceFields"])}
    required = ("building_id", "building_usages_english", "building_status_english",
                "building_permitted_date", "community_no", "community_name_english")
    assert all(name in fields for name in required)
    status = Counter()
    by_token = {token: {"cards": 0, "status": Counter(), "permitDatePresent": 0,
                        "permitDateMissingOrInvalid": 0} for token in TOKENS}
    communities = defaultdict(lambda: {"cards": 0, "names": Counter(),
                                      "usage": Counter(), "missingNames": 0})
    ids = set()
    source_rows = selected_cards = multiple_tokens = missing_community = selected_date_present = 0

    for shard in manifest["shards"]:
        packed = (SHARDS / shard["file"]).read_bytes()
        assert len(packed) == shard["bytes"] and sha(packed) == shard["sha256"]
        decoded = gzip.decompress(packed)
        assert len(decoded) == shard["decodedBytes"] and sha(decoded) == shard["decodedSha256"]
        rows = json.loads(decoded)["rows"]
        assert len(rows) == shard["rows"]
        for row in rows:
            assert len(row) == len(fields)
            building_id = row[fields["building_id"]]
            assert building_id not in ids
            ids.add(building_id)
            source_rows += 1
            card_status = row[fields["building_status_english"]].strip()
            status[card_status] += 1
            exact_tokens = set(part.strip() for part in row[fields["building_usages_english"]].split(" + "))
            selected = [token for token in TOKENS if token in exact_tokens]
            if not selected:
                continue
            selected_cards += 1
            multiple_tokens += len(selected) > 1
            date_text = row[fields["building_permitted_date"]].strip()
            try:
                date.fromisoformat(date_text)
                has_date = True
            except ValueError:
                has_date = False
            selected_date_present += has_date
            community_text = row[fields["community_no"]].strip()
            assert not community_text or re.fullmatch(r"\d+(?:\.00)?", community_text)
            community_no = int(community_text.split(".")[0]) if community_text else None
            if community_no is None:
                missing_community += 1
            community = communities[community_no]
            community["cards"] += 1
            name = row[fields["community_name_english"]].strip()
            if name:
                community["names"][name] += 1
            else:
                community["missingNames"] += 1
            for token in selected:
                item = by_token[token]
                item["cards"] += 1
                item["status"][card_status] += 1
                item["permitDatePresent" if has_date else "permitDateMissingOrInvalid"] += 1
                community["usage"][token] += 1

    assert source_rows == len(ids) == manifest["sourceRows"]
    assert dict(status) == manifest["quality"]["statusCounts"]
    assert sum(item["cards"] for item in communities.values()) == selected_cards
    summary = {
        "version": "20261115-dm-commercial-use-cards-v1",
        "sourceId": manifest["sourceId"],
        "sourceSha256": manifest["sourceSha256"],
        "sourceUpdatedLabel": manifest["sourceUpdatedLabel"],
        "evidenceClass": "derived_exact_usage_token_building_card_counts",
        "grain": "one unique building card; multiple usage tokens may occur on one card",
        "sourceRows": source_rows,
        "selectedUniqueCards": selected_cards,
        "selectedCardsPermitDatePresent": selected_date_present,
        "selectedCardsPermitDateMissingOrInvalid": selected_cards - selected_date_present,
        "cardsWithMultipleSelectedTokens": multiple_tokens,
        "selectedUsageTokens": list(TOKENS),
        "usageTokenCards": [
            {"token": token, "cards": by_token[token]["cards"],
             "statusCounts": {name: by_token[token]["status"].get(name, 0) for name in sorted(status)},
             "permitDatePresent": by_token[token]["permitDatePresent"],
             "permitDateMissingOrInvalid": by_token[token]["permitDateMissingOrInvalid"]}
            for token in TOKENS
        ],
        "communityCodeCount": len(communities) - (None in communities),
        "cardsWithoutCommunityCode": missing_community,
        "communities": [
            {"communityNo": code,
             "sourceNameVariants": [{"name": name, "cards": count} for name, count in sorted(item["names"].items(), key=lambda pair: (-pair[1], pair[0]))],
             "missingNameCards": item["missingNames"],
             "nameConflict": len(item["names"]) > 1,
             "selectedUniqueCards": item["cards"],
             "usageTokenCards": {token: item["usage"].get(token, 0) for token in TOKENS}}
            for code, item in sorted(communities.items(), key=lambda pair: (-1 if pair[0] is None else pair[0]))
        ],
        "limits": "Source building cards are permit-system records, not verified standing buildings, unit counts, live available spaces, prices, transactions, or map points. Usage tokens overlap and must not be added. Community codes and all source name variants are retained without choosing a location when names conflict. Missing permit dates prevent an unbiased historical trend.",
    }
    result = encoded(summary)
    receipt = {
        "sourceId": manifest["sourceId"], "sourceSha256": manifest["sourceSha256"],
        "sourceManifestSha256": sha(manifest_bytes), "sourceRows": source_rows,
        "verifiedShards": len(manifest["shards"]), "selectedUniqueCards": selected_cards,
        "selectedCardsPermitDatePresent": selected_date_present,
        "cardsWithMultipleSelectedTokens": multiple_tokens,
        "communityCodeCount": summary["communityCodeCount"],
        "summaryBytes": len(result), "summarySha256": sha(result),
        "method": "Every pinned shard was checksum-read and all unique building IDs were scanned. Exact English use tokens were counted once per card; overlapping tokens, status, date coverage, and source community name variants were retained.",
    }
    return result, encoded(receipt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result, receipt = build()
    if args.check:
        assert OUTPUT.read_bytes() == result and RECEIPT.read_bytes() == receipt
    else:
        OUTPUT.write_bytes(result)
        RECEIPT.write_bytes(receipt)
    print(json.dumps({"summarySha256": sha(result), "summaryBytes": len(result),
                      "selectedUniqueCards": json.loads(result)["selectedUniqueCards"]}))


if __name__ == "__main__":
    main()
