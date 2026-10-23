# Registo de desenvolvimento assistido por IA — UC-VID-003

Data: 2026-10-09. Ferramenta: ChatGPT/Codex. Branch: `feature/uc-vid-003-apply-tools`.

Pedido do utilizador: analisar o repositório e desenvolver a sua parte, identificada na especificação como UC-VID-003 — aplicar ferramentas de imagem a todos os fotogramas. A IA leu a especificação e os caminhos de importação, recorte, imagem, quota, armazenamento e interface existentes.

A parte inicial deste registo descreve o trabalho e a validação automática executados pelo assistente (2026-10-09); a validação feita depois pela equipa está na secção "Validação pela equipa", no fim.

## Decisões

| ID | Decisão | Alternativa considerada | Motivo |
|---|---|---|---|
| D1 | Worker próprio e fila `video_apply_queue`, respostas comuns em `video_job_queue` | Processar na rota HTTP | Isola trabalho pesado e mantém o modelo de pedidos existente |
| D2 | PyAV descodifica/codifica vídeo; funções Pillow partilhadas com os workers de imagem | Filtros FFmpeg independentes ou um pedido RabbitMQ por fotograma | Reutiliza exatamente os algoritmos de imagem e preserva a ordem sem criar milhares de trabalhos |
| D3 | Copiar pacotes de áudio e tempos; manter codec/contentor | Recodificar áudio ou converter todos os MOV para H.264 | Respeita o contrato de áudio inalterado e formato/codec iguais |
| D4 | Processo filho para download, frames e upload | Trabalho no ciclo principal do broker | Permite heartbeats/progresso e término de um processamento bloqueado |
| D5 | Ficheiro temporário completo antes do upload, limpeza no cancelamento e replay | Publicar ficheiro enquanto se processa | Evita apresentar resultados incompletos |
| D6 | Limites específicos APPLY, separados da importação/recorte | Usar os limites gerais de vídeo | A especificação tem 2/10 min e limites de resolução próprios |
| D7 | Uma reserva por cadeia, devolução com chave do job e dia, manutenção de compensações pendentes | Devolução sem idempotência ou uma operação por ferramenta | Evita descontos por número de frames/ferramentas e devoluções repetidas |
| D8 | Confirmação de publicação e ack após processamento da resposta | Publicação sem confirmação e ack antes das escritas | Permite tratar falhas do broker e reentregar respostas não persistidas |
| D9 | Revalidar tamanho real antes de criar resultado | Assumir que resultado é menor que original | A recodificação pode aumentar o tamanho do vídeo |
| D10 | Preservar resultado em sucesso repetido e recuperar por fingerprint | Criar outro resultado ou apagar por já ser estado final | Evita duplicação/perda do resultado após reentrega ou reinício |
| D11 | Resolução final com limites literais de largura/altura | Trocar os limites para vídeos verticais | Mantém a interpretação expressa da especificação; alteração requer decisão do grupo |
| D12 | Documentar codec sem codificador e reprodução de dimensões ímpares | Converter silenciosamente ou arredondar dimensões | Mantém o contrato e torna limitações verificáveis |

## Validação executada pelo assistente

Foram gerados vídeos sintéticos e executados testes de media, worker, HTTP, ciclo de vida e JWT, bem como tipos, lint e build frontend. Os resultados e o alcance dos adaptadores estão em [tests/uc-vid-003/resultados.md](../tests/uc-vid-003/resultados.md).

Durante os testes foi detetado um caso em que o codificador ainda não tinha criado o ficheiro ao verificar o limite de tamanho, em vídeos sem áudio com atraso de frames. A verificação foi corrigida e os testes de cadência fracionária/tempos variáveis passaram. Foi também corrigido o comportamento comum de respostas repetidas que podia apagar um resultado concluído.

Foi criada uma workflow de CI com testes de media, API, gateway, frontend e compensação idempotente num MongoDB 4.4 descartável. O teste MongoDB é ignorado localmente quando `MONGODB_TEST_URL` não está definido; não se declara que passou antes de consultar o resultado da CI.

## Fontes técnicas consultadas

- Código e documentação deste repositório, em especial a especificação UC-VID-003 e o contrato de jobs de TRIM.
- [PyAV — remuxing](https://pyav.org/docs/stable/cookbook/basics.html): cópia de streams/pacotes sem recodificação.
- [PyAV — containers](https://pyav.org/docs/stable/api/container.html): demux/decode/encode e streams. A API efetiva de `add_stream_from_template` foi confirmada no PyAV 16.1.0 instalado.
- [MongoDB — updates com pipeline](https://www.mongodb.com/docs/manual/tutorial/update-documents-with-aggregation-pipeline/): atualização do contador e chave de devolução num documento.

## Validação pela equipa

- **Integração (2026-10-21):** o UC-VID-003 foi integrado no `main`; os testes do UC-VID-001 foram repetidos sem alterações (regressão, 28/28) e o código partilhado dos pedidos generalizado foi revisto (TST-QUAL-M03).
- **Substituição do vídeo (v1.4, 2026-10-21):** o resultado passou a substituir o vídeo, como no recorte (RNG-09); os testes da API foram adaptados (35/35).
- **Repetição noutro ambiente:** em Linux (Docker Engine, Intel Core i5-11300H), 20/20 testes Python, 35/35 da API, 4/4 do gateway e 1/1 de quota com um MongoDB descartável.
- **Verificação final (2026-10-22 e 23):** com as imagens reconstruídas a partir da versão entregue, em Windows 11 com Docker Desktop: testes pela API (TST-APPLY-M02 e M03, tempos medidos) e no browser (TST-APPLY-M01 e M02, Playwright); encontrados e corrigidos os defeitos D-02 (mensagem sem o espaço livre) e D-04 (mensagem de quota sem o limite), em `Docs/defeitos-conhecidos.md`. A 2026-10-23 os testes isolados foram corridos outra vez: 20/20 Python, 35/35 API, 4/4 gateway (`tests/uc-vid-003/resultados.md`).
- **Limitações que se mantêm:** bloqueio por utilizador só correto com uma instância do serviço `projects`; dimensões ímpares em H.264; limite de resolução literal (UC-VID-003/Q4). Estão na secção 10.3 do relatório.
