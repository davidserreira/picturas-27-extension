#!/usr/bin/env bash
# Complement of the RNF-F2-01 final series (17 Nov 2026, 22:26-23:19): C2.1-C2.5,
# regression and M1.1/C1.4 with 1000 MiB, from a clean start, with the same
# scripts and parameters as correr-tudo.sh. The regression now waits for the
# stack before starting (in the series it started 2 s after the 1000 MiB run).
set -u
REPO="$(git rev-parse --show-toplevel)"
M="$REPO/Docs/fase2/medicoes"
OUT="$M/final/rnf-f2-01/complemento"
mkdir -p "$OUT/logs"
cd "$REPO"
wait_front() {
  local code=000
  for i in $(seq 1 120); do
    code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/)
    [ "$code" = 200 ] && break
    sleep 5
  done
  echo "    frontend $code ($(date +%H:%M:%S)); espera 90 s"
  sleep 90
}
echo "=== $(date +%H:%M:%S) arranque limpo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$OUT/logs/arranque.log" 2>&1
echo "    exit $?"
wait_front
cd "$M"
export MEDICAO=final/rnf-f2-01/complemento
node ambiente.mjs > "$MEDICAO/logs/ambiente.log" 2>&1
echo "=== $(date +%H:%M:%S) rnf2-controlos"
node rnf2/medir.mjs controlos --execucoes 3 --video 330 > "$MEDICAO/logs/rnf2-controlos.log" 2>&1
echo "    exit $? ($(date +%H:%M:%S))"
echo "=== $(date +%H:%M:%S) regressao"
cd "$REPO/Docs/fase2/regressao" && REGRESSAO=final/rnf-f2-01 ./correr.sh > "$OUT/logs/regressao.log" 2>&1
echo "    exit $? ($(date +%H:%M:%S))"
cd "$REPO"; wait_front; cd "$M"
echo "=== $(date +%H:%M:%S) rnf1-memoria-1000"
node rnf1/medir-memoria.mjs --reps 5 --sizes 1000 --only m11,c14 --saida rnf1-memoria-1000.json > "$MEDICAO/logs/rnf1-memoria-1000.log" 2>&1
echo "    exit $? ($(date +%H:%M:%S))"
node resumo.mjs > "$MEDICAO/logs/resumo.log" 2>&1
cd "$REPO"; docker compose logs --no-color --timestamps video_tool > "$OUT/logs/video_tool.log" 2>&1
echo "=== $(date +%H:%M:%S) complemento terminado"
