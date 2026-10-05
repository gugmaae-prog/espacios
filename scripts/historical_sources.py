"""Canonical references with explicitly immutable capture revisions."""
import hashlib


def register_source(item, sources, url_ids, aliases, canonical_url, capture_asof):
    item = dict(item)
    url = canonical_url(item.get('url'))
    requested = item.get('id') or 'url-' + hashlib.sha256(url.encode()).hexdigest()[:16]
    ident = requested
    if requested in sources and sources[requested].get('preserveRevision') and not item.get('preserveRevision'):
        if canonical_url(sources[requested].get('url')) != url:
            raise ValueError('Immutable revision reference has a different URL')
        aliases[requested] = requested
        return requested
    if item.get('preserveRevision'):
        prior_id = aliases.get(item.get('revisionOfSourceId'), item.get('revisionOfSourceId'))
        if not prior_id or prior_id not in sources:
            raise ValueError('Source revision requires an existing predecessor')
        if requested == prior_id or canonical_url(sources[prior_id].get('url')) != url:
            raise ValueError('Source revision must have a new ID and the same canonical URL')
        item['revisionOfSourceId'] = prior_id
        item['canonicalSourceId'] = sources[prior_id].get('canonicalSourceId', prior_id)
    elif url in url_ids:
        ident = url_ids[url]
    aliases[requested] = ident
    item['id'] = ident
    item['url'] = url
    item.setdefault('publishedAt', item.get('published') or None)
    item.setdefault('firstAvailableAt', item['publishedAt'])
    item.setdefault('retrievedAt', item.get('retrieved') or item.get('capturedAt') or capture_asof)
    item.setdefault('datePrecision', 'day' if item.get('publishedAt') else 'unknown')
    item.setdefault('licence', 'rights_pending: citation and source metadata only; redistribution not inferred')
    item.setdefault('classification', 'source_metadata')
    item.setdefault('publicationDateStatus', 'known' if item.get('publishedAt') else 'research_pending')
    old = sources.get(ident, {})
    if item.get('preserveRevision') and old and old != item:
        raise ValueError('Immutable source revision cannot be overwritten')
    sources[ident] = {**old, **{k: v for k, v in item.items() if v is not None or k not in old}}
    if url and not item.get('preserveRevision'):
        url_ids[url] = ident
    return ident
