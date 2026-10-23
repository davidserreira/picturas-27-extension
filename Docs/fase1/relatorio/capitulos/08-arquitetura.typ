#import "../template.typ": *

= Alterações Arquiteturais

Apenas o delta face à solução de base, que já era uma arquitetura de microserviços com gateway, serviço de projetos, filas RabbitMQ, processadores de ferramentas em Python e armazenamento de objetos. O vídeo reutiliza esse padrão: processadores dedicados por ferramenta, um modelo de pedido comum no serviço de projetos e o canal de tempo real existente.

== Visão geral das alterações

#tab([Componentes novos e alterados],
  tabela(
    colunas: (3.2cm, 1.6cm, 1fr, 3.2cm),
    tamanho: 8.5pt,
    [Componente / serviço], [Estado], [Responsabilidade / alteração], [Requisitos],
    [frontend], [Alterado], [Importação de vídeo com progresso e retoma (`import-video-dialog`, `video-imports-indicator`, `lib/video-imports`); vídeos na mesma grelha que as imagens e no visualizador (`project-video-tiles`, `project-image-list`); ferramentas de vídeo na barra de ferramentas (`toolbar/video-tools`) e painel à esquerda com Recortar e Aplicar, onde estão todos os controlos, e o pedido em curso do vídeo, sem lista de pedidos (`video-tools-panel`, `video-apply-panel`); estado em tempo real e consulta periódica (`lib/queries/video-jobs`); faixas de vídeo (fotogramas obtidos no browser) e de áudio (forma de onda) sob o leitor, com a posição de reprodução (`video-tracks`); seleção do recorte arrastável sobre as faixas, partilhada com o painel (`current-video-provider`, `trim-submit`).], [TRIM-\*, APPLY-\*, IMPORT-\*, JOB-002, JOB-003, JOB-010, JOB-013, LIB-003 a 008],
    [apiGateway], [Alterado], [Novas rotas de vídeo com o mesmo controlo JWT das restantes (`routes/videos.js`): importação por blocos, biblioteca, faixas de um vídeo, recorte, aplicação de ferramentas, pedidos e cancelamento.], [ACCESS-001, JOB-001, LIB-003],
    [projects], [Alterado], [Modelos `video` e `videoJob`; rotas `videos` e `videoJobs`; validação do conteúdo real dos ficheiros, incluindo a deteção de ficheiros truncados (`videoProbe`), limites por perfil (`videoLimits`, `videoApply`), importação por blocos com retoma e expiração (`videoImport`), ciclo de vida dos pedidos, quota e deteção de pedidos parados (`videoJobs`), publicação com confirmação (`videoBroker`) e bloqueio por utilizador (`videoLocks`); nomes únicos no projeto (`videoNames`); faixas de um vídeo lidas com ffprobe e forma de onda de cada faixa de áudio calculada com FFmpeg, guardadas no modelo `video` (`videoTracks`, rota `GET …/videos/:video/tracks`).], [IMPORT-\*, JOB-\*, LIB-\*, PROCESS-002, PROCESS-004],
    [video\_trim\_tool], [Novo], [Processador de recorte (Tools/video\_trim): lê o original por endereço assinado interno, corta com precisão de 1 s, envia progresso a cada 2 s, consulta o cancelamento e só guarda o resultado completo. Também remove um intervalo, juntando as partes com `concat` do FFmpeg (recodificado em H.264/AAC).], [TRIM-015, JOB-004, JOB-005, JOB-013, PROCESS-003],
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
    [DA-01], [Processamento assíncrono por fila de mensagens e processadores dedicados], [O projeto já usa RabbitMQ para as ferramentas de imagem. Alternativa: processar na rota HTTP do serviço projects, o que bloquearia a resposta durante minutos.], [Confirmação imediata (medido 0,14 s); exige estados, progresso e tratamento de pedidos parados.], [DQ-001, JOB-001, JOB-012, PROCESS-001],
    [DA-02], [Um processador (contentor) por ferramenta de vídeo, com fila própria e uma fila de respostas comum], [Alternativas: um serviço de vídeo único com todas as ferramentas; reutilizar a fila de respostas das imagens (formato incompatível com progresso e metadados de vídeo).], [Ferramentas evoluem e escalam de forma independente; acrescentar uma ferramenta não altera os processadores existentes (o código comum dos pedidos foi generalizado com a 2.ª ferramenta, TST-QUAL-M03).], [DQ-005, TOOLS-001],
    [DA-03], [Modelo genérico de pedido de processamento (`videoJob`, campo `tool`), separado do vídeo], [Alternativa: guardar o estado do processamento no próprio vídeo (um vídeo pode ter vários pedidos).], [Estados, cancelamento, quota e rotas partilhados por Recortar e Aplicar (requisitos JOB).], [JOB-001 a JOB-010],
    [DA-04], [Ficheiros no armazenamento de objetos existente; processadores leem por endereço assinado interno e escrevem o resultado num diretório temporário, enviado só quando completo], [Alternativas: volume partilhado com cópias de ficheiros grandes; dar credenciais do armazenamento aos processadores; escrever diretamente no armazenamento.], [Sem cópias nem credenciais nos processadores; falhas e cancelamentos não deixam parciais (tática de transações).], [DQ-002, JOB-004, JOB-005, JOB-006],
    [DA-05], [Progresso: processador → fila de respostas → projects → wsGateway (Socket.IO); no browser, também consulta a cada 3 s enquanto há pedidos ativos], [Alternativas: só WebSocket; só consulta periódica.], [Se o WebSocket falhar, o progresso continua dentro dos 5 s.], [JOB-002, JOB-013],
    [DA-06], [Cancelamento por consulta do estado do pedido pelo processador a cada 2 s], [Alternativa: mensagem de cancelamento pela fila (o consumidor está ocupado durante o processamento e não a receberia).], [Cancelamento efetivo em ≤ 2 s após o pedido; uma rota interna só acessível na rede dos contentores.], [JOB-003, JOB-004],
    [DA-07], [Quota: reservar 1 operação ao submeter e devolvê-la, uma única vez, se o pedido não concluir], [Alternativa: descontar só no fim (vários pedidos simultâneos podiam ultrapassar as 5 operações).], [Efeito final igual a RNG-04; o contador mostra a reserva durante o processamento.], [RNG-04, JOB-008, JOB-009],
    [DA-08], [Confirmação manual da mensagem após processar (`prefetch=1`), limite de 15 min no processador e falha automática de pedidos sem notícias durante 20 min], [Alternativa: confirmação automática, como nas ferramentas de imagem (um pedido perdia-se se o processador morresse).], [Pedidos nunca ficam presos; sem retoma a partir do ponto de falha no MVP. Os temporários de um processamento interrompido são removidos quando o processador volta a arrancar.], [DQ-003, PROCESS-002, PROCESS-003],
    [DA-09], [Importação em blocos de 5 MB com retoma e validação do conteúdo real (formato, codec, duração) no servidor], [Alternativas: envio num único pedido; confiar na extensão do ficheiro.], [Retoma após falha de ligação sem reenviar tudo; ficheiros renomeados são rejeitados.], [DQ-011, IMPORT-010, IMPORT-018, IMPORT-020],
    [DA-10], [Verificações de limites (pedidos ativos, espaço, quota) em série por utilizador], [Alternativa: sem bloqueio (dois pedidos simultâneos passavam ambos a verificação de 1 pedido ativo).], [Correto com uma instância do serviço projects; várias instâncias exigem um bloqueio persistente (Fase 2).], [JOB-007, IMPORT-006],
    [DA-11], [Aplicar ferramentas: descodificar e codificar o vídeo no processador, reutilizando as funções de imagem, e copiar o áudio por pacotes], [Alternativas: filtros de vídeo independentes; um pedido por fotograma às ferramentas de imagem (milhares de mensagens).], [Mesmo resultado que as ferramentas de imagem e áudio intacto; o vídeo é recodificado.], [DQ-005, APPLY-013, APPLY-015, APPLY-036],
    [DA-12], [O vídeo abre no visualizador do projeto, como as imagens, e as ferramentas de vídeo aparecem na barra de ferramentas], [Alternativa (primeira versão): diálogo próprio com separadores "Ver" e "Ferramentas de vídeo".], [Interface coerente entre imagem e vídeo; o recorte usa o leitor principal. Ramo `feature/video-carousel-view`.], [TRIM-001, APPLY-001],
    [DA-13], [Faixas: lista lida com ffprobe e forma de onda calculada com FFmpeg no serviço `projects`, na primeira abertura do vídeo e em segundo plano, guardadas no vídeo; fotogramas da faixa de vídeo extraídos pelo browser a partir do mesmo endereço do leitor], [Alternativas: descodificar o áudio no browser (obrigaria a descarregar o ficheiro inteiro, até 2 GB); calcular tudo na importação (atrasaria o estado "Disponível" e não cobriria os vídeos já existentes nem os resultados das ferramentas); gerar as miniaturas no servidor (mais armazenamento, adiado com UC-VID-002/Q2).], [A lista de faixas aparece de imediato e a forma de onda pouco depois (o browser consulta a cada 2 s enquanto está "a analisar"); aberturas seguintes não voltam a ler o ficheiro. O painel Faixas (`video-tracks`) aparece sob o vídeo selecionado no visualizador, sem alterar a barra nem o painel das ferramentas (DA-12).], [DQ-001, LIB-003, LIB-005, LIB-009],
    [DA-14], [O resultado de uma ferramenta substitui o vídeo de origem: ao concluir, o registo do vídeo passa a apontar para o novo ficheiro, com os metadados do resultado, e o ficheiro anterior é removido; um pedido ativo por vídeo], [Alternativas: guardar o resultado como novo vídeo (comportamento inicial); guardar versões do vídeo com a possibilidade de desfazer (mais armazenamento, adiado: UC-VID-001/Q6).], [A biblioteca não acumula cópias; a troca só acontece no fim, por isso falhas e cancelamentos deixam o vídeo intacto; o ficheiro substituído fica registado no pedido, para ser removido mesmo após uma falha do serviço; não há forma de desfazer.], [RNG-09, TRIM-016, APPLY-020, JOB-014, JOB-015],
    [DA-15], [Recorte: a seleção é estado partilhado no browser (faixas e painel), mas os controlos (modo, campos, *Aplicar recorte*) estão só no painel à esquerda; o modo (manter/remover) é um parâmetro do mesmo pedido `trim`; o painel mostra só o pedido em curso do vídeo e reabre quando o utilizador volta a um vídeo com um pedido em curso; os nomes repetidos na importação são numerados ("nome (2).mp4")], [Alternativas: uma ferramenta nova para remover; controlos também sobre as faixas; guardar o resultado como cópia (retirado); lista de pedidos por vídeo; um editor de excertos (lista de segmentos).], [Sem filas nem processadores novos; um só caminho para cada ferramenta (a barra de ferramentas); o resultado substitui sempre o vídeo (RNG-09); vários cortes e excertos móveis ficam para a Fase 3 (UC-VID-001/Q7).], [TRIM-032, 034; IMPORT-032; JOB-010],
  ),
)

== Fluxo de processamento de vídeo

#block(breakable: false)[#figure(
  image("../images/sequencia_processamento.svg", width: 100%),
  caption: [Sequência de processamento de um vídeo entre componentes (recorte; a aplicação de ferramentas segue o mesmo fluxo com o processador video\_apply\_tool)],
)]

1\. O browser envia o pedido ao *apiGateway*, que valida o JWT e o encaminha para o serviço *projects*. 2. O *projects* verifica formato, limites, espaço, quota e pedidos ativos (em série por utilizador), reserva 1 operação no serviço *users*, cria o pedido "Em fila", publica-o na fila da ferramenta e responde de imediato (DA-01). 3. O processador consome o pedido, obtém um endereço assinado interno do *img\_storage* e lê o original diretamente do armazenamento (DA-04). 4. Durante o processamento envia progresso a cada 2 s para a fila de respostas; o *projects* atualiza o pedido e o *wsGateway* emite-o ao browser (DA-05); a cada 2 s o processador consulta se o pedido foi cancelado (DA-06). 5. No fim, envia o ficheiro completo para o armazenamento e responde "concluído"; o *projects* substitui o ficheiro do vídeo pelo resultado, remove o ficheiro anterior e confirma a operação (DA-14). Em caso de falha ou cancelamento, o processador remove os temporários, o pedido fica "Falhado" ou "Cancelado" e a operação é devolvida; um pedido sem notícias durante 20 min é dado como falhado (DA-08).

== Interface do MVP

As funcionalidades de vídeo usam os mesmos elementos de interface que as imagens (DA-12): o vídeo aparece na grelha e no visualizador do projeto, e as ferramentas de vídeo estão na barra *Tools* à esquerda, com um ícone para *Recortar*, um para *Aplicar ferramentas* e um para exportar. Cada ferramenta abre um painel próprio com os parâmetros, as operações diárias restantes e o pedido em curso (DA-15). Sob o leitor fica o painel *Faixas* (UC-VID-002/FA4). As capturas são da versão final, com a conta de demonstração e o `video_teste.mp4`. Na barra superior, as ações mantêm os nomes em inglês da _baseline_: *Add Video* corresponde a "Importar vídeo" e *Add Images* a "Adicionar imagens" nos casos de uso.

#block(breakable: false)[#figure(
  image("../images/upload.png", width: 60%),
  caption: [Importação de um vídeo ao criar um projeto (UC-VID-002/FA5, REQ-VID-IMPORT-033): o vídeo junta-se às imagens na área de submissão e é enviado em segundo plano, como qualquer importação],
)]

#block(breakable: false)[#figure(
  image("../images/recorte.png", width: 100%),
  caption: [Painel *Recortar* (UC-VID-001, passos 2 e 3): intervalo 0:10–0:40 escrito nos campos e mostrado como seleção sobre as faixas V1 (H.264) e A1 (AAC) (TRIM-002, 034), duração do resultado (TRIM-025), operações diárias restantes (JOB-008) e *Pré-visualizar* (FA3)],
)]

#block(breakable: false)[#figure(
  image("../images/recorte-remover.png", width: 100%),
  caption: [Modo *Remover seleção* (UC-VID-001/FA4, REQ-VID-TRIM-032): o intervalo aparece riscado nas faixas e o resultado fica com o que está antes e depois dele (0:30)],
)]

#block(breakable: false)[#figure(
  image("../images/aplicarferramentas.png", width: 100%),
  caption: [Painel *Aplicar ferramentas* (UC-VID-003, passos 2 a 4): cadeia ordenável de 3 ferramentas e resolução final (APPLY-003, 029 a 031); o pedido em curso mostra estado, percentagem, fotogramas processados e *Cancelar* (JOB-002, 003, 013; APPLY-017). A operação já está reservada: restam 3 (DA-07)],
)]

#block(breakable: false)[#figure(
  image("../images/aplicar-limite.png", width: 100%),
  caption: [Exceção UC-VID-003/E5: com *Rodar 90°*, um vídeo de 1280 × 720 passa a 720 × 1280 e excede a altura permitida ao registado, pelo que *Aplicar* fica desativado com o limite (APPLY-005); é o caso da questão UC-VID-003/Q4],
)]

== Impacto na instalação e execução

- *Novos contentores*: `video_trim_tool` e `video_apply_tool`, definidos no `docker-compose.yaml` e dependentes do RabbitMQ.
- *Dependências externas*: FFmpeg (recorte, validação da importação e leitura das faixas, também no contentor `projects`) e PyAV/Pillow (aplicação de ferramentas), incluídos nas imagens dos contentores (REQ-VID-PORT-001).
- *Filas*: `video_trim_queue`, `video_apply_queue` e `video_job_queue`, em `rabbitMQ/definitions.json`.
- *Volumes*: os parciais das importações ficam no volume `image_data` do serviço `projects`, para sobreviverem a um reinício.
- *Configuração* (opcional, com valores por omissão): `VIDEO_STALL_SECONDS` (60 s sem blocos → "Interrompido"), `VIDEO_PARTIAL_RETENTION_SECONDS` (3600 s de retenção do parcial), `VIDEO_TRIM_TIMEOUT` e `VIDEO_APPLY_TIMEOUT` (limite de cada processador, 900 s).
- Instruções completas no Anexo A.
