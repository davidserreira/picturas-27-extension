#import "../template.typ": *

#paisagem[
= Cenários de Entrada e Táticas Candidatas

== Candidatos e cenários de entrada

#tab([Candidatos e cenários de entrada],
  tabela(
    colunas: (1.8cm, 1.8cm, 3cm, 2.2cm, 2.8cm, 3.4cm, 1fr, 4cm),
    tamanho: 8pt,
    [Candidato], [Cenário (`QS-nn`)], [Característica / subcaracterística (ISO/IEC 25010)], [Evidência], [Origem (padrão global / vídeo / interação)], [Estímulo a que a tática reage], [Resposta e medida (resumo)], [Escala e método (cap. 6)],
    [CAND-1], [QS-01], [Eficiência de desempenho — utilização de recursos], [EV-13], [Padrão global], [Envio de um vídeo de 1000 MiB por um utilizador premium], [Vídeo aceite e guardado sem alteração; memória de cada serviço limitada por um valor fixo (M1.1); 1000 MiB aceite com 512 MiB por contentor (M1.2)], [MiB por serviço com `docker stats`; _override_ de 512 MiB],
    [CAND-2], [QS-02], [Usabilidade — operabilidade], [EV-03, EV-04, EV-14], [Interação entre o padrão do vídeo e o global], [Recarregar, mudar de página ou abrir outra sessão a meio de uma execução], [Continuar a usar a aplicação (M2.1), ver o estado reposto e o fim avisado (M2.2), cancelar depois de perder a página (M2.3)], [_Script_ Playwright: ações, tempos, cancelamentos],
  ),
)

== Alterações feitas ao capítulo 5 (se existirem)

#tab([Alterações aos cenários],
  tabela(
    colunas: (2cm, 1fr, 4cm),
    [Cenário], [O que mudou e porquê], [Onde foi atualizado],
    [—], [Nenhuma: os cenários QS-01 e QS-02 foram usados como estão no capítulo 5], [—],
  ),
)

== Táticas candidatas

As táticas seguem o catálogo de Bass, Clements e Kazman. Classe A: _refactoring_ puro; B: alteração visível que é o próprio objeto da melhoria; C: funcionalidade nova, rejeitada nesta fase.

#tab([Táticas candidatas],
  tabela(
    colunas: (1.5cm, 1.4cm, 3.2cm, 3.6cm, 1fr, 4.2cm, 3cm),
    tamanho: 8pt,
    [ID], [Cenário], [Atributo → categoria], [Tática], [Como produz a resposta (estímulo → tática → resposta)], [Já existe na base? (evidência)], [Classe (A/B/C)],
    [TAT-01], [QS-01], [Desempenho → gerir recursos], [Aumentar a eficiência dos recursos: processar em fluxo], [Envio de 1000 MiB → os bytes passam por cada serviço em blocos → a memória fica limitada pelos _buffers_ e pelas partes S3 em curso], [Não: `multer.memoryStorage()` em três serviços (EV-13)], [A],
    [TAT-02], [QS-01], [Desempenho → controlar a procura], [Limitar o que fica em memória: partes S3 em paralelo e tamanho dos _buffers_], [Envio → o pico de memória fica limitado por configuração → a memória não depende do ficheiro], [Parcial: o cliente S3 do `img_storage` já usa 4 partes de 5 MiB, mas sobre um ficheiro inteiro em memória], [A],
    [TAT-03], [QS-01], [Desempenho → gerir recursos], [Retirar intermediários do caminho dos dados: envio direto ao S3 com URL assinado], [Envio → o browser escreve diretamente no armazenamento → nenhum serviço da aplicação vê os bytes], [Não], [B: muda o contrato da API e o frontend; expõe escrita direta no armazenamento],
    [TAT-04], [QS-01], [Desempenho → gerir recursos], [Aumentar ou limitar a memória dos contentores], [Envio → o contentor tem mais memória ou é terminado mais cedo → o Docker não cai, mas o ficheiro continua inteiro em memória], [Parcial: limite de 1100 MB por pedido no nginx], [A, mas não muda a escala do problema],
    [TAT-05], [QS-02], [Usabilidade → iniciativa do sistema], [Manter um modelo da tarefa: estado e progresso de cada execução no orquestrador], [Recarregar ou abrir outra sessão → a interface pede o estado ao servidor → reconstrói o progresso e o cancelamento], [Não: estado num `useState` (EV-03); progresso não guardado (EV-04)], [A],
    [TAT-06], [QS-02], [Usabilidade → iniciativa do sistema], [Mostrar o progresso e o estado em qualquer página, sem bloquear], [Mudar de página → uma faixa na página do projeto e um painel nas outras mostram a execução → o fim e a falha são avisados onde o utilizador estiver], [Parcial: o progresso existia, mas num painel que bloqueava e só na página do projeto (EV-03)], [B: muda a interação só para melhorar a operabilidade],
    [TAT-07], [QS-02], [Usabilidade → iniciativa do utilizador], [Cancelar, disponível depois de perder a página], [Perder a página → o `Cancel` aparece sempre que a execução está ativa, a partir do estado do servidor → o utilizador cancela], [Sim, mas só no painel e só antes de recarregar (EV-03)], [A/B: a capacidade já existia; muda quando está disponível],
    [TAT-08], [QS-02], [Usabilidade → iniciativa do sistema], [Modelo da tarefa só no browser (`localStorage`)], [Recarregar → o browser lembra-se da execução → mostra-a de novo], [Não], [A, mas falha noutra sessão (M2.3, forma B) e não sabe o progresso real],
    [TAT-09], [QS-02], [Usabilidade → iniciativa do sistema], [Consulta periódica do estado, sem eventos], [A cada N s → o browser pergunta o estado → mostra-o], [Não], [A, mas com atraso até N s e mais carga],
    [TAT-10], [QS-02], [Usabilidade → iniciativa do utilizador], [Pausar e retomar uma execução], [—], [Não], [*C: rejeitada*, funcionalidade nova],
  ),
)
]
