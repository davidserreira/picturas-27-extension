#import "../template.typ": *

= Vista Arquitetural Antes e Depois

As duas decisões mexem em partes diferentes da arquitetura, por isso cada uma tem a sua vista, com a mesma notação antes e depois: a DA-1 numa vista do caminho de carregamento, e a DA-2 numa vista do fluxo do estado de uma execução.

== Antes

#figure(
  image("../images/da1-antes.svg", width: 100%),
  caption: [Caminho de carregamento antes da DA-1, com o acréscimo de memória medido com 500 MiB],
)

#figure(
  image("../images/da2-antes.svg", width: 100%),
  caption: [Fluxo do estado de uma execução antes da DA-2],
)

== Depois

#figure(
  image("../images/da1-depois.svg", width: 100%),
  caption: [Caminho de carregamento depois da DA-1, com o acréscimo de memória medido com 500 MiB],
)

#figure(
  image("../images/da2-depois.svg", width: 100%),
  caption: [Fluxo do estado de uma execução depois da DA-2; a verde, os elementos alterados],
)

== Legenda e notas

*Legenda.* Retângulos: serviços ou componentes; setas: fluxo de dados ou de eventos, com a fila, a rota ou o evento na etiqueta. A vermelho, nas vistas "antes", o problema e o seu custo medido (o ficheiro inteiro em memória e o acréscimo em cada serviço; o estado só no browser). A verde, nas vistas "depois", os elementos introduzidos ou alterados, com o estereótipo `«tática: …»` da tática que realizam. Os valores de memória são os maiores acréscimos medidos com 500 MiB (M1.1): na medição inicial, nas vistas "antes", e na medição final do RNF-F2-01, nas vistas "depois".

*DA-1.* Os serviços e a ordem são os mesmos; muda a forma como os bytes passam. Antes, cada serviço guardava o ficheiro inteiro (em disco no nginx, em memória nos outros três) antes de o passar ao seguinte. Depois, o ficheiro passa em blocos de ponta a ponta («tática: processar em fluxo»), o JWT é verificado antes de ler o corpo e o `img_storage` envia ao S3 em partes («tática: limitar o que fica em memória»). O `img_storage` continua a ser a única porta para o S3.

*DA-2.* Antes, o estado da execução só existia no browser: o worker mandava o progresso diretamente para a `ws_queue`, e o orquestrador só via o resultado final. Depois, o worker reporta ao orquestrador pela `project_queue`, o orquestrador guarda o estado na coleção `runs` («tática: manter o modelo da tarefa») e publica `run-status`, que o `ws_gateway` entrega só às salas do dono e de quem iniciou; o browser reconstrói o estado pelas rotas `GET` ao carregar e mostra-o em qualquer página («tática: mostrar o estado»), com o `Cancel` disponível depois de recarregar («tática: cancelar»).
