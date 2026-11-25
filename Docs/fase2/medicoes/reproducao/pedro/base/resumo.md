# Resultados — reproducao/pedro/base

Commit 07f2935 · 11th Gen Intel(R) Core(TM) i5-11300H @ 3.10GHz (8 lógicos) · 15.3 GiB · Linux 7.0.0-43-generic · Docker 29.9.3 (8 CPU, 15.31 GiB) · Compose 5.5.1

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 500 MiB | 58.67 ± 57 | 1574.8 ± 102.98 | 1246.03 ± 283.06 | 1002.83 ± 11.79 | 238.9 ± 296.89 | api_gateway: 1693.7 | 3/3 |

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 500 MiB | 17.92 ± 17.85 (mín. 6.43, máx. 38.49, n=3) | 18.71 ± 17.79 (mín. 7.19, máx. 39.19, n=3) |

**C1.4** SHA-256 igual: .
