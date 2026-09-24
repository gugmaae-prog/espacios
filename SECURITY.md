# Security Policy

This repository is public. Treat every committed byte as internet-visible.

## Never commit

- Cloudflare API tokens, account credentials, Wrangler auth state, or secret values
- Supabase `service_role` / secret keys, database passwords, OAuth refresh tokens, SMTP passwords, or private API keys
- `.env` files or production credential exports
- customer, lead, CRM, inbox, contact, KYC, or other private user datasets
- private agent memory, staff-only documents, or internal access-control material

Configuration may document **secret names** and non-secret resource identifiers, but secret values belong in the runtime secret store.

## Tenant boundary

Espacios data and credentials must remain separate from:

- Haus & Grace / Grace private CRM, enquiries, credentials, and agent memory
- PSR Homes / Sonu private CRM, leads, messages, credentials, and agent memory

Only intentionally public catalogue/media/intelligence data should cross tenant boundaries.

## Production changes

Production changes should be made from reviewed Git commits after source parity with the live Cloudflare deployment is verified. Do not use this public repository as a place to dump live runtime data.

## Reporting

If you find an exposed credential or private dataset, do not paste the secret or data into a public issue. Contact the repository owner through a private channel and rotate/revoke the affected credential immediately.
