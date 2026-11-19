# Resultados — reproducao/miguel/base

Commit 07f2935 · Apple M1 Pro (8 lógicos) · 16 GiB · Darwin 27.0.0 · Docker 29.9.3 (8 CPU, 7.75 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 500 MiB | 17.83 ± 0.21 | 1789.83 ± 154.43 | 1192.93 ± 19.62 | 1036.57 ± 16.58 | 217.5 ± 300.7 | api_gateway: 1961.1 | 3/3 |

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 500 MiB | 10.88 ± 1.67 (mín. 9.61, máx. 12.77, n=3) | 14.56 ± 1.51 (mín. 13.25, máx. 16.21, n=3) |

**C1.4** SHA-256 igual: .
