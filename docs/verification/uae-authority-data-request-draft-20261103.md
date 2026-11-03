# UAE project-data request — draft, not sent

Espacios Map currently preserves the accepted V48 project population and 15 separately dated source snapshots. Its [coverage inventory](https://espacios.me/map/api/uae-evidence/coverage) leaves the authoritative all-UAE project denominator and completeness percentage unset. Additional source snapshots for Fujairah, Ras Al Khaimah, Sharjah and Umm Al Quwain require a source, licence and row-level validation before publication. This draft seeks the missing information; it does not grant reuse rights or authorize a message to be sent.

## Request text

**Subject:** Request for a reusable real-estate project register and data licence for Espacios Map

Dear [department],

Espacios is building a public, source-attributed UAE real-estate research map. We would like to represent [emirate]'s registered developments accurately and keep the published data current. Could you provide, or direct us to, an official machine-readable project register or API and its permitted reuse terms?

For each project, the most useful non-personal fields are: persistent authority ID, Arabic and English name, developer ID/name, district, registration and approval dates, current status with status date, project category, units or buildings where available, last update date, and a verified project footprint or point with its coordinate reference system and precision. Please identify fields that are unavailable or restricted. We would also welcome a dated count of all in-scope projects so we can report a defensible coverage denominator.

Separately, please identify any public, non-personal registered sale, mortgage, rent or permit aggregate datasets, their row grain, period coverage, correction policy and update cadence. We will keep these evidence classes separate from project identities and from forecast scenarios.

Please confirm whether Espacios may store and publicly display the supplied fields, provide search and API access, draw project markers, and publish source-labelled derived summaries. We would appreciate the required attribution, any commercial-use or caching limits, permitted retention period, expiry or renewal terms, and whether a machine-readable licence or written approval is available. We will not publish restricted personal data or represent approximate district centres as project coordinates.

If there is a data request form, subscription or fee, please point us to it. A sample export and schema would help us validate identity, duplicates, geography and status before release.

Kind regards,  
Espacios

## Verified submission channels — not used

Use the common request text above with the corresponding authority-specific question below. The email addresses are published by the authorities; no message has been sent. Data Dubai's request form requires an authenticated account, and the other listed channels have not been tested by sending mail.

| Authority | Official channel | Verification |
| --- | --- | --- |
| Dubai Data and Statistics Establishment / DLD | [Data Dubai Request for Data](https://data.dubai/request-data) | The [official service listing](https://data.dubai/services) says the request is open to everyone and can supply digital files with regular updates. The route currently redirects to Data Dubai sign-in; an authenticated account is needed to submit. Ask DDSE to route the dataset-specific licence question to DLD if necessary. |
| Ras Al Khaimah Municipality RERA | `info@mun.rak.ae` | Published on the [municipality contact page](https://mun.rak.ae/home/communications-center/contact-us/); address the request to the Real Estate Regulatory Administration. |
| Sharjah Real Estate Registration Department | `info@shjrerd.gov.ae` | Published in the [Sharjah government directory](https://protocol.shj.ae/Documents/00%20-%20Gov%20List%2014-1-2025%D8%A7%D9%84%D9%82%D8%A7%D8%A6%D9%85%D8%A9%20%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D9%8A%D8%A9.pdf), page 45. |
| Fujairah Statistics Centre | `fsc@fsc.fujairah.ae` | Published on the [centre's contact page](https://www.fscfuj.gov.ae/contact.html); ask it to identify the correct project-register authority if it only holds aggregate statistics. |
| Umm Al Quwain Land and Property Department | `info.ld@ld.uaqgov.ae` | Published on the [department's own website](https://ld.uaq.ae/ar/home.html); ask for the current register and any public reuse route. |

## Suggested routing and source-specific question

| Authority | Reviewed lead | Additional question |
| --- | --- | --- |
| Dubai Land Department / Data Dubai | [authority-hosted Real Estate Projects dataset](https://data.dubai/en/l/467654), [DLD live project table](https://dubailand.gov.ae/en/open-data/real-estate-data/) | The 1 November Data Dubai CSV is publicly downloadable and marked Open, but its expanded metadata states “Rights: N/A” and “License: Not Specified.” The linked [Open Data Licence](https://data.dubai/documents/d/guest/open-data-license-english-1-1-pdf) allows commercial work products, including maps, but section 2.2 excludes identifiable private-entity data; this CSV includes developer and escrow-agent names and IDs. [Data Dubai's terms](https://data.dubai/en/terms-conditions) point Open datasets to that licence while separately limiting portal-material copying to personal non-commercial use and prohibiting display on another website. Please confirm in writing which terms control, which fields are covered, and whether Espacios may store, search, redistribute via public API and display the permitted fields commercially. Please identify any separate permissions needed for developer or escrow-agent information, required attribution, retention and refresh terms. Can the authority explain why this CSV has 3,474 project numbers while the separately licensed DLD-derived snapshot has 3,871, and what the metadata's expected volume of 24,865 measures? Please provide an authoritative current-project denominator and a documented API or export route that does not depend on the live table's CAPTCHA. |
| Ras Al Khaimah Municipality, Real Estate Regulatory Administration | [RERA off-plan list](https://sanad.mun.rak.ae/docs/en/rera-updated-developers-list), [older project/status list](https://mun.rak.ae/home/rak-municipality/organizational-structure/lands-properties-sector/real-estate-regulatory-administration/), [municipality contact](https://mun.rak.ae/home/communications-center/contact-us/) | Can the department provide a current export of the development-project register established by [Law No. 12 of 2023, Article 5](https://mun.rak.ae/wp-content/uploads/2024/09/Law-No.-12-of-2023-on-Regulating-Real-Estate-Development-in-Emirate-of-Ras-Al-Khaimah.pdf), with stable project and developer register numbers, plot number, registration/status dates, approved delivery date where public, verified geometry and an authoritative in-scope count? Article 28 names several of these as advertising fields; it does not prove they appear in the public list. Please state which fields and historical versions may be stored, searched and republished through a public API. The [website copyright notice](https://mun.rak.ae/home/open-data/website/copyrights/) does not itself authorize bulk republication. The [2025–2026 transaction reports](https://mun.rak.ae/home/rak-municipality/organizational-structure/lands-properties-sector/) also need separate row-grain, export and reuse terms; their aggregates must not be treated as project or unit transactions. |
| Sharjah Real Estate Registration Department | [Department site](https://shjrerd.gov.ae/), [Sharjah government's Aqari update](https://sgmb.ae/en/news/%D9%88%D9%84%D9%8A-%D8%B9%D9%87%D8%AF-%D8%A7%D9%84%D8%B4%D8%A7%D8%B1%D9%82%D8%A9-%D9%8A%D8%AA%D8%B1%D8%A3%D8%B3-%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9-%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%AA%D9%86%D9%81%D9%8A%D8%B0%D9%8A-13-01-2026-12-42) | Can the Aqari system provide an official project-registration export, stable IDs, an authoritative project count, status dates and a licence for public display/API reuse? The published Aqari unit and transaction totals are not a project register. |
| Fujairah Statistics Centre and relevant land authority | [Statistics Centre contact](https://www.fscfuj.gov.ae/contact.html), [construction publications](https://www.fscfuj.gov.ae/publications.html) | Can project identities and locations be supplied separately from aggregate building permits, with explicit reuse terms? |
| Fujairah Foundation for Regions Development | [open-data policy and request route](https://ffrd.fujairah.ae/en/open-data-policy), [currently empty dataset page](https://ffrd.fujairah.ae/en/open-data) | Request a dated CSV/Excel series of completed residential additions, home-maintenance and rental-housing support counts by year and district where privacy thresholds permit. Ask for suppressed cells, coverage, correction and refresh rules. The charter permits attributed reuse of datasets the Foundation publishes, but the page currently has no downloadable rows; these are housing-service aggregates, not a project register or market rents. |
| Umm Al Quwain Land and Property Department | [official department site](https://ld.uaq.ae/) | Is there a public registered-development register, authoritative total and reuse licence? Confirm the correct request channel on the department site before sending. |

For Abu Dhabi, make a **separate** ADREC request for permission covering the specific sale-observation dataset, public display/API use, attribution, retention and expiry. The 642 V55 observations remain unpublished until that permission is received and verified. Do not attach candidate data to the request.

No message or form submission has been made from this draft.
