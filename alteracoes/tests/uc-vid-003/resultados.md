# Resultados — UC-VID-003

Execução pelo assistente em 2026-10-09. Este registo distingue testes reais de media, testes com adaptadores e verificações ainda pendentes. Não representa validação manual pelo aluno.

| Verificação local | Resultado | Alcance |
|---|---|---|
| `python -m unittest discover -s tests/uc-vid-003 -p 'test_*.py' -v` | 20 passaram | 14 testes de media + 6 do worker com HTTP real e canal de broker substituído |
| `node --test tests/uc-vid-003/*.test.cjs` | 38 passaram; 1 ignorado | API Express, ciclo de vida, regras da interface e gateway JWT; base de dados/serviços substituídos em memória |
| `frontend: npx tsc --noEmit --incremental false` | Passou | Tipos de toda a aplicação |
| ESLint dos seis ficheiros frontend alterados | Passou sem avisos | Painel, diálogo, queries e bibliotecas de vídeo |
| `frontend: npm run build` | Passou | Compilação e geração das páginas; avisos existentes em cinco ficheiros fora desta alteração |
| Sintaxe Node/Python, JSON RabbitMQ, YAML Compose | Passou | Configuração e sintaxe; não equivale a executar os contentores |
| `git -c core.whitespace=cr-at-eol diff --check` | Passou | Mantém CRLF nos ficheiros legados que já o usavam |

Ambiente de execução de media: Python 3.12, PyAV 16.1.0, Pillow 11.0.0, FFmpeg disponível. O Dockerfile e a integração contínua usam Python 3.11; esse ambiente deve ser confirmado pela CI. Os testes geram os vídeos e removem as suas pastas temporárias.

## Evidência coberta

- MP4 H.264 com áudio AAC: mesmos fotogramas, cadência, tempos de apresentação e pacotes de áudio, incluindo hashes SHA-256 e tempos/durações dos pacotes.
- MOV PNG: comparação exata de pixels de **todos** os fotogramas com a aplicação das funções Pillow partilhadas.
- MOV ProRes com áudio PCM: codec, contagem/cadência e pacotes de áudio preservados.
- Duas faixas de áudio, taxa de 30000/1001, tempos variáveis, dimensões ímpares, ordem das ferramentas e original inalterado.
- Cancelamento a meio do processamento, erro injetado no quarto fotograma, fonte inválida, limite de armazenamento e duração: sem resultado local parcial.
- Worker: download/transformação/upload reais para um servidor HTTP de teste; cancelamento em fila, durante download e depois do upload; diretórios removidos; resposta repetida de concluído preserva o resultado.
- API: parâmetros, limites exatos, perfis, quota de uma operação por cadeia, concorrência entre TRIM/APPLY, colisões de nomes, progresso monotónico, cancelamento, falha, limite real do resultado e recuperação após inserção anterior ao estado final.
- Gateway: JWT válido, ausente, expirado e de outro utilizador.

## Matriz de requisitos

| REQ-VID-APPLY | Evidência automatizada | Verificação ainda necessária |
|---|---|---|
| 001 | Painel integrado; tipos/build | Abrir ferramenta no browser |
| 002 | API/worker rejeitam ferramentas fora das três permitidas | Confirmar opções visíveis |
| 003 | API rejeita cadeia vazia e quarta ferramenta | Adicionar, ordenar e remover na interface |
| 004 | Parâmetros e fronteiras; interface/API concordam | Mensagens e botão desativado no browser |
| 005 | Resolução final, ordem e ambos os perfis | Feedback visual |
| 006 | MP4 H.264/MOV e rejeição de outros metadados | Integração com vídeos importados |
| 007 | 120/600 s aceites; excesso fracionário rejeitado | Vídeos longos no Compose |
| 008 | Fronteiras de tamanho de ambos os perfis | Ficheiros grandes no armazenamento real |
| 009 | Quinta operação esgotada e indicação Premium | Contador real de `users` |
| 010 | Limite conjunto TRIM/APPLY, envios simultâneos | Concorrência no Compose |
| 011 | HTTP 202 e estado inicial `queued` | Confirmação visual |
| 012 | Trabalho pesado fora da rota HTTP | Medir ≤ 2 s no ambiente completo |
| 013 | Todos os fotogramas MOV comparados com Pillow; ordem | Demonstração visual da cadeia |
| 014 | MP4/MOV, ProRes/PNG/H.264, contagem, taxa e tempos | Codecs dos ficheiros da demonstração |
| 015 | Hash, tempos e duração de pacotes de áudio, duas faixas | Áudio do vídeo importado real |
| 016 | Transições/progresso/cancelamento/falha nas APIs | Estados e textos no browser |
| 017 | Processo principal envia progresso enquanto filho bloqueia; contador final | Medir intervalos ≤ 5 s, WebSocket e polling |
| 018 | Cancelamento queued/processing e worker | Botão na interface |
| 019 | Temporários removidos e resultado tardio apagado | Confirmar SeaweedFS real |
| 020 | Nome `_editado`, colisões e inserção recuperável | Novo vídeo na biblioteca real |
| 021 | SHA-256 original e ausência de alterações no registo de origem | Comparar original armazenado |
| 022 | Três ferramentas reservam uma; sucesso/cancelamento/falha | Reserva/compensação em `users` real |
| 023 | Reutiliza biblioteca/player/exportação; build | Reprodução no browser alvo |
| 024 | Mensagem exigida e estado failed | Falha integrada na aplicação |
| 025 | Falha de fotograma não guarda resultado; refund/retry com adaptadores | Armazenamento e quota reais |
| 026 | API recusa anónimo; interface de vídeo existente só mostra biblioteca a registados | Confirmar sugestão de registo e ausência da aba |

## Pendente

Sem Docker neste ambiente, não foram executados Compose, RabbitMQ/SeaweedFS reais nem o teste opcional `quota-mongo.test.cjs`. A workflow `.github/workflows/uc-vid-003.yml` inclui MongoDB 4.4 para esse teste; o seu resultado deve ser consultado na CI, não presumido neste registo.

Também ficam pendentes os tempos do sistema completo, o cenário A4 (2 min, 1080p, 30 fps em ≤ 10 min), a compatibilidade do player e a checklist manual. As reservas legadas de quota e o bloqueio por processo têm as limitações descritas em [implementação](../../Docs/UC-VID-003-implementacao.md).
