"""Run every browser suite and retain all failures instead of stopping at the first suite."""
import concurrent.futures
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'tests/e2e/out'
out.mkdir(exist_ok=True)
suites = ['lifecycle', 'features', 'upgrade', 'apk-updater', 'ui-cleanup', 'effects-browser', 'ui-duplication', 'ui-audit', 'smart-scenes']

def run(name):
    command = [sys.executable, f'tests/e2e/{name}.py']
    if name == 'ui-duplication': command += ['--assert']
    try:
        result = subprocess.run(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=240)
        log, code = result.stdout, result.returncode
    except subprocess.TimeoutExpired as error:
        log, code = str(error), 1
    (out / f'{name}.log').write_text(log)
    return name, code, log

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(run, suites))
for name, code, log in results:
    print(f'\n===== {name}: {"PASS" if code == 0 else "FAIL"} =====\n{log}', flush=True)
print(f'Browser suites: {sum(code == 0 for _, code, _ in results)}/{len(results)} passed')
sys.exit(int(any(code != 0 for _, code, _ in results)))
