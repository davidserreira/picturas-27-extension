# Reprodução das medições noutra máquina

As diretrizes pedem que as medições possam ser repetidas por outra pessoa. O `reproducao.sh`
repete uma parte curta delas na máquina de cada membro do grupo. Leva 1 a 1,5 h, quase tudo em
builds do Docker.

Não substitui as séries oficiais (`../baseline/`, `../final/`), feitas todas na mesma máquina.
Os tempos não se comparam entre máquinas. Comparam-se só a ordem de grandeza da memória e os
resultados de sim ou não.

| Passo | Versão | O que mede |
| --- | --- | --- |
| 1 | Base (`43a2e08`, numa cópia de trabalho ao lado do repositório) | M1.1 com 500 MiB (100 MiB se o Docker tiver menos de 7 GiB) |
| 2 | Este ramo (código igual ao da `main`) | Regressão completa; M1.1 com o mesmo tamanho; M2.2 e M2.3 uma vez cada, com o vídeo de 330 s das séries oficiais |

O script verifica primeiro que o código da cópia é igual ao da `main`. Na base, um envio de
1000 MiB deita abaixo o motor do Docker (`../ocorrencias/`), por isso esse tamanho não entra aqui.

## Como correr

Requisitos: Docker a correr, Node.js 18 ou mais recente, cerca de 20 GB livres e, no Windows, o
Git Bash. O script para e apaga a instalação local do PictuRAS (`docker compose down -v`).

```bash
git switch fase2/integracao && git pull
NOME=<o-teu-nome> bash Docs/fase2/medicoes/reproducao/reproducao.sh
```

No fim, o script diz onde estão os resultados e como os guardar no ramo `fase2/integracao`
(nunca na `main`). Os vídeos gravados pelo browser e os dados de teste não entram no Git.

| Resultado | O que se espera |
| --- | --- |
| M1.1 na base | No `api_gateway`, 1700 a 2000 MiB com 500 MiB, ou cerca de 300 MiB com 100 MiB (`../baseline/resumo.md`) |
| M1.1 na `main` | Menos de 64 MiB em cada serviço do critério (`nginx`, `api_gateway`, `projects`, `img_storage`) |
| M2.2 | Estado reposto e fim avisado em menos de 2 s |
| M2.3 | Cancelamento feito nas duas formas |
| Regressão | Todos os testes passam, com as mesmas impressões da base |

Se algum resultado não for o esperado, isso também é um resultado: fica registado aqui, com os
registos de `logs/`.
