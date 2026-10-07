# Transaction snapshot trends, 6 October 2026

These PDFs are user-supplied transaction snapshots, retrieved 6 October 2026. Each page is a sales-performance card plus a property-sales history. Every summary figure below is copied from that card. Every monthly figure is calculated from the sale rows printed in the history. No forward price path is estimated, and no change is treated as a causal price effect.

A re-parse of all 33 files matched the stored packet: 21 distinct files, 20 areas, and 5,651 printed sales once the repeated Downtown Dubai file is counted once. The cards state 62,392 transactions for those unique titles. The other 56,741 sales are not on the pages, so they stay missing. Only Arancia Yards (247) and Nad Al Sheba (4) print every sale named by the card. The completion receipt is `enrichment/transaction-snapshots-20261006/completion.json`.

## How a trend was decided

The card prints one median AED per sqft, one median price, one transaction count, sometimes a rental-yield percent, and year-over-year percents for the first three. It does not print the year-ago absolute levels or the dates of that comparison window. A year-over-year percent is therefore one stated comparison. It is not a monthly path, and the prior level was not back-calculated.

The history is a list of sale rows. Most files stop at 300 rows while the card's transaction count is higher. Those 300-row files are treated as an export ceiling: the oldest printed month is incomplete and is not used as a trend endpoint. October 2026 is the retrieval month. The latest printed sale is on or before 5 October 2026, so October is an open month and is not used as a full-month endpoint. A comparable month needs at least five printed sales and neither of those exclusions. A printed-history trend is the change in the median of the row-level AED-per-sqft figures between the earliest and latest comparable month. Where at least four comparable months exist, the latest four-month change is reported as well.

The monthly median is the median of the printed rows. It is not a substitute for the card median, and the card does not print a monthly median. Where the printed row count equals the card's transaction count, the print is the whole counted set. Where the card count is higher, monthly volumes are not market volumes.

Months inside the printed date span with no row are listed as not in the extract. They are not filled with zeros or estimates. A month with fewer than 5 printed sales is sparse and is not a trend endpoint. If the share of the leading property type shifts by more than 15 percentage points between the first and last comparable month, the all-rows series is mix-shifted and is not used as the price trend. The reported printed trend then stays inside the dominant ready/off-plan and apartment/villa slice when that slice has two comparable months.

Rental yield is used only where the card prints a percent. No row prints a rent. Yield has no year-over-year figure, so a yield is a level.

Ranks stay inside one metric. Median AED-per-sqft year-over-year is ranked separately from median-price year-over-year and from transaction-count year-over-year. Printed monthly changes are ranked only inside the same segment label. Areas whose card shows the unit-rate year-over-year and the ticket-price year-over-year moving in opposite directions are not collapsed into one price direction.

## Sources

33 uploaded files, 21 distinct SHA-256 values, 20 areas. Identical bytes are one source. Downtown Dubai is the only repeated title whose bytes differ.

| Area | SHA-256 | Files | Printed rows | Card transactions |
| --- | --- | --- | ---: | ---: |
| Jebel Ali | `5345620bc6b5…` | `Jebel_Ali_5509.pdf`, `Jebel_Ali_c6d6.pdf`, `Jebel_Ali_fc28.pdf` | 300 | 1,316 |
| Arancia Yards By Beyond (All Buildings), City of Arabia | `c937d42007c2…` | `Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_0b18.pdf`, `Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_5e9e.pdf`, `Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf` | 247 | 247 |
| Emaar Beachfront, Dubai Harbour | `41909a0c9c7d…` | `Emaar_Beachfront__Dubai_Harbour_3ded.pdf`, `Emaar_Beachfront__Dubai_Harbour_8662.pdf`, `Emaar_Beachfront__Dubai_Harbour_9bd8.pdf` | 300 | 406 |
| Town Square, Al Yelayiss 2 | `aff0399cfe2c…` | `Town_Square__Al_Yelayiss_2_2f80.pdf` | 300 | 2,088 |
| Sobha Hartland, Al Merkadh | `847befa2cfd9…` | `Sobha_Hartland__Al_Merkadh_829b.pdf` | 300 | 1,148 |
| The Oasis (All Phases), Me'Aisem Second | `2df0f12c1c5d…` | `The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf` | 300 | 656 |
| Damac Hills, Al Hebiah Third | `25bec41745dc…` | `Damac_Hills__Al_Hebiah_Third_ed43.pdf` | 300 | 1,909 |
| Dubai Hills Estate | `3e77df5586eb…` | `Dubai_Hills_Estate_acbf.pdf` | 300 | 2,022 |
| Dubai Marina, Marsa Dubai | `e0532b8caa54…` | `Dubai_Marina__Marsa_Dubai_5a24.pdf` | 300 | 2,350 |
| Jumeirah Village Circle (JVC) | `ec68a8a5c0fe…` | `Jumeirah_Village_Circle__JVC__b203.pdf` | 300 | 12,300 |
| Business Bay | `85a207e4370b…` | `Business_Bay_4e00.pdf` | 300 | 8,216 |
| Dubai Creek Harbour | `a9a83cd09cc6…` | `Dubai_Creek_Harbour_638f.pdf` | 300 | 3,960 |
| Dubai South | `a8d1918308e5…` | `Dubai_South_bda4.pdf` | 300 | 16,260 |
| Palm Jebel Ali | `a853bb6ec80d…` | `Palm_Jebel_Ali_8316.pdf` | 300 | 723 |
| Downtown Dubai | `3881bc011100…` | `Downtown_Dubai_1287.pdf`, `Downtown_Dubai_2f6c.pdf` | 300 | 2,861 |
| Downtown Dubai | `0cdcbe94f780…` | `Downtown_Dubai_e760.pdf` | 300 | 2,861 |
| Tilal Al Ghaf, Al Hebiah Fourth | `5f6ce358b7ed…` | `Tilal_Al_Ghaf__Al_Hebiah_Fourth_7989.pdf`, `Tilal_Al_Ghaf__Al_Hebiah_Fourth_7ab7.pdf` | 300 | 383 |
| Nad Al Sheba | `ed884137bb40…` | `Nad_Al_Sheba_8475.pdf`, `Nad_Al_Sheba_a706.pdf` | 4 | 4 |
| Rashid Yachts And Marina, Mina Rashid | `c4ed0bb76589…` | `Rashid_Yachts_And_Marina__Mina_Rashid_2231.pdf`, `Rashid_Yachts_And_Marina__Mina_Rashid_30d8.pdf` | 300 | 482 |
| Dubai Investment Park First | `f08d928ac056…` | `Dubai_Investment_Park_First_45ae.pdf`, `Dubai_Investment_Park_First_9a52.pdf` | 300 | 2,141 |
| Dubai Land Residence Complex, Wadi Al Safa 5 | `e964fcb0e863…` | `Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_3fc2.pdf`, `Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_9f4a.pdf` | 300 | 2,920 |

Downtown Dubai files `Downtown_Dubai_1287.pdf` and `Downtown_Dubai_e760.pdf` have different SHA-256 values (`3881bc011100…` and `0cdcbe94f780…`). The difference is PDF creation metadata: creation stamps Tue Oct  6 00:54:05 2026 UTC and Tue Oct  6 00:43:36 2026 UTC. The extracted card and every sale field match (`7e8df094fb37…`). There is no numeric conflict to average. Both files stay in the packet. One series is shown because the two extracts are the same observations, not because the figures were blended.

Other repeated uploads (Jebel Ali, Arancia Yards, Emaar Beachfront, plus extra copies of Tilal Al Ghaf, Nad Al Sheba, Rashid Yachts, Dubai Investment Park First, and Dubai Land Residence Complex) share a SHA-256 with the file already listed. They are the same source.

## Cross-area comparison

### Stated median AED per sqft, year over year

Same card metric. The window dates are not printed. The sample is the card's transaction count, which is not the same thing as the 300 printed rows.

| Area | Level (AED/sqft) | YoY | Direction | Card transactions | Printed mix |
| --- | ---: | ---: | --- | ---: | --- |
| Nad Al Sheba | 3,060 | +132% | rose | 4 | Apartment 4 |
| Jebel Ali | 1,770 | +73% | rose | 1,316 | Apartment 270, Office 24, Plot 3, Shop 3 |
| Palm Jebel Ali | 3,460 | +32% | rose | 723 | Apartment 203, Plot 10, Villa 87 |
| Damac Hills, Al Hebiah Third | 1,730 | +20% | rose | 1,909 | Apartment 259, Plot 1, Villa 40 |
| Town Square, Al Yelayiss 2 | 1,500 | +11% | rose | 2,088 | Apartment 247, Townhouse 2, Villa 51 |
| Dubai South | 1,640 | +10% | rose | 16,260 | Apartment 271, Townhouse 1, Villa 28 |
| Downtown Dubai | 3,080 | +9% | rose | 2,861 | Apartment 294, Building 1, Office 2, Shop 3 |
| Dubai Creek Harbour | 2,560 | +6% | rose | 3,960 | Apartment 300 |
| Business Bay | 2,500 | +5% | rose | 8,216 | Apartment 239, Office 56, Shop 5 |
| Dubai Land Residence Complex, Wadi Al Safa 5 | 1,300 | +5% | rose | 2,920 | Apartment 291, Office 1, Shop 8 |
| The Oasis (All Phases), Me'Aisem Second | 2,070 | +5% | rose | 656 | Villa 300 |
| Tilal Al Ghaf, Al Hebiah Fourth | 2,000 | +5% | rose | 383 | Villa 300 |
| Jumeirah Village Circle (JVC) | 1,490 | +4% | rose | 12,300 | Apartment 289, Office 2, Plot 3, Shop 3, Townhouse 1, Villa 2 |
| Rashid Yachts And Marina, Mina Rashid | 2,790 | +2% | rose | 482 | Apartment 300 |
| Dubai Investment Park First | 890 | +1% | rose | 2,141 | Apartment 184, Office 6, Plot 3, Villa 107 |
| Arancia Yards By Beyond (All Buildings), City of Arabia | 1,730 | 0% | flat | 247 | Apartment 247 |
| Dubai Hills Estate | 2,360 | 0% | flat | 2,022 | Apartment 255, Plot 1, Shop 2, Townhouse 1, Villa 41 |
| Sobha Hartland, Al Merkadh | 2,010 | -1% | fell | 1,148 | Apartment 282, Plot 9, Shop 1, Villa 8 |
| Dubai Marina, Marsa Dubai | 2,020 | -12% | fell | 2,350 | Apartment 292, Office 1, Shop 7 |
| Emaar Beachfront, Dubai Harbour | 3,560 | -13% | fell | 406 | Apartment 300 |

### Stated median price, year over year

Same card metric, ticket size rather than unit rate. Do not read this rank as the unit-rate rank.

| Area | Median price (AED) | YoY | Direction | Card transactions |
| --- | ---: | ---: | --- | ---: |
| Business Bay | 2,195,000 | +37% | rose | 8,216 |
| Town Square, Al Yelayiss 2 | 1,433,000 | +8% | rose | 2,088 |
| Dubai Land Residence Complex, Wadi Al Safa 5 | 800,000 | +7% | rose | 2,920 |
| Dubai Creek Harbour | 2,660,000 | +6% | rose | 3,960 |
| Dubai Hills Estate | 2,350,000 | +6% | rose | 2,022 |
| Jumeirah Village Circle (JVC) | 1,040,000 | +5% | rose | 12,300 |
| Sobha Hartland, Al Merkadh | 1,720,000 | +4% | rose | 1,148 |
| The Oasis (All Phases), Me'Aisem Second | 15,832,000 | +2% | rose | 656 |
| Arancia Yards By Beyond (All Buildings), City of Arabia | 1,305,000 | 0% | flat | 247 |
| Downtown Dubai | 3,000,000 | -2% | fell | 2,861 |
| Dubai Marina, Marsa Dubai | 2,000,000 | -2% | fell | 2,350 |
| Damac Hills, Al Hebiah Third | 1,308,000 | -4% | fell | 1,909 |
| Tilal Al Ghaf, Al Hebiah Fourth | 7,575,000 | -4% | fell | 383 |
| Rashid Yachts And Marina, Mina Rashid | 2,406,000 | -10% | fell | 482 |
| Dubai Investment Park First | 980,000 | -18% | fell | 2,141 |
| Emaar Beachfront, Dubai Harbour | 4,062,000 | -23% | fell | 406 |
| Dubai South | 1,050,000 | -35% | fell | 16,260 |
| Palm Jebel Ali | 7,885,000 | -63% | fell | 723 |
| Jebel Ali | 766,000 | -98% | fell | 1,316 |
| Nad Al Sheba | 4,280,000 | -99% | fell | 4 |

### Where the two price metrics disagree

On these cards the unit-rate year-over-year and the ticket-price year-over-year move in opposite directions. Both percents stay as printed. A printed monthly path, where the history has one, is a different comparison and is not used to replace either card percent.

| Area | AED/sqft YoY | Median price YoY | Card transactions | Printed monthly path |
| --- | ---: | ---: | ---: | --- |
| Jebel Ali | +73% | -98% | 1,316 | no two comparable printed months |
| Sobha Hartland, Al Merkadh | -1% | +4% | 1,148 | rose +2.9% on median AED per sqft of printed Ready Apartment, 2026-07 to 2026-09 |
| Damac Hills, Al Hebiah Third | +20% | -4% | 1,909 | no two comparable printed months |
| Dubai South | +10% | -35% | 16,260 | no two comparable printed months |
| Palm Jebel Ali | +32% | -63% | 723 | fell -0.7% on median AED per sqft of printed Apartment, 2026-07 to 2026-09 |
| Downtown Dubai | +9% | -2% | 2,861 | no two comparable printed months |
| Tilal Al Ghaf, Al Hebiah Fourth | +5% | -4% | 383 | Ready Villa rose +15.9% (2026-01 to 2026-09); Offplan Villa fell -5.5% (2026-01 to 2026-09) |
| Nad Al Sheba | +132% | -99% | 4 | no two comparable printed months |
| Rashid Yachts And Marina, Mina Rashid | +2% | -10% | 482 | fell -33.3% on median AED per sqft of printed Offplan Apartment, 2025-12 to 2026-09 |
| Dubai Investment Park First | +1% | -18% | 2,141 | no two comparable printed months |

### Stated transaction-count year over year

Volume only. Arancia Yards prints no transaction year-over-year percent, so it is not in this rank. Jebel Ali prints +10867% and does not print the base count, so that percent cannot be recomputed from this packet.

| Area | Card transactions | YoY | Direction |
| --- | ---: | ---: | --- |
| Jebel Ali | 1,316 | +10867% | rose |
| Dubai Investment Park First | 2,141 | +348% | rose |
| Nad Al Sheba | 4 | +300% | rose |
| Dubai South | 16,260 | +64% | rose |
| Damac Hills, Al Hebiah Third | 1,909 | +16% | rose |
| Palm Jebel Ali | 723 | +14% | rose |
| Dubai Creek Harbour | 3,960 | +10% | rose |
| Sobha Hartland, Al Merkadh | 1,148 | -6% | fell |
| Tilal Al Ghaf, Al Hebiah Fourth | 383 | -21% | fell |
| Town Square, Al Yelayiss 2 | 2,088 | -22% | fell |
| Downtown Dubai | 2,861 | -27% | fell |
| Jumeirah Village Circle (JVC) | 12,300 | -35% | fell |
| Business Bay | 8,216 | -40% | fell |
| The Oasis (All Phases), Me'Aisem Second | 656 | -41% | fell |
| Dubai Land Residence Complex, Wadi Al Safa 5 | 2,920 | -51% | fell |
| Emaar Beachfront, Dubai Harbour | 406 | -53% | fell |
| Dubai Hills Estate | 2,022 | -56% | fell |
| Dubai Marina, Marsa Dubai | 2,350 | -56% | fell |
| Rashid Yachts And Marina, Mina Rashid | 482 | -62% | fell |

### Printed monthly AED per sqft, same segment only

Endpoint change from the earliest comparable printed month to the latest. Ranked only inside one segment. A single snapshot month is not in this table.

**Apartment**

| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Town Square, Al Yelayiss 2 | 2026-08 | 2026-09 | +3.5% | rose | 2 | fewer than four comparable months | no |
| Palm Jebel Ali | 2026-07 | 2026-09 | -0.7% | fell | 3 | fewer than four comparable months | yes |

**Offplan Apartment**

| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Arancia Yards By Beyond (All Buildings), City of Arabia | 2026-06 | 2026-09 | -2.9% | fell | 4 | 2026-06 to 2026-09: -2.9% (fell) | yes |
| Rashid Yachts And Marina, Mina Rashid | 2025-12 | 2026-09 | -33.3% | fell | 10 | 2026-06 to 2026-09: -4.3% (fell) | yes |

**Offplan Villa**

| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Tilal Al Ghaf, Al Hebiah Fourth | 2026-01 | 2026-09 | -5.5% | fell | 9 | 2026-06 to 2026-09: +4.3% (rose) | yes |
| The Oasis (All Phases), Me'Aisem Second | 2026-02 | 2026-09 | -7.3% | fell | 8 | 2026-06 to 2026-09: -5.2% (fell) | yes |

**Ready Apartment**

| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Sobha Hartland, Al Merkadh | 2026-07 | 2026-09 | +2.9% | rose | 3 | fewer than four comparable months | yes |
| Emaar Beachfront, Dubai Harbour | 2026-01 | 2026-09 | -7.3% | fell | 9 | 2026-06 to 2026-09: -2.6% (fell) | yes |

**Ready Villa**

| Area | From | To | Median AED/sqft change | Direction | Comparable months | Latest four-month change | Path reversed |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| Tilal Al Ghaf, Al Hebiah Fourth | 2026-01 | 2026-09 | +15.9% | rose | 9 | 2026-06 to 2026-09: -7.2% (fell) | yes |

## Areas with too little history for a price trend

A price trend here means either two comparable printed months in one segment, or a card whose AED-per-sqft year-over-year and median-price year-over-year do not point in opposite directions. A card with a large transaction count and one coherent year-over-year percent is a one-step change, not an absence of history. October 2026 alone would be a level.

- **Jebel Ali**. Printed sales run 2026-08-11 to 2026-10-05 (300 rows; card transactions 1,316). The card's AED-per-sqft year-over-year is +73% and its median-price year-over-year is -98%, so the two price metrics do not share a direction. Comparable printed months: 1.
- **Damac Hills, Al Hebiah Third**. Printed sales run 2026-08-06 to 2026-10-05 (300 rows; card transactions 1,909). The card's AED-per-sqft year-over-year is +20% and its median-price year-over-year is -4%, so the two price metrics do not share a direction. Comparable printed months: 1.
- **Dubai South**. Printed sales run 2026-09-21 to 2026-10-05 (300 rows; card transactions 16,260). The card's AED-per-sqft year-over-year is +10% and its median-price year-over-year is -35%, so the two price metrics do not share a direction. Comparable printed months: 0.
- **Downtown Dubai**. Printed sales run 2026-08-11 to 2026-10-05 (300 rows; card transactions 2,861). The card's AED-per-sqft year-over-year is +9% and its median-price year-over-year is -2%, so the two price metrics do not share a direction. Comparable printed months: 1.
- **Nad Al Sheba**. Printed sales run 2026-09-09 to 2026-09-23 (4 rows; card transactions 4). The card's AED-per-sqft year-over-year is +132% and its median-price year-over-year is -99%, so the two price metrics do not share a direction. Comparable printed months: 0.
- **Dubai Investment Park First**. Printed sales run 2026-09-04 to 2026-10-02 (300 rows; card transactions 2,141). The card's AED-per-sqft year-over-year is +1% and its median-price year-over-year is -18%, so the two price metrics do not share a direction. Comparable printed months: 0.

## Area evidence

### Jebel Ali

Scope: area/community transaction context. Catalogue: Jebel Ali (exact).

Printed coverage: 2026-08-11 to 2026-10-05. Card median AED/sqft 1,770 (+73% year over year). Card median price AED 766,000 (-98% year over year). Card transactions 1,316 (+10867% year over year). Rental yield not printed.

Printed mix: Offplan 297, Ready 3. Types: Apartment 270, Office 24, Plot 3, Shop 3. Beds: 1 Bed 71, 2 Beds 9, 3 Beds 2, Studio 184, not printed 34. Seller class: Developer 298, Individual 2. Distinct location strings 8 (206 truncated by the page).

Capital-gain percent printed beside the price on 2 rows (median of those percents -14%). 298 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 1,316 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 195 | export_truncated | 1,772 | 729,530 | 3 | 192 | 173 | 0 |
| 2026-09 | 92 | comparable | 1,761.5 | 718,715 | 0 | 92 | 86 | 0 |
| 2026-10 | 13 | open_retrieval_month | 1,802 | 766,867 | 0 | 13 | 11 | 0 |

No single price trend. The card prints median AED/sqft +73% and median price -98%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not in this print: Villa.

Not used as this series: Downtown Jebel Ali (`community:Dubai:downtown-jebel-ali`). Separate catalogue community. Some printed locations name Downtown Jebel Ali projects; the snapshot title is Jebel Ali, so the series stays the area print.
Not used as this series: Jebel Ali Village (`community:Dubai:jebel-ali-village`). Separate catalogue community. Not the snapshot title.

Rows whose printed location contains “Downtown Jebel Ali”: 91 of 300.

### Arancia Yards By Beyond (All Buildings), City of Arabia

Scope: named project transactions. Catalogue: City of Arabia (exact_project_in_community).

The title names one project, all buildings, and the printed rows are that project's buildings. City of Arabia is the parent community, not a community-wide transaction set.

Catalogue project `project:arancia-yards-beyond-city-of-arabia-dubai` (Arancia Yards) in `community:Dubai:city-of-arabia`.

Printed coverage: 2026-06-29 to 2026-09-25. Card median AED/sqft 1,730 (0% year over year). Card median price AED 1,305,000 (0% year over year). Card transactions 247 (not printed year over year). Rental yield not printed.

Printed mix: Offplan 247. Types: Apartment 247. Beds: 1 Bed 181, 2 Beds 60, 3 Beds 6. Seller class: Developer 247, Individual 0. Distinct location strings 3 (247 truncated by the page).

Capital-gain percent printed beside the price on 0 rows (median of those percents n/a). 247 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The print has 247 rows and the card counts 247 transactions. For this file the counted set and the printed rows are the same size.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06 | 8 | comparable | 1,784 | 1,336,500 | 0 | 8 | 8 | 0 |
| 2026-07 | 37 | comparable | 1,660 | 1,305,000 | 0 | 37 | 37 | 0 |
| 2026-08 | 168 | comparable | 1,736.5 | 1,284,500 | 0 | 168 | 168 | 0 |
| 2026-09 | 34 | comparable | 1,733 | 1,310,500 | 0 | 34 | 34 | 0 |

Printed trend, median AED per sqft of printed Offplan Apartment: fell -2.9% from 2026-06 to 2026-09 (4 comparable months). Ticket-price median in the same rows fell -1.9%. Latest four comparable months, 2026-06 to 2026-09: median AED/sqft -2.9% (fell). The comparable-month path reversed inside the window.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft fell -2.9% from 2026-06 to 2026-09 (4 months, 8 then 34 printed sales).
- Offplan: median AED/sqft fell -2.9% from 2026-06 to 2026-09 (4 months, 8 then 34 printed sales).
- Offplan Apartment: median AED/sqft fell -2.9% from 2026-06 to 2026-09 (4 months, 8 then 34 printed sales).

Not in this print: Ready, Villa.


Rows whose printed location contains “Arancia Yards By Beyond”: 247 of 247.

### Emaar Beachfront, Dubai Harbour

Scope: area/community transaction context. Catalogue: Emaar Beachfront (exact).

Printed coverage: 2025-12-19 to 2026-10-05. Card median AED/sqft 3,560 (-13% year over year). Card median price AED 4,062,000 (-23% year over year). Card transactions 406 (-53% year over year). Rental yield +7%.

Printed mix: Offplan 41, Ready 259. Types: Apartment 300. Beds: 1 Bed 122, 2 Beds 103, 3 Beds 60, 4 Beds 15. Seller class: Developer 9, Individual 291. Distinct location strings 23 (300 truncated by the page).

Capital-gain percent printed beside the price on 237 rows (median of those percents +19%). 63 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 406 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-12 | 17 | export_truncated | 3,617 | 3,900,000 | 17 | 0 | 17 | 0 |
| 2026-01 | 46 | comparable | 3,872.5 | 4,150,000 | 38 | 8 | 46 | 0 |
| 2026-02 | 62 | comparable | 3,519.5 | 3,800,000 | 55 | 7 | 62 | 0 |
| 2026-03 | 15 | comparable | 3,947 | 4,950,000 | 15 | 0 | 15 | 0 |
| 2026-04 | 24 | comparable | 3,507 | 3,943,127.5 | 19 | 5 | 24 | 0 |
| 2026-05 | 24 | comparable | 3,648.5 | 3,863,629 | 21 | 3 | 24 | 0 |
| 2026-06 | 30 | comparable | 3,562 | 4,125,000 | 25 | 5 | 30 | 0 |
| 2026-07 | 32 | comparable | 3,486 | 4,012,444 | 24 | 8 | 32 | 0 |
| 2026-08 | 21 | comparable | 3,375 | 4,000,000 | 18 | 3 | 21 | 0 |
| 2026-09 | 25 | comparable | 3,165 | 3,600,000 | 23 | 2 | 25 | 0 |
| 2026-10 | 4 | sparse, open_retrieval_month | 3,255.5 | 7,000,000 | 4 | 0 | 4 | 0 |

Printed trend, median AED per sqft of printed Ready Apartment: fell -7.3% from 2026-01 to 2026-09 (9 comparable months). Ticket-price median in the same rows fell -0.6%. Latest four comparable months, 2026-06 to 2026-09: median AED/sqft -2.6% (fell). The comparable-month path reversed inside the window.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft fell -18.3% from 2026-01 to 2026-09 (9 months, 46 then 25 printed sales).
- Offplan: median AED/sqft fell -14.2% from 2026-01 to 2026-07 (5 months, 8 then 8 printed sales).
- Offplan Apartment: median AED/sqft fell -14.2% from 2026-01 to 2026-07 (5 months, 8 then 8 printed sales).
- Ready: median AED/sqft fell -7.3% from 2026-01 to 2026-09 (9 months, 38 then 23 printed sales).
- Ready Apartment: median AED/sqft fell -7.3% from 2026-01 to 2026-09 (9 months, 38 then 23 printed sales).

Not in this print: Villa.

Not used as this series: Dubai Harbour (`community:Dubai:dubai-harbour`). Printed locality and a separate catalogue community. The snapshot title leads with Emaar Beachfront, so the series is not reassigned to every Dubai Harbour project.

### Town Square, Al Yelayiss 2

Scope: area/community transaction context. Catalogue: Town Square Dubai (obvious_normalized).

Printed coverage: 2026-07-10 to 2026-10-05. Card median AED/sqft 1,500 (+11% year over year). Card median price AED 1,433,000 (+8% year over year). Card transactions 2,088 (-22% year over year). Rental yield +8%.

Printed mix: Offplan 118, Ready 182. Types: Apartment 247, Townhouse 2, Villa 51. Beds: 1 Bed 73, 2 Beds 137, 3 Beds 65, 4 Beds 16, Studio 9. Seller class: Developer 72, Individual 228. Distinct location strings 62 (0 truncated by the page).

Capital-gain percent printed beside the price on 212 rows (median of those percents +29%). 88 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,088 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-07 | 86 | export_truncated | 1,337.5 | 1,442,500 | 55 | 31 | 71 | 15 |
| 2026-08 | 92 | comparable | 1,383.5 | 1,410,000 | 54 | 38 | 75 | 17 |
| 2026-09 | 109 | comparable | 1,411 | 1,480,000 | 64 | 45 | 91 | 18 |
| 2026-10 | 13 | open_retrieval_month | 1,380 | 1,550,000 | 9 | 4 | 10 | 1 |

Printed trend, median AED per sqft of printed Apartment: rose +3.5% from 2026-08 to 2026-09 (2 comparable months). Ticket-price median in the same rows rose +1.9%. Fewer than four comparable months, so there is no four-period change. The comparable-month path did not reverse.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft rose +3.5% from 2026-08 to 2026-09 (2 months, 75 then 91 printed sales).
- Offplan: median AED/sqft rose +4.5% from 2026-08 to 2026-09 (2 months, 38 then 45 printed sales).
- Offplan Apartment: median AED/sqft rose +4.5% from 2026-08 to 2026-09 (2 months, 38 then 45 printed sales).
- Ready: median AED/sqft rose +0.7% from 2026-08 to 2026-09 (2 months, 54 then 64 printed sales).
- Ready Apartment: median AED/sqft rose +2.8% from 2026-08 to 2026-09 (2 months, 37 then 46 printed sales).
- Ready Villa: median AED/sqft fell -4.2% from 2026-08 to 2026-09 (2 months, 17 then 18 printed sales).
- Villa: median AED/sqft fell -4.2% from 2026-08 to 2026-09 (2 months, 17 then 18 printed sales).

Not used as this series: Al Yalayis 1 (`community:Dubai:al-yalayis-1`). Different locality number and a different catalogue community.

### Sobha Hartland, Al Merkadh

Scope: area/community transaction context. Catalogue: Sobha Hartland (exact).

Al Merkadh is the printed locality. It is not a separate catalogue community in the community-count file.

Printed coverage: 2026-06-19 to 2026-10-02. Card median AED/sqft 2,010 (-1% year over year). Card median price AED 1,720,000 (+4% year over year). Card transactions 1,148 (-6% year over year). Rental yield +7%.

Printed mix: Offplan 32, Ready 268. Types: Apartment 282, Plot 9, Shop 1, Villa 8. Beds: 1 Bed 137, 2 Beds 89, 3 Beds 28, 4 Beds 13, 5 Beds 5, Studio 16, not printed 12. Seller class: Developer 4, Individual 296. Distinct location strings 30 (204 truncated by the page).

Capital-gain percent printed beside the price on 260 rows (median of those percents +8%). 40 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 1,148 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06 | 19 | export_truncated | 2,050 | 1,800,000 | 16 | 3 | 18 | 0 |
| 2026-07 | 97 | comparable | 1,918 | 2,065,828 | 89 | 8 | 91 | 3 |
| 2026-08 | 85 | comparable | 1,887 | 1,510,000 | 79 | 6 | 80 | 2 |
| 2026-09 | 93 | comparable | 1,980 | 1,870,000 | 79 | 14 | 87 | 3 |
| 2026-10 | 6 | open_retrieval_month | 1,990 | 1,130,000 | 5 | 1 | 6 | 0 |

Printed trend, median AED per sqft of printed Ready Apartment: rose +2.9% from 2026-07 to 2026-09 (3 comparable months). Ticket-price median in the same rows fell -7.7%. Fewer than four comparable months, so there is no four-period change. The comparable-month path reversed inside the window. The card's own AED-per-sqft and median-price year-over-year figures point in opposite directions; that card comparison is not the same window as these months.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft rose +3.0% from 2026-07 to 2026-09 (3 months, 91 then 87 printed sales).
- Offplan: median AED/sqft rose +5.6% from 2026-07 to 2026-09 (3 months, 8 then 14 printed sales).
- Offplan Apartment: median AED/sqft rose +5.6% from 2026-07 to 2026-09 (3 months, 8 then 14 printed sales).
- Ready: median AED/sqft rose +3.3% from 2026-07 to 2026-09 (3 months, 89 then 79 printed sales).
- Ready Apartment: median AED/sqft rose +2.9% from 2026-07 to 2026-09 (3 months, 83 then 73 printed sales).

Not used as this series: Sobha Hartland II (`community:Dubai:sobha-hartland-ii`). Separate catalogue community. The snapshot does not say Hartland II.

### The Oasis (All Phases), Me'Aisem Second

Scope: named development transactions. Catalogue: The Oasis (exact).

The title names The Oasis, all phases, in Me'Aisem Second. Me'Aisem Second is not a catalogue community. Rows are Oasis clusters, so this is that development's printed sales, not a locality-wide set.

Printed coverage: 2026-01-29 to 2026-10-02. Card median AED/sqft 2,070 (+5% year over year). Card median price AED 15,832,000 (+2% year over year). Card transactions 656 (-41% year over year). Rental yield not printed.

Printed mix: Offplan 300. Types: Villa 300. Beds: 4 Beds 171, 5 Beds 58, 6 Beds 68, 7 Beds 3. Seller class: Developer 248, Individual 52. Distinct location strings 10 (32 truncated by the page).

Capital-gain percent printed beside the price on 43 rows (median of those percents +8%). 257 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 656 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01 | 11 | export_truncated | 2,092 | 15,183,301 | 0 | 11 | 0 | 11 |
| 2026-02 | 120 | comparable | 2,072 | 15,831,888 | 0 | 120 | 0 | 120 |
| 2026-03 | 63 | comparable | 2,111 | 21,102,241 | 0 | 63 | 0 | 63 |
| 2026-04 | 36 | comparable | 2,095 | 16,629,888 | 0 | 36 | 0 | 36 |
| 2026-05 | 13 | comparable | 2,011 | 14,935,888 | 0 | 13 | 0 | 13 |
| 2026-06 | 17 | comparable | 2,025 | 16,100,000 | 0 | 17 | 0 | 17 |
| 2026-07 | 14 | comparable | 2,112 | 17,716,411 | 0 | 14 | 0 | 14 |
| 2026-08 | 15 | comparable | 1,919 | 13,931,888 | 0 | 15 | 0 | 15 |
| 2026-09 | 8 | comparable | 1,920 | 14,164,944 | 0 | 8 | 0 | 8 |
| 2026-10 | 3 | sparse, open_retrieval_month | 2,102 | 21,627,888 | 0 | 3 | 0 | 3 |

Printed trend, median AED per sqft of printed Offplan Villa: fell -7.3% from 2026-02 to 2026-09 (8 comparable months). Ticket-price median in the same rows fell -10.5%. Latest four comparable months, 2026-06 to 2026-09: median AED/sqft -5.2% (fell). The comparable-month path reversed inside the window. The latest comparable month has 8 printed sales in this segment.

Other printed segment paths with at least two comparable months:

- Offplan: median AED/sqft fell -7.3% from 2026-02 to 2026-09 (8 months, 120 then 8 printed sales).
- Offplan Villa: median AED/sqft fell -7.3% from 2026-02 to 2026-09 (8 months, 120 then 8 printed sales).
- Villa: median AED/sqft fell -7.3% from 2026-02 to 2026-09 (8 months, 120 then 8 printed sales).

Not in this print: Ready, Apartment.


Rows whose printed location contains “The Oasis”: 300 of 300.

### Damac Hills, Al Hebiah Third

Scope: area/community transaction context. Catalogue: DAMAC Hills (obvious_normalized).

Printed coverage: 2026-08-06 to 2026-10-05. Card median AED/sqft 1,730 (+20% year over year). Card median price AED 1,308,000 (-4% year over year). Card transactions 1,909 (+16% year over year). Rental yield +7%.

Printed mix: Offplan 190, Ready 110. Types: Apartment 259, Plot 1, Villa 40. Beds: 1 Bed 156, 2 Beds 31, 3 Beds 21, 4 Beds 12, 5 Beds 10, 6 Beds 2, Studio 65, not printed 3. Seller class: Developer 188, Individual 112. Distinct location strings 49 (1 truncated by the page).

Capital-gain percent printed beside the price on 99 rows (median of those percents +12%). 201 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 1,909 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 126 | export_truncated | 1,782.5 | 1,230,000 | 37 | 89 | 117 | 9 |
| 2026-09 | 139 | comparable | 1,745 | 1,230,720 | 60 | 79 | 112 | 26 |
| 2026-10 | 35 | open_retrieval_month | 1,715 | 1,251,000 | 13 | 22 | 30 | 5 |

No single price trend. The card prints median AED/sqft +20% and median price -4%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not used as this series: DAMAC Hills 2 (`community:Dubai:damac-hills-2`). Separate catalogue community. The snapshot does not say Hills 2.
Not used as this series: Tilal Al Ghaf (`community:Dubai:tilal-al-ghaf`). Shares the Al Hebiah locality family (Fourth, not Third) and is a different snapshot.

### Dubai Hills Estate

Scope: area/community transaction context. Catalogue: Dubai Hills Estate (exact).

Printed coverage: 2026-08-01 to 2026-10-05. Card median AED/sqft 2,360 (0% year over year). Card median price AED 2,350,000 (+6% year over year). Card transactions 2,022 (-56% year over year). Rental yield +7%.

Printed mix: Offplan 75, Ready 225. Types: Apartment 255, Plot 1, Shop 2, Townhouse 1, Villa 41. Beds: 1 Bed 111, 2 Beds 105, 3 Beds 41, 4 Beds 21, 5 Beds 11, 7 Beds 1, Studio 5, not printed 5. Seller class: Developer 15, Individual 285. Distinct location strings 77 (86 truncated by the page).

Capital-gain percent printed beside the price on 240 rows (median of those percents +19%). 60 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,022 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 147 | export_truncated | 2,197 | 2,268,888 | 113 | 34 | 124 | 21 |
| 2026-09 | 135 | comparable | 2,312 | 2,215,000 | 96 | 39 | 116 | 18 |
| 2026-10 | 18 | open_retrieval_month | 2,193.5 | 2,556,444 | 16 | 2 | 15 | 2 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft 0% (flat), median price +6% (rose). The year-ago levels are not printed. This is one comparison, not a path.


### Dubai Marina, Marsa Dubai

Scope: area/community transaction context. Catalogue: Dubai Marina (exact).

Printed coverage: 2026-08-04 to 2026-10-05. Card median AED/sqft 2,020 (-12% year over year). Card median price AED 2,000,000 (-2% year over year). Card transactions 2,350 (-56% year over year). Rental yield +7%.

Printed mix: Offplan 25, Ready 275. Types: Apartment 292, Office 1, Shop 7. Beds: 1 Bed 102, 2 Beds 91, 3 Beds 40, 4 Beds 10, Penthouse 3, Studio 45, not printed 9. Seller class: Developer 9, Individual 291. Distinct location strings 105 (10 truncated by the page).

Capital-gain percent printed beside the price on 268 rows (median of those percents +19%). 32 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,350 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 143 | export_truncated | 1,790 | 1,580,000 | 138 | 5 | 140 | 0 |
| 2026-09 | 137 | comparable | 1,963 | 1,900,000 | 120 | 17 | 133 | 0 |
| 2026-10 | 20 | open_retrieval_month | 1,716 | 2,150,000 | 17 | 3 | 19 | 0 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft -12% (fell), median price -2% (fell). The year-ago levels are not printed. This is one comparison, not a path.

Not in this print: Villa.

Not used as this series: Marina (`community:Dubai:marina`). Shorter catalogue name. The snapshot title is Dubai Marina. Marsa Dubai is the printed locality name, not a second series.

### Jumeirah Village Circle (JVC)

Scope: area/community transaction context. Catalogue: Jumeirah Village Circle (JVC) (exact).

Printed coverage: 2026-09-24 to 2026-10-05. Card median AED/sqft 1,490 (+4% year over year). Card median price AED 1,040,000 (+5% year over year). Card transactions 12,300 (-35% year over year). Rental yield +8%.

Printed mix: Offplan 166, Ready 134. Types: Apartment 289, Office 2, Plot 3, Shop 3, Townhouse 1, Villa 2. Beds: 1 Bed 133, 2 Beds 36, 3 Beds 2, 4 Beds 2, Studio 64, not printed 63. Seller class: Developer 176, Individual 124. Distinct location strings 116 (230 truncated by the page).

Capital-gain percent printed beside the price on 68 rows (median of those percents +10.5%). 232 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 12,300 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 157 | export_truncated | 1,492 | 1,050,000 | 55 | 102 | 149 | 2 |
| 2026-10 | 143 | open_retrieval_month | 1,404 | 842,110 | 79 | 64 | 140 | 0 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft +4% (rose), median price +5% (rose). The year-ago levels are not printed. This is one comparison, not a path.

Not used as this series: Jumeirah Village Circle (`community:Dubai:jumeirah-village-circle`). Second catalogue row with the parenthetical omitted. The print matches the row that includes (JVC). Not a second transaction series.
Not used as this series: JVC (`community:Dubai:jvc`). Third catalogue row. Same place label, not a second series.

### Business Bay

Scope: area/community transaction context. Catalogue: Business Bay (exact).

Printed coverage: 2026-09-14 to 2026-10-05. Card median AED/sqft 2,500 (+5% year over year). Card median price AED 2,195,000 (+37% year over year). Card transactions 8,216 (-40% year over year). Rental yield +7%.

Printed mix: Offplan 99, Ready 201. Types: Apartment 239, Office 56, Shop 5. Beds: 1 Bed 114, 2 Beds 51, 3 Beds 24, 4 Beds 7, Studio 37, not printed 67. Seller class: Developer 96, Individual 204. Distinct location strings 106 (30 truncated by the page).

Capital-gain percent printed beside the price on 175 rows (median of those percents +9%). 125 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 8,216 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 241 | export_truncated | 2,031 | 2,000,000 | 171 | 70 | 192 | 0 |
| 2026-10 | 59 | open_retrieval_month | 2,093 | 2,000,000 | 30 | 29 | 47 | 0 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft +5% (rose), median price +37% (rose). The year-ago levels are not printed. This is one comparison, not a path.

Not in this print: Villa.


### Dubai Creek Harbour

Scope: area/community transaction context. Catalogue: Dubai Creek Harbour (exact).

Printed coverage: 2026-09-08 to 2026-10-05. Card median AED/sqft 2,560 (+6% year over year). Card median price AED 2,660,000 (+6% year over year). Card transactions 3,960 (+10% year over year). Rental yield +7%.

Printed mix: Offplan 222, Ready 78. Types: Apartment 300. Beds: 1 Bed 138, 2 Beds 122, 3 Beds 36, 4 Beds 4. Seller class: Developer 205, Individual 95. Distinct location strings 55 (42 truncated by the page).

Capital-gain percent printed beside the price on 76 rows (median of those percents +17%). 224 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 3,960 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 266 | export_truncated | 2,545 | 2,367,888 | 66 | 200 | 266 | 0 |
| 2026-10 | 34 | open_retrieval_month | 2,451.5 | 2,998,689 | 12 | 22 | 34 | 0 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft +6% (rose), median price +6% (rose). The year-ago levels are not printed. This is one comparison, not a path.

Not in this print: Villa.


### Dubai South

Scope: area/community transaction context. Catalogue: Dubai South (exact).

Printed coverage: 2026-09-21 to 2026-10-05. Card median AED/sqft 1,640 (+10% year over year). Card median price AED 1,050,000 (-35% year over year). Card transactions 16,260 (+64% year over year). Rental yield +8%.

Printed mix: Offplan 262, Ready 38. Types: Apartment 271, Townhouse 1, Villa 28. Beds: 1 Bed 84, 2 Beds 49, 3 Beds 12, 4 Beds 14, 5 Beds 8, Studio 113, not printed 20. Seller class: Developer 254, Individual 46. Distinct location strings 104 (10 truncated by the page).

Capital-gain percent printed beside the price on 30 rows (median of those percents +22%). 270 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 16,260 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 232 | export_truncated | 1,625 | 890,000 | 22 | 210 | 205 | 27 |
| 2026-10 | 68 | open_retrieval_month | 1,437.5 | 900,000 | 16 | 52 | 66 | 1 |

No single price trend. The card prints median AED/sqft +10% and median price -35%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not used as this series: Emaar South (`community:Dubai:emaar-south`). Separate catalogue community inside the wider south district.
Not used as this series: Dubai South Residential District (`community:dubai-south-residential-district`). Separate catalogue row. The snapshot title is Dubai South.

### Palm Jebel Ali

Scope: area/community transaction context. Catalogue: Palm Jebel Ali (exact).

Printed coverage: 2026-04-03 to 2026-10-05. Card median AED/sqft 3,460 (+32% year over year). Card median price AED 7,885,000 (-63% year over year). Card transactions 723 (+14% year over year). Rental yield not printed.

Printed mix: Offplan 288, Ready 12. Types: Apartment 203, Plot 10, Villa 87. Beds: 1 Bed 87, 2 Beds 68, 3 Beds 35, 4 Beds 12, 5 Beds 23, 6 Beds 48, 7 Beds 17, not printed 10. Seller class: Developer 267, Individual 33. Distinct location strings 15 (258 truncated by the page).

Capital-gain percent printed beside the price on 22 rows (median of those percents +6%). 278 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 723 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-04 | 35 | export_truncated | 3,719 | 31,260,000 | 9 | 26 | 0 | 26 |
| 2026-05 | 24 | comparable | 3,781 | 31,162,000 | 0 | 24 | 1 | 23 |
| 2026-06 | 10 | comparable | 2,765.5 | 25,767,500 | 1 | 9 | 0 | 9 |
| 2026-07 | 73 | comparable | 3,593 | 4,991,000 | 0 | 73 | 61 | 12 |
| 2026-08 | 124 | comparable | 3,535.5 | 4,376,500 | 0 | 124 | 117 | 7 |
| 2026-09 | 26 | comparable | 3,455 | 5,179,500 | 0 | 26 | 19 | 7 |
| 2026-10 | 8 | open_retrieval_month | 3,459.5 | 7,737,500 | 2 | 6 | 5 | 3 |

Printed trend, median AED per sqft of printed Apartment: fell -0.7% from 2026-07 to 2026-09 (3 comparable months). Ticket-price median in the same rows fell -2.2%. Fewer than four comparable months, so there is no four-period change. The comparable-month path reversed inside the window. The card's own AED-per-sqft and median-price year-over-year figures point in opposite directions; that card comparison is not the same window as these months.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft fell -0.7% from 2026-07 to 2026-09 (3 months, 61 then 19 printed sales).
- Offplan: median AED/sqft fell -8.6% from 2026-05 to 2026-09 (5 months, 24 then 26 printed sales).
- Offplan Apartment: median AED/sqft fell -0.7% from 2026-07 to 2026-09 (3 months, 61 then 19 printed sales).
- Offplan Villa: median AED/sqft fell -30.1% from 2026-05 to 2026-09 (5 months, 23 then 7 printed sales).
- Villa: median AED/sqft fell -30.1% from 2026-05 to 2026-09 (5 months, 23 then 7 printed sales).

All printed rows together move -8.6% in median AED/sqft from 2026-05 to 2026-09, and the Apartment share shifts by more than 15 percentage points. That all-rows figure is kept as a mixed series and is not the ranked price trend.

Not used as this series: Jebel Ali (`community:Dubai:jebel-ali`). Different snapshot and a different catalogue community.

### Downtown Dubai

Scope: area/community transaction context. Catalogue: Downtown Dubai (exact).

Printed coverage: 2026-08-11 to 2026-10-05. Card median AED/sqft 3,080 (+9% year over year). Card median price AED 3,000,000 (-2% year over year). Card transactions 2,861 (-27% year over year). Rental yield +7%.

Printed mix: Offplan 60, Ready 240. Types: Apartment 294, Building 1, Office 2, Shop 3. Beds: 1 Bed 91, 2 Beds 134, 3 Beds 42, 4 Beds 10, Studio 17, not printed 6. Seller class: Developer 39, Individual 261. Distinct location strings 94 (88 truncated by the page).

Capital-gain percent printed beside the price on 234 rows (median of those percents +19%). 66 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,861 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 102 | export_truncated | 2,777.5 | 3,400,000 | 82 | 20 | 101 | 0 |
| 2026-09 | 171 | comparable | 2,850 | 3,120,000 | 136 | 35 | 166 | 0 |
| 2026-10 | 27 | open_retrieval_month | 2,482 | 3,100,000 | 22 | 5 | 27 | 0 |

No single price trend. The card prints median AED/sqft +9% and median price -2%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not in this print: Villa.


### Tilal Al Ghaf, Al Hebiah Fourth

Scope: area/community transaction context. Catalogue: Tilal Al Ghaf (exact).

Printed coverage: 2025-12-05 to 2026-10-05. Card median AED/sqft 2,000 (+5% year over year). Card median price AED 7,575,000 (-4% year over year). Card transactions 383 (-21% year over year). Rental yield +10%.

Printed mix: Offplan 181, Ready 119. Types: Villa 300. Beds: 3 Beds 60, 4 Beds 136, 5 Beds 86, 6 Beds 15, 7 Beds 2, 8 Beds 1. Seller class: Developer 6, Individual 294. Distinct location strings 11 (0 truncated by the page).

Capital-gain percent printed beside the price on 279 rows (median of those percents +51%). 21 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 383 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-12 | 44 | export_truncated | 1,999.5 | 6,787,500 | 15 | 29 | 0 | 44 |
| 2026-01 | 32 | comparable | 2,087.5 | 8,325,000 | 13 | 19 | 0 | 32 |
| 2026-02 | 36 | comparable | 1,935 | 7,712,500 | 11 | 25 | 0 | 36 |
| 2026-03 | 27 | comparable | 2,015 | 4,999,000 | 11 | 16 | 0 | 27 |
| 2026-04 | 22 | comparable | 1,888 | 5,850,000 | 7 | 15 | 0 | 22 |
| 2026-05 | 17 | comparable | 1,891 | 7,000,000 | 9 | 8 | 0 | 17 |
| 2026-06 | 23 | comparable | 2,110 | 9,000,000 | 10 | 13 | 0 | 23 |
| 2026-07 | 33 | comparable | 1,849 | 5,500,000 | 17 | 16 | 0 | 33 |
| 2026-08 | 29 | comparable | 1,849 | 7,800,000 | 14 | 15 | 0 | 29 |
| 2026-09 | 30 | comparable | 2,088 | 12,125,000 | 9 | 21 | 0 | 30 |
| 2026-10 | 7 | open_retrieval_month | 1,881 | 11,275,000 | 3 | 4 | 0 | 7 |

Printed trend is split. median AED per sqft of printed villas, ready and off-plan kept apart. The two sides are not averaged.
- Ready Villa: rose +15.9% from 2026-01 to 2026-09 (9 months, 13 then 9 printed sales; latest four months 2026-06 to 2026-09 -7.2% (fell); path reversed: yes).
- Offplan Villa: fell -5.5% from 2026-01 to 2026-09 (9 months, 19 then 21 printed sales; latest four months 2026-06 to 2026-09 +4.3% (rose); path reversed: yes).
The card's AED-per-sqft and median-price year-over-year figures also point in opposite directions. That is a separate comparison.

Other printed segment paths with at least two comparable months:

- Offplan: median AED/sqft fell -5.5% from 2026-01 to 2026-09 (9 months, 19 then 21 printed sales).
- Offplan Villa: median AED/sqft fell -5.5% from 2026-01 to 2026-09 (9 months, 19 then 21 printed sales).
- Ready: median AED/sqft rose +15.9% from 2026-01 to 2026-09 (9 months, 13 then 9 printed sales).
- Ready Villa: median AED/sqft rose +15.9% from 2026-01 to 2026-09 (9 months, 13 then 9 printed sales).
- Villa: median AED/sqft flat +0.0% from 2026-01 to 2026-09 (9 months, 32 then 30 printed sales).

Not in this print: Apartment.

Not used as this series: DAMAC Hills (`community:Dubai:damac-hills`). Al Hebiah Third is a different snapshot. Not combined with Al Hebiah Fourth.

### Nad Al Sheba

Scope: area/community transaction context. Catalogue: Nad Al Sheba (exact).

The area card is Nad Al Sheba. The printed rows in this file all name Vision Iconic. That is the composition of a four-row extract, not a reason to relabel the card as a project-wide history for other Nad Al Sheba projects.

Printed coverage: 2026-09-09 to 2026-09-23. Card median AED/sqft 3,060 (+132% year over year). Card median price AED 4,280,000 (-99% year over year). Card transactions 4 (+300% year over year). Rental yield not printed.

Printed mix: Offplan 4. Types: Apartment 4. Beds: 1 Bed 1, 2 Beds 2, 3 Beds 1. Seller class: Developer 4, Individual 0. Distinct location strings 1 (0 truncated by the page).

Capital-gain percent printed beside the price on 0 rows (median of those percents n/a). 4 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The print has 4 rows and the card counts 4 transactions. For this file the counted set and the printed rows are the same size.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 4 | sparse | 3,060.5 | 4,280,350 | 0 | 4 | 4 | 0 |

No single price trend. The card prints median AED/sqft +132% and median price -99%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not in this print: Ready, Villa.

Not used as this series: Nad Al Sheba Gardens (`community:Dubai:nad-al-sheba-gardens`). Separate catalogue community. The snapshot title does not say Gardens.

Rows whose printed location contains “Vision Iconic”: 4 of 4.

### Rashid Yachts And Marina, Mina Rashid

Scope: area/community transaction context. Catalogue: Rashid Yachts & Marina (obvious_normalized).

Printed coverage: 2025-11-25 to 2026-09-29. Card median AED/sqft 2,790 (+2% year over year). Card median price AED 2,406,000 (-10% year over year). Card transactions 482 (-62% year over year). Rental yield +5%.

Printed mix: Offplan 275, Ready 25. Types: Apartment 300. Beds: 1 Bed 131, 2 Beds 119, 3 Beds 49, 4 Beds 1. Seller class: Developer 170, Individual 130. Distinct location strings 32 (0 truncated by the page).

Capital-gain percent printed beside the price on 79 rows (median of those percents +8%). 221 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 482 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-11 | 19 | export_truncated | 2,901 | 2,415,888 | 0 | 19 | 19 | 0 |
| 2025-12 | 60 | comparable | 2,865.5 | 3,226,888 | 5 | 55 | 60 | 0 |
| 2026-01 | 47 | comparable | 2,725 | 3,321,339 | 2 | 45 | 47 | 0 |
| 2026-02 | 29 | comparable | 2,560 | 2,308,888 | 3 | 26 | 29 | 0 |
| 2026-03 | 33 | comparable | 2,416 | 2,580,888 | 2 | 31 | 33 | 0 |
| 2026-04 | 51 | comparable | 2,809 | 2,293,888 | 1 | 50 | 51 | 0 |
| 2026-05 | 16 | comparable | 2,222 | 2,342,944 | 1 | 15 | 16 | 0 |
| 2026-06 | 8 | comparable | 2,077 | 2,513,883 | 3 | 5 | 8 | 0 |
| 2026-07 | 14 | comparable | 2,203.5 | 2,276,388 | 2 | 12 | 14 | 0 |
| 2026-08 | 11 | comparable | 1,833 | 1,780,888 | 2 | 9 | 11 | 0 |
| 2026-09 | 12 | comparable | 1,950.5 | 2,700,000 | 4 | 8 | 12 | 0 |

Printed trend, median AED per sqft of printed Offplan Apartment: fell -33.3% from 2025-12 to 2026-09 (10 comparable months). Ticket-price median in the same rows fell -6.1%. Latest four comparable months, 2026-06 to 2026-09: median AED/sqft -4.3% (fell). The comparable-month path reversed inside the window. The latest comparable month has 8 printed sales in this segment. The card's own AED-per-sqft and median-price year-over-year figures point in opposite directions; that card comparison is not the same window as these months.

Other printed segment paths with at least two comparable months:

- Apartment: median AED/sqft fell -31.9% from 2025-12 to 2026-09 (10 months, 60 then 12 printed sales).
- Offplan: median AED/sqft fell -33.3% from 2025-12 to 2026-09 (10 months, 55 then 8 printed sales).
- Offplan Apartment: median AED/sqft fell -33.3% from 2025-12 to 2026-09 (10 months, 55 then 8 printed sales).

Not in this print: Villa.

Not used as this series: Mina Rashid (`community:Dubai:mina-rashid`). Printed locality and a separate catalogue community. The series keeps the snapshot's leading name.

### Dubai Investment Park First

Scope: area/community transaction context. Catalogue: no exact catalogue community (none).

Printed coverage: 2026-09-04 to 2026-10-02. Card median AED/sqft 890 (+1% year over year). Card median price AED 980,000 (-18% year over year). Card transactions 2,141 (+348% year over year). Rental yield +8%.

Printed mix: Offplan 283, Ready 17. Types: Apartment 184, Office 6, Plot 3, Villa 107. Beds: 1 Bed 62, 2 Beds 79, 3 Beds 28, 4 Beds 60, 5 Beds 3, Studio 59, not printed 9. Seller class: Developer 280, Individual 20. Distinct location strings 26 (191 truncated by the page).

Capital-gain percent printed beside the price on 19 rows (median of those percents +33%). 281 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,141 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09 | 297 | export_truncated | 852 | 930,266 | 17 | 280 | 182 | 106 |
| 2026-10 | 3 | sparse, open_retrieval_month | 764 | 889,481 | 0 | 3 | 2 | 1 |

No single price trend. The card prints median AED/sqft +1% and median price -18%. Those directions differ, and the print does not add two comparable months in one stable segment that this packet uses as a substitute price index.

Not used as this series: Dubai Investment Park 2 (`community:Dubai:dubai-investment-park-2`). Different park number.
Not used as this series: Dubai Investments Park (`community:Dubai:dubai-investments-park`). Different catalogue name. Not substituted for First.

### Dubai Land Residence Complex, Wadi Al Safa 5

Scope: area/community transaction context. Catalogue: Dubai Land Residence Complex (exact).

Printed coverage: 2026-08-22 to 2026-10-05. Card median AED/sqft 1,300 (+5% year over year). Card median price AED 800,000 (+7% year over year). Card transactions 2,920 (-51% year over year). Rental yield +8%.

Printed mix: Offplan 214, Ready 86. Types: Apartment 291, Office 1, Shop 8. Beds: 1 Bed 102, 2 Beds 57, 3 Beds 10, Studio 117, not printed 14. Seller class: Developer 187, Individual 113. Distinct location strings 53 (237 truncated by the page).

Capital-gain percent printed beside the price on 89 rows (median of those percents +17%). 211 rows have no percent. The unlabelled No. badge is on every row and is not that percent.

The card counts 2,920 transactions and the print has 300 rows. Monthly counts below are printed rows, not the card's volume.

| Month | Printed sales | Flags | Median AED/sqft | Median price (AED) | Ready | Off-plan | Apartment | Villa |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08 | 81 | export_truncated | 1,406 | 850,000 | 16 | 65 | 81 | 0 |
| 2026-09 | 197 | comparable | 1,211 | 750,000 | 67 | 130 | 195 | 0 |
| 2026-10 | 22 | open_retrieval_month | 1,479.5 | 991,217.5 | 3 | 19 | 15 | 0 |

No two comparable printed months. The only price change on the page is the card: median AED/sqft +5% (rose), median price +7% (rose). The year-ago levels are not printed. This is one comparison, not a path.

Not in this print: Villa.

Not used as this series: Dubai Land Residence Complex (DLRC) (`community:Dubai:dubai-land-residence-complex-dlrc`). Second catalogue row. The snapshot title has no (DLRC) marker, so the series is not attached to both rows.
Not used as this series: Wadi Al Safa (`community:Dubai:wadi-al-safa`). Broader catalogue community. Wadi Al Safa 5 is the printed locality, not a licence to use the whole Wadi Al Safa series.

## Evidence limits

- The card's year-over-year window is not dated. Two areas can both say +5% and still be describing windows the page never shows.
- A 300-row print is not the card's transaction population. Business Bay's card says 8,216 transactions; the print has 300 of the most recent dated rows, from 14 September 2026 to 5 October 2026.
- Location text is often cut with an ellipsis. Names were not repaired.
- The median on the card is the card's median. It was not recomputed. Monthly medians use the AED-per-sqft number printed on each row. Even-count medians average the two central values.
- Ready versus off-plan, and apartment versus villa, are taken from the row badges. The card itself does not split those medians.
- No rent series exists in these files. Yield is a level where a percent is printed, and blank where the card shows a bare percent sign.
- Identical extra uploads are one source. Downtown's two byte streams are both retained and were not averaged.
- Catalogue links are identity only. Community prints are area context. They are not subject-project sale histories. Arancia Yards and The Oasis are the two titles that name one development and whose rows stay inside that development.
- No price was projected, and no community change was attributed to a catalyst.

The production historical snapshot was not rebuilt. This packet is the extract, the comparison, and the tests.
