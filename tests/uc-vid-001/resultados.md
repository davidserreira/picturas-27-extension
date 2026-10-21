# Resultados dos testes automáticos — UC-VID-001

Executado em 2026-10-21 12:19 com `tests/uc-vid-001/test_trim_requirements.py` (perfil registado; o bloco [7] passa o utilizador temporariamente a premium para testar o FA1).

| Requisito | Teste | Resultado | Detalhe |
|-----------|-------|-----------|---------|
| REQ-003 | rejeita 50–70 s (fim acima da duração) | ✅ Passou | O instante de fim não pode exceder a duração do vídeo. |
| REQ-003 | rejeita 20–10 s (início depois do fim) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita 5–5 s (intervalo de 0 s) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita -1–5 s (início negativo) | ✅ Passou | O início não pode ser negativo. |
| REQ-003 | rejeita 10–10.5 s (fração de segundo) | ✅ Passou | O início e o fim têm de ser indicados em segundos inteiros. |
| REQ-009 | pedido criado no estado 'Em fila' (queued) | ✅ Passou | queued |
| REQ-010 | receção confirmada em ≤ 2 s | ✅ Passou | 0.07 s |
| REQ-011 | estados seguem Em fila → Em processamento → Concluído | ✅ Passou | queued → processing → completed |
| REQ-012 | progresso atualizado em intervalos ≤ 5 s | ✅ Passou | maior intervalo 2.1 s |
| REQ-015 | resultado com 30 s ± 1 s, mesmo formato e codec | ✅ Passou | 30.00 s, mp4/h264 |
| REQ-016 | resultado guardado como novo vídeo '{nome}_recorte[_n]' | ✅ Passou | video_teste_recorte_4.mp4 |
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
| REQ-008 | premium: aceita 3 pedidos ativos e rejeita o 4.º | ✅ Passou | 3 aceites; 4.º: Já tem 3 pedido(s) de vídeo em curso. Aguarde que termine ou cancele-o antes de fazer outro. |
| REQ-018 | premium: recortes concluídos não gastam quota diária | ✅ Passou | 3/3 concluídos; operações hoje 1 → 1 |
| REQ-005 | premium: aceita vídeo de 6 min (limite 30 min) | ✅ Passou | HTTP 202 |
| REQ-005 | premium: rejeita vídeo de 31 min, sem sugerir o Premium | ✅ Passou | O seu perfil só permite recortar vídeos até 30 min. |
| REQ-006 | premium: aceita vídeo de 250 MB (limite 2 GB) | ✅ Passou | HTTP 202 |
| LIB-002 | a ocupação da biblioteca aumenta o tamanho do resultado | ✅ Passou | 259595059 → 271653794 bytes (resultado: 12058735 bytes) |
| TRIM-027 | biblioteca cheia: rejeita o recorte com a ocupação e o limite | ✅ Passou | Não há espaço na sua biblioteca de vídeos (1.3 GB de 1 GB). Com o plano Premium tem limites maiores. |
| TRIM-031 | recorte de 5 min a 1080p concluído em ≤ 5 min | ✅ Passou | completed em 42 s (0.7 min) |

**31 de 31 testes passaram.**
