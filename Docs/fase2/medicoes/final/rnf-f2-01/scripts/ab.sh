#!/usr/bin/env bash
# A/B check of C2.1/C2.2 (17-18 Nov 2026, 23:23-00:26): base vs. branch in the
# same session, blocks A-B-A, each from a clean start, 3 runs of C2.1 each.
#   A: the base (43a2e08) in the four services the branch changes (nginx.conf,
#      api_gateway, projects, img_storage) and its docker-compose.yaml (without
#      the V8/glibc options); every other service built from the branch, unchanged.
#   B: the branch.
# Needs a worktree of the base:  git worktree add "$WORKTREE" 43a2e08
set -u
REPO="$(git rev-parse --show-toplevel)"
WORKTREE="${WORKTREE:-C:/tmp/picturas-main}"
M="$REPO/Docs/fase2/medicoes"
AB="final/rnf-f2-01/ab"
VARIANT_A="$(mktemp --suffix=.yaml)"
cd "$REPO"

# Compose file of variant A: the base's, with the four changed services taken from the worktree.
sed -e "s#- ./nginx/nginx.conf:#- $WORKTREE/nginx/nginx.conf:#" \
    -e "s#build: ./imageStorageService#build: $WORKTREE/imageStorageService#" \
    -e "s#build: ./projects\$#build: $WORKTREE/projects#" \
    -e "s#- ./apiGateway:/app#- $WORKTREE/apiGateway:/app#" \
    "$WORKTREE/docker-compose.yaml" > "$VARIANT_A"

# CPU of the containers every minute. The host part (Get-Counter) uses English
# counter names and recorded nothing on the Portuguese Windows of the measurement machine.
sampler() {
  while true; do
    {
      echo "--- $(date +%H:%M:%S)"
      docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}" | grep -E "video_tool|projects-1|api_gateway|img_storage|seaweedfs|nginx"
      powershell -NoProfile -Command "(Get-Counter '\Process(*)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples | Where-Object { \$_.InstanceName -notin '_total','idle' } | Sort-Object CookedValue -Descending | Select-Object -First 6 | ForEach-Object { 'host {0} {1:N0}' -f \$_.InstanceName, \$_.CookedValue }"
    } >> "$1" 2>&1
    sleep 60
  done
}

up_variant() {
  if [ "$1" = A ]; then docker compose -f "$VARIANT_A" --project-directory "$REPO" up -d --build
  else docker compose up -d --build; fi
}

block() {
  local n="$1" v="$2" dir="$AB/$1-$2"
  mkdir -p "$M/$dir/logs"
  echo "=== $(date +%H:%M:%S) bloco $n variante $v"
  { docker compose down -v --remove-orphans; up_variant "$v"; } > "$M/$dir/logs/arranque.log" 2>&1
  echo "    arranque exit $?"
  local code=000
  for i in $(seq 1 120); do
    code=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:8080/); [ "$code" = 200 ] && break; sleep 5
  done
  echo "    frontend $code ($(date +%H:%M:%S)); espera 90 s"
  sleep 90
  {
    echo "variante: $v ($([ "$v" = A ] && echo "main 43a2e08 nos servicos nginx, api_gateway, projects e img_storage; resto do ramo, igual" || echo "ramo fase2/rnf-f2-01-carregamento 7740230"))"
    for c in projects img_storage api_gateway; do
      echo "$c image=$(docker inspect -f '{{.Image}}' picturas-$c-1) NODE_OPTIONS=$(docker exec picturas-$c-1 printenv NODE_OPTIONS) MALLOC_ARENA_MAX=$(docker exec picturas-$c-1 printenv MALLOC_ARENA_MAX)"
    done
    echo "projects mediaUpload.js: $(docker exec picturas-projects-1 ls utils/mediaUpload.js 2>&1)"
    # Git Bash rewrites the absolute path below; this line failed in both variants.
    docker exec picturas-nginx-1 grep -c "proxy_request_buffering off" /etc/nginx/nginx.conf
    docker exec picturas-api_gateway-1 ls utils
  } > "$M/$dir/variante.txt" 2>&1
  sampler "$M/$dir/logs/amostras.log" &
  local sp=$!
  (cd "$M" && MEDICAO="$dir" node rnf2/medir.mjs controlos --execucoes 3 --video 330 --so c21 > "$dir/logs/rnf2-c21.log" 2>&1)
  echo "    medicao exit $? ($(date +%H:%M:%S))"
  kill $sp 2>/dev/null
  docker compose logs --no-color --timestamps video_tool > "$M/$dir/logs/video_tool.log" 2>&1
  grep " ok " "$M/$dir/logs/video_tool.log" | sed -E 's/.*Z \[video\] msg=request-([0-9a-f]{8}).* t=/\1 t=/'
}

block 1 A
block 2 B
block 3 A
echo "=== $(date +%H:%M:%S) repor o ramo"
{ docker compose down -v --remove-orphans; docker compose up -d --build; } > "$M/$AB/repor-ramo.log" 2>&1
echo "    exit $?"
rm -f "$VARIANT_A"
echo "=== $(date +%H:%M:%S) A/B terminado"
