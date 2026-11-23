#import "../template.typ": *

= Decisões Arquiteturais

Cada decisão está registada em pormenor num ADR (`Docs/fase2/adr/`), com as forças, as alternativas, as consequências, o plano por passos, os resultados de cada passo e os desvios. Ambos os ADR foram revistos pela equipa e estão no estado "Aceite".

== DA-1 — Carregamento em fluxo de ponta a ponta (cenário QS-01)

#tab([Decisão arquitetural DA-1],
  tabela-campos(
    [Contexto], [Cada serviço do caminho de carregamento guarda o ficheiro inteiro (EV-13): +2001 MiB no `api_gateway` com 500 MiB, e o motor do Docker cai com 1000 MiB. É um _refactoring_: os _endpoints_, os códigos, as mensagens e a ordem de validação ficam iguais, e o frontend não muda],
    [Tática(s) escolhida(s)], [TAT-01 (processar em fluxo) e TAT-02 (limitar o que fica em memória)],
    [Estrutura / padrão que a realiza], [_Pipes and filters_ em fluxo (_streams_ Node): o nginx passa o corpo à medida que chega; o `api_gateway` verifica o JWT e passa o corpo ao `projects`; o `projects` envia-o ao `img_storage` enquanto o conta e calcula o SHA-256, e valida o vídeo com o `ffprobe` sobre o objeto guardado; o `img_storage` envia-o ao S3 em partes],
    [Alternativas consideradas e razão de rejeição], [TAT-03: muda o contrato da API e expõe escrita direta no armazenamento. TAT-04: não muda a relação entre memória e tamanho; serviu só para medir (M1.2). Fluxo com o ficheiro em disco no `projects` até ser validado (alternativa A do ADR-01): o envio ao armazenamento só começa depois do último byte, e a cache de páginas conta na memória do contentor],
    [Consequências positivas], [Memória limitada por um valor fixo; aceitação mais rápida, porque os serviços trabalham em paralelo; o JWT passa a ser verificado antes de ler o corpo (QS-05); deixa de haver ficheiros temporários],
    [Consequências negativas / riscos], [Um ficheiro recusado é guardado e depois apagado, com risco de órfãos (C1.7). *EV-16*: `medicoes/passos/passo-0/` — na base, um envio recusado com 409 já deixava o ficheiro guardado sem dono. O `ffprobe` passa a ler por HTTP e tem de dar os mesmos metadados (C1.5); um envio interrompido tem de cancelar as partes S3],
    [Elementos arquiteturais afetados], [`nginx/nginx.conf`; `apiGateway` (rotas de carregamento, `utils/streamProxy.js`); `projects` (`utils/mediaUpload.js`, receção e validação em `routes/projects.js`); `imageStorageService` (`services/streamStorage.js`); `docker-compose.yaml` (opções do V8 e da glibc)],
    [Origem e âmbito do _refactoring_], [Padrão global, contido no caminho de carregamento; risco de regressão médio, controlado pela suite de regressão e pelos controlos C1.4 a C1.7],
    [Classe (A/B/C)], [A: _refactoring_ puro, invisível para o utilizador],
    [Implementação (_commits_ / _pull requests_)], [Ramo `fase2/rnf-f2-01-carregamento`, um _commit_ por passo: `47c303b` (passo 0, documentos e controlo C1.7), `93dd800` (1), `d3546b2` (2), `847e0dc` (3), `0130073` (4), `a394a9a` (5), `78a035a` (5b), `8529695` (documentação). No `main`: `126c319`],
    [Desvios face à decisão], [Ver a tabela seguinte],
  ),
)

#tab([DA-1: passos e acréscimo máximo de memória com 500 MiB, em MiB (medição intermédia)],
  tabela(
    colunas: (5.4cm, 1.4cm, 1.9cm, 1.6cm, 1.9cm, 1fr),
    tamanho: 8.5pt,
    [Passo], [`nginx`], [`api_gateway`], [`projects`], [`img_storage`], [Aceitação],
    [Base], [19], [2001], [1044], [1016], [8,96 s],
    [1. `img_storage` em fluxo], [19], [1922], [1039], [*96*], [16,49 s],
    [2. `projects` sem `follow-redirects`], [19], [1986], [1048], [90], [8,43 s],
    [3. `projects` em fluxo, validação sobre o objeto], [19], [1727], [*50*], [111], [7,77 s],
    [4. `api_gateway` em fluxo, JWT antes do corpo], [98], [*75*], [95], [108], [4,96 s],
    [5. nginx sem guardar o corpo], [*10*], [82], [98], [101], [*1,11 s*],
    [5b. Afinação do V8 e da glibc], [11], [*41*], [*18*], [*51*], [0,65 s],
  ),
)

A regressão passou em todos os passos com as mesmas impressões da base. A aceitação do passo 1 está dentro da variação da base (desvio-padrão de 5,9 s).

#tab([DA-1: desvios à decisão],
  tabela(
    colunas: (5.4cm, 1fr),
    [Desvio], [Porquê],
    [O passo 2 não baixou o pico do `projects`], [A previsão estava errada: o pico vinha também da cópia temporária para o `ffprobe` (cache de páginas). Só caiu no passo 3],
    [Passo 5b: afinação do V8 e da glibc nos três serviços Node], [Depois do passo 5 nenhum serviço guardava o ficheiro, mas os serviços Node subiam 80 a 100 MiB com 500 MiB, acima do alvo. A causa era a recolha tardia dos _buffers_ já enviados. Seis variantes medidas (`medicoes/passos/afinacao/`); custo de cerca de 0,3 s a mais no envio de 100 MiB. Estava previsto no ADR como afinação possível],
    [O `projects` deixa de guardar um ficheiro do tipo errado para o _endpoint_], [O motor de armazenamento descarta-o, porque a rota o recusa de qualquer maneira; a resposta é a mesma],
    [Um pedido sem JWT não ocupa memória, mas o gateway lê o corpo até ao fim antes de responder 401], [É o que o cliente via na base; responder a meio do envio dava ao browser um erro de rede em vez da mensagem],
  ),
)

== DA-2 — Estado da execução no orquestrador, enviado por eventos (cenário QS-02)

#tab([Decisão arquitetural DA-2],
  tabela-campos(
    [Contexto], [O orquestrador despacha e fecha as execuções, mas não sabe em que ponto estão: o progresso do vídeo vai do worker diretamente para o browser, e o das imagens é contado no browser (EV-03, EV-04). Base: 0% das ações, estado nunca reposto, 0/10 cancelamentos (EV-14). O comportamento funcional (resultados, quotas, cancelamento) tem de ficar igual],
    [Tática(s) escolhida(s)], [TAT-05 (modelo da tarefa no servidor), TAT-06 (estado em qualquer página, sem bloquear) e TAT-07 (cancelar depois de perder a página)],
    [Estrutura / padrão que a realiza], [Registo de estado no orquestrador (coleção `runs` no MongoDB) e _publish-subscribe_ sobre a `ws_queue`: o worker reporta o progresso ao orquestrador pela `project_queue`; o orquestrador guarda-o e publica `run-status`; o `ws_gateway` entrega-o às salas do dono e de quem iniciou. Duas rotas REST de leitura (`GET .../process/status` e `GET /:user/process/active`) e um fornecedor de estado no frontend],
    [Alternativas consideradas e razão de rejeição], [TAT-08 (estado só no browser, alternativa C do ADR-02): falha noutra sessão. TAT-09 sozinha: atraso e carga. Estado em memória no `ws_gateway` (alternativa B): perde-se num reinício e dá dois donos ao estado. Estado no documento `Project`: cada atualização mudaria a versão do projeto. TAT-10: classe C],
    [Consequências positivas], [O estado sobrevive à página, à sessão e ao reinício do `ws_gateway`; o progresso passa a seguir o trabalho real; o vídeo volta a seguir a orquestração central do padrão global],
    [Consequências negativas / riscos], [Mais escritas no MongoDB e mais mensagens (cerca de uma por segundo por vídeo; C2.1). As mensagens da `project_queue` são tratadas em paralelo, e uma atualização atrasada podia reabrir ou fazer recuar uma execução. O estado não pode chegar a terceiros (EV-15, C2.3). Um vídeo cancelado continua a ocupar o único worker até ao fim],
    [Elementos arquiteturais afetados], [`projects` (`models/run.js`, `controllers/run.js`, `utils/runState.js`, rotas e mensagens); `video_tool` (`video.py`, `video_processor.py`); `ws_gateway` (`index.js`, `utils/runStatus.js`); `api_gateway` (duas rotas); `frontend` (página do projeto, _layout_, `RunsProvider`, `BackgroundRuns`)],
    [Origem e âmbito do _refactoring_], [Interação entre o padrão do vídeo e o global; atravessa quatro serviços; risco de regressão médio, controlado pelos testes e pelos controlos C2.1 a C2.5],
    [Classe (A/B/C)], [B: a interface muda, mas só para melhorar a operabilidade, sem operações novas sobre os media],
    [Implementação (_commits_ / _pull requests_)], [Ramo `fase2/rnf-f2-02-segundo-plano-medido`, um _commit_ por passo: `f1714dc` (passo 0, ADR), `2982528` (1), `df7e1dc` (2), `54386cc` (3), `2abf795` (4), `77c9bf7` (5, documentação). No `main`: `d959150`],
    [Desvios face à decisão], [Ver a tabela seguinte],
  ),
)

#tab([DA-2: passos e verificação intermédia],
  tabela(
    colunas: (4.6cm, 1fr, 3.6cm),
    tamanho: 8.5pt,
    [Passo], [Verificação (vídeo de 120 s, pelo servidor; no passo 4, pelo browser com o vídeo de 330 s)], [Regressão (pytest, `node --test`, ponta a ponta, interface)],
    [1. Estado da execução no orquestrador: coleção `runs`, duas rotas `GET`], [A rota devolve `idle`, `running` e `done` com 100; outro utilizador e sem JWT recebem 401], [74/74, 14/14, 18/18, 3/3],
    [2. O progresso do vídeo passa pelo orquestrador], [107 mudanças do progresso no servidor; maior intervalo de 2,06 s (3,98 s no passo 1)], [75/75, 14/14, 18/18, 3/3],
    [3. Evento `run-status`], [121 eventos, maior intervalo de 1,79 s; nenhum chega a outro utilizador; cancelamento visto na rota em 0,27 s], [75/75, 14/14, 18/18, 3/3],
    [4. Interface que não bloqueia], [M2.2: R em 0,35 e 0,57 s, F em 0,11 s; M2.3: 1/1 em cada forma], [75/75, 14/14, 18/18, 3/3],
  ),
)

#tab([DA-2: desvios à decisão],
  tabela(
    colunas: (5.4cm, 1fr),
    [Desvio], [Porquê],
    [O `run-status` não vai para a sala do projeto], [O plano incluía-a; ao implementar viu-se que a sala `project:<id>` não tem verificação de acesso (EV-15). Vai só para as salas do dono e de quem iniciou, que exigem JWT; ADR e `AGENTS.md` corrigidos no mesmo _commit_],
    [O worker reporta a cada segundo e também a cada ponto percentual inteiro], [O `video-progress` reencaminhado leva a percentagem inteira; só com a regra do segundo, um vídeo rápido saltaria valores],
    [Atualizações de estado só sobre execuções `running` com o mesmo _token_, com `$max`], [As mensagens da `project_queue` são tratadas em paralelo: sem esta regra, um relatório atrasado reabria ou fazia recuar uma execução],
  ),
)
