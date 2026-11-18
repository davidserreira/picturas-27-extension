# Resultados — final/rnf-f2-02

Commit 77c9bf7 · 12th Gen Intel(R) Core(TM) i5-12450H (12 lógicos) · 15.7 GiB · Microsoft Windows 11 Home 10.0.26300 · Docker 29.9.3 (12 CPU, 7.59 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 MiB | 1.58 ± 1.36 | 29.64 ± 5.76 | 27.88 ± 6.45 | 23.26 ± 0.36 | 44.3 ± 37.37 | projects: 39.4 | 5/5 |
| 100 MiB | 4.94 ± 1.72 | 319.58 ± 31.47 | 213 ± 2.39 | 205.06 ± 0.41 | 140.7 ± 108.33 | api_gateway: 375.8 | 5/5 |
| 500 MiB | 17.6 ± 1.33 | 1822.1 ± 186.39 | 1049.28 ± 24.43 | 1006.78 ± 4.3 | 22.34 ± 30.58 | api_gateway: 2009 | 5/5 |

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 10 MiB | 0.78 ± 0.44 (mín. 0.38, máx. 1.47, n=5) | 0.83 ± 0.44 (mín. 0.44, máx. 1.53, n=5) |
| 100 MiB | 5.28 ± 4.67 (mín. 1.82, máx. 13.22, n=5) | 5.57 ± 4.78 (mín. 1.99, máx. 13.7, n=5) |
| 500 MiB | 15.2 ± 14.93 (mín. 7.16, máx. 41.79, n=5) | 16.98 ± 15.7 (mín. 8.4, máx. 44.88, n=5) |

**C1.3** envio de 500 MiB sem JWT: resposta 401, acréscimo do api_gateway 1006.2 MiB.

**C1.4** SHA-256 igual: 10 MiB sim, 100 MiB sim, 500 MiB sim.

**C1.5** decisões de validação:

- sample_10s_720p.mp4: 204 
- sample_6s.mov: 204 
- speech_mandela_177s_1080p.webm: 400 "The video is 176.6 s long and your profile limit is 60 s"
- too_long_90s.mp4 (acima do limite do perfil gratuito): 400 "The video is 90.0 s long and your profile limit is 60 s"
- corrupted.mp4: 400 "Unreadable or corrupted video file"
- imagem enviada como video: 400 "Only video files (.mp4, .mov, .webm) can be uploaded here."
- upload-100MiB.mp4 (tamanho no limite gratuito): 400 "The video is 100.1 MB and your profile limit is 100 MB"

**C1.6** ficheiros em /tmp: antes {"api_gateway":544,"projects":544,"img_storage":544}, após envio completo {"api_gateway":544,"projects":544,"img_storage":544}, após envio interrompido {"api_gateway":544,"projects":544,"img_storage":544}.

**C1.7** objetos no armazenamento (sem órfãos: **não**; envios em partes abertos 0 → 0):

- sample_10s_720p.mp4: 204, 1 objeto(s) em src/ (esperado 1)
- sample_6s.mov: 204, 1 objeto(s) em src/ (esperado 1)
- speech_mandela_177s_1080p.webm: 400, 0 objeto(s) em src/ (esperado 0)
- too_long_90s.mp4 (acima do limite do perfil gratuito): 400, 0 objeto(s) em src/ (esperado 0)
- corrupted.mp4: 400, 0 objeto(s) em src/ (esperado 0)
- imagem enviada como video: 400, 0 objeto(s) em src/ (esperado 0)
- upload-100MiB.mp4 (tamanho no limite gratuito): 400, 0 objeto(s) em src/ (esperado 0)
- conflito de versão (segundo envio com versão antiga): 204, 409, 2 objeto(s) em src/ (esperado 1)
- envio de 100 MiB interrompido a meio: interrompido, 0 objeto(s) em src/ (esperado 0)

## RNF-F2-02

### M2.1 — ações concluídas durante uma execução

Pior execução: **100%** · média 100% ± 0 (mín. 100, máx. 100, n=3) · G1 completo em todas: sim · execuções válidas 3

| # | Ação | Resultado obtido (a) | Progresso visível (b) | Concluída |
| --- | --- | --- | --- | --- |
| 1 | Em P, alternar para o carrossel | 3/3 | 3/3 | 3/3 |
| 2 | Em P, voltar a grelha e ver os tres media | 3/3 | 3/3 | 3/3 |
| 3 | Em P, descarregar os media originais | 3/3 | 3/3 | 3/3 |
| 4 | Em P, abrir o dialogo de partilha | 3/3 | 3/3 | 3/3 |
| 5 | Abrir a pagina da conta | 3/3 | 3/3 | 3/3 |
| 6 | Abrir o projeto Q pela barra lateral | 3/3 | 3/3 | 3/3 |
| 7 | Carregar uma imagem para Q | 3/3 | 3/3 | 3/3 |
| 8 | Acrescentar brilho ao pipeline de Q e guardar | 3/3 | 3/3 | 3/3 |
| 9 | Criar um projeto novo pela barra lateral | 3/3 | 3/3 | 3/3 |
| 10 | Voltar a P | 3/3 | 3/3 | 3/3 |

### M2.2 — tempo até a interface refletir o estado

- R (recarregar): 0 de 6 não recuperam em 60 s; tempos dos que recuperam 0.39 s ± 0.12 (mín. 0.32, máx. 0.63, n=6)
- F (fim noutra página): 0 de 3 sem indicação em 60 s; tempos 0.07 s ± 0.06 (mín. 0, máx. 0.11, n=3)
