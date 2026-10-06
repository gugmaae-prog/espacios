"""Extract DXB Interact area-report PDFs into structured rows.

The text layer is the source of record. Cover-art percentages are not metrics.
Unit sales stay row-level evidence and are never headline project prices.
"""
import hashlib, re
from pdfminer.converter import PDFPageAggregator
from pdfminer.layout import LAParams, LTChar, LTLine, LTTextContainer, LTTextLineHorizontal
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdfminer.pdftypes import resolve1

MONTHS={'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}
HEADER_EXACT={'location','status','price','specs','date','capital gain','sold by','property sales history','sales performance summary','details'}
DATE_RE=re.compile(r'^(\d{1,2}),\s*([A-Za-z]{3,9})\s+(\d{4})$')
PCT_RE=re.compile(r'\(([+-]?\d+(?:\.\d+)?)%\)')
MONEY_RE=re.compile(r'(-?\d[\d,]*(?:\.\d+)?)')
YOY_RE=re.compile(r'^([+-]?\d+(?:\.\d+)?)%\s*YoY$')
BARE_YOY_RE=re.compile(r'^%\s*YoY$')

def sha256_file(path):
    h=hashlib.sha256()
    with open(path,'rb') as handle:
        for chunk in iter(lambda: handle.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest()

def _text(value):
    if isinstance(value, bytes):
        return value.decode('utf-8', 'replace')
    return str(value)

def iter_layouts(path):
    with open(path,'rb') as handle:
        parser=PDFParser(handle)
        document=PDFDocument(parser)
        resources=PDFResourceManager()
        device=PDFPageAggregator(resources, laparams=LAParams())
        interpreter=PDFPageInterpreter(resources, device)
        for index, page in enumerate(PDFPage.create_pages(document)):
            interpreter.process_page(page)
            annots=[]
            raw=resolve1(page.annots) if page.annots else []
            for item in raw or []:
                obj=resolve1(item)
                if not isinstance(obj, dict):
                    continue
                rect=obj.get('Rect')
                action=resolve1(obj.get('A')) if obj.get('A') else None
                uri=None
                if isinstance(action, dict) and action.get('URI'):
                    uri=_text(action.get('URI'))
                if rect and uri:
                    box=[float(x) for x in resolve1(rect)]
                    annots.append({'rect':box,'uri':uri,'https':uri.startswith('https://')})
            yield index, device.get_result(), annots

def line_items(layout):
    rows=[]
    glyphs=[]
    for element in layout:
        if isinstance(element, LTLine):
            glyphs.append(element)
            continue
        if not isinstance(element, LTTextContainer):
            continue
        for line in element:
            if not isinstance(line, LTTextLineHorizontal):
                continue
            text=line.get_text().replace('\n','')
            if not text.strip():
                continue
            runs=[]
            buffer=''; start=None; end=None
            for char in line:
                if isinstance(char, LTChar):
                    if start is None:
                        start=char.x0
                    buffer += char.get_text(); end=char.x1
                elif buffer:
                    runs.append({'x0':start,'x1':end,'text':buffer})
                    buffer=''; start=None; end=None
            if buffer:
                runs.append({'x0':start,'x1':end,'text':buffer})
            rows.append({'y':line.y1,'x0':line.x0,'x1':line.x1,'text':text.strip(),'runs':runs})
    rows.sort(key=lambda item: (-item['y'], item['x0']))
    return rows, glyphs

def parse_number(text):
    if text is None:
        return None
    match=MONEY_RE.search(text.replace(' ',''))
    if not match:
        return None
    return float(match.group(1).replace(',',''))

def parse_date(text):
    match=DATE_RE.match(text.strip())
    if not match:
        return None
    month=MONTHS.get(match.group(2)[:3].lower())
    if not month:
        return None
    return f'{int(match.group(3)):04d}-{month:02d}-{int(match.group(1)):02d}'

def nearest(items, x):
    return min(items, key=lambda item: abs(item['x0']-x))

def parse_summary(lines):
    title=None
    for line in lines:
        if line['y']>640 and line['text'].casefold() not in HEADER_EXACT and 'sales performance' not in line['text'].casefold():
            title=line['text']
            break
    labels=[line for line in lines if line['y']>430 and line['y']<470]
    values=[line for line in lines if 400 < line['y'] < 440 and line['text'] not in {item['text'] for item in labels}]
    yoys=[line for line in lines if 360 < line['y'] < 410 and 'YoY' in line['text']]
    order=['median_price_per_sqft','median_price_aed','transaction_count','rental_yield_percent']
    label_names={
        'median price / sqft':'median_price_per_sqft',
        'median price':'median_price_aed',
        'transactions':'transaction_count',
        'rental yield':'rental_yield_percent',
    }
    metrics=[]
    for label in sorted(labels, key=lambda item: item['x0']):
        key=label_names.get(label['text'].casefold())
        if not key:
            continue
        value_line=nearest(values, label['x0']) if values else None
        if value_line and abs(value_line['x0']-label['x0'])>120:
            value_line=None
        yoy_line=nearest(yoys, label['x0']) if yoys else None
        raw_value=value_line['text'] if value_line else None
        number=parse_number(raw_value) if raw_value and raw_value not in {'%'} else None
        yoy=None; yoy_stated=False; yoy_raw=None
        if yoy_line and abs(yoy_line['x0']-label['x0'])<=80:
            yoy_raw=yoy_line['text']
            found=YOY_RE.match(yoy_raw.strip())
            if found:
                yoy=float(found.group(1)); yoy_stated=True
            elif BARE_YOY_RE.match(yoy_raw.strip()):
                yoy_raw=yoy_line['text']
        metrics.append({
            'metric':key,
            'label':label['text'],
            'rawValue':raw_value,
            'value':number,
            'valueStated':number is not None,
            'unit':{'median_price_per_sqft':'AED/sqft','median_price_aed':'AED','transaction_count':'transactions','rental_yield_percent':'percent'}[key],
            'yoyPercent':yoy,
            'yoyRaw':yoy_raw,
            'yoyStated':yoy_stated,
            'yoyWindow':'not stated in the PDF',
        })
    found={item['metric'] for item in metrics}
    if found!=set(order) or title is None:
        raise ValueError('Summary page did not yield the four labeled metrics and a title: '+str(title)+' '+str(found))
    metrics.sort(key=lambda item: order.index(item['metric']))
    return title, metrics

def tokenise(line):
    tokens=[]
    for run in line['runs']:
        piece=run['text']
        if piece.strip():
            tokens.append({'x0':run['x0'],'text':piece.strip()})
    return tokens

def parse_sale(anchor, band, glyphs, annots, page_index, row_index):
    primary=[item for item in band if item['y']>anchor['y']-8]
    secondary=[item for item in band if item['y']<=anchor['y']-8]
    price_bits=[item['text'] for item in primary if 300 <= item['x0'] < 480]
    spec_bits=[item['text'] for item in primary if 470 <= item['x0'] < 590]
    date_bits=[item['text'] for item in primary if 580 <= item['x0'] < 740]
    price_text=' '.join(price_bits)
    pct=PCT_RE.search(price_text)
    sqft_text=' '.join(spec_bits)
    sqft=parse_number(sqft_text) if 'sqft' in sqft_text.casefold() or parse_number(sqft_text) else None
    if sqft_text and 'sqft' not in sqft_text.casefold() and not re.search(r'\d', sqft_text):
        sqft=None
    date_text=next((item['text'] for item in primary if DATE_RE.match(item['text'])), None)
    status_line=next((item for item in secondary if item['x0']<250), None)
    tokens=tokenise(status_line) if status_line else []
    readiness=tokens[0]['text'] if tokens else None
    property_type_layer=tokens[1]['text'] if len(tokens)>1 else None
    property_type=property_type_layer
    property_type_recovery=None
    if property_type_layer and '\x00' in property_type_layer:
        if property_type_layer.replace('\x00','')=='Ofce':
            # The embedded Lato glyph for the "fi" ligature in Office extracts as U+0000.
            property_type='Office'
            property_type_recovery='text_layer_null_is_fi_ligature_office'
        else:
            property_type=property_type_layer.replace('\x00','')
            property_type_recovery='text_layer_contained_null'
    capital=tokens[2]['text'] if len(tokens)>2 else None
    psf_bits=[item['text'] for item in secondary if 320 <= item['x0'] < 480]
    bed_bits=[item['text'] for item in secondary if 470 <= item['x0'] < 580 and 'sqft' not in item['text'].casefold()]
    sold_bits=[item['text'] for item in secondary if 560 <= item['x0'] < 740]
    bedrooms_text=' '.join(bed_bits).strip() or None
    icon_lines=[line for line in glyphs if 520 <= line.x0 <= 555 and abs(line.x1-line.x0)<16 and abs(line.y1-line.y0)<14 and anchor['y']-34 <= (line.y0+line.y1)/2 <= anchor['y']-10]
    glyph=len(icon_lines)>=4
    details=[item for item in primary+secondary if item['text'].casefold()=='details']
    detail_y=details[0]['y'] if details else anchor['y']-12
    candidates=[]
    for annot in annots:
        x0,y0,x1,y1=annot['rect']
        if (x0+x1)/2 < 700:
            continue
        if abs(((y0+y1)/2) - detail_y) <= 18:
            candidates.append(annot)
    uri=None
    if candidates:
        uri=min(candidates, key=lambda annot: abs(((annot['rect'][1]+annot['rect'][3])/2)-detail_y))['uri']
    location=anchor['text']
    truncated=location.endswith('…') or location.endswith('...') or '…' in location
    price=parse_number(price_text)
    return {
        'page':page_index+1,
        'rowIndex':row_index,
        'locationPrinted':location,
        'locationTruncated':truncated,
        'priceAed':price,
        'priceRaw':price_text.strip() or None,
        'priceParentheticalPercent':float(pct.group(1)) if pct else None,
        'priceParentheticalPercentDefined':False,
        'areaSqft':sqft,
        'areaRaw':sqft_text.strip() or None,
        'datePrinted':date_text,
        'date':parse_date(date_text) if date_text else None,
        'readiness':readiness,
        'propertyType':property_type,
        'propertyTypeTextLayer':property_type_layer,
        'propertyTypeRecovery':property_type_recovery,
        'capitalGainLabel':capital,
        'pricePerSqftAed':parse_number(' '.join(psf_bits)),
        'bedroomsPrinted':bedrooms_text,
        'soldBy': ' '.join(sold_bits).strip() or None,
        'detailUrl':uri if uri and uri.startswith('https://') else None,
        'detailUrlNonHttps':uri if uri and not uri.startswith('https://') else None,
        'unlabeledSpecsGlyph':glyph,
        'currentSnapshotEligible':False,
        'scope':'area_report_printed_sale',
        'subjectTransaction':False,
    }

def pdf_creation_date(path):
    with open(path,'rb') as handle:
        document=PDFDocument(PDFParser(handle))
        info=(document.info or [{}])[0]
        return _text(info.get('CreationDate') or '')

def extract_pdf(path):
    pages=list(iter_layouts(path))
    if not pages:
        raise ValueError('Empty PDF '+path)
    summary_lines, _=line_items(pages[0][1])
    title, metrics=parse_summary(summary_lines)
    rows=[]; unparsed=[]
    for index, layout, annots in pages[1:]:
        lines, glyphs=line_items(layout)
        anchors=[line for line in lines if line['x0']<80 and line['text'].casefold() not in HEADER_EXACT and not line['text'].casefold().startswith(('ready','offplan','off-plan','sales performance'))]
        consumed={id(line) for line in anchors}
        for anchor in anchors:
            band=[line for line in lines if anchor['y']-36 <= line['y'] <= anchor['y']+6]
            for line in band:
                consumed.add(id(line))
            rows.append(parse_sale(anchor, band, glyphs, annots, index, len(rows)+1))
        for line in lines:
            if id(line) in consumed:
                continue
            if line['text'].casefold() in HEADER_EXACT or line['text'].casefold() in {'median price / sqft','median price','transactions','rental yield'}:
                continue
            unparsed.append({'page':index+1,'x':round(line['x0'],1),'y':round(line['y'],1),'text':line['text']})
    https_urls=sorted({annot['uri'] for _,_,annots in pages for annot in annots if annot['https']})
    other_urls=sorted({annot['uri'] for _,_,annots in pages for annot in annots if not annot['https']})
    return {
        'title':title,
        'pageCount':len(pages),
        'pdfCreationDate':pdf_creation_date(path),
        'summaryMetrics':metrics,
        'rows':rows,
        'unparsedTextLines':unparsed,
        'httpsUrlsInPdf':https_urls,
        'nonHttpsUrlsInPdf':other_urls,
        'sha256':sha256_file(path),
    }
