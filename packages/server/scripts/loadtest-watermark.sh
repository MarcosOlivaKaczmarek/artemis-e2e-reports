#!/usr/bin/env bash
# Validates the disk-watermark guard by uploading synthetic archives in a loop
# and asserting that uploads keep succeeding even when /data is near-full.
#
# Run against a *local* dev instance with a small tmpfs-backed /data:
#   docker run --rm -p 3000:3000 \
#     --tmpfs /data:size=2G \
#     -e DATA_DIR=/data -e DB_PATH=/data/reports.db \
#     -e UPLOAD_TOKEN=test -e DISK_WATERMARK_BYTES=$((512*1024*1024)) \
#     -e MAX_AGE_DAYS=0 -e MAX_RUNS_PER_PR_PHASE=1 -e MAX_RUNS_PER_NULL_PR_GROUP=1 \
#     ghcr.io/ls1intum/artemis-e2e-reports:test
#
#   ./loadtest-watermark.sh http://localhost:3000 test 60
#
set -euo pipefail
BASE_URL="${1:-http://localhost:3000}"
TOKEN="${2:-test}"
N="${3:-30}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Build a ~400 MB synthetic archive once and reuse it.
mkdir -p "$WORK/test-reports/monocart-report-parallel/attachments"
mkdir -p "$WORK/test-reports/client-coverage"
cat > "$WORK/test-reports/results.xml" <<'XML'
<?xml version="1.0"?>
<testsuites>
  <testsuite name="loadtest" tests="1" failures="0" time="0.1">
    <testcase classname="loadtest" name="ok" time="0.1"/>
  </testsuite>
</testsuites>
XML
dd if=/dev/urandom of="$WORK/test-reports/monocart-report-parallel/attachments/big.webm" bs=1M count=400 status=none
ARCHIVE="$WORK/upload.tar.gz"
tar -C "$WORK" -czf "$ARCHIVE" test-reports

fail=0
for i in $(seq 1 "$N"); do
  RUN_ID="loadtest-$(date +%s)-$i"
  CODE=$(curl -sS -o /tmp/upload.out -w '%{http_code}' \
    -X PUT "$BASE_URL/api/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "archive=@$ARCHIVE" \
    -F "run_id=$RUN_ID" \
    -F "github_run_id=$i" \
    -F "branch=loadtest" \
    -F "commit_sha=deadbeef" \
    -F "phase=phase1")
  echo "[$i] HTTP $CODE"
  if [ "$CODE" != "200" ]; then
    cat /tmp/upload.out
    fail=$((fail + 1))
  fi
done

echo "---"
if [ "$fail" -gt 0 ]; then
  echo "FAIL: $fail/$N uploads errored — disk-watermark guard did not keep up."
  exit 1
fi
echo "PASS: all $N uploads succeeded under sustained pressure."
