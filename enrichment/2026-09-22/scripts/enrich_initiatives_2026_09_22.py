#!/usr/bin/env python3
"""Enrich Espacios map initiatives (2026-09-22).

Schema extensions (backward compatible — additive only):
  linkedCommunities: [{name, projectCount}]  # area-name match from map-data only
  linkedProjectCounts: {total, byCommunity}
  deliveryCertainty: construction | procurement | announced | strategy
  accessibilityNote, demandNote, supplyRiskNote: str
  researchNotes: str
  officialSourceUrl: str | null
  catalystScore: {delivery, accessibility, demand, supplyRisk, asOf}
    # SCALE: each dimension is 0–100 (integer). Higher = stronger catalyst signal
    # for that dimension. supplyRisk is inverted in meaning: higher = MORE risk
    # (worse for supply balance). asOf is ISO date of this enrichment pass.
"""
from __future__ import annotations
import json
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path("/workspace/espacios-map-navigable-v2")
MAP = ROOT / "data" / "map-data.json"
CORE = ROOT / "data" / "map-core.json"
ASOF = "2026-09-22"

# Area-name needles used ONLY for catalogue matching (never geo-distance).
# Each initiative lists substrings / exact community names to fuzzy-contain match
# against project.area and community.name (case-insensitive).
LINK_RULES = {
    # Needles must match catalogue area/community names — prefer specific districts,
    # avoid bare emirate names that over-count unrelated projects.
    "initiative:dubai:dubai-blue-line": [
        "Academic City", "Warsan", "International City", "Dubai Silicon Oasis",
        "Mirdif", "Muhaisnah", "Al Rashidiya", "Dubai Creek Harbour", "Ras Al Khor",
    ],
    "initiative:dubai:dubai-airport": [
        "Dubai South", "Expo City Dubai", "Expo Valley", "Emaar South",
    ],
    "initiative:dubai:dubai-exhibition-centre": [
        "Expo City Dubai", "Expo Valley", "Dubai South", "Emaar South",
    ],
    "initiative:dubai:dubai-gold-line": [
        "Business Bay", "City Walk", "MBR City", "Mohammed Bin Rashid City",
        "Nad Al Sheba", "Meydan", "Jumeirah Village Circle", "Jumeirah Golf Estates",
        "Al Barsha", "Mina Rashid",
    ],
    "initiative:uae:uae-passenger-rail": [
        "Dubai South", "Emaar South", "Expo City Dubai", "Masdar City",
        "MBZ City", "Mohamed Bin Zayed City",
    ],
    "initiative:uae:abu-dhabi-dubai-high-speed-rail": [
        "Business Bay", "Downtown Dubai", "Saadiyat Island", "Yas Island",
        "Dubai Marina", "Jumeirah Lake Towers",
    ],
    "initiative:ras-al-khaimah:wynn-rak": [
        "Al Marjan Island",
    ],
    "initiative:ras-al-khaimah:al-marjan-pipeline": [
        "Al Marjan Island",
    ],
    "initiative:sharjah:sharjah-airport-expansion": [
        "Aljada", "Muwaileh", "University City", "Al Khan", "Maryam Island",
        "Tilal City", "Al Rahmaniya",
    ],
    "initiative:sharjah:sharjah-midline-drainage": [
        "Aljada", "Al Khan", "Maryam Island", "Muwaileh", "Al Majaz", "Al Nahda",
        "Al Mamzar",
    ],
    "initiative:sharjah:hamriyah-iwp": [
        "Hamriyah", "Aljada", "Al Rahmaniya",
    ],
    "initiative:umm-al-quwain:uaq-emirates-road": [
        "Sobha Siniya Island", "Umm Al Quwain", "Al Zorah",
    ],
    "initiative:umm-al-quwain:siniya-island": [
        "Sobha Siniya Island",
    ],
    "initiative:abu-dhabi:guggenheim-ad": [
        "Saadiyat Island", "Saadiyat",
    ],
    "initiative:abu-dhabi:harry-potter-ad": [
        "Yas Island", "Yas Point", "Yas Acres",
    ],
    "initiative:abu-dhabi:disney-ad": [
        "Yas Island", "Yas Point", "Yas Acres",
    ],
    "initiative:abu-dhabi:sphere-ad": [
        "Yas Island", "Yas Point", "Yas Acres",
    ],
}

# Stale fact fixes + enrichment payloads keyed by initiative id.
ENRICH = {
    "initiative:dubai:dubai-gold-line": {
        "summary": (
            "Dubai's first fully underground metro line: official RTA length 42 km with "
            "18 stations (Al Ghubaiba to Jumeirah Golf Estates), AED34bn programme. "
            "Tender issuance scheduled 2026, contract award 2027, inauguration target 9 Sep 2032."
        ),
        "status": "Procurement",
        "timing": "Tender 2026 / award target 2027 / opening target 9 Sep 2032",
        "deliveryCertainty": "procurement",
        "accessibilityNote": (
            "Connects Red Line (Business Bay, Jumeirah Golf Estates) and Green Line "
            "(Al Ghubaiba); Etihad Rail links at Meydan and Jumeirah Golf Estates. "
            "Serves ~15 strategic districts and an estimated 1.5m residents by 2040."
        ),
        "demandNote": (
            "Long-range accessibility signal across established and emerging districts; "
            "station catchments matter more than generic corridor proximity."
        ),
        "supplyRiskNote": (
            "Not yet construction-stage; property narrative risk if timelines slip from "
            "2026 tender / 2027 award / 2032 opening path."
        ),
        "researchNotes": (
            "Fixed stale summary that still said 34.2 km. Official RTA press release "
            "(22 Apr 2026) confirms 42 km / 18 stations / AED34bn / open 9 Sep 2032."
        ),
        "officialSourceUrl": (
            "https://www.rta.ae/wps/portal/rta/ae/home/news-and-media/all-news/NewsDetails/"
            "mohammed-bin-rashid-approves-dubai-metro-gold-line-involving-an-investment-of-aed-34-billion"
        ),
        "catalystScore": {"delivery": 55, "accessibility": 88, "demand": 78, "supplyRisk": 42, "asOf": ASOF},
    },
    "initiative:abu-dhabi:harry-potter-ad": {
        "summary": (
            "Three Harry Potter–themed lands (Diagon Alley, Hogwarts, Forbidden Forest) "
            "at Warner Bros. World Abu Dhabi spanning ~63,000 m²; construction completion "
            "targeted for 2029. Part of a broader park expansion also adding DC attractions."
        ),
        "status": "Under construction",
        "timing": "Construction completion target 2029",
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "On-site expansion within Warner Bros. World, Yas Island — benefits existing "
            "park visitation and multi-day Yas stays rather than a new greenfield plot."
        ),
        "demandNote": (
            "Deepens Yas Island's multi-day entertainment offer; first Harry Potter lands "
            "in the Middle East and only fully indoor Harry Potter complex globally."
        ),
        "supplyRiskNote": (
            "Delivery is construction-completion (2029), not a confirmed public opening day; "
            "treat 2029 as a works target pending operator opening window."
        ),
        "researchNotes": (
            "Replaced 'Opening date not announced' with Miral (7 Sep 2026) confirmation: "
            "~63,000 sqm, three lands, construction targeted for completion in 2029."
        ),
        "officialSourceUrl": (
            "https://www.mediaoffice.abudhabi/en/tourism/"
            "miral-announces-construction-of-3-new-harry-potter-themed-lands-at-warner-bros-world-abu-dhabi/"
        ),
        "catalystScore": {"delivery": 72, "accessibility": 70, "demand": 86, "supplyRisk": 35, "asOf": ASOF},
    },
    "initiative:dubai:dubai-exhibition-centre": {
        "summary": (
            "AED10bn multi-phase DEC expansion at Expo City. Phase 1 completed/operating "
            "2025–2026 (~140,000 sqm indoor events capacity; hosted Gulfood and World Health Expo). "
            "Phase 2 targets ~2028 (~160,000 sqm); final phase ~2031 (~180,000 sqm, 26 halls)."
        ),
        "status": "Phased / mixed",
        "timing": "Phase 1 operating 2025–2026 / Phase 2 target ~2028 / final ~2031",
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "Anchored at Expo City / Dubai South; Phase 2 adds Eastern Access Road, extended "
            "concourse and multi-storey parking (~7,000 spaces initially)."
        ),
        "demandNote": (
            "Strengthens the events economy around Dubai South and Expo City; demand effects "
            "track phased operating capacity rather than the full 2031 masterplan."
        ),
        "supplyRiskNote": (
            "Hospitality and residential spillover depends on event calendar utilisation; "
            "later phases (2028/2031) remain delivery targets."
        ),
        "researchNotes": (
            "Updated to note Phase 1 completed/operating early 2026 (WAM 9 Sep 2026); "
            "Phase 2 ~2028 and final ~2031 retained from DWTC masterplan."
        ),
        "officialSourceUrl": (
            "https://www.dubaiexhibitioncentre.com/en/media-hub/"
            "mohammed-bin-rashid-approves-aed10-billion-expansion-plan-for-the-dubai-exhibition-centre-at-expo-city-dubai"
        ),
        "catalystScore": {"delivery": 80, "accessibility": 74, "demand": 82, "supplyRisk": 38, "asOf": ASOF},
    },
    "initiative:dubai:dubai-blue-line": {
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "New metro corridor linking major residential, education and employment districts; "
            "station access and opening sequence (target 9 Sep 2029) matter more than broad proximity."
        ),
        "demandNote": "Near-term transit catalyst with construction underway — higher certainty than announced-only lines.",
        "supplyRiskNote": "Watch station-area launch cadence; corridor-level claims overstate impact versus station catchments.",
        "researchNotes": "Priority catalyst: under construction; opening target 9 Sep 2029.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 85, "accessibility": 90, "demand": 84, "supplyRisk": 40, "asOf": ASOF},
    },
    "initiative:dubai:dubai-airport": {
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "Anchors Dubai South aviation/logistics platform; long-run access depends on "
            "terminal phasing and connecting road/rail (incl. Blue Line / passenger rail)."
        ),
        "demandNote": "Employment, hospitality and residential relevance around Dubai South grows with first-phase delivery horizon.",
        "supplyRiskNote": "Ultimate-capacity figures must not be treated as current throughput; ten-year first-phase horizon.",
        "researchNotes": "Paired with DEC expansion as Dubai South dual catalyst.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 70, "accessibility": 82, "demand": 88, "supplyRisk": 48, "asOf": ASOF},
    },
    "initiative:uae:uae-passenger-rail": {
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "Introductory Abu Dhabi–Fujairah service operating; further stations staged "
            "30 Jun 2026–30 Mar 2027 change practical catchments between employment centres, airports and ports."
        ),
        "demandNote": "National mobility backbone — effects are corridor- and station-specific, not emirate-wide.",
        "supplyRiskNote": "Staged rollout means early stations capture demand first; later stops should not be priced as live.",
        "researchNotes": "Keep separate from Abu Dhabi–Dubai HSR announcement.",
        "officialSourceUrl": (
            "https://corporate.etihadrail.ae/en/newsroom/press/"
            "khaled-bin-mohamed-bin-zayed-inaugurates-mbz-city-passenger-train-station-and-witnesses-unveiling-of-uae-passenger-rail-network"
        ),
        "catalystScore": {"delivery": 78, "accessibility": 86, "demand": 80, "supplyRisk": 36, "asOf": ASOF},
    },
    "initiative:uae:abu-dhabi-dubai-high-speed-rail": {
        "deliveryCertainty": "announced",
        "accessibilityNote": "Planned ~30-minute intercity link; design approval and tendering announced — not an operating service.",
        "demandNote": "Long-range commuting/productivity signal between Abu Dhabi and Dubai cores.",
        "supplyRiskNote": "Must remain separate from the operating passenger-rail rollout; opening date not announced.",
        "researchNotes": "Priority companion to Gold Line / passenger-rail cluster.",
        "officialSourceUrl": (
            "https://corporate.etihadrail.ae/en/newsroom/press/"
            "with-the-blessing-of-the-uae-president-khaled-bin-mohamed-bin-zayed-and-hamdan-bin-mohammed-bin-rashid-witness-announcement-of-high-speed-train-project-linking-abu-dhabi-and-dubai"
        ),
        "catalystScore": {"delivery": 35, "accessibility": 92, "demand": 75, "supplyRisk": 55, "asOf": ASOF},
    },
    "initiative:ras-al-khaimah:wynn-rak": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Integrated resort under construction on Al Marjan Island; local island access + Emirates Road regional access matter.",
        "demandNote": "Global-visibility hospitality catalyst for Al Marjan; effect depends on operations quality and market depth.",
        "supplyRiskNote": "Dense branded-residence pipeline on the same island — monitor absorption vs Wynn opening window (Spring 2027).",
        "researchNotes": "Paired with Al Marjan pipeline for island-level supply/demand read.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 82, "accessibility": 68, "demand": 90, "supplyRisk": 62, "asOf": ASOF},
    },
    "initiative:ras-al-khaimah:al-marjan-pipeline": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Operating island destination with continuing hospitality/mixed-use releases — plot-level, not island-wide completion.",
        "demandNote": "Requires operator-by-operator analysis; Wynn is the headline demand engine.",
        "supplyRiskNote": "High concurrent launch density elevates supply-risk relative to other northern emirates nodes.",
        "researchNotes": "linkedProjectCounts derived from Al Marjan area-name matches in live map-data.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 75, "accessibility": 66, "demand": 84, "supplyRisk": 70, "asOf": ASOF},
    },
    "initiative:sharjah:sharjah-airport-expansion": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Raises passenger capacity; changes access around the airport corridor (target mid-2027 capacity milestone).",
        "demandNote": "Supports tourism, trade and employment spillover into Sharjah residential corridors.",
        "supplyRiskNote": "Corridor access improvements can unlock launches — watch oversupply near airport fringe.",
        "researchNotes": "Clustered with Midline drainage + Hamriyah water as Sharjah infrastructure triad.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 76, "accessibility": 80, "demand": 72, "supplyRisk": 44, "asOf": ASOF},
    },
    "initiative:sharjah:sharjah-midline-drainage": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "AED500m drainage protecting ~4,000 ha and major road continuity — resilience underpinning dense districts.",
        "demandNote": "Indirect demand support via flood-risk reduction rather than a visitor magnet.",
        "supplyRiskNote": "Phase 1 end-2026 / overall H1 2027 are targets; incomplete works leave residual climate risk.",
        "researchNotes": "Practical resilience constraint on Sharjah urban districts.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 74, "accessibility": 60, "demand": 55, "supplyRisk": 40, "asOf": ASOF},
    },
    "initiative:sharjah:hamriyah-iwp": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Utility-scale desalination/storage for urban and industrial growth (initial Q2 2027 / full Q2 2028).",
        "demandNote": "Enables growth capacity more than it creates destination demand.",
        "supplyRiskNote": "Two disclosed capacity milestones remain delivery targets.",
        "researchNotes": "Sharjah's first independent water project.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 73, "accessibility": 50, "demand": 58, "supplyRisk": 42, "asOf": ASOF},
    },
    "initiative:umm-al-quwain:uaq-emirates-road": {
        "deliveryCertainty": "construction",
        "accessibilityNote": (
            "25 km federal upgrade Al Badee–UAQ, 3→5 lanes each direction; two-year programme "
            "from Sep 2025 improves regional access for UAQ/Siniya and northern corridor."
        ),
        "demandNote": "Access improvement catalyst for Sobha Siniya and northern emirates travel times.",
        "supplyRiskNote": "~2027 finish depends on stated two-year programme; road alone does not create absorption.",
        "researchNotes": "Paired with Sobha Siniya Island.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 77, "accessibility": 84, "demand": 68, "supplyRisk": 45, "asOf": ASOF},
    },
    "initiative:umm-al-quwain:siniya-island": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Island JV with component handovers distinct from overall ~2032 masterplan; Emirates Road upgrade is key access catalyst.",
        "demandNote": "Tests waterfront supply vs natural-island identity and patient local demand.",
        "supplyRiskNote": "Phased handovers — avoid treating overall 2032 as a single completion event.",
        "researchNotes": "Area-name link to Sobha Siniya Island catalogue projects.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 68, "accessibility": 64, "demand": 70, "supplyRisk": 58, "asOf": ASOF},
    },
    "initiative:abu-dhabi:guggenheim-ad": {
        "deliveryCertainty": "construction",
        "accessibilityNote": "Saadiyat Cultural District museum with named open-place coordinate; announced opening 11 Nov 2026.",
        "demandNote": "Extends cultural-institution cluster and global destination profile for Saadiyat.",
        "supplyRiskNote": "Opening date is announced — still verify operational readiness closer to Nov 2026.",
        "researchNotes": "Yas/Saadiyat cultural cluster priority.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 88, "accessibility": 72, "demand": 85, "supplyRisk": 30, "asOf": ASOF},
    },
    "initiative:abu-dhabi:disney-ad": {
        "deliveryCertainty": "announced",
        "accessibilityNote": "Yas Island planned resort; exact waterfront plot not publicly confirmed (community centroid basis).",
        "demandNote": "Major long-range family-tourism signal; commercial milestones must be tracked.",
        "supplyRiskNote": "Opening date not announced — highest timeline uncertainty in Yas/Saadiyat cultural set.",
        "researchNotes": "Keep alongside Harry Potter / Sphere / Guggenheim as cultural-tourism cluster.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 28, "accessibility": 70, "demand": 92, "supplyRisk": 50, "asOf": ASOF},
    },
    "initiative:abu-dhabi:sphere-ad": {
        "deliveryCertainty": "announced",
        "accessibilityNote": "Up-to-20,000-capacity venue announced for Yas Island; exact plot not publicly confirmed.",
        "demandNote": "Events/entertainment demand engine complementary to theme-park visitation.",
        "supplyRiskNote": "Target completion end-2029 is announced, not construction-verified in this enrichment pass.",
        "researchNotes": "Yas entertainment cluster companion.",
        "officialSourceUrl": None,
        "catalystScore": {"delivery": 40, "accessibility": 68, "demand": 80, "supplyRisk": 48, "asOf": ASOF},
    },
}


def norm(s: str) -> str:
    return " ".join((s or "").lower().replace("–", "-").replace("—", "-").split())


def build_area_index(projects, communities):
    by_area = defaultdict(int)
    for p in projects:
        if p.get("archived"):
            continue
        a = (p.get("area") or "").strip()
        if a:
            by_area[a] += 1
    community_names = []
    for c in communities:
        n = (c.get("name") or "").strip()
        if n:
            community_names.append(n)
            # also count indexedProjects if present
            if n not in by_area and c.get("indexedProjects"):
                by_area[n] = int(c.get("indexedProjects") or 0)
    return by_area, community_names


def match_linked(needles, by_area, community_names):
    """Match catalogue area/community names by substring — never by geo distance."""
    linked = {}
    for area, count in by_area.items():
        an = norm(area)
        for needle in needles:
            nn = norm(needle)
            if nn and (nn in an or an in nn):
                linked[area] = max(linked.get(area, 0), count)
                break
    # also surface community names that match even if project count 0
    for cname in community_names:
        cn = norm(cname)
        for needle in needles:
            nn = norm(needle)
            if nn and (nn in cn or cn in nn):
                linked.setdefault(cname, by_area.get(cname, 0))
                break
    items = [{"name": k, "projectCount": v} for k, v in sorted(linked.items(), key=lambda x: (-x[1], x[0]))]
    by_community = {i["name"]: i["projectCount"] for i in items}
    return items, {"total": sum(by_community.values()), "byCommunity": by_community}


def certainty_from_status(status: str, explicit: str | None) -> str:
    if explicit:
        return explicit
    s = (status or "").lower()
    if "construction" in s or "operating" in s or "phased" in s:
        return "construction" if "construction" in s or "phased" in s else "construction"
    if "procurement" in s or "tender" in s:
        return "procurement"
    if "announced" in s:
        return "announced"
    return "strategy"


def apply(data: dict) -> tuple[dict, list[str]]:
    by_area, community_names = build_area_index(data.get("projects", []), data.get("communities", []))
    touched = []
    for init in data.get("initiatives", []):
        iid = init.get("id")
        if iid not in ENRICH and iid not in LINK_RULES:
            continue
        patch = deepcopy(ENRICH.get(iid, {}))
        # Apply text/status/timing/notes/scores
        for k, v in patch.items():
            if k == "catalystScore":
                init[k] = v
            elif v is not None:
                init[k] = v
        # deliveryCertainty fallback
        init["deliveryCertainty"] = certainty_from_status(
            init.get("status", ""), patch.get("deliveryCertainty")
        )
        # Linked communities via area-name match
        needles = LINK_RULES.get(iid, [])
        if needles:
            items, counts = match_linked(needles, by_area, community_names)
            init["linkedCommunities"] = items
            init["linkedProjectCounts"] = counts
        elif "linkedCommunities" not in init:
            init["linkedCommunities"] = []
            init["linkedProjectCounts"] = {"total": 0, "byCommunity": {}}
        # Ensure enrichment keys exist for UI
        for key in ("accessibilityNote", "demandNote", "supplyRiskNote", "researchNotes"):
            init.setdefault(key, "")
        if "officialSourceUrl" not in init:
            init["officialSourceUrl"] = None
        if "catalystScore" not in init and iid in ENRICH:
            init["catalystScore"] = ENRICH[iid]["catalystScore"]
        touched.append(iid)
    # meta stamp
    meta = data.setdefault("meta", {})
    meta["initiativesEnrichedAt"] = ASOF
    meta["initiativesEnrichment"] = {
        "asOf": ASOF,
        "catalystScoreScale": "0-100 per dimension; supplyRisk higher = more risk",
        "deliveryCertaintyOrder": ["construction", "procurement", "announced", "strategy"],
        "linkingMethod": "area-name match from map-data projects/communities — never geo-distance from strategy markers",
        "enrichedCount": len(touched),
    }
    return data, touched


def sync_core_initiatives(core: dict, full: dict) -> int:
    """If map-core embeds initiatives, sync enrichment fields by id."""
    full_by_id = {i["id"]: i for i in full.get("initiatives", []) if i.get("id")}
    n = 0
    for init in core.get("initiatives", []) or []:
        src = full_by_id.get(init.get("id"))
        if not src:
            continue
        for k in (
            "summary", "status", "timing", "deliveryCertainty",
            "linkedCommunities", "linkedProjectCounts",
            "accessibilityNote", "demandNote", "supplyRiskNote",
            "researchNotes", "officialSourceUrl", "catalystScore",
        ):
            if k in src:
                init[k] = src[k]
                n += 1
    if "meta" in core and "meta" in full:
        for k in ("initiativesEnrichedAt", "initiativesEnrichment"):
            if k in full["meta"]:
                core["meta"][k] = full["meta"][k]
    return n


def main():
    data = json.loads(MAP.read_text())
    data, touched = apply(data)
    MAP.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    core_n = 0
    if CORE.exists():
        core = json.loads(CORE.read_text())
        core_n = sync_core_initiatives(core, data)
        CORE.write_text(json.dumps(core, ensure_ascii=False, separators=(",", ":")))
    # write slim enrichment export for review
    slim = [i for i in data["initiatives"] if i["id"] in touched]
    out = ROOT / "data" / "initiatives-enriched-2026-09-22.json"
    out.write_text(json.dumps({"asOf": ASOF, "count": len(slim), "initiatives": slim}, ensure_ascii=False, indent=2))
    print(f"enriched={len(touched)}")
    for t in touched:
        init = next(i for i in data["initiatives"] if i["id"] == t)
        total = (init.get("linkedProjectCounts") or {}).get("total", 0)
        print(f"  {t}: linkedProjects={total} certainty={init.get('deliveryCertainty')} score={init.get('catalystScore')}")
    print(f"core_fields_synced={core_n}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
