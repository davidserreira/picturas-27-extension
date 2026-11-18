# Resultados — final/rnf-f2-02/complemento

Commit ed34cd7 · 12th Gen Intel(R) Core(TM) i5-12450H (12 lógicos) · 15.7 GiB · Microsoft Windows 11 Home 10.0.26300 · Docker 29.9.3 (12 CPU, 7.59 GiB) · Compose 5.7.0


### M1.2 — maior ficheiro aceite com 512 MiB por contentor

**100 MiB**

| Ficheiro | Repetição | Resposta | Reiniciados / sem memória | Sucesso |
| --- | --- | --- | --- | --- |
| 10 MiB | 1 | 204 | —  | sim |
| 10 MiB | 2 | 204 | —  | sim |
| 10 MiB | 3 | 204 | —  | sim |
| 100 MiB | 1 | 204 | —  | sim |
| 100 MiB | 2 | 204 | —  | sim |
| 100 MiB | 3 | 204 | —  | sim |
| 500 MiB | 1 | 502 | api_gateway (OOM: api_gateway) | não |
| 500 MiB | 2 | 502 | api_gateway (OOM: api_gateway) | não |
| 500 MiB | 3 | 502 | api_gateway (OOM: api_gateway) | não |

### M2.3 — cancelamento depois de perder a página

- Forma A (recarregar): 2/2
- Forma B (sessão nova): 2/2
- Total: 4/4

### Controlos

- C2.1 duração de uma execução de P sem interação: 336.13 s ± 5.61 (mín. 330.3, máx. 341.5, n=3)
- C2.2 maior intervalo entre mudanças do progresso: 1.89 s ± 0.36 (mín. 1.51, máx. 2.22, n=3)
- C2.3 estado da execução a terceiros: outro utilizador 404, sem JWT 404
- C2.4 execuções sobrepostas iguais às separadas: P sim, Q sim
- C2.5 ferramenta acrescentada a meio: resposta 201, resultados iguais à execução sem alteração: sim
