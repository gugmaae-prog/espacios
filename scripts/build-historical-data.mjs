// The legacy Python importer stops at V29. Running it by default erased newer
// retained evidence in clean checkouts. Current builds restore and hash-check
// the exact reviewed archive; individual ingestion scripts create new releases.
if(process.argv.length>2)throw Error('history:build verifies the retained archive without importer options. Use the explicit ingestion script for a new evidence pass.');
await import('./verify-historical-archive.mjs');
