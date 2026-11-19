# Resultados — final/integrado

Commit eb8a37d · 12th Gen Intel(R) Core(TM) i5-12450H (12 lógicos) · 15.7 GiB · Microsoft Windows 11 Home 10.0.26300 · Docker 29.9.3 (12 CPU, 7.59 GiB) · Compose 5.7.0

## RNF-F2-01

### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)

| Ficheiro | nginx | api_gateway | projects | img_storage | seaweedfs | Pior no critério (máx.) | Válidas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 MiB | 0.7 ± 0.14 | 7 ± 0.98 | 5.36 ± 0.62 | 23.12 ± 1.29 | 76.46 ± 56.79 | img_storage: 24.2 | 5/5 |
| 100 MiB | 5.58 ± 2.84 | 23.54 ± 8.56 | 15.86 ± 5 | 37.08 ± 6.09 | 138.7 ± 114.15 | img_storage: 45.6 | 5/5 |
| 500 MiB | 8.54 ± 1.97 | 40.54 ± 1.69 | 22.9 ± 8.71 | 57.38 ± 4.69 | 107.5 ± 97.34 | img_storage: 62.9 | 5/5 |

**1000 MiB, sem limites de memória** (série separada, `rnf1-memoria-1000.json`): 5 tentativa(s), 5 válida(s), 0 com o motor do Docker a deixar de responder.
- rep 1: resposta 204; acréscimos nginx 7.7, api_gateway 41, projects 18.1, img_storage 52.2, seaweedfs 3.1
- rep 2: resposta 204; acréscimos nginx 9.7, api_gateway 42.7, projects 14.7, img_storage 49.1, seaweedfs 0
- rep 3: resposta 204; acréscimos nginx 7.4, api_gateway 41.2, projects 16.6, img_storage 54.6, seaweedfs 73.7
- rep 4: resposta 204; acréscimos nginx 11.5, api_gateway 41, projects 22.6, img_storage 62.4, seaweedfs 134.1
- rep 5: resposta 204; acréscimos nginx 7.2, api_gateway 40.2, projects 15.7, img_storage 52.6, seaweedfs 173.1

### C1.1 / C1.2 — tempos do envio (s)

| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |
| --- | --- | --- |
| 10 MiB | 0.56 ± 0.54 (mín. 0.27, máx. 1.52, n=5) | 0.6 ± 0.55 (mín. 0.31, máx. 1.58, n=5) |
| 100 MiB | 0.58 ± 0.08 (mín. 0.52, máx. 0.71, n=5) | 1.27 ± 0.19 (mín. 1.11, máx. 1.55, n=5) |
| 500 MiB | 0.87 ± 0.27 (mín. 0.47, máx. 1.16, n=5) | 7.19 ± 2.89 (mín. 4.22, máx. 11.25, n=5) |

**C1.3** envio de 500 MiB sem JWT: resposta 401, acréscimo do api_gateway 19.6 MiB.

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

- R (recarregar): 0 de 6 não recuperam em 60 s; tempos dos que recuperam 0.33 s ± 0.05 (mín. 0.27, máx. 0.43, n=6)
- F (fim noutra página): 0 de 3 sem indicação em 60 s; tempos 0.11 s ± 0.01 (mín. 0.11, máx. 0.12, n=3)

### M2.3 — cancelamento depois de perder a página

- Forma A (recarregar): 5/5
- Forma B (sessão nova): 5/5
- Total: 10/10

### Controlos

- C2.1 duração de uma execução de P sem interação: 310.33 s ± 4.15 (mín. 306.6, máx. 314.8, n=3)
- C2.2 maior intervalo entre mudanças do progresso: 2.09 s ± 0.18 (mín. 1.96, máx. 2.3, n=3)
- C2.3 estado da execução a terceiros: outro utilizador 401, sem JWT 401
- C2.4 execuções sobrepostas iguais às separadas: P sim, Q sim
- C2.5 ferramenta acrescentada a meio: resposta 201, resultados iguais à execução sem alteração: sim
