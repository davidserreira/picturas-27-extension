# Medição com os dois requisitos integrados

Ramo `fase2/integracao`, commit `eb8a37d`: o RNF-F2-01 (`7740230`) e o RNF-F2-02 (`3eefe39`)
juntos. Mesma máquina, mesmo Docker e mesmos scripts da base (`../../baseline/`), com o portátil
ligado à corrente. A análise está em `../../../analise.md`, secção 7.

| Pasta ou ficheiro | O que tem | Script |
| --- | --- | --- |
| `*.json`, `resumo.md`, `logs/` | Série completa, 18 nov., 21:54–23:57, de um arranque limpo: todas as medidas e controlos dos dois requisitos, incluindo a M1.1 e o C1.4 com 1000 MiB. `logs/serie.log` tem as horas de cada passo | `scripts/conjunta.sh`, passo 1 |
| `logs/regressao.log` e `../../../regressao/final.md` | Regressão, de um arranque limpo depois da série, 18–19 nov., 23:58–00:05 | `scripts/conjunta.sh`, passo 2 |
| `ab/1-A`, `ab/2-B`, `ab/3-A` | Comparação A-B-A do C2.1 e do C2.2 entre a base (A, `43a2e08`, de uma cópia de trabalho em `C:/tmp/picturas-main`) e este ramo (B), cada bloco com o seu arranque limpo. `variante.txt` diz que versão correu | `scripts/conjunta.sh`, passo 3 (bloco 1); `scripts/ab-repeticao.sh` (blocos 2 e 3) |
| `ab/2-B-tentativa-1`, `ab/3-A-interrompido` | Primeira tentativa dos blocos 2 e 3 (ver abaixo) | `scripts/conjunta.sh` |
| `ab/repeticao.log`, `ab/repor-ramo.log` | Horas de cada passo da repetição dos blocos 2 e 3, e o arranque final deste ramo | `scripts/ab-repeticao.sh` |

**Resultado da comparação A-B-A** (análise em `../../../analise.md`, 7.4). O C2.1 e o C2.2 vêm
de `logs/rnf2-c21.log` e `rnf2-controlos.json` de cada bloco, e o tempo do worker do `t=` em
`logs/video_tool.log`:

| Bloco | Hora (19 nov.) | C2.1 (s) | Mediana (s) | Worker (s) | C2.2 (s) |
| --- | --- | --- | --- | --- | --- |
| 1 — A | 00:08–00:23 | 282,1; 289,5; 284,5 | 284,5 | 279,6; 287,6; 282,9 | 17,2; 18,8; 17,6 |
| 2 — B | 00:36–00:52 | 282,5; 279,7; 346,1 | 282,5 | 280,2; 277,1; 343,9 | 2,0; 1,8; 1,9 |
| 3 — A | 00:55–01:10 | 287,6; 295,8; 285,6 | 287,6 | 285,6; 293,6; 283,8 | 18,3; 18,3; 31,1 |

O C2.1 cumpre o limite de base + 10% na mesma sessão (314,7 s, a partir do ponto médio das
medianas de A). A terceira execução de B teve o tempo a mais no worker; fora dele foram 2,2 s, como
nas outras.

**Bloco 2 repetido.** Na primeira tentativa, o bloco 2 parou no fim da primeira execução. O
`rnf2/medir.mjs` viu a barra de progresso, a execução acabou, a barra desapareceu, e o
`getAttribute` seguinte esperou 30 s por ela e lançou uma exceção. A falha é do instrumento, e
não da aplicação: a interface fez o que devia, que é retirar a barra no fim. O script continuou
para o bloco 3, que foi parado ao arrancar, para que B e o segundo A corressem seguidos, como no
desenho da comparação. O `progressOfP` passou a tratar uma barra que desaparece como "sem barra",
com um tempo de espera de 1 s, e os blocos 2 e 3 foram repetidos (`scripts/ab-repeticao.sh`). O
bloco 1 correu com o instrumento antes da correção; a correção só muda o caso em que a barra
desaparece entre duas leituras, que não entra na duração (C2.1).

**Conversão de caminhos.** Os scripts exportam `MSYS_NO_PATHCONV=1`, para o Git Bash não converter o
valor de `PICTURAS_STATE_PATH` (ver `../rnf-f2-02/README.md`). O C2.3 desta série é válido: o dono
recebe 200 do mesmo URL.

Os vídeos gravados pelo browser (`videos/`) ficam só na máquina de medição, como na base.
