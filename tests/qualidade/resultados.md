# Resultados — requisitos de qualidade (API)

Executado em 2026-10-23: **9/9** passaram.

| Teste | Requisitos | Descrição | Resultado | Detalhe |
|---|---|---|---|---|
| TST-SEC-M01 | ACCESS-001 | outro utilizador e pedidos sem sessão são recusados | Passa | outro utilizador: biblioteca 401, vídeo 401, endereço 401, faixas 401, pedido 401, recorte 401, remover 401; sem sessão: 401 |
| TST-SEC-M02 | ACCESS-002 | endereço assinado válido até 1 h; alterado, forjado ou sem assinatura é recusado | Passa | validade 3600 s; original aceite; validade alterada, assinatura forjada e sem assinatura: [403, 403, 403]. Não se esperou 1 h para ver a expiração |
| TST-SEC-M03 | ACCESS-003 | o conteúdo do vídeo não aparece em claro nos volumes | Passa | excerto de 64 bytes do vídeo procurado em 490 ficheiros de volume: 0 ocorrências |
| TST-LIB-M04 | LIB-009 | 5 min: faixas em ≤ 2 s, forma de onda em ≤ 30 s e reabertura em ≤ 2 s | Passa | faixas 0.25 s; forma de onda 1.3 s; reabertura 0.06 s (medido na API; o desenho no browser não está incluído) |
| TST-APPLY-M02 | APPLY-017; JOB-012 | confirmação em ≤ 2 s e progresso e fotogramas atualizados a cada ≤ 5 s | Passa | confirmação 0.12 s; maior intervalo entre atualizações 2.2 s; fotogramas 3600 |
| TST-APPLY-M03 | APPLY-035 | 2 min, 1920 × 1080, 30 fps, cadeia de 3 ferramentas em ≤ 10 min | Passa | 272 s (4.5 min); resultado 1280 × 720, 3600 fotogramas; stream|codec_name=h264|codec_type=video|width=1280|height=720|r_frame_rate=30/1|nb_frames=3600; stream|codec_name=aac|codec_type=audio|r_frame_rate=0/0|nb_frames=5169 |
| TST-JOB-M01 | PROCESS-003 | processador terminado a meio: o pedido volta a ser processado e termina, sem deixar temporários | Passa | terminado a 11 %; estados vistos depois: processing → completed; temporários no processador: 0. A deteção de pedidos parados (20 min) é testada em test_stalled_job.py |
| TST-JOB-M02 | PROCESS-004 | 20 pedidos simultâneos de contas premium ficam em fila e terminam | Passa | aceites 20/20; concluídos 20; todos terminaram em 61 s com 1 processador |
| TST-QUAL-M04 | PORT-001 | processadores de vídeo concluem pedidos sem dependências no anfitrião | Passa | Windows com Docker Desktop 29.8.2; FFmpeg no anfitrião: não; recorte e aplicação de ferramentas concluídos |
