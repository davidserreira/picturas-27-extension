#!/usr/bin/env bash
# Final series of RNF-F2-01 (17 Nov 2026, 15:23-17:32): same procedure as the
# baseline (medicoes/README.md), on the branch fase2/rnf-f2-01-carregamento.
set -u
REPO="$(git rev-parse --show-toplevel)"
OUT="$REPO/Docs/fase2/medicoes/final/rnf-f2-01"
mkdir -p "$OUT/logs"
cd "$REPO"
echo "=== $(date +%H:%M:%S) arranque limpo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$OUT/logs/arranque.log" 2>&1
echo "    exit $?"
code=000
for i in $(seq 1 120); do
  code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/)
  [ "$code" = 200 ] && break
  sleep 5
done
echo "    frontend $code ($(date +%H:%M:%S)); espera 90 s"
sleep 90
cd Docs/fase2/medicoes && MEDICAO=final/rnf-f2-01 ./correr-tudo.sh
cd ../regressao && REGRESSAO=final/rnf-f2-01 ./correr.sh
echo "=== $(date +%H:%M:%S) serie final terminada"
