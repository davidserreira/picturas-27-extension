#import "../template.typ": *

= Trade-offs, Cenários de Qualidade e Prioridades

== Cenários de qualidade para a extensão de vídeo

Cada cenário parte de uma fragilidade da base com evidência e tem os seis elementos. A medida da resposta diz o que se mede; os valores de base, alvo e mínimo dos dois cenários escolhidos só foram fixados depois da medição inicial (capítulo 6), e os dos outros ficam por fixar, porque não foram medidos.

#paisagem[
#tab([Cenários de qualidade],
  tabela(
    colunas: (1.2cm, 3.6cm, 2.4cm, 2cm, 2.4cm, 2.4cm, 2cm, 2.6cm, 1fr),
    tamanho: 7.5pt,
    [ID], [Fragilidade na base (EV-nn)], [Característica (ISO/IEC 25010)], [Fonte do estímulo], [Estímulo], [Artefacto], [Ambiente], [Resposta], [Medida da resposta],
    [QS-01], [O ficheiro fica inteiro em memória em cada serviço do caminho de carregamento; com 500 MiB o `api_gateway` sobe 2001 MiB e com 1000 MiB a instalação inteira deixa de responder (EV-13)], [Eficiência de desempenho — utilização de recursos], [Utilizador premium], [Carrega um vídeo de 1000 MiB], [`nginx`, `api_gateway`, `projects`, `img_storage`], [Operação normal, um envio de cada vez], [O vídeo é aceite e guardado sem alteração, e a memória de cada serviço não acompanha o tamanho do ficheiro], [Acréscimo de memória por serviço durante o envio, em MiB (M1.1); maior ficheiro aceite com 512 MiB por contentor, em MiB (M1.2)],
    [QS-02], [O estado da execução só existe no browser, um painel bloqueia a página e o progresso do vídeo não passa pelo orquestrador (EV-03, EV-04). *EV-14*: `medicoes/baseline/` — 0% das ações concluídas durante uma execução, estado nunca reposto ao recarregar, 0/10 cancelamentos depois de perder a página], [Usabilidade — operabilidade], [Utilizador registado ou premium], [Recarrega, muda de página ou abre outra sessão a meio de uma execução de minutos], [Frontend, `projects`, `ws_gateway`, `video_tool`], [Execução de um vídeo e duas imagens em curso], [Continua a usar a aplicação, vê o progresso, pode cancelar e é avisado do fim], [% de 10 ações concluídas (M2.1); segundos até repor o estado e avisar o fim (M2.2); % de cancelamentos conseguidos depois de perder a página (M2.3)],
    [QS-03], [Um só worker de vídeo, um trabalho de cada vez: uma legendagem longa atrasa todos os vídeos (EV-12)], [Eficiência de desempenho — capacidade], [Dois utilizadores], [Um submete a legendagem de um vídeo longo e o outro um efeito num vídeo curto], [`video_tool`, `video_queue`], [Dois trabalhos em simultâneo], [O vídeo curto não espera pelo longo], [Segundos até ao resultado do vídeo curto],
    [QS-04], [*H-04*: se o worker morrer a meio de um lote, a execução fica "em curso" sem fim e o utilizador não é avisado; não verificado por injeção de falhas], [Fiabilidade — recuperabilidade], [`video_tool`], [Falha a meio de um lote], [Worker, `projects`], [Operação normal], [O pedido não se perde, não há saída parcial e a execução termina], [Minutos até recuperar; pedidos perdidos],
    [QS-05], [O `api_gateway` guarda o corpo antes de verificar o JWT (EV-13). *EV-21*: `medicoes/baseline/` (C1.3) — um envio de 500 MiB sem JWT é recusado com 401, mas só depois de o gateway subir 1006 MiB], [Segurança — autenticidade], [Cliente sem JWT], [Envia 500 MiB à API], [`nginx`, `api_gateway`], [Operação normal], [O pedido é recusado sem ocupar memória], [Código da resposta; acréscimo de memória do gateway, em MiB],
  ),
)
]

#tab([Priorização dos cenários],
  tabela(
    colunas: (1.6cm, 1fr, 1fr, 2cm),
    tamanho: 8.5pt,
    [ID], [Importância para os stakeholders], [Dificuldade / risco técnico], [Prioridade],
    [QS-02], [Alta — atinge todos os utilizadores em todas as execuções e contradiz um interesse escrito no documento de base (Tabela 2 do PL1-G4); base: 0% das ações (EV-14)], [Média — estado no servidor e interface nova, em quatro serviços], [1],
    [QS-01], [Alta — o premium paga pelos ficheiros grandes, a entrada única cai, e com 1000 MiB cai a instalação inteira (EV-13)], [Média — três serviços e alternativas reais, contido no caminho de carregamento], [2],
    [QS-05], [Média — numa instalação local o risco é menor, e resolve-se com a mesma decisão do QS-01], [Baixa, se tratado com o QS-01], [3],
    [QS-03], [Alta para quem legenda, mas só com vários utilizadores ao mesmo tempo], [Alta — réplicas, filas e memória do Whisper; resultados dependentes da máquina (H-01)], [4],
    [QS-04], [Média — trabalho perdido, raro numa instalação local], [Média — injeção de falhas e repetição idempotente], [5],
  ),
)

== Atributos de qualidade por ordem de prioridade

+ *Usabilidade — operabilidade*: QS-02, o cenário mais importante, atinge todos os utilizadores.
+ *Eficiência de desempenho — utilização de recursos*: QS-01; a falha derruba a entrada única.
+ *Segurança — autenticidade*: QS-05; corrige-se com a mesma decisão do QS-01.
+ *Eficiência de desempenho — capacidade*: QS-03; importante com vários utilizadores, mas com mais risco técnico.
+ *Fiabilidade — recuperabilidade*: QS-04; o estado da execução no servidor, pedido pelo QS-02, é um primeiro passo.

== Pré-requisitos e efeitos colaterais entre atributos

#tab([Pré-requisitos e efeitos colaterais entre atributos],
  tabela(
    colunas: (3.2cm, 3.2cm, 3cm, 1fr),
    tamanho: 8.5pt,
    [Atributo A], [Atributo B], [Efeito (pré-requisito, sinergia ou conflito)], [Razão / evidência],
    [Fiabilidade — recuperabilidade (estado no servidor)], [Usabilidade — operabilidade], [Pré-requisito], [Sem um estado que o servidor devolva, nenhuma interface consegue repor o acompanhamento depois de recarregar (EV-03, EV-04)],
    [Usabilidade — operabilidade], [Eficiência — comportamento temporal], [Possível conflito], [Guardar o estado acrescenta escritas e mensagens por execução; controlado pelo C2.1],
    [Usabilidade — operabilidade], [Segurança — confidencialidade], [Possível conflito], [O estado passa a ser consultável e não pode chegar a terceiros (EV-15); controlado pelo C2.3],
    [Eficiência — utilização de recursos (fluxo)], [Eficiência — comportamento temporal], [Sinergia], [Os serviços passam a trabalhar em paralelo em vez de em série; controlado pelo C1.1 e pelo C1.2],
    [Eficiência — utilização de recursos (fluxo)], [Segurança — autenticidade], [Sinergia], [Verificar o JWT antes de ler o corpo deixa de custar memória (QS-05, C1.3)],
    [Eficiência — utilização de recursos (fluxo)], [Fiabilidade, armazenamento], [Possível conflito], [Validar depois de guardar pode deixar objetos órfãos; controlado pelo C1.7],
    [Eficiência — capacidade (réplicas)], [Eficiência — utilização de recursos], [Conflito], [Cada réplica do worker carrega o seu modelo Whisper (H-01)],
    [Manutenibilidade (um serviço por efeito)], [Eficiência — comportamento temporal], [Conflito], [Codificar o vídeo entre efeitos (H-02)],
  ),
)

== Recomendações de melhoria à solução atual

#tab([Recomendações de melhoria],
  tabela(
    colunas: (1fr, 3cm, 3cm, 1.8cm, 2.2cm),
    tamanho: 8.5pt,
    [Recomendação], [Atributo(s)], [Padrão a que se refere (global / vídeo)], [Esforço], [Risco de regressão],
    [Passar os ficheiros em fluxo por todo o caminho de carregamento e verificar o JWT antes de ler o corpo (QS-01, QS-05)], [Utilização de recursos, segurança, comportamento temporal], [Global], [Médio], [Médio],
    [Guardar o estado de cada execução no orquestrador, fazer o vídeo reportar-lhe o progresso e não bloquear a interface (QS-02)], [Operabilidade, recuperabilidade], [Interação entre os dois], [Médio], [Médio],
    [Réplicas do `video_tool` e fila própria para a legendagem (QS-03, ALT-1)], [Capacidade], [Vídeo], [Médio a alto], [Médio],
    [Verificar o acesso nas salas do WebSocket e o dono em todas as rotas do `projects`; segredos fora do repositório], [Segurança], [Global], [Médio], [Médio],
    [Recuperar trabalhos interrompidos e repetir mensagens de forma idempotente (QS-04)], [Recuperabilidade], [Ambos], [Médio], [Médio],
    [Separar os efeitos de vídeo em módulos partilhados com as ferramentas de imagem (ALT-2, parcial)], [Modularidade], [Vídeo], [Alto], [Alto],
  ),
)
