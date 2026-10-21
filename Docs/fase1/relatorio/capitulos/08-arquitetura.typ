#import "../template.typ": *

= Alterações Arquiteturais

Apenas o delta face à solução de base, que já era uma arquitetura de microserviços com gateway, serviço de projetos, filas RabbitMQ, processadores de ferramentas em Python e armazenamento de objetos. O vídeo reutiliza esse padrão: processadores dedicados por ferramenta, um modelo de pedido comum no serviço de projetos e o canal de tempo real existente.

== Visão geral das alterações

#tab([Componentes novos e alterados],
  tabela(
    colunas: (3.2cm, 1.6cm, 1fr, 3.2cm),
    tamanho: 8.5pt,
    [Componente / serviço], [Estado], [Responsabilidade / alteração], [Requisitos],
    [frontend], [Alterado], [Importação de vídeo com progresso e retoma (`import-video-dialog`, `video-imports-indicator`, `lib/video-imports`); vídeos na mesma grelha que as imagens e no visualizador (`project-video-tiles`, `project-image-list`); ferramentas de vídeo na barra de ferramentas (`toolbar/video-tools`) e painel com Recortar, Aplicar e pedidos (`video-tools-panel`, `video-apply-panel`); estado em tempo real e consulta periódica (`lib/queries/video-jobs`).], [TRIM-_, APPLY-_, IMPORT-\*, JOB-002, JOB-003, JOB-010, JOB-013],
    [apiGateway], [Alterado], [Novas rotas de vídeo com o mesmo controlo JWT das restantes (`routes/videos.js`): importação por blocos, biblioteca, recorte, aplicação de ferramentas, pedidos e cancelamento.], [ACCESS-001, JOB-001],
    [projects], [Alterado], [Modelos `video` e `videoJob`; rotas `videos` e `videoJobs`; validação do conteúdo real dos ficheiros (`videoProbe`), limites por perfil (`videoLimits`, `videoApply`), importação por blocos com retoma e expiração (`videoImport`), ciclo de vida dos pedidos, quota e deteção de pedidos parados (`videoJobs`), publicação com confirmação (`videoBroker`) e bloqueio por utilizador (`videoLocks`).], [IMPORT-_, JOB-_, LIB-\*, PROCESS-002, PROCESS-004],
    [video\_trim\_tool], [Novo], [Processador de recorte (Tools/video\_trim): lê o original por endereço assinado interno, corta com precisão de 1 s, envia progresso a cada 2 s, consulta o cancelamento e só guarda o resultado completo.], [TRIM-015, JOB-004, JOB-005, JOB-013, PROCESS-003],
    [video\_apply\_tool], [Novo], [Processador de aplicação de ferramentas (Tools/video\_apply): descodifica todos os fotogramas, aplica a cadeia com as mesmas funções das ferramentas de imagem e copia o áudio sem o recodificar.], [APPLY-013, APPLY-014, APPLY-015, APPLY-036, JOB-005],
    [Tools/utils (image\_operations)], [Alterado], [Funções de redimensionar, binarizar e rodar extraídas das ferramentas de imagem e partilhadas com o processador de vídeo.], [APPLY-036, TOOLS-001],
    [img\_storage + SeaweedFS], [Alterado], [Rota de envio de vídeo e endereços assinados (internos e públicos, válidos 1 h); vídeos guardados cifrados em repouso no armazenamento existente.], [ACCESS-002, ACCESS-003, IMPORT-013],
    [rabbitMQ], [Alterado], [Filas `video_trim_queue`, `video_apply_queue` e `video_job_queue` (respostas de progresso e resultado de todas as ferramentas de vídeo).], [PROCESS-001, PROCESS-004],
    [wsGateway], [Alterado], [Novo evento `video-job-update`, emitido para a sala do utilizador (mesmo mecanismo do progresso das imagens).], [JOB-002, JOB-013],
    [users], [Alterado], [Reserva e devolução de operações com chave do pedido e dia, para devolver a operação uma única vez quando o pedido não conclui.], [JOB-008, JOB-009],
    [nginx], [Alterado], [Encaminhamento `/s3` para o armazenamento, usado pelos endereços assinados públicos.], [ACCESS-002],
  ),
)

== Decisões arquiteturais

#tab([Decisões arquiteturais],
  tabela(
    colunas: (1.2cm, 2.8cm, 1fr, 3.2cm, 2.4cm),
    tamanho: 8pt,
    [ID], [Decisão], [Contexto e alternativas consideradas], [Consequências], [Requisitos / DQ],
    [DA-01], [Processamento assíncrono por fila de mensagens e processadores dedicados], [O projeto já usa RabbitMQ para as ferramentas de imagem. Alternativa: processar na rota HTTP do serviço projects, o que bloquearia a resposta durante minutos.], [Confirmação imediata (medido 0,04 s); exige estados, progresso e tratamento de pedidos parados.], [DQ-001, JOB-001, JOB-012, PROCESS-001],
    [DA-02], [Um processador (contentor) por ferramenta de vídeo, com fila própria e uma fila de respostas comum], [Alternativas: um serviço de vídeo único com todas as ferramentas; reutilizar a fila de respostas das imagens (formato incompatível com progresso e metadados de vídeo).], [Ferramentas evoluem e escalam de forma independente; acrescentar uma ferramenta não altera as outras.], [DQ-005, TOOLS-001],
    [DA-03], [Modelo genérico de pedido de processamento (`videoJob`, campo `tool`), separado do vídeo], [Alternativa: guardar o estado do processamento no próprio vídeo (um vídeo pode ter vários pedidos).], [Estados, cancelamento, quota e rotas partilhados por Recortar e Aplicar (requisitos JOB).], [JOB-001 a JOB-010],
    [DA-04], [Ficheiros no armazenamento de objetos existente; processadores leem por endereço assinado interno e escrevem o resultado num diretório temporário, enviado só quando completo], [Alternativas: volume partilhado com cópias de ficheiros grandes; dar credenciais do armazenamento aos processadores; escrever diretamente no armazenamento.], [Sem cópias nem credenciais nos processadores; falhas e cancelamentos não deixam parciais (tática transações).], [DQ-002, JOB-004, JOB-005, JOB-006],
    [DA-05], [Progresso: processador → fila de respostas → projects → wsGateway (Socket.IO); no browser, também consulta a cada 3 s enquanto há pedidos ativos], [Alternativas: só WebSocket; só consulta periódica.], [Se o WebSocket falhar, o progresso continua dentro dos 5 s.], [JOB-002, JOB-013],
    [DA-06], [Cancelamento por consulta do estado do pedido pelo processador a cada 2 s], [Alternativa: mensagem de cancelamento pela fila (o consumidor está ocupado durante o processamento e não a receberia).], [Cancelamento efetivo em ≤ 2 s após o pedido; uma rota interna só acessível na rede dos contentores.], [JOB-003, JOB-004],
    [DA-07], [Quota: reservar 1 operação ao submeter e devolvê-la, uma única vez, se o pedido não concluir], [Alternativa: descontar só no fim (vários pedidos simultâneos podiam ultrapassar as 5 operações).], [Efeito final igual a RNG-04; o contador mostra a reserva durante o processamento.], [RNG-04, JOB-008, JOB-009],
    [DA-08], [Confirmação manual da mensagem após processar (`prefetch=1`), limite de 15 min no processador e falha automática de pedidos sem notícias durante 20 min], [Alternativa: confirmação automática, como nas ferramentas de imagem (um pedido perdia-se se o processador morresse).], [Pedidos nunca ficam presos; sem retoma a partir do ponto de falha no MVP.], [DQ-003, PROCESS-002, PROCESS-003],
    [DA-09], [Importação em blocos de 5 MB com retoma e validação do conteúdo real (formato, codec, duração) no servidor], [Alternativas: envio num único pedido; confiar na extensão do ficheiro.], [Retoma após falha de ligação sem reenviar tudo; ficheiros renomeados são rejeitados.], [DQ-011, IMPORT-010, IMPORT-018, IMPORT-020],
    [DA-10], [Verificações de limites (pedidos ativos, espaço, quota) em série por utilizador], [Alternativa: sem bloqueio (dois pedidos simultâneos passavam ambos a verificação de 1 pedido ativo).], [Correto com uma instância do serviço projects; várias instâncias exigem um bloqueio persistente (Fase 2).], [JOB-007, IMPORT-006],
    [DA-11], [Aplicar ferramentas: descodificar e codificar o vídeo no processador, reutilizando as funções de imagem, e copiar o áudio por pacotes], [Alternativas: filtros de vídeo independentes; um pedido por fotograma às ferramentas de imagem (milhares de mensagens).], [Mesmo resultado que as ferramentas de imagem e áudio intacto; o vídeo é recodificado.], [DQ-005, APPLY-013, APPLY-015, APPLY-036],
    [DA-12], [O vídeo abre no visualizador do projeto, como as imagens, e as ferramentas de vídeo aparecem na barra de ferramentas], [Alternativa (primeira versão): diálogo próprio com separadores "Ver" e "Ferramentas de vídeo".], [Interface coerente entre imagem e vídeo; o recorte usa o leitor principal. Ramo `feature/video-carousel-view`.], [TRIM-001, APPLY-001],
  ),
)

== Fluxo de processamento de vídeo

#block(breakable: false)[#figure(
  image("../images/sequencia_processamento.svg", width: 100%),
  caption: [Sequência de processamento de um vídeo entre componentes (recorte; a aplicação de ferramentas segue o mesmo fluxo com o processador video\_apply\_tool)],
)]

1\. O browser envia o pedido ao *apiGateway*, que valida o JWT e o encaminha para o serviço *projects*. 2. O *projects* verifica formato, limites, espaço, quota e pedidos ativos (em série por utilizador), reserva 1 operação no serviço *users*, cria o pedido "Em fila", publica-o na fila da ferramenta e responde de imediato (DA-01). 3. O processador consome o pedido, obtém um endereço assinado interno do *img\_storage* e lê o original diretamente do armazenamento (DA-04). 4. Durante o processamento envia progresso a cada 2 s para a fila de respostas; o *projects* atualiza o pedido e o *wsGateway* emite-o ao browser (DA-05); a cada 2 s o processador consulta se o pedido foi cancelado (DA-06). 5. No fim, envia o ficheiro completo para o armazenamento e responde "concluído"; o *projects* cria o novo vídeo na biblioteca e confirma a operação. Em caso de falha ou cancelamento, o processador remove os temporários, o pedido fica "Falhado" ou "Cancelado" e a operação é devolvida; um pedido sem notícias durante 20 min é dado como falhado (DA-08).

== Impacto na instalação e execução

- *Novos contentores*: `video_trim_tool` e `video_apply_tool`, definidos no `docker-compose.yaml` e dependentes do RabbitMQ.
- *Dependências externas*: FFmpeg (recorte e validação da importação, também no contentor `projects`) e PyAV/Pillow (aplicação de ferramentas), incluídos nas imagens dos contentores (REQ-VID-PORT-001).
- *Filas*: `video_trim_queue`, `video_apply_queue` e `video_job_queue`, em `rabbitMQ/definitions.json`.
- *Volumes*: os parciais das importações ficam no volume `image_data` do serviço `projects`, para sobreviverem a um reinício.
- *Configuração* (opcional, com valores por omissão): `VIDEO_STALL_SECONDS` (60 s sem blocos → "Interrompido"), `VIDEO_PARTIAL_RETENTION_SECONDS` (3600 s de retenção do parcial), `VIDEO_APPLY_TIMEOUT` (limite do processador de aplicação).
- Instruções completas no Anexo A.
