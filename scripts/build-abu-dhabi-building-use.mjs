import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/abu-dhabi/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const capture=JSON.parse(await read('sdi-building-use-capture.json'));
const metadataBytes=await read('sdi-building-layer-metadata.json'),metadata=JSON.parse(metadataBytes);
if(metadata.id!==353||metadata.name!=='Building'||metadata.geometryType!=='esriGeometryPolygon'||metadata.maxRecordCount!==2000||metadata.advancedQueryCapabilities?.supportsStatistics!==true||!['OBJECTID','MUNICIPALITYNAME','PRIMARYUSAGETYPE'].every(name=>metadata.fields?.some(field=>field.name===name))||sha(metadataBytes)!==capture.metadataSha256)throw Error('AD-SDI building layer metadata changed');
if(capture.sourceLayerUrl!=='https://arcgis.sdi.abudhabi.ae/agspublish/rest/services/OpenData/ADSDI_OpenData/MapServer/353'||capture.termsUrl!=='https://sdi.gov.abudhabi/sdi/opendata.html'||capture.countReads?.length!==2||capture.countReads.some(item=>item.count!==392495))throw Error('AD-SDI building source details changed');
const canonical=bytes=>{
 const source=JSON.parse(bytes);
 if(source.error||source.exceededTransferLimit||!Array.isArray(source.features)||source.features.length!==266)throw Error('AD-SDI building query is incomplete');
 const rows=source.features.map(item=>({municipalityCode:item.attributes?.MUNICIPALITYNAME,primaryUse:item.attributes?.PRIMARYUSAGETYPE,featureCount:item.attributes?.feature_count}));
 if(rows.some(row=>!['ADM','AAM','WRM'].includes(row.municipalityCode)||row.primaryUse!==null&&(typeof row.primaryUse!=='string'||!row.primaryUse.trim())||!Number.isSafeInteger(row.featureCount)||row.featureCount<1))throw Error('Invalid AD-SDI building group');
 const keys=new Set(rows.map(row=>JSON.stringify([row.municipalityCode,row.primaryUse])));
 if(keys.size!==rows.length)throw Error('Duplicate AD-SDI building group');
 const compare=(a,b)=>a<b?-1:a>b?1:0;
 return rows.sort((a,b)=>compare(a.municipalityCode,b.municipalityCode)||compare(a.primaryUse||'',b.primaryUse||''));
};
const rawCaptures=[],packedCaptures=[];
for(const letter of 'ab'){
 const packed=await read(`sdi-building-use-capture-${letter}.json.gz`),raw=gunzipSync(packed),expected=capture[`capture${letter.toUpperCase()}`];
 if(raw.length!==expected.rawBytes||sha(raw)!==expected.rawSha256)throw Error('AD-SDI building raw capture checksum mismatch');
 packedCaptures.push(packed);rawCaptures.push(raw);
}
const rows=canonical(rawCaptures[0]),readback=canonical(rawCaptures[1]);
if(JSON.stringify(rows)!==JSON.stringify(readback))throw Error('Independent AD-SDI building groups differ');
const packed=await read('sdi-building-use-20261109.json.gz'),raw=gunzipSync(packed);
if(sha(raw)!==capture.canonicalSha256||raw.length!==capture.canonicalBytes||JSON.stringify(JSON.parse(raw))!==JSON.stringify(rows))throw Error('AD-SDI building canonical snapshot mismatch');
const byMunicipality=Object.fromEntries(['AAM','ADM','WRM'].map(code=>[code,rows.filter(row=>row.municipalityCode===code).reduce((n,row)=>n+row.featureCount,0)]));
const layerFeatureCount=rows.reduce((n,row)=>n+row.featureCount,0),unknownUseFeatures=rows.filter(row=>row.primaryUse===null||row.primaryUse==='UNDEFINED').reduce((n,row)=>n+row.featureCount,0);
const distinctUseLabels=new Set(rows.map(row=>row.primaryUse));
if(layerFeatureCount!==392495||JSON.stringify(byMunicipality)!==JSON.stringify({AAM:173118,ADM:146332,WRM:73045})||unknownUseFeatures!==249177||distinctUseLabels.size!==204)throw Error('AD-SDI building quality profile changed');
const report={sourceId:'ad-sdi-building-use-20261109',sourceLayerUrl:capture.sourceLayerUrl,queryUrl:capture.queryUrl,termsUrl:capture.termsUrl,publisher:'Abu Dhabi Spatial Data Infrastructure',attribution:'Source: AD-SDI Data Catalog / Department of Government Enablement, Government of Abu Dhabi',retrievedAt:capture.retrievedAt,emirate:'Abu Dhabi',evidenceClass:'official_building_polygon_use_aggregate',grain:'municipality code × exact primary-use label; count of published building polygon features',layerFeatureCount,groupRows:rows.length,municipalityCodes:['AAM','ADM','WRM'],byMunicipality,distinctUseLabels:distinctUseLabels.size,unknownUseFeatures,knownUseFeatures:layerFeatureCount-unknownUseFeatures,rawCaptureASha256:sha(rawCaptures[0]),rawCaptureBSha256:sha(rawCaptures[1]),canonicalSha256:sha(raw),canonicalBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),limits:'Counts are published polygon features, not verified distinct buildings, units, projects, sale or rent transactions, prices, or currently available spaces. 249,177 of 392,495 features have null or UNDEFINED primary use; source use labels are retained verbatim. The service does not state a source observation date or guarantee completeness. Municipality codes are retained from the source; polygons and building-level identities are not included in this aggregate.'};
const path=new URL(dir+'sdi-building-use-validation.json',root);
if(process.argv.includes('--check')){const saved=JSON.parse(await fs.readFile(path));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('AD-SDI building validation differs from source');console.log(JSON.stringify({passed:true,layerFeatureCount,groupRows:rows.length,unknownUseFeatures}));}
else{await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({layerFeatureCount,groupRows:rows.length,unknownUseFeatures}));}
