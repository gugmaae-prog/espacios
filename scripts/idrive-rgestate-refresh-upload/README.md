# RGEstate 14 November 2026 evidence refresh

The publisher full index and its rent and sale commercial categories were each captured twice. Both passes had the same factual rows, and each commercial row appeared in the full index. The capture HTML and upload capability remain in ignored `work/` paths. No listing photos are stored or served.

The new snapshots contain 1,660 full-index listings, 859 publisher commercial-category listings, and 137 separately labelled title-matched candidates. Six former full-index IDs are absent from this capture; that does not prove a sale or current unavailability. One publisher asking price changed. All listing availability remains unverified. Area circles represent reviewed OpenStreetMap district references, never unit coordinates.

The [copy plan](../../data/uae-evidence/idrive-e2-rgestate-refresh-plan-20261114.json) pins three immutable gzip objects to `espacios-store-a`. The [readback attestation](../../data/uae-evidence/idrive-e2-rgestate-refresh-readback-20261114.json) records immediate checksum readback after upload and a separate signed IDrive GET for every object. `transfer.mjs` has `prepare`, `stage`, `upload`, `verify`, `attest`, and `verify-attestation` actions. The upload Worker version received no production traffic, and the Map API continues to serve checksum-checked Worker snapshots with IDrive as a dated private replica.

The 11 November files and their original readback attestation remain pinned separately. The refresh does not change the accepted V48 archive, which uses IDrive as its configured primary with an immutable fallback. R2 remains disabled.
