#!/usr/bin/env bash
# CI probe, not for main: test/tyre-fx.mjs N times, 3 at a time, first with main's allocation helper, then with this
# branch's. Counts the runs that failed, the ones that failed on a negative reading, and the retries noted.
set -u
N=${1:-60}
T=${RUNNER_TEMP:-.}
phase() {
  local label=$1 dir=$2 fails=0
  mkdir -p "$dir"
  for ((i = 0; i < N; i += 3)); do
    for j in 0 1 2; do
      k=$((i + j))
      ( node --import ./test/helpers/dom-shim.mjs test/tyre-fx.mjs > "$dir/$k.txt" 2>&1; echo $? > "$dir/$k.rc" ) &
    done
    wait
  done
  for f in "$dir"/*.rc; do [ "$(cat "$f")" = 0 ] || fails=$((fails + 1)); done
  echo "== $label: $N runs, $fails failed, $(grep -lE '^FAIL .*alloc: .* -[0-9]' "$dir"/*.txt | wc -l) failed on a negative reading, $(grep -l 'below the floor' "$dir"/*.txt | wc -l) noted a below-the-floor retry"
  grep -hE '^FAIL|below the floor' "$dir"/*.txt | cut -c1-260 | sort | uniq -c | sort -rn | head -20
}
node --version
nproc
cp test/helpers/alloc.mjs "$T/alloc.new.mjs"
cp test/helpers/alloc.old.mjs test/helpers/alloc.mjs
phase "old helper (main)" "$T/probe-old"
cp "$T/alloc.new.mjs" test/helpers/alloc.mjs
phase "new helper (the fix)" "$T/probe-new"
exit 0
