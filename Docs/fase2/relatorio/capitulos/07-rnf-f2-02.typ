#import "../template.typ": *

= RNF-F2-02 — Trabalho em segundo plano durante o processamento

== Diagnóstico

#tab([Como se acompanhava uma execução na base],
  tabela(
    colunas: (3.4cm, 4.6cm, 1fr),
    [Parte], [Evidência], [O que faz],
    [Estado "a processar"], [`frontend/app/dashboard/[pid]/page.tsx:89-93`], [Quatro `useState` da página do projeto: recarregar ou sair da página apaga-os],
    [Interface durante a execução], [`page.tsx:894-927`], [Um painel `absolute ... z-50` cobre a página do projeto; o único controlo é `Cancelar`],
    [Progresso das imagens], [`page.tsx:300-400`], [O browser conta eventos `process-update`, um por passo concluído],
    [Progresso dos vídeos], [`Tools/video/video.py:112-124`, `wsGateway/index.js:65-72`], [O worker envia a percentagem diretamente para a `ws_queue`; o orquestrador não a vê e ninguém a guarda],
    [Estado no servidor], [`projects/routes/projects.js:1521-1815`], [`activeToken`, `committedToken` e um `Process` por passo em curso. Não há rota que diga em que ponto vai uma execução],
    [Cancelamento], [`projects.js:2252-2355`; `page.tsx:914-924`], [A rota existe, mas o botão só aparece dentro do painel, que desaparece com a página],
  ),
)

*Impacto.* Atinge todos os utilizadores em todas as execuções, e pesa mais onde pesa o vídeo: um trabalho de minutos prende a aplicação inteira. Contradiz o interesse declarado do utilizador registado ou premium ("saber a todo o momento como vai o trabalho, mesmo quando já não acompanha"). O PL1-G4 já listava a falta de aviso de conclusão como limitação. Para a operação, uma execução cuja página se perdeu é um trabalho que continua a gastar CPU sem que a interface o deixe parar.

#tab([Cenário de fragilidade e cenário de qualidade do RNF-F2-02],
  tabela(
    colunas: (3.2cm, 1fr, 1fr),
    [Parte], [Na base (fragilidade)], [Pretendido (qualidade)],
    [Fonte], table.cell(colspan: 2)[Utilizador registado ou premium],
    [Estímulo], table.cell(colspan: 2)[Durante um processamento de 4 a 5 min, usa outras páginas, recarrega a página ou abre outra sessão, e quer acompanhar ou cancelar a execução],
    [Artefacto], table.cell(colspan: 2)[Interface web e estado da execução],
    [Ambiente], table.cell(colspan: 2)[Execução em curso, operação normal, browser de secretária],
    [Resposta], [Um painel tapa o projeto. Ao sair ou recarregar, o progresso desaparece e deixa de haver forma de cancelar; noutra página, o fim não é avisado], [A aplicação continua utilizável, mostra o progresso em qualquer página, repõe o estado depois de recarregar, deixa cancelar e avisa no fim],
    [Medida da resposta], [Ações concluídas: 0 de 10; estado reposto: nunca; cancelamentos: 0 de 10], [Ações: 10 de 10 (mínimo 80%); estado reposto e fim avisado: ≤ 2 s (mínimo 5 s); cancelamentos: 10 de 10 (mínimo 5 de 5 ao recarregar)],
  ),
)

== Quantificação

*Classificação.* Usabilidade, subcaracterística _operabilidade_: o grau em que o sistema é fácil de operar e de controlar. O que está em causa é o utilizador manter o controlo da aplicação e de uma execução demorada.

*Enunciado.* Enquanto um projeto é processado, o sistema deve permitir que o utilizador continue a usar a aplicação sem deixar de acompanhar essa execução, e deve permitir acompanhá-la e cancelá-la depois de recarregar a página.

O cancelamento mantém o significado que tem na base: a execução deixa de produzir resultados e o projeto volta a ficar editável. A mudança é visível ao utilizador porque é o próprio objeto da melhoria, como as diretrizes admitem para a usabilidade, e não acrescenta operações novas sobre os media.

*Cenário comum às três medidas.* Uma conta premium num browser de secretária (1440×900). O projeto P tem um vídeo sintético de 330 s (1280×720, 30 fps) e duas imagens, com brilho e contraste no pipeline. A duração do vídeo foi calibrada na medição inicial para a execução de P demorar entre 150 e 300 s. O projeto Q tem uma imagem. O instrumento é um script Playwright que executa os passos, cronometra e grava um vídeo de cada execução. Os critérios são definidos pelo que o utilizador vê, e não por identificadores de elementos.

#tab([Medidas principais do RNF-F2-02],
  tabela(
    colunas: (2.6cm, 1fr, 1.9cm, 2.6cm, 2.6cm),
    tamanho: 8.5pt,
    [Medida], [Escala e procedimento], [Base], [Alvo], [Mínimo],
    [M2.1 — Ações concluídas durante uma execução], [Percentagem de 10 ações fixas (em P: carrossel, grelha, transferir, partilhar; fora de P: abrir a conta, abrir Q, carregar uma imagem para Q, acrescentar brilho ao pipeline de Q, criar um projeto, voltar a P) concluídas a partir dos 10% de progresso. Uma ação conta se o resultado aparece em 10 s ou menos e o progresso de P continua visível. Pior de 3 execuções], [*0%*], [100%], [80%, com as 6 ações fora de P todas concluídas],
    [M2.2 — Tempo até a interface refletir o estado], [R: recarregar a página de P aos 25% e 60%, até ver o progresso certo (6 valores). F: fim da execução com o utilizador noutra página, até a interface o indicar (3 valores). Maior valor; 60 s sem resposta conta como "não recupera"], [*Não recupera* (6/6 e 3/3)], [R e F ≤ 2 s], [R e F ≤ 5 s],
    [M2.3 — Cancelamento depois de perder a página], [10 tentativas: 5 recarregando a página (A) e 5 abrindo P noutra sessão (B). Sucesso: o cancelamento é oferecido em 10 s, P deixa de processar em 5 s e os resultados ficam iguais aos de antes], [*0/10*], [10/10], [5/5 na forma A],
  ),
)

*Origem dos valores.* O alvo de 100% na M2.1 é a leitura direta da ideia das diretrizes e do interesse do utilizador na Tabela 2 do PL1-G4. O mínimo admite que até duas ações de leitura dentro do projeto em processamento fiquem por disponibilizar. Os 10 s por ação são o limite da atenção numa tarefa (Nielsen, _Usability Engineering_, 1993). Os 2 s e 5 s da M2.2 são o alvo e o mínimo do REQ-VID-STATUS-003 (atualizar o progresso a cada 2 s, no máximo 5 s), e o acontecimento F corresponde ao REQ-VID-NOTIFY-001, que a base deixou por implementar. Na M2.3, o cancelamento ou está ao alcance do utilizador ou não está, por isso não se aceita uma taxa parcial dentro de cada forma; o mínimo cobre o caso que as diretrizes nomeiam ("mesmo depois de recarregar a página").

*Pré-requisito.* O estado de uma execução tem de existir no servidor; sem isso, nenhuma das três medidas pode melhorar. Faz parte do _refactoring_ deste requisito.

*Efeitos colaterais a controlar* (`requisitos-nf.md`, 4.2): duração da execução (C2.1, até +10%), maior intervalo entre mudanças do progresso (C2.2, ≤ 5 s, REQ-VID-STATUS-003), estado recusado a outro utilizador e sem JWT (C2.3), resultados iguais com execuções sobrepostas (C2.4) e comportamento ao alterar o pipeline durante a execução (C2.5).

== Medição inicial

Na mesma série da base (17 de novembro, `43a2e08`):

- *M2.1: 0% nas 3 execuções.* As ações dentro de P ficam tapadas pelo painel. As ações noutras páginas funcionam, mas o progresso de P desaparece logo que se sai da página, e ao voltar a P o progresso já não aparece.
- *M2.2: não recupera* em 6 de 6 recargas e em 3 de 3 fins.
- *M2.3: 0/10.* Depois de perder a página, a interface não oferece o cancelamento em nenhuma das duas formas.
- *C2.1: 275,9 ± 13,1 s* (mediana 269,3 s). *C2.2: 16,9 ± 1,0 s*, acima do limite de 5 s. A causa está no código: em P, a barra tem 5 passos e o vídeo vale um; o worker reporta de 2 em 2%, e o número mostrado só muda a cada 5% do vídeo, cerca de 13 a 16 s. O C2.2 é o único controlo que a base já não cumpria.

== Decisão arquitetural (ADR-02)

O registo completo está em `Docs/fase2/adr/ADR-02-estado-da-execucao-no-servidor.md`. As forças da decisão eram uma única fonte de verdade que sobreviva à página e à sessão; progresso ao ritmo do trabalho real; comportamento funcional igual; o estado só visível a quem pode ver o projeto; e pouca sobreposição com o RNF-F2-01.

#tab([Alternativas consideradas no ADR-02],
  tabela(
    colunas: (3.6cm, 1fr, 1fr),
    [Alternativa], [A favor], [Contra],
    [*A — Estado da execução no orquestrador, no MongoDB, exposto por REST e enviado por WebSocket (escolhida)*], [Uma fonte de verdade persistente para a página recarregada, outra sessão e outra aba; progresso calculado num só sítio, com o peso real de cada media; a rota passa pelo gateway, com a verificação de JWT das outras; os eventos antigos ficam iguais], [Mais escritas no MongoDB (uma por passo de imagem e cerca de uma por segundo por vídeo); o worker de vídeo muda o destino do progresso; é a alternativa com mais ficheiros alterados],
    [B — O `ws_gateway` guarda o último progresso em memória e repete-o a quem se liga], [Poucas alterações; nenhuma escrita no MongoDB], [O estado perde-se quando o gateway reinicia e o serviço passa a ter estado; dois donos do estado; o progresso das imagens continua no browser; não há forma de pedir o estado por REST nem de o proteger],
    [C — Só no browser, a partir do `localStorage` e dos campos do projeto], [Sem alterações no servidor], [Não serve outra sessão (forma B da M2.3); os _tokens_ não chegam para saber se uma execução está ativa; o progresso das imagens não se reconstrói],
  ),
)

Foram descartadas sem análise detalhada a consulta periódica em vez de eventos (cada aba teria de perguntar de segundo a segundo para cumprir o C2.2), as notificações do sistema operativo ou por email (funcionalidade nova) e um serviço novo de execuções (tirava a orquestração do `projects`).

*Decisão: alternativa A.* É a única que serve as três medidas nas duas formas da M2.3. Corrige a causa do C2.2 em vez de a esconder. Fica no sítio certo da arquitetura: o orquestrador já era dono do ciclo de vida da execução, e o `ws_gateway` continua a ser só um distribuidor de eventos, sem estado. Preserva as rotas, os resultados e os eventos existentes, e só acrescenta uma rota e um evento.

*Táticas.* Manter um modelo da tarefa no servidor, mostrar o estado em qualquer página e cancelar depois de perder a página (TAT-05, TAT-06 e TAT-07). A alternativa C corresponde à TAT-08; a consulta periódica é a TAT-09, e pausar ou retomar (TAT-10) foi rejeitada por ser uma funcionalidade nova. A decisão está resumida na DA-2 (secção 4.3).

*Como se calcula o progresso.* Cada media tem um trabalho total em "fotogramas processados": uma imagem conta um por ferramenta de imagem, e um vídeo conta os seus fotogramas (duração × fps). O progresso é o trabalho feito sobre o total. Num projeto só com imagens, dá o mesmo que na base; em P, o vídeo vale 9900 unidades e as imagens quatro, e a barra avança ao ritmo do vídeo. O worker passa a reportar com uma casa decimal, a cada segundo.

#tab([A interface antes e depois do ADR-02],
  tabela(
    colunas: (3.4cm, 1fr, 1fr),
    [Onde], [Na base], [Depois],
    [Página do projeto em processamento], [Painel que cobre a página, com a barra e `Cancelar`], [Uma faixa por baixo do cabeçalho com a barra, a percentagem e `Cancel`; o resto da página funciona],
    [Pipeline desse projeto], [Tapado], [Só de leitura enquanto a execução corre; `Apply` desativado],
    [Outras páginas], [Sem indicação], [Painel no canto inferior direito com o nome e o progresso de cada execução em curso noutro projeto],
    [Fim ou falha], [Só na página do projeto], [Também nas outras páginas, numa região `status` ou `alert`, com ligação para os resultados],
    [Recarregar, nova sessão], [O estado perde-se], [O estado é pedido ao servidor ao carregar e atualizado pelos eventos],
  ),
)

*Consequências registadas.* O evento `run-status` vai só para as salas do dono e de quem iniciou a execução, que exigem JWT. A sala `project:<id>` ficou de fora porque o `ws_gateway` deixa qualquer socket entrar nela sem verificação: é uma fragilidade da base, encontrada ao implementar. As atualizações de estado são concorrentes (as mensagens da `project_queue` são tratadas em paralelo), por isso só tocam execuções ainda `running` com o mesmo _token_ e usam `$max`, para um relatório atrasado não fazer recuar nem reabrir uma execução. Um vídeo cancelado continua a ocupar o único worker até ao fim: interromper o trabalho já entregue ao worker ficou fora do âmbito. Os padrões que realizam a decisão são um registo de estado no orquestrador e _publish-subscribe_ sobre a `ws_queue`.

== Refactoring

Ramo `fase2/rnf-f2-02-segundo-plano-medido`, com um commit por passo, do servidor para a interface: até ao passo 3 o browser via o mesmo que na base, e cada passo verificou-se pela API.

#tab([Passos do ADR-02 e verificação intermédia],
  tabela(
    colunas: (4.4cm, 1fr, 3.4cm),
    tamanho: 8.5pt,
    [Passo], [Verificação (vídeo de 120 s, pelo servidor; no passo 4, pelo browser com o vídeo de 330 s)], [Regressão],
    [1. Estado da execução no orquestrador: coleção `runs`, duas rotas `GET`], [A rota devolve `idle`, `running` e `done` com 100; outro utilizador e sem JWT recebem 401], [74/74, 14/14, 18/18, 3/3],
    [2. O progresso do vídeo passa pelo orquestrador], [107 mudanças do progresso no servidor; maior intervalo de 2,06 s (1,96 s no `video-progress`, contra 3,98 s no passo 1)], [75/75, 14/14, 18/18, 3/3],
    [3. Evento `run-status`], [121 eventos, maior intervalo de 1,79 s; nenhum chega a outro utilizador; cancelamento visto na rota em 0,27 s], [75/75, 14/14, 18/18, 3/3],
    [4. Interface que não bloqueia], [M2.2: R em 0,35 e 0,57 s, F em 0,11 s; M2.3: 1/1 em cada forma], [75/75, 14/14, 18/18, 3/3],
    [5. Documentação], [—], [—],
  ),
)

Os 14 testes do orquestrador incluem os 8 da base e 6 novos (cálculo do progresso); o pytest ganhou um teste de cadência no passo 2; o `ws_gateway` ganhou 3 testes unitários no passo 3. No passo 4, a M2.1 e o C2.1/C2.2 com uma execução não ficaram registados: a M2.1 parou num `ECONNRESET` do reencaminhamento de portas do Docker Desktop, antes de o pedido chegar ao nginx, e o C2.1 foi interrompido por uma suspensão do portátil. O instrumento passou a repetir uma vez um `GET` que falhe dessa forma, e as duas medidas ficaram para a medição final.

#tab([Desvios ao plano do ADR-02],
  tabela(
    colunas: (5.4cm, 1fr),
    [Desvio], [Porquê],
    [O worker reporta a cada segundo e também a cada ponto percentual inteiro], [O `video-progress` reencaminhado leva a percentagem inteira; só com a regra do segundo, um vídeo rápido saltaria valores. Com o vídeo de 330 s manda a regra do segundo],
    [O `run-status` não vai para a sala do projeto], [O plano incluía-a; ao implementar viu-se que a sala não tem verificação de acesso. ADR e `AGENTS.md` corrigidos no mesmo commit],
    [A medição final não repete o envio de 1000 MiB sem limites], [Este ramo mantém o caminho de carregamento da base, onde esse envio deita abaixo o motor do Docker. Mede-se na série conjunta (capítulo 8)],
  ),
)

== Medição final e análise

Medido no seu ramo, a 18 de novembro, com os scripts da base (`medicoes/final/rnf-f2-02/`). A série foi interrompida a meio da M2.3 e completada de um arranque limpo (`complemento/`).

#tab([RNF-F2-02: medidas principais],
  tabela(
    colunas: (3.2cm, 2.4cm, 1fr, 1.6cm, 2.2cm, 2cm),
    tamanho: 8.5pt,
    [Medida], [Base], [Final], [Alvo], [Mínimo], [Resultado],
    [M2.1], [0%], [*100%* nas 3 execuções; as 10 ações concluídas em todas], [100%], [80%, G1 completo], [*Alvo atingido*],
    [M2.2 R], [Não recupera (6/6)], [*0,63 s* (pior de 6; mediana 0,36 s)], [≤ 2 s], [≤ 5 s], [*Alvo atingido*],
    [M2.2 F], [Não recupera (3/3)], [*0,11 s* (pior de 3)], [≤ 2 s], [≤ 5 s], [*Alvo atingido*],
    [M2.3], [0/10], [*12/12*: 7/7 na forma A e 5/5 na forma B; `Cancel` oferecido em 0,27–1,02 s], [10/10], [5/5 na forma A], [*Alvo atingido*],
  ),
)

*O RNF-F2-02 fica cumprido, com o alvo atingido nas três medidas principais.* Dados por medida:

- *M2.1.* As ações dentro de P, que na base ficavam tapadas pelo painel, demoram 0,1 a 0,3 s; transferir os originais demora cerca de 4 s. As ações fora de P demoram 0,1 a 0,4 s mais do que na base (criar um projeto: 0,65–0,95 s contra 0,43–0,50 s), muito abaixo dos 10 s; a diferença não foi investigada. Os 10% de progresso, a partir dos quais as ações começam, chegaram aos 31–45 s, e não aos 0,8 s da base: a barra passou a seguir o vídeo, que é quase todo o trabalho, em vez de contar cada imagem como um quinto da execução. As três execuções foram válidas, porque P ainda estava a ser processado quando a última ação terminou.
- *M2.2.* O valor mostrado depois de recarregar nunca foi inferior ao de antes (por exemplo, 15,0% → 15,3%). Num dos fins, a interface mostrou a conclusão no mesmo instante em que os resultados ficaram disponíveis na API.
- *M2.3.* O `Cancel` apareceu em 0,27 a 1,02 s; o valor mais alto é da forma B, que abre P numa sessão nova. P deixou de estar em processamento em 0,03 s ou menos, e os resultados ficaram iguais aos de antes. A série foi interrompida a meio desta medida, com 8 tentativas feitas; as outras 4 correram no complemento, de um arranque limpo.

#tab([RNF-F2-02: controlos],
  tabela(
    colunas: (3.2cm, 2.3cm, 2.6cm, 1.8cm, 1fr),
    tamanho: 8.5pt,
    [Controlo], [Base], [Final], [Limite], [Resultado],
    [C2.1 — duração de P (mediana)], [269,3 s], [336,6 s], [≤ base + 10%], [Não se compara entre sessões; ver abaixo e o capítulo 8],
    [C2.2 — maior intervalo do progresso], [16,9 s], [*2,22 s*], [≤ 5 s], [*Passa a cumprir*; a base não cumpria],
    [C2.3 — estado com o JWT de outro utilizador e sem JWT], [Não aplicável], [Dono 200; outro utilizador 401; sem JWT 401], [Recusado nos dois], [Cumpre],
    [C2.4 — P e Q sobrepostos], [Iguais], [Iguais], [Iguais], [Cumpre],
    [C2.5 — ferramenta acrescentada a meio], [201; resultados iguais], [201; resultados iguais], [Sem erro, sempre igual], [Cumpre; pela interface, o pipeline fica só de leitura],
  ),
)

*C2.1.* As três execuções demoraram 330 a 342 s, 25% acima da série da base, mas esta comparação não é válida: na série do RNF-F2-01, o mesmo código da base demorou 267–291 s numa sessão e 311–381 s noutra (secção 6.6). No registo do worker, estas três execuções demoraram 329 a 339 s: o C2.1 fica só 1,6 a 2,3 s acima (2 a 3,5 s na base), por isso o tempo a mais está dentro do worker, e não no orquestrador. Na mesma sessão, outras execuções do mesmo trabalho demoraram 240 a 300 s no worker. O efeito do RNF-F2-02 no C2.1 mede-se com a base na mesma sessão, nos blocos A-B-A da medição conjunta (capítulo 8).

*C2.3.* Na primeira tentativa, o Git Bash converteu o caminho da rota num caminho do Windows, e o pedido deu 404 a todos, incluindo o dono; o script contou-o como recusa. O C2.3 foi repetido com a conversão desligada, e o script passou a só contar a recusa quando o dono recebe 200 do mesmo URL.

*C2.2.* O progresso mostrado mudou 356 a 375 vezes por execução, contra 25 na base. O maior intervalo ficou entre 1,5 e 2,2 s: o mínimo do REQ-VID-STATUS-003 (5 s) é cumprido em todas as execuções, e o alvo (2 s) em duas das três.

*Medidas do RNF-F2-01 neste ramo.* O caminho de carregamento é o da base, e as medidas ficaram como na base: M1.1 com 500 MiB de 2009 MiB no `api_gateway` (base 2001 MiB), M1.2 de 100 MiB (com 500 MiB o `api_gateway` é terminado), C1.3 com +1006 MiB, e o C1.7 continua a encontrar o ficheiro órfão do 409. As medianas do tempo de aceitação de 10 e 100 MiB ficaram acima das da base (0,60 e 3,75 s, contra 0,33 e 1,69 s), puxadas pelas primeiras repetições de cada tamanho. Na base, essas repetições também eram as mais lentas, e as duas últimas de cada tamanho ficam dentro do intervalo da base. Como o diff não toca no caminho de carregamento, a diferença fica registada como variação da sessão.

*O que não foi atingido.* Nada nas medidas principais. Fica por confirmar o C2.1, na mesma sessão que a base (capítulo 8).

== Preservação funcional

#tab([Regressão do RNF-F2-02, no seu ramo],
  tabela(
    colunas: (4cm, 1fr, 1fr),
    [Suite], [Base], [Final],
    [Worker de vídeo (pytest)], [74/74], [75/75 (os 74 da base e o teste de cadência)],
    [Orquestrador (`node --test`)], [8/8], [14/14 (os 8 da base e 6 do cálculo do progresso)],
    [Ponta a ponta (T01–T18)], [18/18], [18/18, com as mesmas impressões da base],
    [Interface (U01–U03)], [3/3], [3/3],
  ),
)

Os 3 testes unitários novos do `ws_gateway` passam (3/3) e não fazem parte da suite da base. A interface mudou, por ser o objeto da melhoria, mas os testes de interface da base (importar, aplicar, cancelar) continuaram a passar sem alterações: o U03 procura um botão cujo nome contenha "cancel", que passou do painel para a faixa da página do projeto.
