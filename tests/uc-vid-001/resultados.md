# Resultados dos testes automáticos — UC-VID-001

Executado em 2026-10-23 00:57 com `tests/uc-vid-001/test_trim_requirements.py` (perfil registado; o bloco [7] passa o utilizador temporariamente a premium para testar o FA1).

| Requisito | Teste | Resultado | Detalhe |
|-----------|-------|-----------|---------|
| REQ-003 | rejeita 50–70 s (fim acima da duração) | ✅ Passou | O instante de fim não pode exceder a duração do vídeo. |
| REQ-003 | rejeita 20–10 s (início depois do fim) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita 5–5 s (intervalo de 0 s) | ✅ Passou | O instante de fim tem de ser posterior ao de início. |
| REQ-003 | rejeita -1–5 s (início negativo) | ✅ Passou | O início não pode ser negativo. |
| REQ-003 | rejeita 10–10.5 s (fração de segundo) | ✅ Passou | O início e o fim têm de ser indicados em segundos inteiros. |
| REQ-009 | pedido criado no estado 'Em fila' (queued) | ✅ Passou | queued |
| REQ-010 | receção confirmada em ≤ 2 s | ✅ Passou | 0.14 s |
| REQ-011 | estados seguem Em fila → Em processamento → Concluído | ✅ Passou | processing → completed |
| REQ-012 | progresso atualizado em intervalos ≤ 5 s | ✅ Passou | maior intervalo 2.1 s |
| REQ-015 | resultado com 30 s ± 1 s, mesmo formato e codec | ✅ Passou | 30.00 s, mp4/h264 |
| REQ-016 | o resultado substitui o vídeo recortado (mesmo vídeo e nome, sem vídeo novo) | ✅ Passou | __teste_trabalho.mp4 |
| REQ-018 | desconta 1 operação quando o pedido termina 'Concluído' | ✅ Passou | 5 → 4 |
| REQ-008 | rejeita um 2.º pedido com 1 pedido ativo (registado) | ✅ Passou | Já tem 1 pedido(s) de vídeo em curso. Aguarde que termine ou cancele-o antes de fazer outro. |
| REQ-013 | cancela um pedido em curso | ✅ Passou | HTTP 200 |
| REQ-014 | cancelado: sem vídeo novo nem ficheiros temporários | ✅ Passou | temporários no worker: 0 |
| REQ-018 | cancelado: a quota não muda | ✅ Passou | 4 → 4 |
| REQ-017 | cancelado: o vídeo fica inalterado (SHA-256 igual antes e depois) | ✅ Passou | b22a06b779bd24d8… |
| REQ-007 | com 5 operações usadas rejeita e sugere o Premium | ✅ Passou | Atingiu o limite de 5 operações diárias. Com o plano Premium não tem limite diário. |
| REQ-019 | marca 'Falhado' com a mensagem prevista | ✅ Passou | failed: Não foi possível recortar o vídeo. Tente novamente. |
| REQ-020 | falhado: sem vídeo novo e quota inalterada | ✅ Passou | quota 4 → 4 |
| REQ-004 | rejeita formato não suportado | ✅ Passou | Formato não suportado. Formatos aceites: MP4 (H.264) e MOV |
| REQ-005 | rejeita duração acima de 5 min (registado) | ✅ Passou | O seu perfil só permite recortar vídeos até 5 min. Com o plano Premium tem limites maiores. |
| REQ-006 | rejeita tamanho acima de 200 MB (registado) | ✅ Passou | O seu perfil só permite recortar vídeos até 200 MB. Com o plano Premium tem limites maiores. |
| TRIM-032 | rejeita um modo desconhecido | ✅ Passou | O modo do recorte tem de ser manter ou remover o intervalo. |
| TRIM-032 | remover o vídeo todo é rejeitado (tem de ficar ≥ 1 s) | ✅ Passou | O vídeo tem de ficar com pelo menos 1 segundo depois de remover o intervalo. |
| TRIM-032 | remover um intervalo de um vídeo que não é H.264 é rejeitado | ✅ Passou | Remover um intervalo só está disponível para vídeos H.264. |
| TRIM-032 | remover 0:05–0:10 de um vídeo de 30 s deixa 25 s ± 1 s, no mesmo vídeo | ✅ Passou | completed; 25.00 s |
| IMPORT-032 | importar outra vez "__teste_trabalho.mp4" dá o nome "__teste_trabalho (2).mp4" | ✅ Passou | HTTP 201: __teste_trabalho (2).mp4 |
| REQ-008 | premium: aceita 3 pedidos ativos e rejeita o 4.º | ✅ Passou | 3 aceites; 4.º: Já tem 3 pedido(s) de vídeo em curso. Aguarde que termine ou cancele-o antes de fazer outro. |
| REQ-018 | premium: recortes concluídos não gastam quota diária | ✅ Passou | 3/3 concluídos; operações hoje 2 → 2 |
| REQ-005 | premium: aceita vídeo de 6 min (limite 30 min) | ✅ Passou | HTTP 202 |
| REQ-005 | premium: rejeita vídeo de 31 min, sem sugerir o Premium | ✅ Passou | O seu perfil só permite recortar vídeos até 30 min. |
| REQ-006 | premium: aceita vídeo de 250 MB (limite 2 GB) | ✅ Passou | HTTP 202 |
| LIB-002 | a ocupação da biblioteca passa a contar o tamanho do resultado em vez do anterior | ✅ Passou | 249354672 → 226261399 bytes (vídeo: 37241886 → 14148613 bytes) |
| TRIM-027 | biblioteca cheia: rejeita o recorte com a ocupação e o limite | ✅ Passou | Não há espaço na sua biblioteca de vídeos (1.2 GB de 1 GB). Com o plano Premium tem limites maiores. |
| TRIM-031 | recorte de 5 min a 1080p concluído em ≤ 5 min | ✅ Passou | completed em 94 s (1.6 min) |

**36 de 36 testes passaram.**
