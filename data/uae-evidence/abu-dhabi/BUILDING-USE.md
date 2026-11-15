# AD-SDI building-use aggregate

The public [AD-SDI Building layer](https://arcgis.sdi.abudhabi.ae/agspublish/rest/services/OpenData/ADSDI_OpenData/MapServer/353) was queried on 9 November 2026. The [AD-SDI open-data terms](https://sdi.gov.abudhabi/sdi/opendata.html) permit reuse with source credit. The Worker publishes only counts grouped by source municipality code and exact primary-use label. It does not publish source polygons, building identities, or addresses.

Two independent ArcGIS grouped-query captures are retained with SHA-256 hashes in `sdi-building-use-capture.json`. `build-abu-dhabi-building-use.mjs --check` confirms both reads yield the same 266 groups, checks the canonical snapshot bytes, and reconciles their counts to the independently queried layer feature count of 392,495.

The source does not state an observation date or a completeness guarantee. Of the 392,495 polygon features, 249,177 have null or `UNDEFINED` primary use. These are **feature counts**, not verified distinct buildings, commercial units, transactions, prices, or spaces currently available for sale or rent. The source labels and municipality codes are preserved rather than recast as a commercial inventory. The public route is `/map/api/uae-evidence/abu-dhabi/building-uses`.
