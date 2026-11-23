#!/usr/bin/env bash
# Runs every Phase 2 measurement in sequence against the running stack and
# writes the raw results to Docs/fase2/medicoes/$MEDICAO (baseline or final).
#
#   MEDICAO=baseline ./correr-tudo.sh
#
# Expects: the stack up from a clean state (see README), test data generated
# (node gerar-dados.mjs; node gerar-dados.mjs --video $P_VIDEO), Playwright
# installed in rnf2/ (npm install; npx playwright install chromium).
set -u
cd "$(dirname "$0")"
export MEDICAO="${MEDICAO:-baseline}"
P_VIDEO="${P_VIDEO:-330}"
mkdir -p "$MEDICAO/logs"

run() {
  local name="$1"; shift
  echo "=== $(date +%H:%M:%S) $name"
  "$@" > "$MEDICAO/logs/$name.log" 2>&1
  echo "    exit $? ($(date +%H:%M:%S))"
}

node ambiente.mjs > "$MEDICAO/logs/ambiente.log" 2>&1
run rnf1-memoria   node rnf1/medir-memoria.mjs --reps 5 --sizes 10,100,500
run rnf2-m21       node rnf2/medir.mjs m21 --execucoes 3 --video "$P_VIDEO"
run rnf2-m22       node rnf2/medir.mjs m22 --execucoes 3 --video "$P_VIDEO"
run rnf2-m23       node rnf2/medir.mjs m23 --tentativas 5 --video "$P_VIDEO"
run rnf2-controlos node rnf2/medir.mjs controlos --execucoes 3 --video "$P_VIDEO"
run rnf1-limite    node rnf1/medir-limite.mjs --reps 3
# Last on purpose: in the base, a 1000 MiB upload without memory caps can take
# the whole Docker engine down (first baseline series, see ocorrencias/).
run rnf1-memoria-1000 node rnf1/medir-memoria.mjs --reps 5 --sizes 1000 --only m11,c14 --saida rnf1-memoria-1000.json
node resumo.mjs > "$MEDICAO/logs/resumo.log" 2>&1
echo "=== $(date +%H:%M:%S) fim"
