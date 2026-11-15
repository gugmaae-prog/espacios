import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packed=await read('area-reference-20231003.json.gz');
const raw=gunzipSync(packed),rows=JSON.parse(raw);
const metadataBytes=await read('area-reference-source-metadata.json');
const metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('area-reference-capture.json'));
if(metadata.dataset_id!=='ajman-area'||meta?.title!=='Ajman area'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Municipality & Planning Department'||meta?.modified!=='2023-10-03T09:39:18+00:00'||meta?.records_count!==20||JSON.stringify(meta?.geometry_types)!=='["Point"]')throw Error('Unexpected Ajman area-reference metadata');
if(JSON.stringify(metadata.fields.map(field=>field.name))!=='["area_in_ajman","geopoint","latitude","longitude"]'||!Array.isArray(rows)||rows.length!==20||capture.totalCount!==20||capture.independentReadbackCount!==20||capture.rawSha256!==sha(raw)||capture.independentReadbackSha256!==sha(raw)||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(packed)||capture.compressedBytes!==packed.length)throw Error('Ajman area-reference capture mismatch');
const names=new Set(),points=new Set();
for(const row of rows){
 if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify(['area_in_ajman','geopoint','latitude','longitude'].sort()))throw Error('Unexpected Ajman area-reference row fields');
 const lat=Number(row.latitude),lon=Number(row.longitude);
 if(typeof row.area_in_ajman!=='string'||!row.area_in_ajman.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<25.2||lat>25.6||lon<55.3||lon>55.8||Math.abs(row.geopoint?.lat-lat)>1e-8||Math.abs(row.geopoint?.lon-lon)>1e-8)throw Error('Invalid Ajman area-reference point');
 if(names.has(row.area_in_ajman)||points.has(lat+'|'+lon))throw Error('Duplicate Ajman area-reference label or point');
 names.add(row.area_in_ajman);points.add(lat+'|'+lon);
}
const report={sourceId:'ajman-mpd-20231003-area-reference',datasetUrl:'https://data.ajman.ae/explore/dataset/ajman-area/',recordsUrl:capture.recordsUrl,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,portalTermsUrl:'https://data.ajman.ae/terms/terms-and-conditions.pdf',sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_area_reference_point',grain:'named Ajman area reference point; not a project coordinate, cadastral boundary, or verified district centroid',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),rows:rows.length,distinctAreaNames:names.size,geometryType:'Point',canonicalProjectMatches:0,projectCoordinatesPresent:false,sourceAgeNote:'The publisher last modified this dataset on 3 October 2023; use as dated geographic context only.'};
const reportPath=new URL(dir+'area-reference-validation.json',root);
if(process.argv.includes('--check')){const saved=JSON.parse(await fs.readFile(reportPath,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman area-reference validation differs from source');console.log(JSON.stringify({passed:true,rows:report.rows,rawSha256:report.rawSha256}));}
else{await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({rows:report.rows,rawSha256:report.rawSha256}));}
