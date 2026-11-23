#!/usr/bin/env bash
# Joint final series (RNF-F2-01 + RNF-F2-02) on the branch fase2/integracao, then an
# A-B-A check of the time controls C2.1/C2.2 against the base in the same session
# (analise.md, section 5: times do not compare across sessions).
#
# Before running (about 3.5 h, on AC power, no suspension):
#   git worktree remove C:/tmp/picturas-integracao     # frees the branch
#   git switch fase2/integracao                         # in the main working tree (has dados/ and node_modules)
#   git worktree add C:/tmp/picturas-main 43a2e08       # the base, for the A blocks
set -u
# Git Bash rewrites POSIX-looking values passed to native programs: without this,
# PICTURAS_STATE_PATH reaches node as "C:/Program Files/Git/projects/..." (C2.3 of
# the RNF-F2-02 complement, final/rnf-f2-02/complemento/c23/README.md).
export MSYS_NO_PATHCONV=1
REPO="$(git rev-parse --show-toplevel)"
M="$REPO/Docs/fase2/medicoes"
OUT="$M/final/integrado"
BASE_WT="${BASE_WT:-C:/tmp/picturas-main}"
STATE_PATH="/projects/{user}/{project}/process/status"
mkdir -p "$OUT/logs"
cd "$REPO"

wait_frontend() {
  local code=000
  for i in $(seq 1 120); do
    code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/); [ "$code" = 200 ] && break; sleep 5
  done
  echo "    frontend $code ($(date +%H:%M:%S)); espera 90 s"
  sleep 90
}

# --- 1. Full series, same scripts and order as the baseline (correr-tudo.sh, 1000 MiB included).
echo "=== $(date +%H:%M:%S) commit $(git rev-parse --short HEAD); arranque limpo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$OUT/logs/arranque.log" 2>&1
echo "    exit $?"
wait_frontend
cp "$M/baseline/rnf2-calibracao-330s.json" "$OUT/"
(cd "$M" && PICTURAS_STATE_PATH="$STATE_PATH" MEDICAO=final/integrado ./correr-tudo.sh)
docker compose logs --no-color --timestamps video_tool > "$OUT/logs/video_tool.log" 2>&1

# --- 2. Regression (regressao/final.md), after a clean start: in the RNF-F2-01 series the
# end-to-end suite failed with ECONNRESET when it started right after the 1000 MiB uploads.
echo "=== $(date +%H:%M:%S) regressao (arranque limpo)"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$OUT/logs/arranque-regressao.log" 2>&1
wait_frontend
(cd Docs/fase2/regressao && REGRESSAO=final ./correr.sh) > "$OUT/logs/regressao.log" 2>&1
echo "    exit $?"

# --- 3. A-B-A of C2.1/C2.2: A = the base (whole stack from the worktree), B = fase2/integracao.
AB="final/integrado/ab"
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
block 1 A
block 2 B
block 3 A
echo "=== $(date +%H:%M:%S) repor o ramo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$M/$AB/repor-ramo.log" 2>&1
echo "    exit $?"
echo "=== $(date +%H:%M:%S) serie conjunta terminada"
