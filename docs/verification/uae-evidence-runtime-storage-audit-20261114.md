# UAE evidence runtime storage audit — 14 November 2026

The accepted V48 archive reads from private IDrive E2 through the `MAP_EVIDENCE` service binding, with immutable Worker assets as fallback. Newer UAE source snapshots have independently checksum-verified IDrive replicas, but their public APIs currently read the checksum-verified Worker snapshots. The replica is not their runtime primary.

## Bounded production-path test

The production Map Worker was `4769b547-bb8a-43cd-881c-78710f8cf5d6` at 100% before and after the test. Candidate `31685480-f975-40f4-b532-52776151cde7` was staged at 0% and reached only through the canonical route with `Cloudflare-Workers-Version-Overrides`. Its fixed, read-only proof attempted the 89,000-byte RGEstate full-index object whose private IDrive upload and independent signed GET already matched SHA-256 `f5efe6899757c73e522ecab4de5a2edf41404579fa122a0a292d8bae07c6fade`.

The staged `/map/api/health?storage=idrive-rgestate` returned 503 with zero IDrive reads and zero primary failures. The same staged binding returned a checksum-verified `idrive_e2` read for the accepted V48 proof object. This isolates the newer-object miss to the private service's logical-key registry, rather than an unavailable service or a failed checksum. The candidate was removed from the deployment; normal traffic remained on `4769b547-bb8a-43cd-881c-78710f8cf5d6` throughout. The temporary proof code was discarded from the branch.

A read-only download of the currently deployed `espacios-auth-central` Worker confirmed that its named `MapEvidence` entrypoint requires an exact registry key before signing an IDrive request. The registry contains the accepted V48 logical keys and three earlier Ajman keys; it has no RGEstate key. Its existing path function maps those legacy keys to legacy IDrive prefixes. The newer replicas use versioned keys under `espacios-map/uae-evidence/`, so adding them requires both an explicit, checksum-pinned registry entry and an exact storage-key mapping. The private auth Worker is not source-controlled in this Map checkout; this audit did not modify or redeploy it, copy its credentials, or publish its downloaded source.

## Safe cutover requirement

Before describing a newer API as IDrive-primary, preserve the auth Worker's complete current source and bindings in a reviewed source-controlled release, add only the approved immutable keys with byte length, content type and SHA-256, stage the private service and Map Worker at 0%, and verify exact bytes through the service binding. Keep the packaged snapshot as fallback, test its failure path, then promote and recheck normal traffic. The existing published APIs and 41 dated replicas remain available while this is unresolved. A replica attestation alone is not a runtime read proof.
