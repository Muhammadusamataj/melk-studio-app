#!/usr/bin/env python3
"""Read the two public URLs the app actually uses. Never publishes or mutates a feed."""
import argparse
import concurrent.futures
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]

def read(pair):
    kind,url=pair
    try:
        request=urllib.request.Request(url,headers={'Cache-Control':'no-cache','Accept':'application/json'})
        with urllib.request.urlopen(request,timeout=15) as response:
            return {'kind':kind,'url':url,'httpStatus':response.status,'manifest':json.load(response)}
    except urllib.error.HTTPError as error:
        return {'kind':kind,'url':url,'httpStatus':error.code,'missing':error.code==404}
    except Exception as error:
        return {'kind':kind,'url':url,'error':str(error)}

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    apk=re.search(r"const MANIFEST_URL = '([^']+)'",(ROOT/'www/js/apk-updater.js').read_text())[1]
    web=re.search(r"const DEFAULT_URL = '([^']+)'",(ROOT/'www/js/ota.js').read_text())[1]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: report=list(pool.map(read,[('apk',apk),('web',web)]))
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
