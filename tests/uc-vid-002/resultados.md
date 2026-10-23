# Resultados — UC-VID-002 (importação)

Executado em 2026-10-23: **11/12** passaram.

| Teste | Requisitos | Descrição | Resultado | Detalhe |
|---|---|---|---|---|
| TST-IMPORT-M01 | IMPORT-002, 007, 013, 014, 015, 029 | importação válida: estados, biblioteca e ficheiro idêntico | Passa | estados uploading → validating → available; video_teste.mp4, 60 s, 39042157 bytes; SHA-256 igual: True |
| TST-IMPORT-M11 | IMPORT-021 | importar não gasta operações do dia | Passa | operações usadas 0 → 0 |
| TST-IMPORT-M10 | IMPORT-025, 026 | remover um vídeo liberta o espaço | Passa | ocupação 39042157 → 0 bytes (−39042157) |
| TST-IMPORT-M02 | IMPORT-003 | extensão .avi recusada antes do envio | Passa | 415: Formato não suportado. Formatos aceites: MP4 (H.264) e MOV |
| TST-IMPORT-M03 | IMPORT-004 | 250 MB recusado no registado com o limite | Passa | 413: O ficheiro excede o tamanho máximo de 200 MB do seu perfil. Com o plano Premium pode importar vídeos até 2 GB. |
| TST-IMPORT-M04 | IMPORT-005, 027 | sem espaço livre: não começa e indica o espaço | Passa | 409: Não há espaço suficiente na biblioteca de vídeo. Espaço livre: 124 MB de 1 GB. (ocupação 900 MB de 1024 MB) |
| TST-IMPORT-M05 | IMPORT-006 | segunda importação ativa recusada no registado | Passa | 409: Atingiu o número máximo de importações ativas (1). Aguarde ou cancele uma importação ativa. |
| TST-IMPORT-M07 | IMPORT-012 | 6 min recusado depois do envio e removido | Passa | failed: O vídeo excede a duração máxima de 5 min do seu perfil. Com o plano Premium pode importar vídeos até 30 min. |
| TST-IMPORT-M06 | IMPORT-010, 011, 023 | AVI renomeado e MP4 truncado recusados e fora da biblioteca | Falha | renomeado.mp4: failed — Formato não suportado. Formatos aceites: MP4 (H.264) e MOV; truncado.mp4: available — None |
| TST-IMPORT-M08 | IMPORT-016, 017, 023 | cancelar a meio: Cancelado, sem parcial nem vídeo | Passa | cancelado a 52 %; parcial antes True, depois False |
| TST-IMPORT-M09 | IMPORT-018, 019, 020 | falha de ligação: Interrompido, retoma sem reenviar e expiração ao fim de 1 h | Passa | interrompido a 60 % (expira 2026-10-23T00:35:54.559Z); retoma em 115343360 de 115343360 bytes; SHA-256 igual: True; expirado: failed — A importação foi interrompida e não foi retomada no prazo de 1 hora. |
| TST-IMPORT-M12 | IMPORT-008, 009, 030 | 190 MB: envio começa em ≤ 2 s, progresso a cada ≤ 5 s, validação em ≤ 30 s | Passa | início 0.06 s; maior intervalo entre blocos de 5 MB 0.19 s; validação 2.8 s |
