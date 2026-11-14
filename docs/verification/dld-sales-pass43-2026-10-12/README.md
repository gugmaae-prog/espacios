# Cresswell Plaza: exact project identity and individual registered sales

Status: published and verified in V43 / frontend V47. All 24 sales are live; prior evidence is preserved. See [release verification](../history-v43-2026-10-12/README.md).

## Identity decision

The catalogue's sole non-archived Cresswell Plaza record is marketed under Merath Development in Dubai South. [Merath's own portfolio](https://www.merathdevelopment.com/properties) identifies that exact project as 35 residences and explicitly lists project management, sales and marketing services. It separately lists Cresswell Views, Cresswell Residence and Cresswell Homes; none is included here.

The retained [DLD project-status authority capture](../dld-authority-review-2026-10-12/README.md) identifies Cresswell Plaza as project 4359 in Madinat Al Mataar, with 35 residential units (15 one-bedroom and 20 two-bedroom), registered developer Essa Bokhowa Properties L.L.C, developer number 2475. The downloadable developer register independently links that number/name to ID 804324850. DLD's public developer contact and Merath's public footer share the merathmanagement.com business domain. Full email addresses are not redistributed.

This establishes the exact project through name, location, inventory, property segment and the publicly corroborated operational contact. It does not establish that Merath and Essa Bokhowa are corporate aliases, subsidiaries or the same legal entity. Their roles remain separate; the original catalogue and prior evidence are preserved.

## Accepted scope and exclusions

The packet retains 24 individual residential-flat sale registrations from **23 April through 8 October 2026**. Each has exact project number 4359, source area 462, project and building name Cresswell Plaza, and a one- or two-bedroom label. Date, AED amount, square metres, derived AED/sqft and registration type are retained. Native transaction IDs are hashed.

The entire retained 10 October transaction export (1,800,588 rows) is scanned twice, including rows outside the target project, to detect changed duplicate IDs. All 24 eligible keys are distinct and absent from prior individual observations; verified subject-series descriptors are checked for overlapping ownership. No target rows fail financial eligibility. This is not proof that every lifetime transaction was published or that these were first-ever sales.

DLD's 20 July 2027 inspection remains future-dated and quarantined. Its advertised percentage is not accepted as present construction progress. The reported completion schedule is not actual completion or occupancy. Merath's 2,709.55 sqm and DLD's 3,610.1 sqm have unreconciled area definitions; neither is used as a transaction denominator or valuation. No map coordinates are inferred from the authority's repeated generic coordinate pair.

## Provenance and validation

Two source records are added: a minimal Merath identity capture and a new normalized DLD extract revision. Primary capture availability is 2026-10-11T23:07:11.555Z, used conservatively for all new sale evidence; original publication times remain unknown. Raw source rows, private captures and full contact details stay outside the public repository.

The prior archive is pinned to V42 root `472486d78f139da3a2e111fbaa110578698248c20e31359c96580b8200cce05a`. Reproduce preparation with `python3 scripts/prepare-dld-sales-pass43.py` using the retained lawful private inputs. Run `python3 tests/dld-sales-pass43.py` without private data. Tests cover exact scope and arithmetic, source vintage/availability, in-memory append preservation, organizational role separation, future-inspection exclusion and distinct same-brand projects. The full identity-review suite passes.

No new monthly medians, rents, current valuations, occupancy or forecast assumptions are supplied. Prior asking quotes, lifecycle schedules, native cohorts and scenario inputs remain unchanged. Complete lifetime history remains unresolved.

Next: integrate the separately prepared 40-sale Avida packet; resolve Belmont/Oakmont 42 and Raffles component mapping seven. Continue broader historical/present evidence and fully specified conditional annual scenarios through 2080.
