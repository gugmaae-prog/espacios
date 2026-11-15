export const SCAD_STOCK_SOURCE = Object.freeze({
  id: 'scad-abu-dhabi-census-2024-real-estate-stock',
  publisher: 'Statistics Centre – Abu Dhabi',
  product: 'Abu Dhabi Census 2024, Real Estate: Number of Units and Buildings by Region, Emirate of Abu Dhabi',
  url: 'https://census.scad.gov.ae/home/realestate?lang=en',
  termsUrl: 'https://www.scad.gov.ae/web/guest/terms-of-use',
  policyUrl: 'https://scad.gov.ae/documents/d/guest/scad-open-data-policy',
  sourceResponseSha256: '2a1f58d1818a0c0b2a227e3e274f7c38daa3864754e18e8888119d418f06569b',
  retrievedAt: '2026-11-02T18:25:47.028399+00:00',
  referencePeriods: [2023, 2024],
  table: 'Number of Units and Buildings by Region, Emirate of Abu Dhabi',
  attribution: 'Source: Statistics Centre – Abu Dhabi; Abu Dhabi Census 2024, Real Estate; reference periods 2023–2024; Number of Units and Buildings by Region table. The web table displays no catalogue or archive number.'
});

// The source table is rounded to multiples of five. These are stock totals,
// including non-residential uses, not project counts or registered sales.
export const SCAD_STOCK_ROWS = Object.freeze([
  {region:'emirate-of-abu-dhabi',regionName:'Emirate of Abu Dhabi',period:2023,units:754555,buildings:281780},
  {region:'emirate-of-abu-dhabi',regionName:'Emirate of Abu Dhabi',period:2024,units:783970,buildings:299360},
  {region:'abu-dhabi-region',regionName:'Abu Dhabi Region',period:2023,units:513455,buildings:148655},
  {region:'abu-dhabi-region',regionName:'Abu Dhabi Region',period:2024,units:535925,buildings:161930},
  {region:'al-ain-region',regionName:'Al Ain Region',period:2023,units:189680,buildings:110740},
  {region:'al-ain-region',regionName:'Al Ain Region',period:2024,units:196175,buildings:114715},
  {region:'al-dhafra-region',regionName:'Al Dhafra Region',period:2023,units:51425,buildings:22385},
  {region:'al-dhafra-region',regionName:'Al Dhafra Region',period:2024,units:51870,buildings:22715}
]);

const PATH = '/map/api/uae-evidence/abu-dhabi/stock';
const reply = (request, body, status=200) => new Response(request.method==='HEAD'?null:JSON.stringify(body), {
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store',
    'x-content-type-options':'nosniff',
    'x-espacios-evidence-source':SCAD_STOCK_SOURCE.id,
    ...(status===405?{allow:'GET, HEAD'}:{})
  }
});

export function mapScadStock(request) {
  const url = new URL(request.url);
  if (url.pathname.replace(/\/+$/,'') !== PATH) return null;
  if (!['GET','HEAD'].includes(request.method)) return reply(request,{error:'Read-only endpoint'},405);
  const period = url.searchParams.get('period');
  const region = url.searchParams.get('region');
  if ((period !== null && !['2023','2024'].includes(period)) ||
      (region !== null && !SCAD_STOCK_ROWS.some(row=>row.region===region))) {
    return reply(request,{error:'Invalid period or region'},400);
  }
  const rows = SCAD_STOCK_ROWS.filter(row=>(period===null||row.period===Number(period))&&(region===null||row.region===region));
  return reply(request,{
    source:SCAD_STOCK_SOURCE,
    scope:{emirate:'Abu Dhabi',evidenceClass:'official_rounded_census_stock',grain:'region_year',isAllUae:false,projectCoordinatesPresent:false,limitations:'Rounded to multiples of 5. Units and buildings include non-residential uses. Regional sums can differ from the emirate total. Revised 2023 figures; no project, sale, price, or current-period claim.'},
    filters:{period:period===null?null:Number(period),region},
    totalRows:rows.length,
    rows
  });
}
