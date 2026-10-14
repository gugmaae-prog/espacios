/** Refuse unreviewed, ambiguous or detached catalogue metadata revisions. */
export function validateCatalogueRevisions(packet,snapshot){
 if(packet?.classification!=='reviewed_catalogue_metadata_not_financial_evidence'||!Array.isArray(packet.revisions))throw Error('Invalid catalogue revision packet');
 const seen=new Set();
 for(const r of packet.revisions){
  const records=snapshot.records.filter(record=>record.id===r.recordId);
  if(records.length!==1||records[0].type!=='project'||records[0].name!==r.catalogueName||records[0].emirate!==r.emirate)throw Error('Catalogue revision identity mismatch');
  if(!r.id||seen.has(r.recordId))throw Error('Duplicate catalogue revision');
  seen.add(r.recordId);
  if(r.field!=='developer'||r.verification!=='verified'||r.primaryEvidence!==true||!r.reason||!r.fromValue||!r.toValue||r.fromValue===r.toValue)throw Error('Unverified catalogue revision');
  if(!Number.isFinite(Date.parse(r.firstAvailableAt))||!Array.isArray(r.sourceRefs)||!r.sourceRefs.length)throw Error('Missing catalogue evidence availability');
  for(const ref of r.sourceRefs){
   const matches=snapshot.sources.filter(source=>source.id===ref.id),source=matches[0];
   if(matches.length!==1||!source.primaryEvidence||source.sha256!==ref.sha256||source.url!==ref.url||!Number.isFinite(Date.parse(source.firstAvailableAt))||Date.parse(r.firstAvailableAt)<Date.parse(source.firstAvailableAt))throw Error('Catalogue revision source mismatch');
  }
 }
 return packet.revisions;
}
