# Sharjah supplement IDrive E2 replica

The selected numerical supplement in `monthly-market-20261114-supplement.json.gz` was uploaded to the private `espacios-store-a` bucket under `espacios-map/uae-evidence/sharjah/monthly-market/20261114-supplement/`. The immutable [plan](../../data/uae-evidence/idrive-e2-sharjah-supplement-plan-20261114.json) pins its local checksum and key. The [attestation](../../data/uae-evidence/idrive-e2-sharjah-supplement-readback-20261114.json) records a separate signed GET after upload. The temporary upload capability and receipts remain under ignored `work/idrive-replica/sharjah-supplement-20261114/` with private file modes.

Run `node scripts/idrive-sharjah-supplement-upload/transfer.mjs verify-attestation` to check the committed plan and attestation. The map serves its own checksum-checked Worker snapshot; IDrive is a verified private replica for this source. The accepted V48 archive remains IDrive-primary. No article body or images are included.
