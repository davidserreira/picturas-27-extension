#import "../template.typ": *

= Âmbito e Vista da Arquitetura

== Preparação e ambiente

#tab([Preparação e ambiente],
  tabela-campos(
    [Commit de partida], [`052310226c51fa57a17101c7bd1ad795674aac95` (`0523102`); `43a2e08` no repositório do grupo, com o mesmo código],
    [Comando(s) de arranque], [`docker compose down -v --remove-orphans` e `docker compose up -d --build`, à espera de que todos os serviços respondam; depois, `https://localhost:8080`, aceitando o certificado autoassinado],
    [Ambiente (SO, CPU, RAM, versões de Docker e Compose)], [HP Victus 15, Intel Core i5-12450H (8 núcleos, 12 processadores lógicos), 15,7 GiB de RAM; Windows 11 Home 10.0.26300; Docker Desktop sobre WSL 2, Engine 29.9.3, Compose 5.7.0, com 12 CPUs e 7,59 GiB atribuídos; 32 serviços],
  ),
)

O primeiro _build_ demora 15 a 30 min e ocupa cerca de 15 GB. Dois ajustes ficaram registados. Uma instalação da Fase 1 partilha o nome do projeto Compose (`picturas`) e os volumes, com uma organização do armazenamento incompatível, por isso o primeiro arranque tem de apagar os volumes (`down -v`). E, na base, um único envio de 1000 MiB esgota a memória do Docker e o motor deixa de responder (secção 6.1); nesse caso, é preciso reiniciar o Docker Desktop.

*Como é orquestrado o processamento em lote de imagens e de vídeos.* Quando o utilizador carrega em _Apply_, o browser chama `POST /:user/:project/process`. O `projects`, que é o orquestrador, valida o pipeline do projeto, verifica a quota no `users`, abre uma execução nova (incrementa o `activeToken` do projeto), copia cada media para o volume partilhado e regista um `Process` por media antes de publicar as mensagens. Aqui imagens e vídeos separam-se. Cada imagem recebe uma mensagem por ferramenta, enviada para a fila dessa ferramenta: quando a ferramenta responde na `project_queue`, o orquestrador guarda o resultado e envia o passo seguinte. Cada vídeo recebe uma só mensagem, com o pipeline inteiro, para a `video_queue`: o `video_tool` aplica todos os efeitos numa passagem e responde no fim. Quando já não há `Process` em curso, o orquestrador fecha a execução (`commitRunIfActive`) e avisa o browser. O tipo de media é decidido no carregamento: os vídeos entram por uma rota própria e ficam com `media_type: "video"`.

== Fontes consultadas

#tab([Fontes consultadas],
  tabela(
    colunas: (5.5cm, 3cm, 1fr),
    [Fonte], [Versão / data], [Usada para],
    [Código e configuração do repositório oficial (`docker-compose.yaml`, `rabbitMQ/definitions.json`, serviços)], [_Commit_ `0523102`], [Todas as evidências `EV-nn` de código e de configuração],
    [`README.md`, `AGENTS.md`], [_Commit_ `0523102`], [Arquitetura, fluxo de processamento, limites dos perfis e armadilhas conhecidas],
    [`doc-ext-requisitos-2627.pdf` (PL1-G4)], [Versão entregue na Fase 1], [Interesses dos _stakeholders_ (Tabela 2), REQ-VID-SUBMIT-008 (Tabela 30), REQ-VID-STATUS-003 e REQ-VID-NOTIFY-001, limitações registadas],
    [`doc-sol-arquitetural.pdf`], [Base anterior], [Não usado diretamente: a arquitetura foi lida no código e na configuração, que são mais recentes],
    [Diretrizes da Fase 2 (`fase-2-guidelines.pdf`)], [Versão 1, 4 de novembro de 2026], [Ideias indicativas, princípios e os seis pontos esperados por requisito],
    [Enunciados e _templates_ dos Exercícios 6 e 7], [Ver a secção 1.3], [Estrutura dos capítulos 2 a 10],
    [Bass, Clements e Kazman, _Software Architecture in Practice_], [—], [Catálogo de táticas (capítulo 7)],
    [Hohpe e Woolf, _Enterprise Integration Patterns_; Buschmann et al., _Pattern-Oriented Software Architecture_, vol. 1], [—], [Padrões das alternativas (capítulo 4)],
    [Medições da base (`Docs/fase2/medicoes/baseline/`)], [17 de novembro de 2026], [Evidências `EV-13` e `EV-14`],
  ),
)

== Vista da arquitetura global

#figure(
  image("../images/arquitetura-base.svg", width: 100%),
  caption: [Vista da arquitetura global da solução de base, com o caminho do vídeo destacado],
)

*Ferramenta / notação:* diagrama de contentores ao estilo do modelo C4, em SVG, desenhado a partir do `docker-compose.yaml` e do código no _commit_ de partida, e conferido com a solução em execução.

#tab([Legenda da vista da arquitetura],
  tabela(
    colunas: (5cm, 1fr),
    [Elemento (cor, forma ou estilo)], [Significado],
    [Retângulo], [Serviço (um contentor do `docker-compose.yaml`); as ferramentas de imagem aparecem agrupadas],
    [Seta vermelha], [Caminho do vídeo na base: carregamento, despacho para a `video_queue`, processamento e progresso],
    [Seta cinzenta], [Outros fluxos (imagens, contas, subscrições)],
    [Etiqueta junto à seta], [Protocolo, rota, fila ou evento (por exemplo, `video-progress` publicado diretamente na `ws_queue`)],
  ),
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
    [`rabbitmq`], [_Exchange_ direta `picturas`, com 20 filas], [RabbitMQ],
  ),
)

== Sequência de um pedido completo

#figure(
  image("../images/sequencia-pedido.svg", width: 100%),
  caption: [Sequência do processamento em lote de um projeto com vídeos, na solução de base],
)

#tab([Passos do pedido completo],
  tabela(
    colunas: (2.4cm, 3.2cm, 1fr, 4.6cm),
    tamanho: 8.5pt,
    [Passo], [Origem → Destino], [Mensagem / _endpoint_ / fila], [Evidência],
    [Carregamento do vídeo], [Browser → `nginx` → `api_gateway` → `projects` → `img_storage` → SeaweedFS], [`POST /:user/:project/video` (_multipart_); o `projects` corre o `ffprobe` e aplica os limites do perfil antes de guardar], [*EV-01*: `projects/routes/projects.js:1277-1351`, `projects/utils/video.js` — rota de carregamento de vídeo, com `ffprobe` e limites de duração e tamanho por perfil. *EV-13*: `apiGateway/routes/projects.js:23-24` e `467` — `multer.memoryStorage()` sem limites e reenvio de `req.file.buffer`; medido: +2001 MiB no `api_gateway` com 500 MiB e o motor do Docker em baixo com 1000 MiB (`medicoes/baseline/`)],
    [Definição do _pipeline_], [Browser → `api_gateway` → `projects`], [`POST /:user/:project/tool`: acrescenta uma ferramenta ao pipeline, que pertence ao projeto e não a cada media], [*EV-17*: `projects/routes/projects.js:1397` — rota que acrescenta uma ferramenta ao pipeline do projeto],
    [_Apply_], [Browser → `projects` → RabbitMQ → `video_tool`], [`POST /:user/:project/process`; uma mensagem por vídeo, com o pipeline inteiro, na `video_queue`], [*EV-02*: `projects/routes/projects.js:1521` e `1634-1642` — o vídeo é despachado com o pipeline inteiro numa só mensagem. *EV-12*: `Tools/video/video.py:54` (`prefetch_count=1`) e `docker-compose.yaml:256` — um só worker de vídeo, sem réplicas, um trabalho de cada vez],
    [Progresso], [`video_tool` → `ws_queue` → `ws_gateway` → browser], [Evento `video-progress`, publicado pelo worker a cada 2%; o browser conta também os `process-update` das imagens], [*EV-04*: `Tools/video/video.py:112-124` e `video_processor.py:221` — o worker publica o progresso diretamente na `ws_queue`, sem passar pelo orquestrador. *EV-18*: `wsGateway/index.js:55-72` — o `ws_gateway` consome a `ws_queue` e emite o evento para a sala do utilizador. *EV-03*: `frontend/app/dashboard/[pid]/page.tsx:89`, `301-315` e `894-927` — o estado "a processar" é um `useState` da página, o progresso das imagens é contado no browser e um painel `z-50` cobre a página],
    [Resultado], [`video_tool` → `project_queue` → `projects` → `ws_queue` → browser], [Resultado na `project_queue`; o orquestrador guarda-o, fecha a execução e emite `process-update`; o browser pede `GET /:user/:project/process`], [*EV-10*: `projects/routes/projects.js:169-541` (`commitRunIfActive` na linha 455) — o orquestrador trata as respostas e fecha a execução. *EV-19*: `projects/routes/projects.js:972` — a rota só devolve resultados concluídos; não há rota que diga em que ponto vai uma execução],
  ),
)

Para as imagens, a sequência é a mesma até ao _Apply_; daí em diante, há uma mensagem por par (imagem, ferramenta), enviada para a fila da ferramenta, e o orquestrador encadeia os passos.
