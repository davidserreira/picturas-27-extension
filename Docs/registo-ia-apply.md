# Registo de desenvolvimento assistido por IA — UC-VID-003

Data: 2026-10-09. Ferramenta: ChatGPT/Codex. Branch: `feature/uc-vid-003-apply-tools`.

Pedido do utilizador: analisar o repositório e desenvolver a sua parte, identificada na especificação como UC-VID-003 — aplicar ferramentas de imagem a todos os fotogramas. A IA leu a especificação e os caminhos de importação, recorte, imagem, quota, armazenamento e interface existentes.

Este registo descreve trabalho e validação automática executados pelo assistente. **A revisão e validação pelo aluno ainda não foram registadas.** Não foram inventados nomes/números de alunos, medições do Compose ou testes manuais.

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

## Revisão pelo aluno — por preencher depois de executar

- Data, identificação e ambiente: pendentes.
- Código revisto, decisões aceites/alteradas e entendimento do processamento de frames: pendentes.
- Checklist manual e testes com o Compose: pendentes.
- Medições de receção, progresso e cenário A4: pendentes.
- Comentários do grupo/docente e correções posteriores: pendentes.

As limitações remanescentes de quota legada, bloqueio por processo e browsers constam de [UC-VID-003-implementacao.md](UC-VID-003-implementacao.md). Esta entrega é um MVP para revisão e verificação; não é uma declaração de preparação para produção.
