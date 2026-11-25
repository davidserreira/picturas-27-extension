# Resultados — reproducao/pedro/main

Commit 07f2935 · 11th Gen Intel(R) Core(TM) i5-11300H @ 3.10GHz (8 lógicos) · 15.3 GiB · Linux 7.0.0-43-generic · Docker 29.9.3 (8 CPU, 15.31 GiB) · Compose 5.5.1

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 500 MiB | 4.93 ± 1.61 | 35.03 ± 1.65 | 59.7 ± 38.95 | 45.47 ± 1.23 | 290.53 ± 166.12 | projects: 87 | 3/3 |

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 500 MiB | 0.62 ± 0.02 (mín. 0.61, máx. 0.64, n=3) | 4.23 ± 0.4 (mín. 3.82, máx. 4.63, n=3) |

**C1.4** SHA-256 igual: .

### M2.2 — tempo até a interface refletir o estado

- R (recarregar): 0 de 2 não recuperam em 60 s; tempos dos que recuperam 0.43 s ± 0.01 (mín. 0.42, máx. 0.44, n=2)
- F (fim noutra página): 0 de 1 sem indicação em 60 s; tempos 0 s ± 0 (mín. 0, máx. 0, n=1)

### M2.3 — cancelamento depois de perder a página

- Forma A (recarregar): 1/1
- Forma B (sessão nova): 1/1
- Total: 2/2
