import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result = spawnSync(process.env.HI_PYTHON || 'python3', [fileURLToPath(new URL('./build-historical-data.py', import.meta.url)), ...process.argv.slice(2)], {stdio:'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
