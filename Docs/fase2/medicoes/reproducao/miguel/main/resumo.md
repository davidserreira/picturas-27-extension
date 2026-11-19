# Resultados — reproducao/miguel/main

Commit 07f2935 · Apple M1 Pro (8 lógicos) · 16 GiB · Darwin 27.0.0 · Docker 29.9.3 (8 CPU, 7.75 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 500 MiB | 2.7 ± 0.3 | 24.2 ± 10 | 147.1 ± 34.9 | 42.2 ± 11.85 | 139.17 ± 17.36 | projects: 182.1 | 3/3 |

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 500 MiB | 0.55 ± 0.05 (mín. 0.49, máx. 0.59, n=3) | 4.3 ± 0.02 (mín. 4.28, máx. 4.33, n=3) |

**C1.4** SHA-256 igual: .

### M2.2 — tempo até a interface refletir o estado

- R (recarregar): 1 de 2 não recuperam em 60 s; tempos dos que recuperam 0.13 s ± 0 (mín. 0.13, máx. 0.13, n=1)
- F (fim noutra página): 1 de 1 sem indicação em 60 s; tempos —

### M2.3 — cancelamento depois de perder a página

- Forma A (recarregar): 1/1
- Forma B (sessão nova): 1/1
- Total: 2/2
