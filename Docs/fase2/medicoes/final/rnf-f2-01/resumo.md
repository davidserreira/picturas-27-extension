# Resultados — final/rnf-f2-01

Commit 7740230 · 12th Gen Intel(R) Core(TM) i5-12450H (12 lógicos) · 15.7 GiB · Microsoft Windows 11 Home 10.0.26300 · Docker 29.9.3 (12 CPU, 7.59 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 MiB | 0.68 ± 0.18 | 4.84 ± 2.68 | 6.52 ± 6.06 | 17.38 ± 9.97 | 39.6 ± 49.54 | img_storage: 24.4 | 5/5 |
| 100 MiB | 4.2 ± 4.06 | 25.14 ± 7.9 | 9.78 ± 3.05 | 42.2 ± 10.67 | 162.8 ± 120.05 | img_storage: 55.7 | 5/5 |
| 500 MiB | 8.14 ± 1.34 | 40.8 ± 1.25 | 22.88 ± 12.19 | 48.08 ± 6.4 | 129.04 ± 97.58 | img_storage: 55.3 | 5/5 |

**1000 MiB, sem limites de memória** (série separada, `rnf1-memoria-1000.json`): 4 tentativa(s), 3 válida(s), 1 com o motor do Docker a deixar de responder.
- rep 1: resposta 204; acréscimos nginx 10.7, api_gateway 42.3, projects 17.4, img_storage 51.2, seaweedfs 2
- rep 2: resposta 204; acréscimos nginx 7.2, api_gateway 42.8, projects 16.5, img_storage 47.1, seaweedfs 0
- rep 3: resposta 204; acréscimos nginx 11.8, api_gateway 39.1, projects 38.8, img_storage 52.9, seaweedfs 59.4
- rep 4: resposta 204, motor do Docker em baixo; acréscimos nginx 12, api_gateway 43.1, projects 20, img_storage 54.3, seaweedfs 187.4

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 10 MiB | 0.62 ± 0.74 (mín. 0.25, máx. 1.94, n=5) | 0.67 ± 0.74 (mín. 0.3, máx. 2, n=5) |
| 100 MiB | 0.75 ± 0.4 (mín. 0.49, máx. 1.45, n=5) | 1.42 ± 0.42 (mín. 1.07, máx. 2.14, n=5) |
| 500 MiB | 0.8 ± 0.18 (mín. 0.59, máx. 0.97, n=5) | 6.45 ± 1.85 (mín. 4.32, máx. 8.39, n=5) |

**C1.3** envio de 500 MiB sem JWT: resposta 401, acréscimo do api_gateway 24.1 MiB.

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

**C1.7** objetos no armazenamento (sem órfãos: sim; envios em partes abertos 0 → 0):

- sample_10s_720p.mp4: 204, 1 objeto(s) em src/ (esperado 1)
- sample_6s.mov: 204, 1 objeto(s) em src/ (esperado 1)
- speech_mandela_177s_1080p.webm: 400, 0 objeto(s) em src/ (esperado 0)
- too_long_90s.mp4 (acima do limite do perfil gratuito): 400, 0 objeto(s) em src/ (esperado 0)
- corrupted.mp4: 400, 0 objeto(s) em src/ (esperado 0)
- imagem enviada como video: 400, 0 objeto(s) em src/ (esperado 0)
- upload-100MiB.mp4 (tamanho no limite gratuito): 400, 0 objeto(s) em src/ (esperado 0)
- conflito de versão (segundo envio com versão antiga): 204, 409, 1 objeto(s) em src/ (esperado 1)
- envio de 100 MiB interrompido a meio: interrompido, 0 objeto(s) em src/ (esperado 0)

### M1.2 — maior ficheiro aceite com 512 MiB por contentor

**1000 MiB**

| Ficheiro | Repetição | Resposta | Reiniciados / sem memória | Sucesso |
| --- | --- | --- | --- | --- |
| 10 MiB | 1 | 204 | —  | sim |
| 10 MiB | 2 | 204 | —  | sim |
| 10 MiB | 3 | 204 | —  | sim |
| 100 MiB | 1 | 204 | —  | sim |
| 100 MiB | 2 | 204 | —  | sim |
| 100 MiB | 3 | 204 | —  | sim |
| 500 MiB | 1 | 204 | —  | sim |
| 500 MiB | 2 | 204 | —  | sim |
| 500 MiB | 3 | 204 | —  | sim |
| 1000 MiB | 1 | 204 | —  | sim |
| 1000 MiB | 2 | 204 | —  | sim |
| 1000 MiB | 3 | 204 | —  | sim |

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

- C2.1 duração de uma execução de P sem interação: 332.4 s ± 7.04 (mín. 326.3, máx. 340.1, n=3)
- C2.2 maior intervalo entre mudanças do progresso: 23.66 s ± 1.43 (mín. 22.02, máx. 24.66, n=3)
- C2.3 estado da execução a terceiros: a base nao expoe o estado de uma execucao; nao ha nada a pedir
- C2.4 execuções sobrepostas iguais às separadas: P sim, Q sim
- C2.5 ferramenta acrescentada a meio: resposta 201, resultados iguais à execução sem alteração: sim
