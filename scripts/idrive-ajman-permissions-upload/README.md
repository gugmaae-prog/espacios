# Ajman new-building permission replica

The [exact two-object plan](../../data/uae-evidence/idrive-e2-ajman-permissions-replica-plan-20261114.json) pins the gzip snapshots, source validation hashes, content type, bytes and private IDrive keys. `prepare-ajman-permissions-idrive-plan.mjs --check` verifies the plan against the tracked files. `transfer.mjs prepare` checks its allowlist and source hashes.

`transfer.mjs stage` creates an upload-only, inactive `espacios-ai-router` preview inheriting the existing E2 secrets, with a four-hour bearer capability held only under ignored `work/idrive-replica/ajman-permissions-20261114/`. `upload` uses conditional private PUT and immediate signed GET. `verify` separately reads both objects by signed GET and checks content type, length and SHA-256. `attest` confirms both receipt sets and that the production router deployment did not change. `verify-attestation` checks the public attestation without credentials.

The map continues serving these datasets from checksum-verified Worker snapshots. IDrive is a dated verified replica for them; the accepted V48 archive is a separate IDrive primary with immutable fallback. The [v74 verification note](../../docs/verification/ajman-new-building-permissions-v74-20261114.md) records their evidence limits.
