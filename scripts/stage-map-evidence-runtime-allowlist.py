#!/usr/bin/env python3
"""Stage an exact, zero-traffic MapEvidence registry extension on auth-central.

The shared auth Worker is downloaded from the pinned live production version.
Only its MapEvidence module and registry are changed. No credentials or source
modules are printed or committed. This script never promotes traffic.
"""
import base64
import hashlib
import json
import os
import ssl
import subprocess
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'work/private-map-evidence-runtime-20261114'
ALLOWLIST = ROOT / 'data/uae-evidence/idrive-e2-runtime-allowlist-20261115.json'
ACCOUNT = 'b1b843ec85bc39a3a4d370ba4f84f17a'
WORKER = 'espacios-auth-central'
PRODUCTION = '19ebc965-ec69-49d3-a50a-4b7b0cc2dcc3'
PRODUCTION_ETAG = '0f5f0cf301a5b4ffebdb676c0bb56cf512de671b3e473bf925270bfb03e77eef'
MODULE_HASHES = {
    'map-evidence-registry.mjs': '37725117b07074aca94823c2e5d0f18e246ced53ae6f40ba4341d622f455dcc3',
    'map-evidence.mjs': '3319ca437ff4f5508b296dccb6b19e09353e986c1b9821297d2322dd4a280ddf',
    'oauth-security.mjs': '297f4f16c0d6b2deadbcba2452fa01beef79f04e4cdfab6e7386658752e38ba4',
    'worker.js': '2355a0a8634747882382474b07e495e7fbc0b0c16a2a88f0477e4e0b7f7c778f',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def token():
    with (Path.home() / '.wrangler/config/default.toml').open('rb') as handle:
        return tomllib.load(handle)['oauth_token']


def request(auth, method, route, payload=None):
    headers = {'Authorization': 'Bearer ' + auth}
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        payload = json.dumps(payload, separators=(',', ':')).encode()
    url = 'https://api.cloudflare.com/client/v4' + route
    try:
        context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
        with urllib.request.urlopen(urllib.request.Request(url, data=payload, method=method, headers=headers), timeout=120, context=context) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        body = error.read()
        try:
            detail = json.loads(body)
            messages = [(item.get('code'), item.get('message')) for item in detail.get('errors', [])]
        except ValueError:
            messages = []
        raise RuntimeError(f'Cloudflare {method} {route} returned {error.code}: {messages}') from None


def result(auth, method, route, payload=None):
    _, _, body = request(auth, method, route, payload)
    value = json.loads(body)
    if value.get('success') is not True:
        raise RuntimeError(f'Cloudflare rejected {method} {route}: {value.get("errors")}')
    return value['result']


def deployed(auth):
    route = f'/accounts/{ACCOUNT}/workers/scripts/{WORKER}/deployments'
    versions = result(auth, 'GET', route)['deployments'][0]['versions']
    if versions != [{'version_id': PRODUCTION, 'percentage': 100}]:
        raise RuntimeError('Shared auth Worker production version or traffic changed')
    return versions


def modules(auth):
    # A script download returns the latest upload, which may be an undeployed candidate.
    # Fetch the immutable production version explicitly before checking every module hash.
    route = f'/accounts/{ACCOUNT}/workers/workers/{WORKER}/versions/{PRODUCTION}?include=modules'
    version = result(auth, 'GET', route)
    if version.get('id') != PRODUCTION or not isinstance(version.get('modules'), list):
        raise RuntimeError('Unexpected production Worker version response')
    found = {part['name']: base64.b64decode(part['content_base64'], validate=True) for part in version['modules']}
    if set(found) != set(MODULE_HASHES) or any(sha(found[name]) != expected for name, expected in MODULE_HASHES.items()):
        raise RuntimeError('Shared auth Worker module bytes changed')
    return found


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise RuntimeError('MapEvidence patch anchor changed')
    return source.replace(old, new)


def patched(auth):
    deployed(auth)
    version = result(auth, 'GET', f'/accounts/{ACCOUNT}/workers/scripts/{WORKER}/versions/{PRODUCTION}')
    if version['resources']['script']['etag'] != PRODUCTION_ETAG:
        raise RuntimeError('Production script etag mismatch')
    runtime = version['resources']['script_runtime']
    if runtime['compatibility_date'] != '2026-06-21' or runtime['compatibility_flags'] != ['nodejs_compat']:
        raise RuntimeError('Shared auth Worker runtime changed')
    bindings = version['resources']['bindings']
    if len(bindings) != 56 or len({b['name'] for b in bindings}) != 56 or not {'E2A_KEY', 'E2A_SECRET'} <= {b['name'] for b in bindings}:
        raise RuntimeError('Shared auth Worker bindings changed')
    source = modules(auth)
    manifest = json.loads(ALLOWLIST.read_bytes())
    if manifest['version'] != '20261115-idrive-e2-runtime-allowlist-v3' or manifest['publishedObjectCount'] != 198 or manifest['excludedPrivateOriginalParts'] != 10 or manifest['coveredInventorySourceCount'] != 44:
        raise RuntimeError('Runtime allowlist changed')
    registry_text = source['map-evidence-registry.mjs'].decode()
    if not registry_text.startswith('export default ') or not registry_text.endswith(';\n'):
        raise RuntimeError('Unexpected legacy registry module')
    registry = json.loads(registry_text[len('export default '):-2])
    if len(registry) != 2720:
        raise RuntimeError('Legacy MapEvidence registry changed')
    for item in manifest['entries']:
        key = item['key']
        if key in registry or not key.startswith('espacios-map/uae-evidence/') or '/originals/' in key:
            raise RuntimeError('Invalid or overlapping runtime evidence key')
        registry[key] = {'sha256': item['sha256'], 'bytes': item['bytes'], 'contentType': item['contentType'], 'storageKey': key, 'readOnly': True, 'sourceId': item['sourceId']}
    source['map-evidence-registry.mjs'] = ('export default ' + json.dumps(registry, ensure_ascii=False, separators=(',', ':')) + ';\n').encode()
    service = source['map-evidence.mjs'].decode()
    service = replace_once(service,
        "    if (!['GET', 'HEAD', 'PUT'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, PUT' } });",
        "    if (item.readOnly && request.method === 'PUT') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });\n    if (!['GET', 'HEAD', 'PUT'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, PUT' } });")
    service = replace_once(service, "storagePrefix(key) + item.sha256, item.sha256", "(item.storageKey || storagePrefix(key) + item.sha256), item.sha256")
    service = replace_once(service, "storagePrefix(key) + item.sha256, EMPTY_SHA", "(item.storageKey || storagePrefix(key) + item.sha256), EMPTY_SHA")
    service = replace_once(service, "'x-evidence-version': key ===", "'x-evidence-version': item.storageKey ? '20261114-uae-evidence-runtime-v1' : key ===")
    source['map-evidence.mjs'] = service.encode()
    return source, bindings, runtime, manifest


def save_private(name, data):
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = STATE / name
    with target.open('xb') as handle:
        os.chmod(target, 0o600)
        handle.write(data)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('prepare', 'stage'):
        raise SystemExit('Usage: stage-map-evidence-runtime-allowlist.py prepare|stage')
    subprocess.run(['node', 'scripts/build-map-evidence-runtime-allowlist.mjs', '--check'], cwd=ROOT, check=True)
    auth = token()
    source, bindings, runtime, manifest = patched(auth)
    summary = {'baseWorker': WORKER, 'baseVersion': PRODUCTION, 'baseEtag': PRODUCTION_ETAG, 'allowlistSha256': sha(ALLOWLIST.read_bytes()), 'newEntryCount': len(manifest['entries']), 'legacyEntryCount': 2720, 'moduleSha256': {name: sha(data) for name, data in source.items()}, 'bindingCount': len(bindings)}
    for name in ('map-evidence.mjs', 'map-evidence-registry.mjs'):
        subprocess.run(['node', '--check', '/dev/stdin'], input=source[name], check=True)
    if sys.argv[1] == 'prepare':
        print(json.dumps({'prepared': True, **summary}))
        return
    if (STATE / 'stage.json').exists():
        raise RuntimeError('A prior staged version exists; inspect it before another upload')
    save_private('base-source-sha256.json', (json.dumps({name: sha(data) for name, data in modules(auth).items()}, indent=2) + '\n').encode())
    payload = {'main_module': 'worker.js', 'compatibility_date': runtime['compatibility_date'], 'compatibility_flags': runtime['compatibility_flags'], 'bindings': [{'name': item['name'], 'type': 'inherit', 'version_id': PRODUCTION} for item in bindings], 'bindings_inherit': 'strict', 'modules': [{'name': name, 'content_type': 'application/javascript+module', 'content_base64': base64.b64encode(data).decode()} for name, data in source.items()], 'annotations': {'workers/message': '196 checksum-pinned published UAE evidence objects; 0 percent traffic; auth source unchanged'}}
    created = result(auth, 'POST', f'/accounts/{ACCOUNT}/workers/workers/{WORKER}/versions?deploy=false', payload)
    candidate = created.get('id')
    if not candidate:
        raise RuntimeError('Cloudflare returned no staged version id')
    save_private('stage.json', (json.dumps({'candidateVersion': candidate, **summary}, indent=2) + '\n').encode())
    deployed(auth)
    staged = result(auth, 'GET', f'/accounts/{ACCOUNT}/workers/scripts/{WORKER}/versions/{candidate}')
    actual = staged['resources']['bindings']
    if {(b['name'], b['type']) for b in actual} != {(b['name'], b['type']) for b in bindings}:
        raise RuntimeError('Staged binding names or types differ from production')
    print(json.dumps({'staged': True, 'candidateVersion': candidate, 'productionUnchanged': True, 'bindingsPreserved': True, **summary}))


if __name__ == '__main__':
    main()
