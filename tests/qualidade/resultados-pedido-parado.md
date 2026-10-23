# Resultados — pedido parado (TST-JOB-M01, 2.ª parte)

Executado em 2026-10-23: **1/1** passaram.

| Teste | Requisitos | Descrição | Resultado | Detalhe |
|---|---|---|---|---|
| TST-JOB-M01 | PROCESS-002 | processador parado: o pedido fica Falhado ao fim de 20 min, a operação é devolvida e o vídeo não muda | Passa | recorte (remover 0:10–0:20) de um vídeo de 5 min a 1080p; video_trim_tool suspenso a 5 %; 'failed' (Não foi possível recortar o vídeo. Tente novamente.) 20.1 min depois; operações usadas 0 → 1 (reserva) → 0 (devolvida); depois de o processador retomar, o pedido continua 'failed', o vídeo tem o mesmo SHA-256 e 300 s e a biblioteca tem 1 vídeo |
