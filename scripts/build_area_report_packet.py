"""Build the reviewed DXB Interact area-report packet. Does not publish or rebuild the snapshot."""
import hashlib, json, re
from pathlib import Path

from extract_dxb_area_reports import extract_pdf

ROOT=Path(__file__).resolve().parents[1]
UPLOADS=Path('/home/ubuntu/.cursor/projects/workspace/uploads')
OUT=ROOT/'enrichment'/'area-reports-20261006'
RETRIEVAL='2026-10-06'
FILES=[
 'Jebel_Ali_fc28.pdf',
 'Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf',
 'Emaar_Beachfront__Dubai_Harbour_3ded.pdf',
 'Town_Square__Al_Yelayiss_2_2f80.pdf',
 'Sobha_Hartland__Al_Merkadh_829b.pdf',
 'The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf',
 'Damac_Hills__Al_Hebiah_Third_ed43.pdf',
 'Dubai_Hills_Estate_acbf.pdf',
 'Dubai_Marina__Marsa_Dubai_5a24.pdf',
 'Jumeirah_Village_Circle__JVC__b203.pdf',
 'Business_Bay_4e00.pdf',
 'Dubai_Creek_Harbour_638f.pdf',
 'Dubai_South_bda4.pdf',
 'Palm_Jebel_Ali_8316.pdf',
 'Downtown_Dubai_e760.pdf',
]
PHASE_RE=re.compile(r'\bphase\s+\d+\b', re.I)

def norm(value):
    text=value.replace('\u2019',"'").replace('\u2018',"'").replace('\u2013','-').replace('\u2014','-').replace('–','-').replace('—','-')
    return re.sub(r'\s+',' ', text).strip().casefold()

def slug(filename):
    stem=filename[:-4]
    return re.sub(r'[^a-z0-9]+','-', stem.lower()).strip('-')

def canonical_sale(row):
    keys=['page','rowIndex','locationPrinted','locationTruncated','priceAed','priceRaw','priceParentheticalPercent','areaSqft','areaRaw','datePrinted','date','readiness','propertyType','propertyTypeTextLayer','propertyTypeRecovery','capitalGainLabel','pricePerSqftAed','bedroomsPrinted','soldBy','detailUrl','detailUrlNonHttps','unlabeledSpecsGlyph']
    return {key:row.get(key) for key in keys}

def row_hash(rows):
    payload=json.dumps([canonical_sale(row) for row in rows], ensure_ascii=False, separators=(',',':')).encode()
    return hashlib.sha256(payload).hexdigest()

def load_catalogue():
    data=json.loads((ROOT/'data'/'historical-intelligence-20261003.json').read_text())
    communities=[]; projects=[]
    for record in data['records']:
        item={'id':record['id'],'name':record['name'],'type':record['type'],'communityId':record.get('communityId'),'emirate':record.get('emirate')}
        if record['type']=='community':
            item['directSalePeriods']=record.get('coverageSummary',{}).get('directSalePeriods')
            item['directRentPeriods']=record.get('coverageSummary',{}).get('directRentPeriods')
            item['researchStatus']=record.get('researchStatus',{}).get('status')
            item['gaps']=record.get('researchStatus',{}).get('gaps')
            forecast=(record.get('researchStatus',{}).get('itemCoverage') or {}).get('validated_price_forecast') or {}
            item['validatedPriceForecast']=forecast.get('status')
            series={}
            for entry in record.get('historySeries') or []:
                series[entry.get('scope')]=series.get(entry.get('scope'),0)+1
            item['historySeriesScopes']=series
            communities.append(item)
        else:
            projects.append(item)
    return data['version'], data['asOf'], data['manifest'], communities, projects

def index_names(records):
    out={}
    for record in records:
        out.setdefault(norm(record['name']), []).append(record)
    return out

def title_identity(title, communities, projects):
    community_index=index_names(communities)
    tokens=[part.strip() for part in title.split(',') if part.strip()]
    full=community_index.get(norm(title), [])
    components=[]
    for token in tokens:
        exact=community_index.get(norm(token), [])
        near=[]
        if not exact:
            for key, rows in community_index.items():
                name=rows[0]['name']
                if norm(token)==key:
                    continue
                if token.casefold().startswith(name.casefold()) and token[len(name):len(name)+1] in ' (':
                    near.append({'id':rows[0]['id'],'name':name,'reason':'catalogue name is only a prefix of this title component'})
                elif name.casefold().startswith(token.casefold()+' '):
                    near.append({'id':rows[0]['id'],'name':name,'reason':'catalogue name adds words beyond this title component'})
        longer=[row for row in communities if norm(row['name']).startswith(norm(token)+' ') and row['id'] not in {item['id'] for item in exact}]
        shorter_projects=[row for row in projects if len(row['name'])>=8 and (token.casefold().startswith(row['name'].casefold()+' ') or token.casefold().startswith(row['name'].casefold()+'('))]
        components.append({
            'printed':token,
            'exactCommunityMatches':[{'id':row['id'],'name':row['name']} for row in exact],
            'nearCommunityMatches':near,
            'longerCommunityNamesNotAttached':[{'id':row['id'],'name':row['name']} for row in longer],
            'shorterProjectNamesNotAttached':[{'id':row['id'],'name':row['name']} for row in shorter_projects],
        })
    exact_ids=[row['id'] for row in full]
    ledger=exact_ids[0] if len(exact_ids)==1 else None
    similar_not_attached=[]
    if ledger:
        base=norm(next(row['name'] for row in full))
        for row in communities:
            name=norm(row['name'])
            if row['id']==ledger:
                continue
            shorter, longer = (name, base) if len(name)<=len(base) else (base, name)
            phrase=re.sub(r'[^a-z0-9]+',' ', shorter).strip()
            container=re.sub(r'[^a-z0-9]+',' ', longer).strip()
            related=len(phrase)>=8 and (container==phrase or container.startswith(phrase+' ') or container.endswith(' '+phrase) or f' {phrase} ' in f' {container} ')
            if related:
                similar_not_attached.append({'id':row['id'],'name':row['name']})
        for alias in re.findall(r'\(([^)]+)\)', title):
            for row in community_index.get(norm(alias), []):
                if row['id']!=ledger and all(item['id']!=row['id'] for item in similar_not_attached):
                    similar_not_attached.append({'id':row['id'],'name':row['name']})
    return {
        'printedTitle':title,
        'fullTitleExactCommunities':[{'id':row['id'],'name':row['name']} for row in full],
        'titleComponents':components,
        'ledgerCommunityId':ledger,
        'ledgerAttachment':'exact_full_title' if ledger else 'not_attached',
        'similarNamesNotAttached':similar_not_attached,
        'populationNote':'Summary figures describe the printed DXB Interact page. A title component that matches a catalogue community does not by itself make those figures that community\'s transactions, and it never makes them a project transaction.',
    }

def phrase_in(hay, phrase):
    hay=re.sub(r'[^a-z0-9]+',' ', hay).strip()
    phrase=re.sub(r'[^a-z0-9]+',' ', phrase).strip()
    if not phrase:
        return False
    return hay==phrase or hay.startswith(phrase+' ') or hay.endswith(' '+phrase) or f' {phrase} ' in f' {hay} '

def project_identity(row, projects, communities_by_id, report_title):
    if row['locationTruncated']:
        return {'status':'truncated_printed_name','catalogueProjectId':None,'subjectTransaction':False,'reason':'The PDF truncates this name with an ellipsis. It is not matched to a shorter or similar catalogue project.'}
    building=row['locationPrinted'].split(',',1)[0].strip()
    hits=[project for project in projects if norm(project['name'])==norm(building) or norm(project['name'])==norm(row['locationPrinted'])]
    if len(hits)>1:
        return {'status':'ambiguous_duplicate_catalogue_name','catalogueProjectId':None,'candidateIds':[project['id'] for project in hits],'subjectTransaction':False,'reason':'More than one catalogue project has this exact name, so no project is selected.'}
    if len(hits)==1:
        project=hits[0]
        community=communities_by_id.get(project.get('communityId'))
        place=norm(row['locationPrinted']+' '+report_title)
        supported=bool(community and phrase_in(place, norm(community['name'])))
        if not supported:
            return {'status':'exact_name_place_not_confirmed','catalogueProjectId':None,'candidateProjectId':project['id'],'candidateProjectName':project['name'],'candidateCommunityId':project.get('communityId'),'subjectTransaction':False,'reason':'The building text equals one catalogue project name, but that project\'s catalogue community is not printed in the location or report title. The row stays area context.'}
        return {'status':'exact_project_name','catalogueProjectId':project['id'],'catalogueProjectName':project['name'],'catalogueCommunityId':project.get('communityId'),'subjectTransaction':False,'reason':'The printed building name equals one catalogue project name and the project\'s catalogue community is printed in the same row or report title. The row remains one area-report sale, not a project headline price or a subject transaction.'}
    return {'status':'no_exact_project_match','catalogueProjectId':None,'subjectTransaction':False}

def main():
    version, as_of, manifest, communities, projects=load_catalogue()
    OUT.mkdir(parents=True, exist_ok=True)
    extracts=OUT/'extracts'
    extracts.mkdir(exist_ok=True)
    sources=[]; summaries=[]; documents=[]
    all_project_hits=[]
    for filename in FILES:
        path=UPLOADS/filename
        if not path.exists():
            raise SystemExit('Missing PDF '+str(path))
        extracted=extract_pdf(str(path))
        if extracted['unparsedTextLines']:
            raise SystemExit('Unparsed text remained in '+filename)
        if any(row['priceAed'] is None or row['date'] is None or row['subjectTransaction'] for row in extracted['rows']):
            raise SystemExit('Incomplete or subject-scoped sale in '+filename)
        identity=title_identity(extracted['title'], communities, projects)
        phases=sorted({match.group(0) for row in extracted['rows'] for match in PHASE_RE.finditer(row['locationPrinted'])})
        locations=sorted({row['locationPrinted'] for row in extracted['rows']})
        hits=[]
        for row in extracted['rows']:
            match=project_identity(row, projects, {item['id']:item for item in communities}, extracted['title'])
            row['projectIdentity']=match
            if match['status']=='exact_project_name':
                hits.append({'location':row['locationPrinted'],'date':row['date'],'priceAed':row['priceAed'],'bedroomsPrinted':row['bedroomsPrinted'],'propertyType':row['propertyType'],'catalogueProjectId':match['catalogueProjectId'],'subjectTransaction':False})
        all_project_hits.extend(hits)
        summary_count=next(metric['value'] for metric in extracted['summaryMetrics'] if metric['metric']=='transaction_count')
        document={
            'sourceId':'area-report-'+slug(filename),
            'localFilename':filename,
            'sha256':extracted['sha256'],
            'title':extracted['title'],
            'pageCount':extracted['pageCount'],
            'pdfCreationDate':extracted['pdfCreationDate'],
            'saleRowCount':len(extracted['rows']),
            'saleRowSha256':row_hash(extracted['rows']),
            'summaryMetrics':extracted['summaryMetrics'],
            'summaryTransactionCount':summary_count,
            'printedRowsVersusSummaryCount':None if summary_count is None else len(extracted['rows'])-int(summary_count),
            'httpsUrlCount':len(extracted['httpsUrlsInPdf']),
            'rowDetailUrlCount':sum(bool(row['detailUrl']) for row in extracted['rows']),
            'publisherHomeUrl':'https://dxbinteract.com/' if 'https://dxbinteract.com/' in extracted['httpsUrlsInPdf'] else None,
            'nonHttpsUrls':extracted['nonHttpsUrlsInPdf'],
            'truncatedLocationCount':sum(bool(row['locationTruncated']) for row in extracted['rows']),
            'unlabeledSpecsGlyphCount':sum(bool(row['unlabeledSpecsGlyph']) for row in extracted['rows']),
            'unstatedSummaryValues':[metric['metric'] for metric in extracted['summaryMetrics'] if not metric['valueStated']],
            'unstatedSummaryYoy':[metric['metric'] for metric in extracted['summaryMetrics'] if not metric['yoyStated']],
            'distinctPrintedLocations':len(locations),
            'phaseLabelsPrinted':phases,
            'dateMin':min(row['date'] for row in extracted['rows']),
            'dateMax':max(row['date'] for row in extracted['rows']),
            'identity':identity,
            'exactProjectSaleCount':len(hits),
            'propertyTypeCounts':{},
        }
        for row in extracted['rows']:
            key=(row['readiness'] or '')+' '+(row['propertyType'] or '')
            document['propertyTypeCounts'][key]=document['propertyTypeCounts'].get(key,0)+1
        body={
            'sourceId':document['sourceId'],
            'localFilename':filename,
            'title':extracted['title'],
            'summaryMetrics':extracted['summaryMetrics'],
            'rows':[{**canonical_sale(row),'projectIdentity':row['projectIdentity'],'scope':row['scope'],'currentSnapshotEligible':False,'subjectTransaction':False} for row in extracted['rows']],
        }
        target=extracts/f'{slug(filename)}.json'
        target.write_text(json.dumps(body, ensure_ascii=False, separators=(',',':')))
        document['extractPath']=str(target.relative_to(ROOT))
        documents.append(document)
        sources.append({
            'id':document['sourceId'],
            'localFilename':filename,
            'sha256':extracted['sha256'],
            'publisher':'DXB Interact',
            'publisherEvidence':'Page-1 figure carries the DXB Interact mark, and the PDF states https://dxbinteract.com/ plus per-sale https://dxb.is/ detail links.',
            'url':'https://dxbinteract.com/',
            'urlRole':'site root stated by the PDF link annotation; not a report-specific canonical URL',
            'retrievedAt':RETRIEVAL,
            'publishedAt':None,
            'pdfCreationDate':extracted['pdfCreationDate'],
            'bodyProvenance':'user-supplied PDF on 2026-10-06',
            'licence':'rights_pending: concise sourced extracts only; report prose is not redistributed',
            'classification':'user_supplied_area_sales_print',
        })
        summaries.append(document)
    packet={
        'schemaVersion':1,
        'packetId':'area-reports-20261006',
        'asOf':RETRIEVAL,
        'status':'reviewed_packet_not_integrated_or_published',
        'snapshotIntegration':{
            'wiredIntoSnapshotBuild':False,
            'publishedSnapshotVersion':version,
            'publishedSnapshotAsOf':as_of,
            'approved2080ForecastRecords':manifest.get('approved2080ForecastRecords'),
            'historicalObservationRows':manifest.get('historicalObservationRows'),
            'reason':'The published builder rejects a source retrieved after the snapshot as-of date. These PDFs were retrieved on 2026-10-06 and the published ledger as-of is 2026-10-05. Loading the sales into that builder would rebuild the historical snapshot and would edit the same integration path as the in-progress V11 candidate. This packet is therefore stored beside the builder and is not referenced by scripts/build-historical-data.py.',
        },
        'rules':{
            'bedroomOrUnitSalesCannotReplaceHeadlinePrices':True,
            'communityOrAreaFiguresAreNotProjectTransactions':True,
            'noInventedPricesRentsUpliftsOrForecasts':True,
            'truncatedNamesAreNotExpanded':True,
            'similarCatalogueNamesAreNotAttached':True,
        },
        'sources':sources,
        'documents':[{key:value for key,value in document.items() if key!='propertyTypeCounts'} | {'propertyTypeCounts':document['propertyTypeCounts']} for document in documents],
        'exactProjectSales':all_project_hits,
        'withheld':[
            'Cover illustrations contain unlabeled percentage fragments. They are not metric cards and are not stored as measurements.',
            'No rent amount in AED is printed. A rental-yield percent is not converted into rent.',
            'Where the rental-yield card prints only a percent sign, no yield is stored.',
            'No year-over-year figure is stored for a card that does not print one. The transaction-count change is not copied onto rental yield.',
            'The year-over-year window is not stated anywhere in the PDFs.',
            'Sale rows that the summary count implies but the print does not show are not invented.',
            'Truncated location strings are stored as printed and are not completed from similar catalogue names.',
            'No 2027-2080 price, rent, uplift, or forecast is created.',
            'The parenthetical percent beside some prices is stored as printed. The PDF does not define it, and the separate capital-gain label remains "No." on every row.',
            'A small building-like glyph beside some bedroom counts has no text label. Its presence is flagged and it is not interpreted as a unit type.',
        ],
    }
    (OUT/'packet.json').write_text(json.dumps(packet, ensure_ascii=False, indent=2))
    (OUT/'ANALYSIS.md').write_text(render_analysis(packet, communities))
    print(json.dumps({
        'documents':len(documents),
        'rows':sum(item['saleRowCount'] for item in documents),
        'exactProjectSales':len(all_project_hits),
        'ledgerAttached':[item['title'] for item in documents if item['identity']['ledgerCommunityId']],
    }, indent=2))

def ledger_line(communities, community_id):
    row=next(item for item in communities if item['id']==community_id)
    return f"{row['name']} (`{row['id']}`) has direct sale periods {row['directSalePeriods']}, direct rent periods {row['directRentPeriods']}, forecast status {row['validatedPriceForecast']}, and history-series scopes {row['historySeriesScopes'] or 'none'}."

def render_analysis(packet, communities):
    lines=[]
    lines.append('# Area-report packet, 6 October 2026')
    lines.append('')
    lines.append('Fifteen user-supplied DXB Interact printouts were read in full. The packet stores every labeled summary cell and every printed sale row. It does not rebuild or deploy the published historical ledger.')
    lines.append('')
    lines.append(f"The comparison ledger is `{packet['snapshotIntegration']['publishedSnapshotVersion']}`, as of {packet['snapshotIntegration']['publishedSnapshotAsOf']}, with {packet['snapshotIntegration']['historicalObservationRows']} public aggregate observations and {packet['snapshotIntegration']['approved2080ForecastRecords']} validated through-2080 forecasts.")
    lines.append('')
    lines.append('## What the pages are')
    lines.append('')
    lines.append('Each PDF is a browser print of a DXB Interact area page. Page 1 states four summary cards: median price per square foot, median price, transaction count, and rental yield, with a year-over-year line where the page prints one. Later pages are a Property Sales History table. The PDF states `https://dxbinteract.com/` and one `https://dxb.is/` detail link per sale. It does not state a report-specific canonical URL, a sample methodology, a comparison window, or a forecast.')
    lines.append('')
    lines.append('The summary transaction count is larger than the number of printed sale rows for 14 of the 15 pages. Those history tables are the rows that fitted in the print, not the population named by the summary. Arancia Yards By Beyond is the exception: the summary count and the printed row count are both 247. That is a count match, not a certificate that every row was independently reconciled to a land-registry extract.')
    lines.append('')
    lines.append('## Area context and catalogue identity')
    lines.append('')
    lines.append('A figure is attached to a catalogue community only when the full printed title equals that community name. A comma-separated title is one page, not two populations. Similar names are listed and left unattached. No sale is given `subjectTransaction: true`, and none is eligible to replace a project headline price.')
    lines.append('')
    for document in packet['documents']:
        identity=document['identity']
        lines.append(f"### {document['title']}")
        lines.append('')
        lines.append(f"File `{document['localFilename']}` has {document['saleRowCount']} printed sales, dated {document['dateMin']} to {document['dateMax']}. The summary transaction count is {int(document['summaryTransactionCount']) if document['summaryTransactionCount'] is not None else 'unstated'}. Printed rows minus that count: {document['printedRowsVersusSummaryCount']}. Truncated location strings: {document['truncatedLocationCount']}. Distinct printed location strings: {document['distinctPrintedLocations']}.")
        metrics=[]
        for metric in document['summaryMetrics']:
            value='unstated' if not metric['valueStated'] else metric['value']
            yoy='unstated' if not metric['yoyStated'] else metric['yoyPercent']
            metrics.append(f"{metric['label']} {value} (YoY {yoy})")
        lines.append('Summary: '+'; '.join(metrics)+'.')
        if document['phaseLabelsPrinted']:
            lines.append('Phase labels printed inside location strings: '+', '.join(document['phaseLabelsPrinted'])+'.')
        lines.append(f"Identity attachment: {identity['ledgerAttachment']}.")
        if identity['ledgerCommunityId']:
            lines.append(ledger_line(communities, identity['ledgerCommunityId']))
            if identity['similarNamesNotAttached']:
                lines.append('Similar catalogue names that are not attached: '+', '.join(f"{item['name']} (`{item['id']}`)" for item in identity['similarNamesNotAttached'])+'.')
        else:
            lines.append('No catalogue community receives these figures as its own transactions.')
        for component in identity['titleComponents']:
            exact=', '.join(f"{item['name']} (`{item['id']}`)" for item in component['exactCommunityMatches']) or 'none'
            near=', '.join(f"{item['name']} (`{item['id']}`)" for item in component['nearCommunityMatches']) or 'none'
            longer=', '.join(f"{item['name']} (`{item['id']}`)" for item in component['longerCommunityNamesNotAttached']) or 'none'
            shorter=', '.join(f"{item['name']} (`{item['id']}`)" for item in component['shorterProjectNamesNotAttached']) or 'none'
            if len(identity['titleComponents'])>1 or component['nearCommunityMatches'] or component['longerCommunityNamesNotAttached'] or component['shorterProjectNamesNotAttached'] or not identity['ledgerCommunityId']:
                lines.append(f"Title component \"{component['printed']}\": exact community match {exact}; near community match {near}; longer community names not attached {longer}; shorter project names not attached {shorter}.")
        lines.append(f"Exact project-name sales inside this page: {document['exactProjectSaleCount']}. Each remains an area-report sale.")
        lines.append('')
    lines.append('## Ledger gaps these pages do not close')
    lines.append('')
    lines.append('Every matched community still has zero direct subject sale periods and an unestablished validated price forecast. Existing community-context series, where the ledger has them, are prior area aggregates. These prints do not identify a catalogue project\'s unit history, do not supply signed rents, and do not validate a 2027-2080 path.')
    lines.append('')
    lines.append('The pages that do match a full community title — Jebel Ali, Dubai Hills Estate, Jumeirah Village Circle (JVC), Business Bay, Dubai Creek Harbour, Dubai South, Palm Jebel Ali, and Downtown Dubai — are area context for that community page. They are still not project transactions. Jebel Ali Village, Downtown Jebel Ali, Jumeirah Village Circle, JVC, and Sobha Hartland II are different catalogue records and receive nothing from a merely similar title.')
    lines.append('')
    lines.append('Combined titles stay on the printed page. Emaar Beachfront and Dubai Harbour are both exact catalogue communities, so assigning one set of medians to both, or choosing one silently, would invent a boundary the PDF does not draw. Damac Hills matches as a title component, while Al Hebiah Third has no catalogue record. Dubai Marina matches as a title component, while Marsa Dubai has no catalogue record. Town Square is not Town Square Dubai. The Oasis (All Phases) is not the catalogue record The Oasis. Arancia Yards By Beyond (All Buildings) is not the catalogue project Arancia Yards and is not the whole of City of Arabia, even though City of Arabia is an exact title component.')
    lines.append('')
    lines.append(f"Printed building text equals a catalogue project name on {len(packet['exactProjectSales'])} sales where that project's community is also printed, and on {packet.get('placeWithheldNameMatches',0)} further sales where the community is not printed. Only the first group records a catalogue project id. Neither group is a subject transaction, and neither can replace a headline price.")
    lines.append('')
    lines.append('## Evidence limits')
    lines.append('')
    for item in packet['withheld']:
        lines.append(f'- {item}')
    lines.append('- Office is recovered only where the text layer reads `Of` plus a null plus `ce` and the rendered word is Office. The null is the broken `fi` ligature, and the raw layer is kept.')
    lines.append('- One Downtown row is a Ready Building sale at Emaar Square 3 for AED 725,000,000 with no bedroom count. It stays an area-report sale.')
    lines.append('- Printed year-over-year percentages, including very large transaction-count changes, are not price uplifts and are not fed into a 2027-2080 forecast.')
    lines.append('- Snapshot integration and production deployment are separate later steps. This packet is not part of the V9 snapshot and does not alter the in-progress V11 candidate.')
    lines.append('')
    return '\n'.join(lines)+'\n'

def refresh_identity():
    version, as_of, manifest, communities, projects=load_catalogue()
    communities_by_id={item['id']:item for item in communities}
    packet=json.loads((OUT/'packet.json').read_text())
    exact=[]
    withheld=0
    for document in packet['documents']:
        path=ROOT/document['extractPath']
        body=json.loads(path.read_text())
        document['identity']=title_identity(body['title'], communities, projects)
        hits=0
        for row in body['rows']:
            match=project_identity(row, projects, communities_by_id, body['title'])
            row['projectIdentity']=match
            row['subjectTransaction']=False
            row['currentSnapshotEligible']=False
            row['scope']='area_report_printed_sale'
            if match['status']=='exact_project_name':
                hits+=1
                exact.append({'location':row['locationPrinted'],'date':row['date'],'priceAed':row['priceAed'],'bedroomsPrinted':row['bedroomsPrinted'],'propertyType':row['propertyType'],'catalogueProjectId':match['catalogueProjectId'],'subjectTransaction':False})
            elif match['status']=='exact_name_place_not_confirmed':
                withheld+=1
        document['exactProjectSaleCount']=hits
        document['saleRowSha256']=row_hash(body['rows'])
        path.write_text(json.dumps(body, ensure_ascii=False, separators=(',',':')))
    packet['exactProjectSales']=exact
    packet['placeWithheldNameMatches']=withheld
    packet['snapshotIntegration']['publishedSnapshotVersion']=version
    packet['snapshotIntegration']['publishedSnapshotAsOf']=as_of
    (OUT/'packet.json').write_text(json.dumps(packet, ensure_ascii=False, indent=2))
    (OUT/'ANALYSIS.md').write_text(render_analysis(packet, communities))
    print(json.dumps({'exactProjectSales':len(exact),'placeWithheldNameMatches':withheld,'ledger':[d['title'] for d in packet['documents'] if d['identity']['ledgerCommunityId']]}, indent=2))

if __name__=='__main__':
    import sys
    if '--refresh-identity' in sys.argv:
        refresh_identity()
    else:
        main()
