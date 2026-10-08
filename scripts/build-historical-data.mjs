// The legacy Python importer stops at V29. Running it by default erased newer
// retained evidence in clean checkouts. Current builds restore and hash-check
// the exact reviewed archive; individual ingestion scripts create new releases.
const args=process.argv.slice(2),reject=message=>{console.error(message);process.exit(2);};
for(const [i,flag] of args.entries()){
 const value=args[i+1];
 if(flag==='--version'&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value||''))reject('version must be 1–80 letters, digits, dots, underscores or hyphens; start with a letter or digit');
 if(flag==='--as-of'){
  const date=new Date(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)reject('as-of must be a valid date in YYYY-MM-DD format');
 }
}
if(args.length)reject('history:build verifies the retained archive without importer options. Use the explicit ingestion script for a new evidence pass.');
await import('./verify-historical-archive.mjs');
