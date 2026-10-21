# Resultados — requisitos de qualidade (API)

Executado em 2026-10-21: **8/8** passaram.

| Teste | Requisitos | Descrição | Resultado | Detalhe |
|---|---|---|---|---|
| TST-SEC-M01 | ACCESS-001 | outro utilizador e pedidos sem sessão são recusados | Passa | outro utilizador: biblioteca 401, vídeo 401, endereço 401, faixas 401, pedido 401, recorte 401, remover 401; sem sessão: 401 |
| TST-SEC-M02 | ACCESS-002 | endereço assinado válido até 1 h; alterado, forjado ou sem assinatura é recusado | Passa | validade 3600 s; original aceite; validade alterada, assinatura forjada e sem assinatura: [403, 403, 403]. Não se esperou 1 h para ver a expiração |
| TST-SEC-M03 | ACCESS-003 | o conteúdo do vídeo não aparece em claro nos volumes | Passa | excerto de 64 bytes do vídeo procurado em 22 ficheiros de volume: 0 ocorrências |
| TST-LIB-M04 | LIB-009 | 5 min: faixas em ≤ 2 s, forma de onda em ≤ 30 s e reabertura em ≤ 2 s | Passa | faixas 0.21 s; forma de onda 0.7 s; reabertura 0.03 s (medido na API; o desenho no browser não está incluído) |
| TST-APPLY-M02 | APPLY-017; JOB-012 | confirmação em ≤ 2 s e progresso e fotogramas atualizados a cada ≤ 5 s | Passa | confirmação 0.14 s; maior intervalo entre atualizações 2.1 s; fotogramas 3600 |
| TST-APPLY-M03 | APPLY-035 | 2 min, 1920 × 1080, 30 fps, cadeia de 3 ferramentas em ≤ 10 min | Passa | 182 s (3.0 min); resultado 1280 × 720, 3600 fotogramas; stream|codec_name=h264|codec_type=video|width=1280|height=720|r_frame_rate=30/1|nb_frames=3600; stream|codec_name=aac|codec_type=audio|r_frame_rate=0/0|nb_frames=5169 |
| TST-JOB-M01 | PROCESS-003 | processador terminado a meio: o pedido volta a ser processado e termina | Passa | terminado a 12 %; estados vistos depois: processing → completed. A deteção de pedidos parados (20 min) não foi esperada |
| TST-QUAL-M04 | PORT-001 | processadores de vídeo concluem pedidos sem dependências no anfitrião | Passa | Linux com Docker Engine; FFmpeg no anfitrião: não; recorte e aplicação de ferramentas concluídos |
