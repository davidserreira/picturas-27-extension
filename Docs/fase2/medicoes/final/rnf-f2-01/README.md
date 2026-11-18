# Medição final do RNF-F2-01

Ramo `fase2/rnf-f2-01-carregamento`, commit `7740230`. Mesma máquina, mesmo Docker e mesmos scripts
da base (`../../baseline/`). A análise está em `../../../analise.md`.

| Pasta ou ficheiro | O que tem | Script |
| --- | --- | --- |
| `*.json`, `resumo.md`, `logs/` | Série completa, 17 nov. 15:23–17:32: todas as medidas e controlos dos dois requisitos | `scripts/final.sh` (`correr-tudo.sh` e `regressao/correr.sh`) |
| `logs/video_tool.log`, `logs/servicos-17h27-17h33.log`, `logs/docker-desktop-17h29.log` | Registos guardados antes do arranque seguinte: duração de cada execução no worker; serviços e Docker Desktop à volta da falha do `docker inspect` na 4.ª repetição de 1000 MiB | — |
| `complemento/` | De um arranque limpo, 17 nov. 22:26–23:19: C2.1–C2.5, regressão e M1.1/C1.4 com 1000 MiB | `scripts/complemento.sh` |
| `ab/1-A`, `ab/2-B`, `ab/3-A` | Comparação do C2.1 entre a base (A) e o ramo (B) na mesma sessão, 17–18 nov. 23:23–00:26. Cada bloco tem `variante.txt`, com a versão que correu, e `logs/amostras.log`, com a CPU dos contentores minuto a minuto | `scripts/ab.sh` |

Os vídeos gravados pelo browser (`videos/`) ficam só na máquina de medição, como na base.

Os scripts em `scripts/` são os que correram, com os caminhos tornados relativos ao repositório. O
`ab.sh` precisa de uma cópia de trabalho da base (`git worktree add <pasta> 43a2e08`) e da opção
`--so c21` de `rnf2/medir.mjs`, que corre só o C2.1 e o C2.2.
