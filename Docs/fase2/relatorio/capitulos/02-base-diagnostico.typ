#import "../template.typ": *

= Arquitetura e padrões da solução de base

Este capítulo corresponde ao Bloco 1 do Exercício 6: a vista da arquitetura, os padrões atuais (o global e o do vídeo), as alternativas e a matriz de comparação. A notação segue a dos enunciados: `EV-nn` é um facto verificado no código, na configuração ou numa medição, e `H-nn` é uma hipótese ainda não verificada. O registo completo está na secção 2.6. O estudo das fragilidades, com a evidência linha a linha, está em `Docs/fase2/diagnostico.md`. Os capítulos 2 a 4 adaptam a resolução dos Exercícios 6 e 7 feita na equipa (`arquitetura.md` e `taticas.md`, no ramo `fase2/rnf-f2-02-segundo-plano`) ao que foi implementado. O commit analisado é o de partida, `0523102` (`43a2e08` no repositório do grupo).

== Vista da arquitetura

A solução tem 32 serviços num único `docker-compose.yaml`. Todo o tráfego do utilizador entra pelo nginx (`https://localhost:8080`). A figura destaca o caminho do vídeo.

#figure(
  image("../images/arquitetura-base.svg", width: 100%),
  caption: [Vista de contentores da solução de base, com o caminho do vídeo a vermelho],
)

#tab([Componentes da solução de base],
  tabela(
    colunas: (3.2cm, 1fr, 3.6cm),
    [Componente], [Papel], [Tecnologia],
    [`nginx`], [Proxy inverso e TLS; encaminha `/`, `/api-gateway/`, `/socket.io` e `/s3/`], [nginx],
    [`frontend`], [Interface], [Next.js, React],
    [`api_gateway`], [Entrada REST: verifica o JWT e reencaminha], [Express],
    [`users`, `subscriptions`], [Contas, perfis e quota diária; planos e pagamentos simulados], [Express, MongoDB],
    [`projects`], [Orquestrador: projetos, media, pipelines e processamento], [Express, MongoDB],
    [`img_storage`], [Fachada do armazenamento de objetos (`src`, `out`, `preview`)], [Express, SeaweedFS (S3)],
    [`ws_gateway`], [Consome a `ws_queue` e envia os eventos ao browser], [Socket.IO],
    [Ferramentas de imagem], [Um microsserviço por efeito, uma fila por ferramenta], [Python, PIL],
    [`video_tool`], [O único worker de vídeo: efeitos, corte, velocidade, legendas e fotogramas], [Python, ffmpeg, Faster-Whisper],
    [`rabbitmq`], [Exchange direta `picturas`, com 20 filas], [RabbitMQ],
  ),
)

*Processamento em lote.* O pedido `POST /:user/:project/process` valida o pipeline, verifica a quota, abre uma execução nova (incrementa o `activeToken` do projeto), copia cada media para o volume partilhado e regista um `Process` por media antes de publicar as mensagens. As respostas das ferramentas chegam à `project_queue`. O orquestrador guarda cada resultado, encadeia o passo seguinte e, quando já não há `Process` em curso, conclui a execução (`commitRunIfActive`).

#tab([Onde imagem e vídeo bifurcam],
  tabela(
    colunas: (2.6cm, 1fr, 1fr, 1.8cm),
    [Ponto], [Imagem], [Vídeo], [Evidência],
    [Carregamento], [`POST .../img`], [`POST .../video`, com `ffprobe` e limites de duração e tamanho por perfil], [EV-01],
    [Despacho], [Uma mensagem por par (imagem, ferramenta), para a fila da ferramenta; o orquestrador encadeia], [Uma mensagem por vídeo com o pipeline inteiro, para a `video_queue`], [EV-02],
    [Quem aplica o efeito], [O microsserviço da ferramenta], [O `video_tool`, com cópias das operações PIL], [EV-05],
    [Progresso], [O browser conta eventos `process-update`], [O worker publica `video-progress` diretamente na `ws_queue`, a cada 2%], [EV-03, EV-04],
  ),
)

== Padrão global

*Microsserviços com API Gateway, comunicação assíncrona por mensagens (RabbitMQ) e orquestração central no `projects`*. Cada serviço Node está organizado em camadas (rotas, controladores, modelos).

#tab([Elementos do padrão global],
  tabela(
    colunas: (5cm, 1fr),
    [Elemento do padrão], [Evidência],
    [Entrada única por proxy inverso], [`nginx/nginx.conf`: `/` → `frontend`, `/api-gateway/` → `api_gateway`, `/socket.io` → `ws_gateway` (EV-06)],
    [API Gateway com autenticação], [`apiGateway/auth/auth.js:3-12` (`jwt.verify`); o gateway passa o pedido aos serviços (EV-07)],
    [Uma base de dados por serviço], [Três MongoDB no `docker-compose.yaml` (EV-08)],
    [Mensagens ponto a ponto], [20 filas ligadas à exchange `picturas` (`rabbitMQ/definitions.json`) (EV-09)],
    [Orquestração central], [O `projects` decide o passo seguinte de cada imagem e fecha a execução (`commitRunIfActive`) (EV-10)],
    [_Pipes and filters_ distribuído], [Uma ferramenta de imagem por contentor, encadeadas pelo orquestrador (EV-11)],
  ),
)

*Benefícios.* As falhas ficam isoladas por ferramenta, e cada ferramenta escala e evolui sozinha. O cliente não espera pelo processamento, porque este é assíncrono.

*Desafios.* O estado de uma execução fica espalhado por vários sítios: os `Process` no MongoDB, as mensagens nas filas e a contagem no browser. Os serviços confiam no cabeçalho `X-Caller-Id` posto pelo gateway (diagnóstico, C6). Cada serviço do caminho de carregamento guarda o ficheiro inteiro em memória (EV-13).

== Padrão do processamento de vídeo

*Um worker único que aplica o pipeline inteiro (_pipeline monolith_) sobre uma fila.* O pipeline completo de cada vídeo segue numa só mensagem e é aplicado num único processo, que descodifica uma vez e codifica uma vez.

#tab([Elementos do padrão do vídeo],
  tabela(
    colunas: (5cm, 1fr),
    [Elemento], [Evidência],
    [Uma mensagem por vídeo com o pipeline completo], [`projects/routes/projects.js:1634-1642` (EV-02)],
    [Consumidor único, um trabalho de cada vez], [`Tools/video/video.py:54` (`prefetch_count=1`); sem réplicas no `docker-compose.yaml` (EV-12)],
    [Todos os efeitos, legendas e fotogramas no mesmo serviço], [`Tools/video/` (`effects.py`, `subtitles.py`, `frame_extraction.py`) (EV-05)],
    [Progresso fora do orquestrador], [`Tools/video/video.py:112-124` publica na `ws_queue` (EV-04)],
  ),
)

*Benefícios.* Uma só descodificação e codificação, sem perda de qualidade nem disco intermédio entre efeitos, e nenhuma saída parcial se o processamento falhar a meio.

*Desafios.* O sistema inteiro processa um vídeo de cada vez (diagnóstico, C3); os efeitos de imagem são reimplementados (C2); o progresso não passa pelo orquestrador, por isso ninguém o guarda (C4).

== Relação entre os dois padrões

#tab([Onde o padrão do vídeo segue ou se afasta do global],
  tabela(
    colunas: (4.4cm, 3cm, 1fr),
    [Aspeto], [Segue ou afasta-se], [Consequência],
    [Comunicação por filas e resultado na `project_queue`], [Segue], [Reutiliza o fecho da execução (`commitRunIfActive`) e o cancelamento por _token_],
    [Um serviço por filtro], [Afasta-se: um serviço para tudo], [Justificado pelo custo de codificar o vídeo entre filtros; custa modularidade (C2)],
    [Orquestração central], [Afasta-se em parte], [O orquestrador despacha e recebe o resultado, mas não vê o progresso. O estado intermédio da execução não existe no servidor: é a origem da fragilidade do RNF-F2-02],
    [Escala por réplicas], [Possível, mas não configurada], [Capacidade de um vídeo de cada vez (C3)],
  ),
)

== Alternativas e matriz de comparação

Alternativas para o vídeo: *ALT-1 — _Competing Consumers_* (várias réplicas do `video_tool` sobre a mesma fila, com fila própria para a legendagem); *ALT-2 — um microsserviço por efeito de vídeo* (_pipes and filters_ distribuído, como as imagens); *ALT-3 — tarefas efémeras por vídeo*, coordenadas por um orquestrador de _workflow_. O termo de comparação global é o *monólito modular*.

#tab([Matriz de comparação de padrões (↑ bom, \~ médio, ↓ fraco)],
  tabela(
    colunas: (3.2cm, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [Atributo (ISO/IEC 25010)], [Global atual], [Vídeo atual], [ALT-1], [ALT-2], [ALT-3], [Monólito modular],
    [Relação com o global], [—], [Afasta-se em parte], [Mantém], [Mantém (é o global)], [Altera em parte], [Altera],
    [Desempenho — comportamento temporal], [\~ latência das filas], [↑ uma codificação por vídeo], [↑ igual por vídeo], [↓ codifica entre efeitos], [\~ arranque de cada tarefa], [↑ sem rede interna],
    [Desempenho — capacidade], [↑ escala por serviço], [↓ um vídeo de cada vez (EV-12)], [↑ N em paralelo], [\~ escala por efeito], [↑ elástico], [↓ escala em bloco],
    [Desempenho — utilização de recursos], [↓ ficheiro inteiro em memória em cada serviço (EV-13)], [\~], [↓ N cópias do modelo Whisper], [↓ disco intermédio por efeito], [\~], [↑],
    [Fiabilidade — recuperabilidade], [↑ falhas isoladas], [\~ sem saída parcial, mas o progresso perde-se], [↑ uma réplica cai, as outras continuam], [\~ mais pontos de falha], [↑ repetição por tarefa], [↓ uma falha derruba tudo],
    [Manutenibilidade — modularidade], [↑], [↓ efeitos reimplementados], [\~ igual ao atual], [↑ reutiliza as ferramentas], [\~ mais infraestrutura], [\~],
    [Segurança], [\~ JWT só no gateway; confiança em `X-Caller-Id`], [\~ igual], [\~ igual], [\~ mais superfície], [↓ acesso ao orquestrador de contentores], [↑ menos superfície],
    [Usabilidade — operabilidade], [↓ estado só no browser (EV-03)], [↓ progresso fora do orquestrador (EV-04)], [\~ menos espera; não resolve o estado], [\~], [↑ o orquestrador de _workflow_ guarda o estado], [\~],
  ),
)

As avaliações das colunas atuais assentam nas evidências; as de ALT-1 a ALT-3 são hipóteses (H-01 a H-03), porque nenhuma foi implementada nem medida. A justificação de cada atributo está na secção 3.1.

== Registo de evidências e hipóteses

#tab([Registo de evidências (EV) e hipóteses (H)],
  tabela(
    colunas: (1.4cm, 1.6cm, 1fr, 5.2cm),
    tamanho: 8.5pt,
    [ID], [Tipo], [Conteúdo], [Onde],
    [EV-01], [Facto], [Rota de carregamento de vídeo com `ffprobe` e limites por perfil], [`projects/routes/projects.js:1277-1351`, `projects/utils/video.js`],
    [EV-02], [Facto], [Vídeo despachado com o pipeline inteiro numa mensagem], [`projects/routes/projects.js:1634-1642`],
    [EV-03], [Facto], [Estado "a processar" num `useState` da página; progresso das imagens contado no browser; painel `z-50` sobre a página], [`frontend/app/dashboard/[pid]/page.tsx:89`, `301-315`, `894-927`],
    [EV-04], [Facto], [Progresso do vídeo publicado diretamente na `ws_queue`, a cada 2%], [`Tools/video/video.py:112-124`, `video_processor.py:221`],
    [EV-05], [Facto], [Efeitos, legendas e fotogramas no mesmo worker], [`Tools/video/`],
    [EV-06], [Facto], [Entrada única pelo nginx], [`nginx/nginx.conf`],
    [EV-07], [Facto], [JWT verificado no `api_gateway`], [`apiGateway/auth/auth.js:3-12`],
    [EV-08], [Facto], [Uma base de dados por serviço], [`docker-compose.yaml`],
    [EV-09], [Facto], [20 filas na exchange `picturas`], [`rabbitMQ/definitions.json`],
    [EV-10], [Facto], [Fecho da execução pelo orquestrador], [`projects/routes/projects.js` (`commitRunIfActive`)],
    [EV-11], [Facto], [Uma ferramenta de imagem por contentor], [`docker-compose.yaml` (`*_tool`)],
    [EV-12], [Facto], [Worker de vídeo único, `prefetch_count=1`], [`Tools/video/video.py:54`, `docker-compose.yaml:256`],
    [EV-13], [Medição], [`multer.memoryStorage()` no caminho de carregamento; +2001 MiB no `api_gateway` com 500 MiB; motor do Docker em baixo com 1000 MiB], [`apiGateway/routes/projects.js:23-24`; `medicoes/baseline/`],
    [EV-14], [Medição], [M2.1 = 0%, M2.2 sem recuperação, M2.3 = 0/10; maior intervalo do progresso 16,9 s], [`medicoes/baseline/`],
    [EV-15], [Facto], [Qualquer socket entra na sala `project:<id>`, sem verificação de acesso (encontrado ao implementar o ADR-02)], [`wsGateway/index.js:33-37`],
    [EV-16], [Medição], [Um envio recusado com 409 deixa o ficheiro guardado sem dono (C1.7)], [`medicoes/passos/passo-0/`],
    [H-01], [Hipótese], [ALT-1 dá ganhos de capacidade proporcionais aos núcleos e multiplica a memória do Whisper], [Não medido],
    [H-02], [Hipótese], [ALT-2 aumenta o tempo por codificar entre efeitos], [Não medido],
    [H-03], [Hipótese], [ALT-3 exige acesso ao motor de contentores ou a um orquestrador externo], [Não medido],
  ),
)
