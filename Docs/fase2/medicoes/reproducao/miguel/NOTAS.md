# Reprodução — miguel

Corrida a 19 de novembro de 2026 com `reproducao.sh` no ramo `fase2/integracao` (`07f2935`, código
igual ao da `main`). Os resultados estão em `base/`, `main/` e `main-330/`, e a regressão em
`../../../regressao/reproducao/miguel.md`.

## Máquina

MacBook Pro com Apple M1 Pro (8 processadores lógicos, 16 GiB), macOS (Darwin 27.0.0), Docker
Desktop 29.9.3 com 8 CPUs e 7,75 GiB, Node.js 26.13.1. As imagens Docker são ARM (linux/arm64), ao
contrário da máquina das medições oficiais e da do Pedro (Intel).

## Ajustes para correr (sem alterar os scripts)

- **Browsers do Playwright.** `npx playwright install chromium` ficou parado depois do download
  (mais de 15 min a descompactar). Os três pacotes foram descarregados com `curl` do mesmo
  endereço e descompactados à mão em `~/Library/Caches/ms-playwright`
  (`chromium-1187`, `chromium_headless_shell-1187`, `ffmpeg-1011`, cada um com o ficheiro
  `INSTALLATION_COMPLETE`), e o `npm install` de `medicoes/rnf2` e `regressao` foi feito antes do
  script, para ele não voltar a instalar.
- **`regressao/correr.sh` sem permissão de execução** no git (o script chama-o com `./`):
  `chmod +x` local antes de correr. Em Linux deu `exit 126` na reprodução do Pedro. Correção
  sugerida: `git update-index --chmod=+x Docs/fase2/regressao/correr.sh`.

## Resultados

| Medida | Base | Main | Notas |
| --- | --- | --- | --- |
| Regressão | — | pytest 75/75, node 19/19, ponta a ponta 16/18, interface 3/3 | T05 e T06 "diferentes da referência" (ver abaixo) |
| M1.1, 500 MiB, maior acréscimo | `api_gateway` 1961 MiB | `projects` 182 MiB | Ver abaixo |
| C1.1, aceitação de 500 MiB | 10,9 s | 0,55 s | |
| C1.2, envio completo de 500 MiB | 14,6 s | 4,3 s | |
| M2.2 R / F (vídeo de 120 s) | — | 0,13 s; "não recupera" numa recarga e no fim | Artefacto do script (ver abaixo) |
| M2.2 R / F (vídeo de 330 s, `main-330/`) | — | 0,13 s e 0,13 s; F 0 s | Alvo atingido |
| M2.3 | — | 2/2 (A 1/1, B 1/1) | Alvo atingido |

## Pontos a registar

**1. M1.1: o `projects` fica entre 112 e 182 MiB nesta máquina.** Acréscimos nas três repetições:
112,3, 146,9 e 182,1 MiB (repouso 61 a 80 MiB, pico 192 a 255 MiB). Os outros serviços ficam dentro
do alvo (`api_gateway` 24, `img_storage` 42, `nginx` 3 MiB, médias). O valor já não acompanha o
tamanho do ficheiro (na base, o `projects` subiu 1193 MiB), mas fica acima do alvo de 64 MiB nas três
repetições e acima do mínimo de 128 MiB em duas. Na reprodução do Pedro (Linux, Intel) o
`projects` deu 87 e 77 MiB. **Hipótese:** a mesma causa da afinação do passo 5b do ADR-01, a memória
que o V8 e a glibc demoram a devolver, que varia com a plataforma; o instrumento não a distingue.
O relatório, que só fala da margem do `img_storage`, deve indicar esta variação entre máquinas.

**2. T05 e T06 diferem da referência em ARM.** Os dois testes comparam o SHA-256 dos ficheiros de
imagem com a referência gravada numa máquina Intel. Diferem também ferramentas que só copiam píxeis
(recorte), e na máquina Intel do Pedro deram 18/18 com o mesmo código. A explicação provável é a
plataforma das imagens Docker (outra compressão PNG), e não o código. O mesmo aconteceu numa corrida
anterior, no mesmo Mac, sobre o ramo do RNF-F2-02 isolado.

**3. M2.2 com o vídeo de 120 s: artefacto do instrumento.** O script recarrega em momentos fixos
calculados para uma execução de 200 s (`duracaoReferenciaS`). Nesta máquina a execução de P com o
vídeo de 120 s é muito mais curta: aos "25%" o progresso já estava nos 76%, e aos "60%" a execução já
tinha acabado (`progressoAntes: null`, não havia progresso para recuperar). O fim (F) também
aconteceu antes de o script chegar à outra página. Com o vídeo de 330 s (`main-330/`) as três
medições ficaram em 0,13 s, 0,13 s e 0 s. Sugestão para o script: confirmar que a execução ainda
está a correr antes de cada recarga e antes de medir F, ou calibrar o vídeo em cada máquina.

## Complemento de 26 de novembro: M1.1 com os quatro tamanhos e experiência com o V8

Mesma máquina, código `9091f53` (igual ao da `main`), arranque com `docker compose up -d --build`.

**A — M1.1 com 10, 100, 500 e 1000 MiB, 3 repetições** (`tamanhos/`). Acréscimo do `projects`
(MiB), o pior serviço do critério em todos os tamanhos:

| Ficheiro | Repetições | Outros serviços (máx.) |
| --- | --- | --- |
| 10 MiB | 67,7; 40,0; 25,5 | `img_storage` 25,8 |
| 100 MiB | 171,3; 192,8; 165,5 | `img_storage` 35,9 |
| 500 MiB | 197,0; 188,4; 190,2 | `img_storage` 46,3 |
| 1000 MiB | 186,7; 190,9; 178,0 | `img_storage` 48,6 |

Nesta máquina o acréscimo do `projects` **não acompanha o tamanho do ficheiro**: estabiliza em cerca
de 165–197 MiB a partir de 100 MiB, igual com 1000 MiB (na base, com 500 MiB, subia 1193 MiB). Ou
seja, o comportamento que o RNF-F2-01 pede (um valor fixo, independente do tamanho) repete-se; o que
muda entre máquinas é o patamar, aqui acima do alvo (64) e do mínimo (128). `api_gateway`, `nginx` e
`img_storage` ficam dentro do alvo em todos os tamanhos.

**B — o `projects` com o limite do V8 que o `img_storage` já usa** (`experiencia-old-space/`;
`NODE_OPTIONS="--max-semi-space-size=1 --max-old-space-size=96"` aplicado com um ficheiro de
override local, não versionado). Acréscimo do `projects`: 500 MiB → 193,6; 191,1; 191,2 MiB;
1000 MiB → 7,6; 193,1; 189,1 MiB. O patamar não muda, pelo que **o heap antigo do V8 não explica a
diferença**: a H-05 fica mais fraca na parte do V8. O valor de 7,6 MiB numa repetição não foi
investigado (provável falha da amostragem a 1 s). Não se confirmou dentro do contentor que o
override estava ativo nessa série; ficam por medir a memória por processo dentro do contentor
(`node` e `ffprobe`) e a cache de páginas, que o `docker stats` não separa.
