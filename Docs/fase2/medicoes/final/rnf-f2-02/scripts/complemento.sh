#!/usr/bin/env bash
# Complement of the RNF-F2-02 final series: the series of 18 Nov 2026 (15:15-16:3x)
# was stopped during M2.3 because the machine had to be switched off. This runs,
# from a clean start and with the same scripts, what was left: the missing M2.3
# attempts, the controls C2.1-C2.5, M1.2 and the regression.
# M2.3 with --tentativas 2 runs A1, A2, B1, B2 (about 20 min); together with the
# attempts of the interrupted series this gives at least 5 per form.
set -u
REPO="$(git rev-parse --show-toplevel)"
OUT="$REPO/Docs/fase2/medicoes/final/rnf-f2-02/complemento"
mkdir -p "$OUT/logs"
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
export MEDICAO=final/rnf-f2-02/complemento
P_VIDEO=330
run() {
  local name="$1"; shift
  echo "=== $(date +%H:%M:%S) $name"
  "$@" > "$MEDICAO/logs/$name.log" 2>&1
  echo "    exit $? ($(date +%H:%M:%S))"
}
node ambiente.mjs > "$MEDICAO/logs/ambiente.log" 2>&1
run rnf2-m23       node rnf2/medir.mjs m23 --tentativas 2 --video "$P_VIDEO"
run rnf2-controlos node rnf2/medir.mjs controlos --execucoes 3 --video "$P_VIDEO"
run rnf1-limite    node rnf1/medir-limite.mjs --reps 3
node resumo.mjs > "$MEDICAO/logs/resumo.log" 2>&1
cd "$REPO"

docker compose logs --no-color --timestamps video_tool > "$OUT/logs/video_tool.log" 2>&1
echo "=== $(date +%H:%M:%S) regressao"
(cd Docs/fase2/regressao && REGRESSAO=final/rnf-f2-02 ./correr.sh) > "$OUT/logs/regressao.log" 2>&1
echo "    exit $?"
echo "=== $(date +%H:%M:%S) complemento terminado"
