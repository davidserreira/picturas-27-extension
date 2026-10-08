# Registo de desenvolvimento assistido por IA — UC-VID-001 (Recortar vídeo)

Autor: Miguel Páscoa · Branch: `feature/video-trim`
Ferramenta de IA: Claude (Anthropic).
Este registo documenta, por fase, o que foi pedido à IA, as decisões tomadas,
as alternativas rejeitadas e a validação feita pelo aluno.

---

## Fase 0 — Análise do sistema existente

**Tarefa apoiada:** leitura do código existente para perceber onde encaixar o recorte.

Conclusões:
- As ferramentas de imagem seguem o padrão: `projects` publica no RabbitMQ
  (exchange `picturas`, uma fila por ferramenta) → worker Python em `Tools/` processa
  → responde em `project_queue` → `projects` envia para `ws_queue` → `wsGateway`
  emite por Socket.IO para o browser.
- A importação (UC-VID-002, David) guarda o vídeo no SeaweedFS (API S3), bucket
  `user-{id}`, chave `{projeto}/video/{ficheiro}`, através do serviço `img_storage`;
  os metadados (formato, codec, duração…) ficam no modelo `video` do `projects`.
- O `img_storage` gera URLs pré-assinados internos (rede Docker) e públicos (browser).

---

## Fase 1 — Worker `Tools/video_trim`

**Ficheiros:** `Tools/video_trim/{video_trim.py, Dockerfile, requirements.txt}`,
`docker-compose.yaml` (serviço `video_trim_tool`).

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D1 | Novo microserviço worker, igual aos de `Tools/` | Recortar dentro do `projects` | Mantém a arquitetura existente; processamento pesado fora do serviço que responde ao utilizador (RN6: confirmação ≤ 2 s); escala com mais contentores |
| D2 | Filas próprias: pedido em `video_trim_queue`, respostas em `video_job_queue` | Reutilizar `project_queue` | O formato das respostas de imagem não serve (progresso, cancelamento, metadados do vídeo); evita partir o consumidor existente |
| D3 | O worker lê o original por URL pré-assinado interno e o `ffmpeg` lê diretamente por HTTP | Copiar o vídeo para um volume partilhado; dar credenciais S3 ao worker | Sem cópias de ficheiros grandes; o worker não precisa de credenciais do armazenamento |
| D4 | O resultado é escrito num diretório temporário e só é enviado para o armazenamento quando está completo | Escrever diretamente no armazenamento | Garante que falhas e cancelamentos não deixam ficheiros parciais (REQ-014, REQ-020, garantia mínima) |
| D5 | H.264: recodificar com `libx264` (corte exato). Outros codecs MOV: cópia de streams (`-c copy`) | Usar sempre `-c copy` | `-c copy` é rápido mas só corta em keyframes (erro pode passar 1 s, violando REQ-015). Para codecs MOV sem codificador disponível, a cópia é a única forma de manter o codec (RN1); limitação documentada |
| D6 | Progresso lido de `ffmpeg -progress` e enviado a cada 2 s | Só enviar no fim | RN6 / REQ-012 exigem atualização ≤ 5 s; 2 s dá margem |
| D7 | Cancelamento: o worker pergunta ao `projects` o estado do pedido a cada 2 s e termina o `ffmpeg` se estiver "cancelado" | Mensagem de cancelamento pelo RabbitMQ | O consumidor RabbitMQ está ocupado durante o processamento e não recebe mensagens novas; a consulta é simples e robusta |
| D8 | `ack` manual depois de terminar e `prefetch=1` | `auto_ack` como nas ferramentas de imagem | Se o worker morrer a meio, o pedido volta à fila em vez de se perder |
| D9 | Tempo máximo de processamento de 15 min (configurável), tratado como falha | Sem limite | Evita pedidos presos indefinidamente (E5) |
| D10 | Os heartbeats do RabbitMQ são servidos enquanto o `ffmpeg` corre | — | Sem isto, recortes com mais de ~60 s fariam cair a ligação |

**Contrato de mensagens:** documentado no topo de `video_trim.py`.

**Pendente para a Fase 2:** o `projects` tem de publicar os pedidos, consumir
`video_job_queue` e expor `GET /internal/video-jobs/:id/state` (usado em D7).

**Validação feita pelo aluno:** _[preencher: build do contentor, logs, revisão do código]_
