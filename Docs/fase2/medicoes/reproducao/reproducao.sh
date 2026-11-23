#!/usr/bin/env bash
# Short reproduction of the Phase 2 measurements on another machine (README.md here).
# About 1 to 1.5 h, mostly Docker builds. It does not replace the official series:
# times are not compared across machines; only memory and yes/no results are.
#
#   NOME=<nome> bash Docs/fase2/medicoes/reproducao/reproducao.sh
#
# Run it from Git Bash (Windows) or a shell (Linux/macOS), in a checkout of the branch
# fase2/integracao (same code as main), with Docker running, Node 20+ and ~20 GB free.
# It stops and wipes the local PictuRAS stack (docker compose down -v).
#
#   1. Base (43a2e08, from a git worktree): M1.1 with 500 MiB, or 100 MiB when Docker
#      has less than 7 GiB (on the base, 500 MiB takes about 2 GiB in one service).
#   2. This branch: regression suite, M1.1 with the same size, M2.2 and M2.3 once each, with the
#      330 s video of the official series (M2.2 reloads at fixed times: with the 120 s video a
#      fast machine ends the run before the reloads; reproducao/miguel/NOTAS.md).
# Results: medicoes/reproducao/$NOME/{base,main}/ and regressao/reproducao/$NOME.md.
set -u
# Git Bash would turn PICTURAS_STATE_PATH into a Windows path (final/rnf-f2-02/README.md).
export MSYS_NO_PATHCONV=1
: "${NOME:?indica o teu nome: NOME=<nome> bash Docs/fase2/medicoes/reproducao/reproducao.sh}"
REPO="$(git rev-parse --show-toplevel)"
M="$REPO/Docs/fase2/medicoes"
R="$REPO/Docs/fase2/regressao"
OUT="reproducao/$NOME"
BASE_WT="${BASE_WT:-$REPO/../picturas-base-43a2e08}"
STATE_PATH="/projects/{user}/{project}/process/status"
VIDEO=330
mkdir -p "$M/$OUT/base/logs" "$M/$OUT/main/logs"
exec > >(tee -a "$M/$OUT/reproducao.log") 2>&1
cd "$REPO"

step() { echo "=== $(date +%H:%M:%S) $*"; }
fail() { echo "ERRO: $*"; exit 1; }
wait_frontend() {
  local code=000
  for i in $(seq 1 120); do
    code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/); [ "$code" = 200 ] && break; sleep 5
  done
  [ "$code" = 200 ] || fail "o frontend não respondeu em 10 min (docker compose ps)"
  echo "    frontend pronto; espera 90 s"
  sleep 90
}

# --- 0. Checks: the code must be the code of main.
step "verificações"
command -v node >/dev/null || fail "falta o Node.js 18+"
docker info >/dev/null 2>&1 || fail "o Docker não está a correr"
git fetch -q origin main || fail "git fetch falhou"
git diff --quiet origin/main HEAD -- . ':(exclude)Docs' ':(exclude)AGENTS.md' \
  || fail "o código desta cópia não é igual ao da main: usa o ramo fase2/integracao atualizado (git pull)"
MEM_GIB=$(docker info --format '{{.MemTotal}}' | awk '{printf "%d", $1/1073741824}')
SIZE=500; [ "$MEM_GIB" -lt 7 ] && SIZE=100
echo "    commit $(git rev-parse --short HEAD); Docker com ${MEM_GIB} GiB: M1.1 com ${SIZE} MiB"
[ -e "$BASE_WT/docker-compose.yaml" ] || git worktree add --detach "$BASE_WT" 43a2e08 >/dev/null \
  || fail "não consegui criar a cópia da base em $BASE_WT"
(cd "$M/rnf2" && { [ -d node_modules ] || { npm install && npx playwright install chromium; }; }) > "$M/$OUT/npm.log" 2>&1 \
  || fail "npm install em medicoes/rnf2 (ver $OUT/npm.log)"
(cd "$R" && { [ -d node_modules ] || { npm install && npx playwright install chromium; }; }) >> "$M/$OUT/npm.log" 2>&1 \
  || fail "npm install em regressao (ver $OUT/npm.log)"

# --- 1. Base.
step "base: arranque limpo (a primeira vez demora 15 a 30 min)"
{ docker compose down -v --remove-orphans
  docker compose -f "$BASE_WT/docker-compose.yaml" --project-directory "$BASE_WT" up -d --build; } \
  > "$M/$OUT/base/logs/arranque.log" 2>&1 || fail "arranque da base (ver $OUT/base/logs/arranque.log)"
wait_frontend
echo "base $(git -C "$BASE_WT" rev-parse --short HEAD) ($BASE_WT); os JSON registam o commit de onde correm os scripts" \
  > "$M/$OUT/base/variante.txt"
step "dados de teste"
(cd "$M" && node gerar-dados.mjs && node gerar-dados.mjs --video "$VIDEO") > "$M/$OUT/dados.log" 2>&1 \
  || fail "gerar-dados.mjs (ver $OUT/dados.log)"
step "base: M1.1 com $SIZE MiB (3 repetições)"
(cd "$M" && MEDICAO="$OUT/base" node ambiente.mjs > "$OUT/base/logs/ambiente.log" 2>&1
  MEDICAO="$OUT/base" node rnf1/medir-memoria.mjs --reps 3 --sizes "$SIZE" --only m11 > "$OUT/base/logs/m11.log" 2>&1)
echo "    exit $?"

# --- 2. This branch (code of main).
step "main: arranque limpo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } \
  > "$M/$OUT/main/logs/arranque.log" 2>&1 || fail "arranque (ver $OUT/main/logs/arranque.log)"
wait_frontend
echo "fase2/integracao $(git rev-parse --short HEAD), código igual ao da main $(git rev-parse --short origin/main)" \
  > "$M/$OUT/main/variante.txt"
step "main: regressão (a primeira legendagem descarrega o modelo de fala)"
(cd "$R" && REGRESSAO="reproducao/$NOME" ./correr.sh) > "$M/$OUT/main/logs/regressao.log" 2>&1
echo "    exit $?"
step "main: M1.1 com $SIZE MiB (3 repetições)"
(cd "$M" && MEDICAO="$OUT/main" node ambiente.mjs > "$OUT/main/logs/ambiente.log" 2>&1
  MEDICAO="$OUT/main" node rnf1/medir-memoria.mjs --reps 3 --sizes "$SIZE" --only m11 > "$OUT/main/logs/m11.log" 2>&1)
echo "    exit $?"
step "main: M2.2 (recarregar a página e ver o fim), uma execução"
(cd "$M" && MEDICAO="$OUT/main" PICTURAS_STATE_PATH="$STATE_PATH" node rnf2/medir.mjs m22 --execucoes 1 --video "$VIDEO" \
  > "$OUT/main/logs/m22.log" 2>&1)
echo "    exit $?"
step "main: M2.3 (cancelar depois de perder a página), uma tentativa de cada forma"
(cd "$M" && MEDICAO="$OUT/main" PICTURAS_STATE_PATH="$STATE_PATH" node rnf2/medir.mjs m23 --tentativas 1 --video "$VIDEO" \
  > "$OUT/main/logs/m23.log" 2>&1)
echo "    exit $?"

(cd "$M" && MEDICAO="$OUT/base" node resumo.mjs > /dev/null 2>&1; MEDICAO="$OUT/main" node resumo.mjs > /dev/null 2>&1)
step "fim"
cat <<EOF
Resultados: Docs/fase2/medicoes/$OUT/{base,main}/resumo.md e Docs/fase2/regressao/reproducao/$NOME.md
Para os guardar (no ramo fase2/integracao, nunca na main):
  git add Docs/fase2/medicoes/$OUT Docs/fase2/regressao/reproducao Docs/fase2/regressao/resultados/reproducao
  git commit -m "Fase 2: reprodução das medições ($NOME)" && git push
A aplicação fica a correr com o código da main (docker compose stop para a parar).
EOF
