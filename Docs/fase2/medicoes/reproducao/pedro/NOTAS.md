# Notas da reprodução (pedro, Linux)

Corrida a 2026-11-19 sobre o commit `07f2935`. Máquina: i5-11300H (8 lógicos), 15,3 GiB,
Ubuntu 24.04 com kernel 7.0.0, Docker 29.9.3 (Engine nativo, sem Docker Desktop), Node 22.23.5
nas medições (`ambiente.json`). A regressão foi corrida à parte, noutra consola, onde o `node`
é o 18.19.1; a versão dessa corrida não ficou registada.

## O que correu de forma diferente do previsto

1. **Regressão: `exit 126` dentro de `reproducao.sh`.** Em Linux, o `./correr.sh` (linha 84) dá
   "Permission denied": o ficheiro está no git com o modo 100644 (sem permissão de execução).
   Em Windows (Git Bash) isto não acontece. A regressão foi corrida logo a seguir, à mão,
   sobre a mesma stack do `main` e sem alterações ao código:
   `REGRESSAO=reproducao/pedro bash ./correr.sh`. Corrigido
   entretanto no ramo (`0ec8e05`).
2. **`regressao/reproducao/pedro.md`: linha "Máquina" corrigida à mão.** O `relatorio.mjs` lê
   sempre `medicoes/baseline/ambiente.json` e escrevia a máquina da baseline (i5-12450H,
   7,59 GiB) em vez desta. O script foi
   corrigido entretanto (`0ec8e05`).
3. **`resumo.md`: "C1.4 SHA-256 igual: ." vazio.** A reprodução corre só a M1.1 (`c14` fica `{}`),
   mas o `resumo.mjs` imprime a linha na mesma. Não é uma falha de integridade.

## Resultados a assinalar

- **M1.1 no `main`: o `projects` passou o alvo em 2 das 3 repetições.** Acréscimos de 15,1,
  87,0 e 77,0 MiB com 500 MiB (repouso ~61 MiB nas três). O alvo é ≤ 64 MiB e o mínimo
  128 MiB, pelo que nesta máquina fica **entre o alvo e o mínimo**. Os outros serviços:
  api_gateway ≤ 36,4, img_storage ≤ 46,5, nginx ≤ 6,1 MiB. O relatório (cap. 8) só
  apontava a margem do `img_storage` (62,4 MiB).
- Base: api_gateway até 1693,7 MiB com 500 MiB, dentro do previsto pelo README.
- M2.2: recarregar a página repõe o estado em 0,43 s. O momento de 60 % já apanhou 96 % do
  progresso, porque a execução foi mais rápida do que a referência de 200 s. O F deu 0 s: o
  aviso foi visto o mais tardar quando a API deu o resultado (o `medir.mjs` limita as diferenças
  negativas a 0), pelo que o valor não mede um atraso. Foi usado o vídeo de 120 s do primeiro
  script, e não o de 330 s do script atual.
- M2.3: 2/2. Regressão: 75/75, 19/19, 18/18 (0 diferentes da referência) e 3/3.
