import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {RGE_AREA_CENTRES,RGE_AREA_EMIRATES,rgeAreaLocationFor} from '../src/stack-audit/rgestate-commercial.mjs';

const root=new URL('../',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-validation.json',root)));
const raw=gunzipSync(await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-20261103.json.gz',root)));
if(sha(raw)!==source.rawSha256)throw Error('RGEstate source checksum mismatch');
const rows=JSON.parse(raw);
const explicit=new Set(['Abu Dhabi','Ajman','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain','Emirate of Umm Al Quwain']);
const matched=rows.filter(row=>!explicit.has(row.locationLabel)&&rgeAreaLocationFor(row));
const byEmirate=Object.fromEntries(['Abu Dhabi','Ajman','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain'].map(name=>[name,matched.filter(row=>rgeAreaLocationFor(row).emirate===name).length]));
const report={sourceId:source.sourceId,sourceRawSha256:source.rawSha256,areaReferenceSha256:sha(JSON.stringify({areas:RGE_AREA_CENTRES,emirates:RGE_AREA_EMIRATES})),reviewedAreaReferences:RGE_AREA_CENTRES.length,reviewedAreaRows:matched.length,unresolvedRows:rows.length-604-matched.length,byEmirate,method:'Exact publisher locationLabel alias matched to a previously reviewed OpenStreetMap area reference; the area reference has a separately reviewed emirate.',geographyStatus:'reviewed_osm_area_reference_not_unit_coordinate',limits:'Area references are approximate district or city locations. They do not verify a listing address, project identity, current availability, or registered transaction. Publisher emirate labels and reviewed area references remain separate.'};
if(rows.length!==1708||report.reviewedAreaRows!==767||report.unresolvedRows!==337||byEmirate.Dubai!==767||Object.values(byEmirate).reduce((a,b)=>a+b,0)!==767)throw Error('RGEstate reviewed area geography changed');
const path=new URL('data/uae-evidence/rgestate/area-geography-validation.json',root);
if(process.argv.includes('--check')){if(JSON.stringify(JSON.parse(await fs.readFile(path)))!==JSON.stringify(report))throw Error('RGEstate area geography report is out of date');}
else await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,reviewedAreaRows:report.reviewedAreaRows,unresolvedRows:report.unresolvedRows}));
