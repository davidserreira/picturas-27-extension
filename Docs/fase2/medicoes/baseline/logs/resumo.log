# Resultados — baseline

Commit 43a2e08 · 12th Gen Intel(R) Core(TM) i5-12450H (12 lógicos) · 15.7 GiB · Microsoft Windows 11 Home 10.0.26300 · Docker 29.9.3 (12 CPU, 7.59 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 MiB | 0.92 ± 0.3 | 28 ± 6.17 | 27.6 ± 4.45 | 18.88 ± 10.56 | 36.82 ± 37.16 | api_gateway: 35 | 5/5 |
| 100 MiB | 4.58 ± 1.57 | 305 ± 1.66 | 219.4 ± 3.6 | 205.2 ± 0.6 | 77.48 ± 93.99 | api_gateway: 307.9 | 5/5 |
| 500 MiB | 17.74 ± 1.27 | 1692.02 ± 202.52 | 1022.92 ± 40.1 | 991.06 ± 37.45 | 13.68 ± 23.86 | api_gateway: 2001 | 5/5 |

**1000 MiB, sem limites de memória** (série separada, `rnf1-memoria-1000.json`): 1 tentativa(s), 0 válida(s), 1 com o motor do Docker a deixar de responder.
- rep 1: resposta 504, motor do Docker em baixo; acréscimos nginx 33.2, api_gateway 3454.5, projects 1981.1, img_storage 282.4, seaweedfs 0

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 10 MiB | 0.36 ± 0.1 (mín. 0.28, máx. 0.53, n=5) | 0.39 ± 0.1 (mín. 0.3, máx. 0.57, n=5) |
| 100 MiB | 1.87 ± 0.5 (mín. 1.53, máx. 2.76, n=5) | 2.1 ± 0.48 (mín. 1.79, máx. 2.96, n=5) |
| 500 MiB | 11.21 ± 5.92 (mín. 7.17, máx. 21.61, n=5) | 12.65 ± 5.95 (mín. 8.36, máx. 23.01, n=5) |

**C1.3** envio de 500 MiB sem JWT: resposta 401, acréscimo do api_gateway 1006.4 MiB.

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

## RNF-F2-02

### M2.1 — ações concluídas durante uma execução

Pior execução: **0%** · média 0% ± 0 (mín. 0, máx. 0, n=3) · G1 completo em todas: não · execuções válidas 3

| # | Ação | Resultado obtido (a) | Progresso visível (b) | Concluída |
| --- | --- | --- | --- | --- |
| 1 | Em P, alternar para o carrossel | 0/3 | 3/3 | 0/3 |
| 2 | Em P, voltar a grelha e ver os tres media | 0/3 | 3/3 | 0/3 |
| 3 | Em P, descarregar os media originais | 0/3 | 3/3 | 0/3 |
| 4 | Em P, abrir o dialogo de partilha | 0/3 | 3/3 | 0/3 |
| 5 | Abrir a pagina da conta | 3/3 | 0/3 | 0/3 |
| 6 | Abrir o projeto Q pela barra lateral | 3/3 | 0/3 | 0/3 |
| 7 | Carregar uma imagem para Q | 3/3 | 0/3 | 0/3 |
| 8 | Acrescentar brilho ao pipeline de Q e guardar | 3/3 | 0/3 | 0/3 |
| 9 | Criar um projeto novo pela barra lateral | 3/3 | 0/3 | 0/3 |
| 10 | Voltar a P | 0/3 | 0/3 | 0/3 |

### M2.2 — tempo até a interface refletir o estado

- R (recarregar): 6 de 6 não recuperam em 60 s; tempos dos que recuperam —
- F (fim noutra página): 3 de 3 sem indicação em 60 s; tempos —

### M2.3 — cancelamento depois de perder a página

- Forma A (recarregar): 0/5
- Forma B (sessão nova): 0/5
- Total: 0/10

### Controlos

- C2.1 duração de uma execução de P sem interação: 275.87 s ± 13.05 (mín. 267.4, máx. 290.9, n=3)
- C2.2 maior intervalo entre mudanças do progresso: 16.91 s ± 1.01 (mín. 16.11, máx. 18.05, n=3)
- C2.3 estado da execução a terceiros: a base nao expoe o estado de uma execucao; nao ha nada a pedir
- C2.4 execuções sobrepostas iguais às separadas: P sim, Q sim
- C2.5 ferramenta acrescentada a meio: resposta 201, resultados iguais à execução sem alteração: sim
