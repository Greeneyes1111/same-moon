"""Counts from Google's own request log, for the time before the counter was live.

Cloud Run already logs every request to the web service and keeps the log for
30 days. This reads it and saves, for each UTC day, a small file of totals
(stats/<day>/logs-backfill.json in the private bucket) that the studio's
Numbers page adds in. Only totals are saved; addresses in the log are not read.

What the log can tell us:
  open            requests for the story list: one each time the app opens with
                  signal, plus one when the offline helper is set up or updated,
                  so it runs a little high (shown as approximate)
  audioDownloads  whole story files sent (a first play with signal, or a save)

Run it once, right after the counter goes live, with --until set to that time,
so nothing is counted twice:

    python3 tools/log_counts.py --project same-moon-stories \\
        --since 2026-11-20T00:00:00Z --until 2026-11-21T09:30:00Z

Add --dry-run to print the totals without saving them.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from urllib.parse import urlsplit

BOTS = re.compile(r"bot|crawl|spider|preview|externalhit|whatsapp|slack|discord|curl|wget|python|httpclient|headless|monitor", re.I)

ap = argparse.ArgumentParser()
ap.add_argument("--project", required=True)
ap.add_argument("--since", required=True, help="UTC start, e.g. 2026-11-20T00:00:00Z")
ap.add_argument("--until", required=True, help="UTC end: when the counter went live")
ap.add_argument("--service", default="web")
ap.add_argument("--dry-run", action="store_true")
args = ap.parse_args()

flt = (
    'resource.type="cloud_run_revision" '
    f'AND resource.labels.service_name="{args.service}" '
    'AND httpRequest.requestMethod="GET" '
    f'AND timestamp>="{args.since}" AND timestamp<"{args.until}" '
    'AND (httpRequest.requestUrl:"/api/catalogue" OR httpRequest.requestUrl:"/media/audio/")'
)
cmd = [
    "gcloud", "logging", "read", flt, "--project", args.project, "--order", "asc",
    "--format", "value[separator='\t'](timestamp,httpRequest.requestUrl,httpRequest.status,httpRequest.userAgent)",
]
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
days = defaultdict(lambda: {"open": 0, "audioDownloads": 0})
for line in proc.stdout:
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 3:
        continue
    ts, url, status = parts[0], parts[1], parts[2]
    agent = parts[3] if len(parts) > 3 else ""
    if BOTS.search(agent):
        continue
    day = ts[:10]
    u = urlsplit(url)
    if u.path == "/api/catalogue" and status in ("200", "304"):
        days[day]["open"] += 1
    elif u.path.startswith("/media/audio/") and status == "200":
        days[day]["audioDownloads"] += 1
if proc.wait() != 0:
    sys.exit("gcloud logging read failed")

bucket = f"samemoon-state-{args.project}"
for day in sorted(days):
    totals = {"source": "google-request-log", "since": args.since, "until": args.until,
              "open": days[day]["open"], "newPhone": 0, "saveAll": 0, "play": {}, "save": {},
              "audioDownloads": days[day]["audioDownloads"]}
    print(day, json.dumps(totals))
    if not args.dry_run:
        subprocess.run(["gcloud", "storage", "cp", "-", f"gs://{bucket}/stats/{day}/logs-backfill.json",
                        "--project", args.project, "--content-type", "application/json"],
                       input=json.dumps(totals), text=True, check=True)
if not days:
    print("No matching requests in that window.")
