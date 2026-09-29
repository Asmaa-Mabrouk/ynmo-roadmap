#!/usr/bin/env bash
# Full verification: build check, lint, feature scripts (assert PASS/FAIL lines), then the 88-scenario suite.
set -u
cd "$(dirname "$0")/.."
node build.mjs --check || exit 1
node lint.mjs || exit 1
mkdir -p tests/out; fail=0
for f in tests/features/*.py; do
  out=$(python3 "$f" 2>&1); code=$?
  p=$(grep -c '^PASS' <<<"$out"); x=$(grep -c '^FAIL' <<<"$out")
  echo "$(basename "$f"): pass=$p fail=$x exit=$code"
  if [ "$x" -gt 0 ] || [ "$code" -ne 0 ]; then echo "$out" | grep -E '^FAIL|Error|Traceback' | head -5; fail=1; fi
done
node build.mjs --dist >/dev/null && python3 tests/csp_check.py || fail=1
python3 tests/e2e_qa.py | tee tests/out/qa.log | tail -1
exit $fail
