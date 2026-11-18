#import "../template.typ": *

= Táticas e decisões arquiteturais

Este capítulo corresponde ao Exercício 7 (template 3.0). Parte dos dois cenários escolhidos (QS-01 e QS-02), sem os reescrever, e continua a numeração das evidências e hipóteses. As decisões estão registadas em pormenor no ADR-01 e no ADR-02 (`Docs/fase2/adr/`) e resumidas nos capítulos 6 e 7.

== Cenários de entrada

#tab([Candidatos e cenários de entrada],
  tabela(
    colunas: (1.6cm, 1.2cm, 2.4cm, 1.6cm, 1.8cm, 2.4cm, 1fr),
    tamanho: 8pt,
    [Candidato], [Cenário], [ISO/IEC 25010], [Evidência], [Origem], [Estímulo], [Resposta e medida],
    [CAND-1], [QS-01], [Eficiência — utilização de recursos], [EV-13], [Padrão global], [Envio de um vídeo de 1000 MiB], [Memória de cada serviço limitada por um valor fixo (M1.1); 1000 MiB aceite com 512 MiB por contentor (M1.2)],
    [CAND-2], [QS-02], [Usabilidade — operabilidade], [EV-03, EV-04, EV-14], [Interação], [Recarregar, mudar de página ou abrir outra sessão a meio de uma execução], [Continuar a usar a aplicação (M2.1), ver o estado reposto e o fim avisado (M2.2), cancelar (M2.3)],
  ),
)

Não houve alterações aos cenários do capítulo 3.

== Táticas candidatas

As táticas seguem o catálogo de Bass, Clements e Kazman (_Software Architecture in Practice_). A classe indica se a tática é _refactoring_ puro (A), uma alteração visível que é o próprio objeto da melhoria (B), ou uma funcionalidade nova (C, rejeitada nesta fase).

#tab([Táticas candidatas por cenário],
  tabela(
    colunas: (1.3cm, 1.1cm, 2.2cm, 2.7cm, 1fr, 2.5cm, 2.5cm),
    tamanho: 7.5pt,
    [ID], [Cenário], [Atributo → categoria], [Tática], [Como produz a resposta], [Já existe na base?], [Classe],
    [TAT-01], [QS-01], [Desempenho → gerir recursos], [Aumentar a eficiência dos recursos: processar em fluxo], [Os bytes passam por cada serviço em blocos; a memória fica limitada pelos buffers e pelas partes S3 em curso], [Não: `multer.memoryStorage()` em três serviços (EV-13)], [A],
    [TAT-02], [QS-01], [Desempenho → controlar a procura], [Limitar o que fica em memória: número de partes S3 em paralelo e tamanho dos buffers], [O pico de memória fica limitado por configuração, independentemente do ficheiro], [Em parte: o cliente S3 usa 4 partes de 5 MiB], [A],
    [TAT-03], [QS-01], [Desempenho → gerir recursos], [Retirar intermediários do caminho dos dados (envio direto ao S3 com URL assinado)], [Nenhum serviço da aplicação vê os bytes], [Não], [B: muda o contrato da API e o frontend; piora a segurança],
    [TAT-04], [QS-01], [Desempenho → gerir recursos], [Aumentar ou limitar a memória dos contentores], [Impede que um envio derrube o Docker, ou adia o problema], [Em parte: limite de 1100 MB no nginx], [A, mas não muda a escala: o ficheiro continua inteiro em memória],
    [TAT-05], [QS-02], [Usabilidade → iniciativa do sistema], [Manter um modelo da tarefa: estado e progresso de cada execução no orquestrador], [A interface reconstrói o estado a partir do servidor depois de recarregar ou noutra sessão], [Não: estado num `useState` (EV-03); progresso não guardado (EV-04)], [A],
    [TAT-06], [QS-02], [Usabilidade → iniciativa do sistema], [Mostrar o progresso e o estado em qualquer página, sem bloquear], [Faixa na página do projeto, painel no canto nas outras páginas, aviso de fim ou falha], [Em parte: o progresso existia, mas num painel que bloqueava e só na página do projeto], [B: muda a interação só para melhorar a operabilidade],
    [TAT-07], [QS-02], [Usabilidade → iniciativa do utilizador], [Cancelar, disponível depois de perder a página], [O `Cancel` aparece sempre que a execução está ativa, a partir do estado do servidor], [Sim, mas só no painel e só antes de recarregar], [A/B: a capacidade já existia; muda quando está disponível],
    [TAT-08], [QS-02], [Usabilidade → iniciativa do sistema], [Modelo da tarefa só no browser (`localStorage`)], [O browser lembra-se da execução ao recarregar], [Não], [A, mas falha a forma B da M2.3 e não sabe o progresso real],
    [TAT-09], [QS-02], [Usabilidade → iniciativa do sistema], [Consulta periódica do estado, sem eventos], [O browser pergunta o estado a cada N s], [Não], [A, mas com atraso até N s e mais carga],
    [TAT-10], [QS-02], [Usabilidade → iniciativa do utilizador], [Pausar e retomar uma execução], [—], [Não], [*C: rejeitada*, funcionalidade nova],
  ),
)

== Decisões arquiteturais

=== DA-1 — Carregamento em fluxo de ponta a ponta (QS-01)

#tabela-campos(
  [Contexto], [Cada serviço do caminho de carregamento guarda o ficheiro inteiro (EV-13): +2001 MiB no `api_gateway` com 500 MiB, e o motor do Docker cai com 1000 MiB. É um _refactoring_: os endpoints, os códigos e as mensagens têm de ficar iguais],
  [Táticas escolhidas], [TAT-01 e TAT-02],
  [Estrutura que a realiza], [_Pipes and filters_ em fluxo (streams Node): proxy em fluxo no gateway, motor de armazenamento do `multer` no `projects` que envia diretamente ao `img_storage`, envio em partes ao S3],
  [Alternativas rejeitadas], [TAT-03: muda o contrato da API e expõe escrita direta no armazenamento. TAT-04: não muda a relação entre memória e tamanho. Fluxo com o ficheiro em disco no `projects` (alternativa A do ADR-01): a cache de páginas conta na memória do contentor],
  [Consequências positivas], [Memória limitada por um valor fixo; aceitação mais rápida, porque os serviços trabalham em paralelo; o JWT passa a ser verificado antes de ler o corpo; deixa de haver temporários],
  [Consequências negativas e riscos], [Um ficheiro recusado é guardado e depois apagado (risco de órfãos, C1.7); o `ffprobe` passa a ler por HTTP e tem de dar os mesmos metadados (C1.5); um envio interrompido tem de cancelar as partes S3],
  [Elementos afetados], [`nginx/nginx.conf`, `apiGateway` (rotas de carregamento, proxy em fluxo), `projects` (receção de media, validação), `imageStorageService` (envio ao S3), `docker-compose.yaml` (opções do V8 e da glibc)],
  [Origem e âmbito], [Padrão global; contido no caminho de carregamento; risco de regressão médio],
  [Classe], [A: _refactoring_ puro, invisível para o utilizador],
)

=== DA-2 — Estado da execução no orquestrador, enviado por eventos (QS-02)

#tabela-campos(
  [Contexto], [O orquestrador despacha e fecha as execuções, mas não sabe em que ponto estão: o progresso do vídeo vai do worker diretamente para o browser e o das imagens é contado no browser (EV-03, EV-04). Base: M2.1 0%, M2.2 sem recuperação, M2.3 0/10 (EV-14)],
  [Táticas escolhidas], [TAT-05, TAT-06 e TAT-07],
  [Estrutura que a realiza], [Um registo de estado no orquestrador (coleção `runs` no MongoDB) e _publish-subscribe_ sobre a `ws_queue`: o worker reporta ao orquestrador pela `project_queue`, o orquestrador publica `run-status` e o `ws_gateway` entrega-o ao dono e a quem iniciou. Duas rotas REST de leitura e um fornecedor de estado no frontend],
  [Alternativas rejeitadas], [TAT-08: falha a sessão nova (M2.3, forma B). TAT-09 sozinha: atraso e carga. Estado em memória no `ws_gateway`: perde-se num reinício e dá dois donos ao estado. Estado no documento `Project`: cada atualização mudaria a versão do projeto. TAT-10: classe C],
  [Consequências positivas], [O estado sobrevive à página, à sessão e ao reinício do `ws_gateway`; o progresso passa a refletir o trabalho real; o vídeo volta a seguir a orquestração central do padrão global],
  [Consequências negativas e riscos], [Mais escritas no MongoDB e mais mensagens (cerca de uma por segundo por vídeo; C2.1); atualizações concorrentes que podiam reabrir uma execução; o estado não pode chegar a terceiros (EV-15, C2.3)],
  [Elementos afetados], [`projects` (modelo, controlador, rotas, mensagens), `video_tool`, `ws_gateway`, `api_gateway` (duas rotas), `frontend` (página do projeto, _layout_, fornecedor de estado)],
  [Origem e âmbito], [Interação entre o padrão do vídeo e o global; atravessa quatro serviços; risco de regressão médio, controlado pelos testes e pelos controlos C2.1 a C2.5],
  [Classe], [B: a interface muda, mas só para melhorar a operabilidade, sem operações novas sobre os media],
)

== Vista arquitetural antes e depois

#figure(
  image("../images/da1-antes-depois.svg", width: 100%),
  caption: [DA-1: caminho de carregamento antes e depois, com o acréscimo de memória medido com 500 MiB],
)

#figure(
  image("../images/da2-antes-depois.svg", width: 100%),
  caption: [DA-2: fluxo do estado de uma execução antes e depois; a verde, os elementos alterados],
)

== Trade-offs e plano de medição

#tab([Matriz de efeitos (↑ melhora, ↓ degrada, = neutro), prevista e medida],
  tabela(
    colunas: (1.4cm, 1.7cm, 1.9cm, 1.6cm, 1.7cm, 1.9cm, 1fr),
    tamanho: 8pt,
    [Decisão], [Desempenho], [Fiabilidade], [Segurança], [Usabilidade], [Manutenibilidade], [Justificação e resultado medido],
    [DA-1], [↑ recursos e tempo], [\= (risco de órfãos)], [↑ JWT antes do corpo], [\=], [\=], [M1.1 de 2001 para 56 MiB; aceitação de 500 MiB de 9 s para menos de 1 s; C1.3 de +1006 para +24 MiB; C1.7 sem órfãos; medidas do RNF-F2-02 iguais à base],
    [DA-2], [\= (mais escritas)], [↑ recuperabilidade], [\= (C2.3 recusado)], [↑ operabilidade], [↑ vídeo segue o orquestrador], [M2.1 de 0 para 100%; M2.2 de "não recupera" para menos de 1 s; C2.1 e C2.2 nos capítulos 7 e 8],
  ),
)

*Interação entre a DA-1 e a DA-2.* São independentes: nenhuma é pré-requisito da outra. O único ponto de contacto é a ação 7 da M2.1 (carregar uma imagem para Q durante a execução), que usa o caminho da DA-1. As duas mexem em `projects/routes/projects.js`, mas em zonas diferentes, e a integração dos dois ramos não teve conflitos de código. A medição conjunta (capítulo 8) verifica que nenhuma piora a outra.

#tab([Plano de medição],
  tabela(
    colunas: (1.2cm, 1fr, 2.4cm, 2.6cm, 2.2cm, 2.4cm),
    tamanho: 8pt,
    [Cenário], [Cenário de teste e carga], [Ambiente], [O que se regista], [Repetições], [_Scripts_ e dados],
    [QS-01], [Envio pela API de vídeos de 10, 100, 500 e 1000 MiB, um de cada vez; depois, com 512 MiB por contentor], [A mesma máquina e o mesmo Docker; arranque limpo (capítulo 5)], [Memória de cada contentor a cada segundo; códigos; SHA-256; tempos de aceitação e de envio], [5 por tamanho (M1.1); 3 por tamanho (M1.2); máximo e mediana], [`medicoes/rnf1/`],
    [QS-02], [Projeto P (vídeo de 330 s e duas imagens) em processamento; 10 ações, 6 recargas, 3 fins, 10 cancelamentos], [Igual; Chromium do Playwright, 1440×900], [Ações concluídas; segundos até repor o estado e avisar o fim; sucesso de cada cancelamento; vídeo de cada execução], [3 execuções (M2.1, M2.2); 10 tentativas (M2.3); pior valor], [`medicoes/rnf2/`],
  ),
)

Cada requisito foi medido primeiro no seu ramo e depois com os dois integrados. Os controlos de tempo (C2.1) repetem-se em blocos A-B-A (base, versão nova, base) na mesma sessão, porque a velocidade da máquina variou até 40% entre sessões (secção 6.6).

#tab([Preservação funcional por zona alterada],
  tabela(
    colunas: (3cm, 2.8cm, 1fr, 1fr),
    tamanho: 8pt,
    [Zona alterada], [Testes existentes], [Lacunas], [Testes acrescentados],
    [DA-1: receção de media no `api_gateway`, no `projects` e no `img_storage`; nginx], [`projects/tests` (8, sem o carregamento)], [Nenhum teste passava pelo gateway, pelo armazenamento nem pela validação real], [Ponta a ponta T02 a T04 e T14; unitários do `img_storage` (4), do `api_gateway` (6) e do `projects` (5); controlos C1.4 a C1.7],
    [DA-2: processamento no `projects`, `video_tool`, `ws_gateway` e frontend], [`Tools/video/tests` (74); `projects/tests` (8)], [Nenhum teste do frontend nem das rotas com MongoDB e RabbitMQ; nenhum do `ws_gateway`], [Ponta a ponta T05 a T17; interface U01 a U03; unitários do progresso (6), da cadência do worker (1) e das salas do `ws_gateway` (3); controlos C2.3 a C2.5],
  ),
)
