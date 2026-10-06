import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function applyUiSpans(original,patch){
  if(hash(original)!==patch.originalSha256||original.length!==patch.originalBytes)throw Error('Private owning module differs from the reviewed base; stop and reconcile first');
  let output=original;
  const edits=[...patch.edits].sort((a,b)=>b.startByte-a.startByte);
  for(const edit of edits){
    const before=original.subarray(edit.startByte,edit.endByte);
    if(hash(before)!==edit.beforeSha256||!before.equals(Buffer.from(edit.before)))throw Error('UI span differs: '+edit.finding);
    output=Buffer.concat([output.subarray(0,edit.startByte),Buffer.from(edit.after),output.subarray(edit.endByte)]);
  }
  if(hash(output)!==patch.patchedSha256||output.length!==patch.patchedBytes)throw Error('Patched module verification failed');
  return output;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw Error('Usage: node scripts/apply-auth-ui.mjs PRIVATE_OWNING_MODULE OUTPUT_MODULE');
  if(input===output)throw Error('Use a separate output file');
  const patch=JSON.parse(await readFile(new URL('../integration/auth-ui-spans.json',import.meta.url),'utf8'));
  const bytes=applyUiSpans(await readFile(input),patch);
  await writeFile(output,bytes,{flag:'wx'});
  console.log('Verified '+patch.edits.length+' UI spans; private output saved without printing source');
}
