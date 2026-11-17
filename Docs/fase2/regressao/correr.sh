#!/usr/bin/env bash
# Runs the whole regression suite against the running stack and writes
# Docs/fase2/regressao/$REGRESSAO.md (baseline or final).
#
#   REGRESSAO=baseline ./correr.sh
set -u
cd "$(dirname "$0")"
export REGRESSAO="${REGRESSAO:-baseline}"
REPO="$(cd ../../.. && pwd)"
mkdir -p resultados

echo "=== $(date +%H:%M:%S) unitarios: worker de video (pytest)"
(cd "$REPO" && docker compose run --rm --no-deps -T video_tool sh -c \
  "pip install -q pytest >/dev/null 2>&1; python -m pytest -q -rA tests") \
  > "resultados/$REGRESSAO-pytest.txt" 2>&1
echo "    exit $?"

echo "=== $(date +%H:%M:%S) unitarios: orquestrador (node --test)"
(cd "$REPO" && docker compose run --rm --no-deps -T projects sh -c "node --test tests/*.test.js") \
  > "resultados/$REGRESSAO-node.txt" 2>&1
echo "    exit $?"

echo "=== $(date +%H:%M:%S) ponta a ponta (API e WebSocket)"
node e2e.mjs > "resultados/$REGRESSAO-e2e.log" 2>&1
echo "    exit $?"

echo "=== $(date +%H:%M:%S) interface (Playwright)"
node ui.mjs > "resultados/$REGRESSAO-ui.log" 2>&1
echo "    exit $?"

node relatorio.mjs
echo "=== $(date +%H:%M:%S) fim: $REGRESSAO.md"
