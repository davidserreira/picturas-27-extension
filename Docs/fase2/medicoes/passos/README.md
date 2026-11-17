# Medições intermédias do ADR-01

Uma pasta por passo do plano de `../../adr/ADR-01-carregamento-em-fluxo.md` (secção 6). Servem para
atribuir a cada passo a redução que provoca e não substituem a medição final.

| Pasta | O que tem |
| --- | --- |
| `passo-0/` | C1.7 na base, antes de qualquer alteração |
| `passo-1/` a `passo-5/` | M1.1, C1.1, C1.2 e C1.4 com 100 e 500 MiB (duas repetições); nos passos 3 a 5, também C1.5 e C1.7; nos passos 4 e 5, C1.3; no passo 5, 10 MiB e C1.6 |
| `passo-5b/` | A afinação adotada: M1.1 com 100, 500 e 1000 MiB, C1.3 a C1.5 e C1.7; tempos com 10 e 100 MiB (3 repetições) |
| `afinacao/` | Variantes de configuração dos serviços Node testadas depois do passo 5 (ver ADR-01, secção 7) |

A regressão completa de cada passo está em `../../regressao/passos/`.

Cada medição foi feita com o código do passo ainda por versionar, sobre o commit do passo
anterior; o campo `commit` dos JSON regista esse commit e a lista de ficheiros alterados.

## Hashes dos commits

O ramo foi reescrito depois dos passos para retirar das mensagens dos commits a linha de coautoria
da ferramenta de IA. O conteúdo dos commits não mudou, mas os hashes sim. Os resultados guardados
antes disso registam os hashes antigos:

| Commit | Hash registado nos resultados | Hash atual |
| --- | --- | --- |
| Passo 0 | `a78a727` | `47c303b` |
| Passo 1 | `86693d0` | `93dd800` |
| `ia.md` e ficheiro de pedidos | `23fe7d1` | `cf4b5be` |
| Passo 2 | `ad6b5c4` | `d3546b2` |
| Passo 3 | `7061250` | `847e0dc` |
| Passo 4 | `f1a6e0f` | `0130073` |
| Passo 5 | `e7db5a9` | `a394a9a` |
| *Merge* feito pelo VS Code com os commits antigos do `origin`, sem alterações ao conteúdo (retirado do ramo) | `7c2ab1e` | `a394a9a` (o mesmo conteúdo) |

As variantes de `afinacao/` e as medições do passo 5b correram sobre o conteúdo do passo 5, com as
alterações por versionar registadas em cada JSON.
