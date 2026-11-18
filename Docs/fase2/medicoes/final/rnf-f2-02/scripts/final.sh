#!/usr/bin/env bash
# Final series of RNF-F2-02: same procedure as the baseline (medicoes/README.md),
# on the branch fase2/rnf-f2-02-segundo-plano. Settings the baseline also had
# or that ADR-02 makes possible:
#  - M2.2 reloads at 25% and 60% of the reference run of the baseline
#    (baseline/rnf2-calibracao-330s.json, 222.8 s), copied next to the results;
#  - C2.3 asks the state route that ADR-02 adds (PICTURAS_STATE_PATH).
# Same steps and order as correr-tudo.sh, except the last one (M1.1/C1.4 with
# 1000 MiB): this branch keeps the base upload path, where that upload took the
# whole Docker engine down twice (medicoes/ocorrencias/2026-11-16-queda-docker/).
# 1000 MiB is measured in the joint series, with the RNF-F2-01 upload path.
set -u
REPO="$(git rev-parse --show-toplevel)"
OUT="$REPO/Docs/fase2/medicoes/final/rnf-f2-02"
mkdir -p "$OUT/logs" "$REPO/Docs/fase2/regressao/final" "$REPO/Docs/fase2/regressao/resultados/final"
cd "$REPO"
echo "=== $(date +%H:%M:%S) commit $(git rev-parse --short HEAD); arranque limpo"
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
cp Docs/fase2/medicoes/baseline/rnf2-calibracao-330s.json "$OUT/"
export PICTURAS_STATE_PATH="/projects/{user}/{project}/process/status"

cd Docs/fase2/medicoes
export MEDICAO=final/rnf-f2-02
P_VIDEO=330
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
node resumo.mjs > "$MEDICAO/logs/resumo.log" 2>&1
cd "$REPO"

docker compose logs --no-color --timestamps video_tool > "$OUT/logs/video_tool.log" 2>&1
echo "=== $(date +%H:%M:%S) regressao"
(cd Docs/fase2/regressao && REGRESSAO=final/rnf-f2-02 ./correr.sh) > "$OUT/logs/regressao.log" 2>&1
echo "    exit $?"
echo "=== $(date +%H:%M:%S) serie final terminada"
