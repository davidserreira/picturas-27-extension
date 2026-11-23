#import "../template.typ": *

= Padrões Arquiteturais Atuais

== Padrão global da solução

#tabela-campos(
  [Nome(s) do padrão / estilo], [Microsserviços com _API Gateway_, comunicação assíncrona por mensagens (RabbitMQ) e orquestração central no `projects`; cada serviço Node organizado em camadas (rotas, controladores, modelos)],
  [Descrição], [Um proxy inverso dá entrada única a todo o tráfego. O _API Gateway_ verifica o JWT e reencaminha para os serviços de domínio, cada um com a sua base de dados. O processamento corre fora do pedido do cliente: o orquestrador publica mensagens ponto a ponto para os workers e encadeia os passos à medida que as respostas chegam],
)

#tab([Decisões globais que condicionam o vídeo],
  tabela(
    colunas: (4.5cm, 4.2cm, 1fr),
    tamanho: 8.5pt,
    [Decisão global], [Evidência], [Efeito no vídeo],
    [Comunicação assíncrona por filas, numa _exchange_ direta], [*EV-09*: `rabbitMQ/definitions.json` — 20 filas ligadas à _exchange_ `picturas`], [O vídeo é mais um consumidor de fila (`video_queue`) e responde na mesma `project_queue` que as ferramentas de imagem],
    [Orquestração central no `projects`], [EV-10], [O vídeo reutiliza o fecho da execução e o cancelamento por _token_; mas o orquestrador só recebe o resultado final, e não o progresso (EV-04)],
    [Entrada única pelo nginx e pelo _API Gateway_], [*EV-06*: `nginx/nginx.conf` — `/` para o `frontend`, `/api-gateway/` para o `api_gateway`, `/socket.io` para o `ws_gateway`. *EV-07*: `apiGateway/auth/auth.js:3-12` — `jwt.verify` só no gateway], [Cada vídeo carregado atravessa serviços genéricos (nginx, gateway, orquestrador), que o guardam inteiro em memória (EV-13)],
    [Uma base de dados por serviço], [*EV-08*: `docker-compose.yaml` — três instâncias de MongoDB], [O estado de uma execução, se existir no servidor, tem de viver no `projects`, dono do ciclo de vida da execução],
  ),
)

#tab([Benefícios e desafios do padrão global],
  tabela(
    colunas: (2cm, 1fr, 4.2cm, 2.4cm),
    tamanho: 8.5pt,
    [Tipo], [Descrição], [Característica / subcaracterística (ISO/IEC 25010)], [Facto / hipótese],
    [Benefício], [As falhas ficam isoladas por ferramenta: um efeito que falha não derruba os outros], [Fiabilidade — tolerância a falhas], [*EV-11*: `docker-compose.yaml` (`*_tool`) — uma ferramenta de imagem por contentor],
    [Benefício], [Cada ferramenta evolui e escala sozinha], [Manutenibilidade — modularidade; Eficiência — capacidade], [EV-11],
    [Benefício], [O cliente não espera pelo processamento, que corre fora do pedido], [Eficiência — comportamento temporal], [EV-02],
    [Desafio], [O estado de uma execução fica espalhado: `Process` no MongoDB, mensagens nas filas e a contagem no browser], [Usabilidade — operabilidade; Fiabilidade — recuperabilidade], [EV-03, EV-10],
    [Desafio], [Os serviços confiam no cabeçalho posto pelo gateway, e a sala `project:<id>` do WebSocket aceita qualquer socket], [Segurança — autenticidade, confidencialidade], [EV-07. *EV-15*: `wsGateway/index.js:33-37` — qualquer socket entra na sala do projeto, sem verificação de acesso (encontrado ao implementar a DA-2)],
    [Desafio], [Cada serviço do caminho de carregamento guarda o ficheiro inteiro antes de o passar ao seguinte], [Eficiência — utilização de recursos], [EV-13],
  ),
)

== Padrão do processamento de vídeo

#tabela-campos(
  [Nome do padrão], [Worker único que aplica o pipeline inteiro sobre uma fila (_pipeline_ monolítico)],
  [Descrição], [O pipeline completo de cada vídeo segue numa só mensagem e é aplicado num único processo, que descodifica o vídeo uma vez, aplica os efeitos fotograma a fotograma e codifica uma vez. Legendas e extração de fotogramas são etapas desse mesmo processo],
  [Contraste com o caminho de imagens], [As imagens seguem _pipes and filters_ distribuído: uma mensagem por par (imagem, ferramenta), uma ferramenta por contentor, e o orquestrador encadeia os passos (EV-11). O vídeo concentra tudo num serviço (EV-02) e reimplementa as operações PIL das ferramentas de imagem. *EV-05*: `Tools/video/` (`effects.py`, `subtitles.py`, `frame_extraction.py`) — efeitos, legendas e fotogramas no mesmo worker],
)

#tab([Benefícios e desafios do padrão do vídeo],
  tabela(
    colunas: (2cm, 1fr, 4.2cm, 2.4cm),
    tamanho: 8.5pt,
    [Tipo], [Descrição], [Característica / subcaracterística (ISO/IEC 25010)], [Facto / hipótese],
    [Benefício], [Uma só descodificação e codificação, sem perda de qualidade nem disco intermédio entre efeitos], [Eficiência — comportamento temporal e utilização de recursos], [EV-02, EV-05],
    [Benefício], [Nenhuma saída parcial se o processamento falhar a meio: a mensagem só é confirmada no fim], [Fiabilidade — tolerância a falhas], [*EV-20*: `Tools/video/video.py:140` e `170` — confirmação da mensagem só no fim do tratamento],
    [Desafio], [O sistema inteiro processa um vídeo de cada vez; uma legendagem longa atrasa todos os outros vídeos], [Eficiência — capacidade], [EV-12],
    [Desafio], [Os efeitos de imagem estão duplicados no worker de vídeo], [Manutenibilidade — modularidade, modificabilidade], [EV-05],
    [Desafio], [O progresso não passa pelo orquestrador, por isso ninguém o guarda], [Usabilidade — operabilidade; Fiabilidade — recuperabilidade], [EV-04],
  ),
)

== Relação entre o padrão global e o padrão do vídeo

#tab([Relação entre o padrão global e o padrão do vídeo],
  tabela(
    colunas: (2.4cm, 3cm, 3cm, 1.9cm, 3cm, 1.6cm),
    tamanho: 8pt,
    [Aspeto], [O que o padrão global prescreve], [O que o vídeo faz], [Segue / afasta-se], [Consequência], [Evidência],
    [Comunicação entre serviços], [Mensagens ponto a ponto por filas; resultado na `project_queue`], [Consome a `video_queue` e responde na `project_queue`], [Segue], [Reutiliza o fecho da execução e o cancelamento por _token_], [EV-02, EV-10],
    [Granularidade dos filtros], [Um serviço por ferramenta], [Um serviço para todos os efeitos], [Afasta-se], [Justificado pelo custo de codificar o vídeo entre filtros; custa modularidade], [EV-05],
    [Gestão de estado e progresso], [O orquestrador conhece e fecha cada execução], [O progresso vai do worker para o browser, sem passar pelo orquestrador], [Afasta-se em parte], [O estado intermédio da execução não existe no servidor: recarregar a página perde o acompanhamento e o cancelamento. Origem do RNF-F2-02], [EV-03, EV-04],
    [Escala], [Réplicas por serviço], [Um só worker, um trabalho de cada vez], [Possível, mas não configurada], [Capacidade de um vídeo de cada vez], [EV-12],
    [Entrada dos ficheiros], [Tudo entra pelo nginx e pelo _API Gateway_], [Vídeos de até 1 GB pelo mesmo caminho que as imagens], [Segue], [Serviços genéricos guardam o vídeo inteiro em memória e a entrada única cai com envios grandes. Origem do RNF-F2-01], [EV-13],
    [Tratamento de falhas], [Falhas isoladas por serviço], [Sem saída parcial; uma falha do worker para todos os vídeos], [Segue], [Isola as falhas do vídeo das imagens, mas não entre vídeos], [EV-12, EV-20],
  ),
)

O vídeo herda do padrão global a comunicação por filas, a entrada única e a orquestração central, e com elas o fecho da execução e o cancelamento por _token_. O padrão global impõe-lhe duas restrições que pesam no vídeo mais do que nas imagens: os ficheiros atravessam serviços genéricos que os guardam inteiros em memória, e o estado de uma execução só existe onde o orquestrador o guarda. O desvio do vídeo (um worker para tudo) justifica-se pelo custo de codificar entre efeitos, mas deixa duas fragilidades: o progresso não passa pelo orquestrador, e o sistema só processa um vídeo de cada vez. A primeira e a fragilidade herdada do carregamento são as origens dos dois requisitos desta fase.
