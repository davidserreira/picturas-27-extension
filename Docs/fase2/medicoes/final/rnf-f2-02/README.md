# Medição final do RNF-F2-02

Ramo `fase2/rnf-f2-02-segundo-plano-medido`, commit `77c9bf7`. Mesma máquina, mesmo Docker e mesmos
scripts da base (`../../baseline/`), com o portátil ligado à corrente.

| Pasta ou ficheiro | O que tem | Script |
| --- | --- | --- |
| `*.json`, `resumo.md`, `logs/` | Série de 18 nov., 15:15–16:35, de um arranque limpo: M1.1 com 10, 100 e 500 MiB e C1.1–C1.7; M2.1; M2.2; M2.3, com 8 das 10 tentativas (A1–A5, B1–B3) | `scripts/final.sh` |
| `complemento/` | Por fazer: as tentativas da M2.3 que faltam, C2.1–C2.5, M1.2 e a regressão, de um arranque limpo | `scripts/complemento.sh` |

A série foi parada às 16:35, a seguir à tentativa B3 da M2.3, porque a máquina tinha de ser
desligada. Tudo o que está nos JSON foi concluído antes da paragem: a M2.3 grava o ficheiro depois
de cada tentativa. `logs/serie.log` tem as horas de cada passo.

Ficam fora desta série, por decisão (ADR-02, 7.2): a M1.1 e o C1.4 com 1000 MiB. Este ramo mantém o
caminho de carregamento da base, onde esse envio deitou abaixo o motor do Docker. Medem-se na
série com os dois requisitos juntos.

Os vídeos gravados pelo browser (`videos/`) ficam só na máquina de medição, como na base.
