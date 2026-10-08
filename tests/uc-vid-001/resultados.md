# Resultados dos testes automáticos — UC-VID-001

Executado em 2026-10-08 22:00 com `tests/uc-vid-001/test_trim_requirements.py` (perfil registado).

| Requisito | Teste | Resultado | Detalhe |
|-----------|-------|-----------|---------|
| REQ-003 | rejeita 50–70 s (fim acima da duração) | ✅ Passou | O instante de fim não pode exceder a duração do vídeo. |
| REQ-003 | rejeita 20–10 s (início depois do fim) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita 5–5 s (intervalo de 0 s) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita -1–5 s (início negativo) | ✅ Passou | O início não pode ser negativo. |
| REQ-003 | rejeita 10–10.5 s (fração de segundo) | ✅ Passou | O início e o fim têm de ser indicados em segundos inteiros. |
| REQ-009 | pedido criado no estado 'Em fila' (queued) | ✅ Passou | queued |
| REQ-010 | receção confirmada em ≤ 2 s | ✅ Passou | 0.04 s |
| REQ-011 | estados seguem Em fila → Em processamento → Concluído | ✅ Passou | queued → processing → completed |
| REQ-012 | progresso atualizado em intervalos ≤ 5 s | ✅ Passou | maior intervalo 2.1 s |
| REQ-015 | resultado com 30 s ± 1 s, mesmo formato e codec | ✅ Passou | 30.00 s, mp4/h264 |
| REQ-016 | resultado guardado como novo vídeo '{nome}_recorte[_n]' | ✅ Passou | video_teste_recorte_2.mp4 |
| REQ-017 | ficheiro original inalterado (SHA-256 igual antes e depois) | ✅ Passou | 790e05bbf7be9a6b… |
| REQ-018 | desconta 1 operação quando o pedido termina 'Concluído' | ✅ Passou | 5 → 4 |
| REQ-008 | rejeita um 2.º pedido com 1 pedido ativo (registado) | ✅ Passou | Já tem 1 pedido(s) de vídeo em curso. Aguarde que termine ou cancele-o antes de fazer outro. |
| REQ-013 | cancela um pedido em curso | ✅ Passou | HTTP 200 |
| REQ-014 | cancelado: sem vídeo novo nem ficheiros temporários | ✅ Passou | temporários no worker: 0 |
| REQ-018 | cancelado: a quota não muda | ✅ Passou | 4 → 4 |
| REQ-007 | com 5 operações usadas rejeita e sugere o Premium | ✅ Passou | Atingiu o limite de 5 operações diárias. Com o plano Premium não tem limite diário. |
| REQ-019 | marca 'Falhado' com a mensagem prevista | ✅ Passou | failed: Não foi possível recortar o vídeo. Tente novamente. |
| REQ-020 | falhado: sem vídeo novo e quota inalterada | ✅ Passou | quota 4 → 4 |
| REQ-004 | rejeita formato não suportado | ✅ Passou | Formato não suportado. Formatos aceites: MP4 (H.264) e MOV |
| REQ-005 | rejeita duração acima de 5 min (registado) | ✅ Passou | O seu perfil só permite recortar vídeos até 5 min. Com o plano Premium tem limites maiores. |
| REQ-006 | rejeita tamanho acima de 200 MB (registado) | ✅ Passou | O seu perfil só permite recortar vídeos até 200 MB. Com o plano Premium tem limites maiores. |

**23 de 23 testes passaram.**
