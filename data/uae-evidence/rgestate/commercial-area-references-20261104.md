# RGEstate commercial area references

The 3 November 2026 commercial snapshot contains 894 publisher listings and no
verified unit coordinates. This map groups rows by their exact publisher
`locationLabel`. It does not geocode individual units or turn asking listings
into transactions.

On 4 November 2026, 33 one-time OpenStreetMap Nominatim area searches were
reviewed. The 23 references accepted for publication are listed with OSM object
IDs in `src/stack-audit/rgestate-commercial.mjs`. Only exact, explicit aliases
are grouped. OSM attribution is visible on the map, and the API returns the
source URL for each area reference. The API also reports the mapped and
unmapped row counts for each sale/rent/search filter.

Some search results were rejected because they pointed to a station, airport,
lake, police station, street, or a narrower numbered subarea rather than the
publisher's area label. Those rows remain searchable in the list. `Al Layan`,
for example, was not assigned to either `Al Layan 1` or `Al Layan 2`.

The commercial map represents where the publisher said listings were located
at area scale. It cannot establish a unit's address, current availability, or
exact placement. Historical sale and rent evidence stays in separate routes.

On 9 November 2026, seven more area references were reviewed against OSM
Nominatim results: Nad Al Hamar (`relation/18471802`), Al Garhoud
(`relation/18471788`), Barsha Heights (`node/3087418334`), Dubai Production
City (`relation/18471777`), Fujairah city (`way/872858707`), Dubai Islands
(`relation/8122161`), and Jebel Ali Village (`way/1018273191`). Exact
publisher labels now group 817 listings at 30 reviewed area references;
77 listings remain searchable without a mapped area. The unmatched Al Layan,
Dubai World Central, and road labels were not assigned to narrower or
ambiguous OSM results.
