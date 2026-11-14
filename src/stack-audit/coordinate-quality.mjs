/** Summarize the coordinate basis already carried by each accepted map feature. */
export function mapCoordinateQuality(payload) {
 const features=payload.projectFeatures?.features;
 const unmapped=payload.unmappedProjectRecords;
 if(!Array.isArray(features)||!Array.isArray(unmapped))throw Error('Project location inventory is incomplete');
 const quality={projectOrSource:0,approximateCommunityCentre:0,withoutCoordinates:unmapped.length};
 const byEmirate=new Map(Object.keys(payload.counts?.byEmirate||{}).map(name=>[name,{projectOrSource:0,approximateCommunityCentre:0,withoutCoordinates:0}]));
 for(const feature of features){
  const key=feature.properties?.coordinateQuality==='project_or_source_coordinate'?'projectOrSource':feature.properties?.coordinateQuality==='community_centroid_fallback'?'approximateCommunityCentre':null;
  const emirate=byEmirate.get(feature.properties?.emirate);
  if(!key||!emirate)throw Error('Unknown project coordinate quality or emirate');
  quality[key]++;emirate[key]++;
 }
 for(const record of unmapped){const emirate=byEmirate.get(record.emirate);if(!emirate)throw Error('Unknown unmapped project emirate');emirate.withoutCoordinates++;}
 if(quality.projectOrSource+quality.approximateCommunityCentre!==payload.counts.geocodedProjects||
  quality.projectOrSource+quality.approximateCommunityCentre+quality.withoutCoordinates!==payload.counts.projects)throw Error('Project location totals do not reconcile');
 for(const [name,part] of byEmirate){
  const counts=payload.counts.byEmirate[name];
  if(part.projectOrSource+part.approximateCommunityCentre!==counts.geocodedProjects||part.withoutCoordinates!==counts.unmappedProjects)throw Error('Emirate location totals do not reconcile: '+name);
  counts.coordinateQuality=part;
 }
 payload.counts.coordinateQuality=quality;
 payload.sourceSnapshot.coordinateQualityNote='Project/source coordinates are retained as reported and are not all independently surveyed project sites. Community-centre points are approximate area locations, not project sites. Records without coordinates remain searchable.';
 if(payload.sourceSnapshot.basis)payload.sourceSnapshot.basis=payload.sourceSnapshot.basis.replace('Only verified coordinates enter the heat surface; unmapped records remain explicit in the payload.','The heat surface includes reported project/source points and approximate community-centre points; records without coordinates remain explicit in the payload.');
 payload.completeness.coordinateQuality=quality;
 payload.completeness.rule='Every recognized catalogue record has a reported project/source point, an approximate community-centre point, or no map location. Approximate points must not be interpreted as project sites.';
 return payload;
}
