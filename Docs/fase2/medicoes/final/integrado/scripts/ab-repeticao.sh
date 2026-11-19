#!/usr/bin/env bash
# Repeats blocks 2 (B) and 3 (A) of the A-B-A check of conjunta.sh. In the first run,
# block 2 stopped at the end of its first execution: rnf2/medir.mjs waited 30 s for a
# progress bar that had just disappeared (the run had ended) and threw. The instrument
# now treats a bar that disappears as no bar (progressOfP). Block 3 was stopped while
# starting, so that B and the second A run one after the other, as in the design.
# The failed and interrupted folders are kept as ab/2-B-tentativa-1 and ab/3-A-interrompido.
set -u
export MSYS_NO_PATHCONV=1
REPO="$(git rev-parse --show-toplevel)"
M="$REPO/Docs/fase2/medicoes"
BASE_WT="${BASE_WT:-C:/tmp/picturas-main}"
AB="final/integrado/ab"
cd "$REPO"

wait_frontend() {
  local code=000
  for i in $(seq 1 120); do
    code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/); [ "$code" = 200 ] && break; sleep 5
  done
  echo "    frontend $code ($(date +%H:%M:%S)); espera 90 s"
  sleep 90
}
up_variant() {
  if [ "$1" = A ]; then docker compose -f "$BASE_WT/docker-compose.yaml" --project-directory "$BASE_WT" up -d --build
  else docker compose up -d --build; fi
}
block() {
  local n="$1" v="$2" dir="$AB/$1-$2"
  mkdir -p "$M/$dir/logs"
  echo "=== $(date +%H:%M:%S) bloco $n variante $v"
  { docker compose down -v --remove-orphans; up_variant "$v"; } > "$M/$dir/logs/arranque.log" 2>&1
  echo "    arranque exit $?"
  wait_frontend
  {
    echo "variante: $v"
    [ "$v" = A ] && echo "base $(git -C "$BASE_WT" rev-parse --short HEAD) ($BASE_WT)" || echo "ramo fase2/integracao $(git rev-parse --short HEAD)"
    docker exec picturas-projects-1 ls models
  } > "$M/$dir/variante.txt" 2>&1
  (cd "$M" && MEDICAO="$dir" node rnf2/medir.mjs controlos --execucoes 3 --video 330 --so c21 > "$dir/logs/rnf2-c21.log" 2>&1)
  echo "    medicao exit $? ($(date +%H:%M:%S))"
  docker compose logs --no-color --timestamps video_tool > "$M/$dir/logs/video_tool.log" 2>&1
}
block 2 B
block 3 A
echo "=== $(date +%H:%M:%S) repor o ramo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$M/$AB/repor-ramo.log" 2>&1
echo "    exit $?"
echo "=== $(date +%H:%M:%S) A-B-A terminado"
