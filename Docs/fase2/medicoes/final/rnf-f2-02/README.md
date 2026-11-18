# Medição final do RNF-F2-02

Ramo `fase2/rnf-f2-02-segundo-plano-medido`. Mesma máquina, mesmo Docker e mesmos scripts da base
(`../../baseline/`), com o portátil ligado à corrente. A análise está em `../../../analise.md`,
secção 6.

| Pasta ou ficheiro | O que tem | Script |
| --- | --- | --- |
| `*.json`, `resumo.md`, `logs/` | Série de 18 nov., 15:15–16:35, commit `77c9bf7`, de um arranque limpo: M1.1 com 10, 100 e 500 MiB e C1.1–C1.7; M2.1; M2.2; M2.3, com 8 das 10 tentativas (A1–A5, B1–B3) | `scripts/final.sh` |
| `complemento/` | De um arranque limpo, 18 nov., 20:40–22:xx, commit `ed34cd7` (difere de `77c9bf7` só em `Docs/`): 4 tentativas da M2.3 (A1, A2, B1, B2), C2.1–C2.5, M1.2 e a regressão (`../../../regressao/final/rnf-f2-02.md`) | `scripts/complemento.sh` |
| `complemento/c23/` | C2.3 repetido no fim do complemento, com `MSYS_NO_PATHCONV=1` (ver abaixo) | `node rnf2/medir.mjs controlos --so c23` |

**Paragem a meio da M2.3.** A série foi parada às 16:35, a seguir à tentativa B3, porque a máquina
tinha de ser desligada. Tudo o que está nos JSON foi concluído antes da paragem: a M2.3 grava o
ficheiro depois de cada tentativa. `logs/serie.log` tem as horas de cada passo. As tentativas do
complemento juntam-se às da série: 12 no total, 7 na forma A e 5 na forma B.

**C2.3 do complemento inválido.** Em `complemento/rnf2-controlos.json`, o C2.3 deu 404 ao dono, a
outro utilizador e sem JWT. O URL registado (`C:/Program Files/Git/projects/...`) mostra porquê: o Git
Bash converte em caminho do Windows um valor que comece por `/` antes de o passar ao node, e o pedido
foi para um URL que não existe. O script contava esse caso como "recusado nos dois casos". O C2.3 foi
repetido em `complemento/c23/` com a conversão desligada, e o script passou a só contar a recusa
quando o dono recebe 200 do mesmo URL (`urlValido`). O valor válido é o de `complemento/c23/`.

Ficam fora desta série, por decisão (ADR-02, 7.2): a M1.1 e o C1.4 com 1000 MiB. Este ramo mantém o
caminho de carregamento da base, onde esse envio deitou abaixo o motor do Docker. Medem-se na
série com os dois requisitos juntos.

Os vídeos gravados pelo browser (`videos/`) ficam só na máquina de medição, como na base.
