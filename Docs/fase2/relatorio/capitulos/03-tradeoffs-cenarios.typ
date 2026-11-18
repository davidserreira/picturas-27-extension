#import "../template.typ": *

= Trade-offs, cenários de qualidade e escolha dos requisitos

Este capítulo corresponde ao Bloco 2 do Exercício 6 (enunciado e template 1.1). Parte da matriz da secção 2.5. Justifica-a atributo a atributo, escreve os cenários de qualidade da extensão de vídeo, prioriza-os e escolhe os dois requisitos não funcionais da Fase 2.

== Justificação das avaliações da matriz

#tab([Trade-offs por atributo de qualidade],
  tabela(
    colunas: (3.2cm, 1fr, 2.4cm, 1.8cm),
    tamanho: 8.5pt,
    [Atributo], [Justificação], [Depende sobretudo de], [Evidência],
    [Eficiência — comportamento temporal], [O vídeo é rápido por execução: descodifica e codifica uma vez. A latência das filas é desprezável face a minutos de processamento. O carregamento é lento porque cada serviço só passa o ficheiro ao seguinte depois de o receber inteiro: com 500 MiB, a aceitação demora 9 s (mediana)], [Ambos: o vídeo no processamento, o global no carregamento], [EV-02, EV-13],
    [Eficiência — utilização de recursos], [Todos os serviços do caminho de carregamento usam `multer` em memória e o `img_storage` monta o ficheiro antes do S3. A memória cresce com o tamanho do ficheiro, em vários serviços ao mesmo tempo], [Padrão global], [EV-13],
    [Eficiência — capacidade], [O padrão global permite réplicas, mas o worker de vídeo é único e consome um trabalho de cada vez; uma legendagem longa atrasa todos os vídeos], [Padrão do vídeo], [EV-12],
    [Fiabilidade], [As falhas ficam isoladas por ferramenta e o worker de vídeo não deixa saídas parciais (confirma a mensagem só no fim). Mas o `api_gateway`, a entrada única, cai por falta de memória com um envio grande, e o progresso de uma execução perde-se com a página], [Ambos], [EV-04, EV-13],
    [Manutenibilidade], [As ferramentas de imagem são independentes e substituíveis. As operações de imagem estão duplicadas no worker de vídeo, e o orquestrador tem ramos `if` por tipo de media], [Padrão do vídeo], [EV-05],
    [Segurança], [O JWT só é verificado no gateway, e depois de o corpo ser lido; os serviços confiam no `X-Caller-Id`; a sala `project:<id>` do WebSocket aceita qualquer socket], [Padrão global], [EV-07, EV-13, EV-15],
    [Usabilidade — operabilidade], [O estado de uma execução só existe no browser e o progresso do vídeo não passa pelo orquestrador: recarregar a página perde o acompanhamento e o cancelamento], [Interação entre os dois], [EV-03, EV-04, EV-14],
  ),
)

== Cenários de qualidade

Cada cenário tem os seis elementos. As medidas da resposta são verificáveis por script. Os valores-alvo e mínimos dos dois cenários escolhidos só foram fixados depois da medição inicial (capítulos 6 e 7); os dos outros cenários ficam por fixar, porque não foram medidos.

#tab([Cenários de qualidade da extensão de vídeo],
  tabela(
    colunas: (1.3cm, 2.2cm, 1.8cm, 2.2cm, 2.2cm, 1.9cm, 2.4cm, 1fr),
    tamanho: 7.5pt,
    [ID], [Característica], [Fonte], [Estímulo], [Artefacto], [Ambiente], [Resposta], [Medida da resposta],
    [QS-01], [Eficiência — utilização de recursos], [Utilizador premium], [Carrega um vídeo de 1000 MiB], [`nginx`, `api_gateway`, `projects`, `img_storage`], [Operação normal, um envio de cada vez], [O vídeo é aceite e guardado sem alteração; a memória não acompanha o tamanho], [Acréscimo de memória por serviço, em MiB (M1.1); maior ficheiro aceite com 512 MiB por contentor (M1.2)],
    [QS-02], [Usabilidade — operabilidade], [Utilizador registado ou premium], [Recarrega, muda de página ou abre outra sessão a meio de uma execução de minutos], [Frontend, `projects`, `ws_gateway`, `video_tool`], [Execução de um vídeo e duas imagens em curso], [Continua a usar a aplicação, vê o progresso, pode cancelar e é avisado do fim], [% de 10 ações concluídas (M2.1); segundos até repor o estado e avisar o fim (M2.2); % de cancelamentos conseguidos (M2.3)],
    [QS-03], [Eficiência — capacidade], [Dois utilizadores], [Um submete a legendagem de um vídeo longo e o outro um efeito num vídeo curto], [`video_tool`, `video_queue`], [Dois trabalhos em simultâneo], [O vídeo curto não espera pelo longo], [Segundos até ao resultado do vídeo curto],
    [QS-04], [Fiabilidade — recuperabilidade], [`video_tool`], [Falha a meio de um lote], [Worker, `projects`], [Operação normal], [O pedido não se perde e não há saída parcial], [Minutos até recuperar; pedidos perdidos],
    [QS-05], [Segurança — autenticidade], [Cliente sem JWT], [Envia 500 MiB à API], [`nginx`, `api_gateway`], [Operação normal], [O pedido é recusado sem ocupar memória], [Código da resposta; acréscimo de memória do gateway, em MiB],
  ),
)

#tab([Priorização dos cenários],
  tabela(
    colunas: (1.4cm, 1fr, 1fr, 1.8cm),
    tamanho: 8.5pt,
    [ID], [Importância para os _stakeholders_], [Dificuldade e risco técnico], [Prioridade],
    [QS-02], [Alta: todos os utilizadores em todas as execuções; contradiz um interesse escrito no documento de base. Base: 0% das ações (EV-14)], [Média: estado no servidor e interface nova, em quatro serviços], [1],
    [QS-01], [Alta: o premium paga pelos ficheiros grandes; a entrada única cai e, com 1000 MiB, cai a instalação inteira (EV-13)], [Média: três serviços e alternativas reais, contido no carregamento], [2],
    [QS-05], [Média: numa instalação local o risco é menor; resolve-se com o QS-01], [Baixa, se tratado no QS-01], [3],
    [QS-03], [Alta para quem legenda, mas só com vários utilizadores ao mesmo tempo], [Alta: réplicas, filas e memória do Whisper; resultados dependentes da máquina], [4],
    [QS-04], [Média: trabalho perdido, raro numa instalação local], [Média: injeção de falhas e idempotência], [5],
  ),
)

== Atributos de qualidade por ordem de prioridade

1. *Usabilidade (operabilidade)*: QS-02, o cenário mais importante, atinge todos os utilizadores.
2. *Eficiência de desempenho (utilização de recursos)*: QS-01; a falha derruba a entrada única.
3. *Segurança (autenticidade)*: QS-05; corrige-se com a mesma decisão do QS-01.
4. *Eficiência de desempenho (capacidade)*: QS-03; importante com vários utilizadores, mas com mais risco técnico.
5. *Fiabilidade (recuperabilidade)*: QS-04; o estado da execução no servidor (QS-02) é um primeiro passo.

== Pré-requisitos e efeitos colaterais entre atributos

#tab([Relações entre atributos],
  tabela(
    colunas: (3cm, 3cm, 2.2cm, 1fr),
    tamanho: 8.5pt,
    [Atributo A], [Atributo B], [Efeito], [Razão e evidência],
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

#tab([Recomendações],
  tabela(
    colunas: (1fr, 3cm, 1.8cm, 1.5cm, 1.8cm),
    tamanho: 8.5pt,
    [Recomendação], [Atributos], [Padrão], [Esforço], [Risco de regressão],
    [Passar os ficheiros em fluxo por todo o caminho de carregamento e verificar o JWT antes de ler o corpo], [Utilização de recursos, segurança, tempo], [Global], [Médio], [Médio],
    [Guardar o estado de cada execução no orquestrador e fazer o vídeo reportar-lhe o progresso; interface que não bloqueia], [Operabilidade, recuperabilidade], [Interação], [Médio], [Médio],
    [Réplicas do `video_tool` e fila própria para a legendagem], [Capacidade], [Vídeo], [Médio a alto], [Médio],
    [Verificar o acesso nas salas do WebSocket e o dono em todas as rotas do `projects`; segredos fora do repositório], [Segurança], [Global], [Médio], [Médio],
    [Recuperar trabalhos interrompidos e repetir mensagens de forma idempotente], [Fiabilidade], [Ambos], [Médio], [Médio],
    [Separar os efeitos de vídeo em módulos partilhados com as ferramentas de imagem], [Manutenibilidade], [Vídeo], [Alto], [Alto],
  ),
)

== Candidatos e escolha

O diagnóstico (`diagnostico.md`) comparou oito candidatos: as cinco ideias das diretrizes e três fragilidades encontradas no código.

#tab([Comparação dos oito candidatos],
  tabela(
    colunas: (0.9cm, 3.2cm, 1fr, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [\#], [Candidato], [Pertinência], [Complexidade técnica], [Facilidade de medir], [Risco para 20/11],
    [C1], [Usabilidade — criação de pipelines], [Média: confusão e erros tardios, sem perda de trabalho], [Baixa a média: quase só frontend], [Baixa: pede participantes, duas vezes], [Médio: fronteira com funcionalidade nova],
    [C2], [Manutenibilidade — modularidade do vídeo], [Média: sentida pela equipa e pela operação], [Alta], [Média: medidas estáticas], [Alto],
    [C3], [Eficiência — elasticidade], [Alta: lotes em série], [Baixa com réplicas fixas; alta com ajuste dinâmico], [Alta, mas dependente da máquina], [Médio a alto],
    [*C4*], [*Usabilidade — trabalho em segundo plano*], [Alta: todos os utilizadores], [Média], [Alta: valores de base extremos], [Médio],
    [*C5*], [*Eficiência — carregamento de ficheiros grandes*], [Alta: premium e entrada única], [Média: três serviços], [Alta: memória e tempo por script], [Baixo a médio],
    [C6], [Segurança], [Alta em produção; menos visível em local], [Média: muitas alterações simples], [Média], [Médio],
    [C7], [Fiabilidade — tolerância a falhas], [Alta: trabalho perdido], [Média], [Alta: injeção de falhas], [Médio],
    [C8], [Eficiência — tempo de processamento], [Baixa: a base já cumpre], [Alta], [Alta], [Alto],
  ),
)

#tab([Candidatos a requisitos não funcionais da Fase 2],
  tabela(
    colunas: (1.4cm, 2.2cm, 2.4cm, 1.7cm, 2.2cm, 2.1cm, 2.2cm, 1fr),
    tamanho: 7.5pt,
    [\#], [ISO/IEC 25010], [Fragilidade na base], [Origem], [Pertinência], [Complexidade], [Escala e método], [Pré-requisitos e efeitos],
    [CAND-1 (RNF-F2-01)], [Eficiência de desempenho — utilização de recursos], [O ficheiro fica inteiro em memória em cada serviço do caminho (EV-13)], [Padrão global], [Alta: o premium não carrega 1 GB e a entrada única cai], [Média a alta: quatro serviços e validação sobre o objeto guardado], [MiB por serviço com `docker stats`; maior ficheiro aceite com 512 MiB], [Efeitos no tempo (C1.1, C1.2), na segurança (C1.3) e na correção (C1.4 a C1.7)],
    [CAND-2 (RNF-F2-02)], [Usabilidade — operabilidade], [Painel que bloqueia e estado só no browser (EV-03, EV-04, EV-14)], [Interação: o vídeo não reporta ao orquestrador], [Alta: todos os utilizadores, todas as execuções], [Média a alta: orquestrador, worker, gateway de WebSocket e frontend], [Script Playwright: ações, tempos de reposição, cancelamentos], [Pré-requisito: estado no servidor. Efeitos no tempo (C2.1), no progresso (C2.2), na segurança (C2.3) e na correção (C2.4, C2.5)],
  ),
)

*Justificação da escolha.* São as duas fragilidades com mais impacto nos _stakeholders_, ambas com evidência no código e já reconhecidas pelas diretrizes e pelo PL1-G4. As duas têm uma escala objetiva, medível por script, e pedem decisões arquiteturais com alternativas reais (por onde passa o ficheiro; quem é dono do estado de uma execução) sem reescrever o pipeline de vídeo. A origem é diferente: o CAND-1 vem do padrão global, por isso o _refactoring_ fica contido no caminho de carregamento; o CAND-2 vem da interação entre os dois padrões, e atravessa o orquestrador, o worker, o `ws_gateway` e a interface, com mais risco de regressão. O par C2 + C3 (separar as legendas e a extração para as escalar à parte) era a alternativa mais ambiciosa, mas juntava os dois riscos mais altos da tabela.

== Esboço de quantificação

#tab([Escala e método de medição dos dois candidatos],
  tabela(
    colunas: (3.2cm, 1fr, 1fr),
    tamanho: 8.5pt,
    [], [CAND-1], [CAND-2],
    [Escala], [Acréscimo de memória de cada serviço durante um envio (MiB); maior ficheiro aceite com memória limitada (MiB)], [% de ações concluídas durante uma execução; segundos até a interface repor o estado e avisar o fim; % de cancelamentos conseguidos depois de perder a página],
    [Cenário], [Um utilizador premium envia um vídeo pela API para um projeto vazio], [Projeto P (um vídeo de 330 s e duas imagens) em processamento; projeto Q de apoio],
    [Carga], [Vídeos de 10, 100, 500 e 1000 MiB, um envio de cada vez], [Uma execução de cada vez; 10 ações, 6 recargas e 3 fins, 10 tentativas de cancelamento],
    [Ambiente], table.cell(colspan: 2)[A mesma máquina, o mesmo Docker e arranque limpo em todas as medições (capítulo 5)],
    [Instrumento], [`docker stats` a cada segundo; _override_ do Compose com 512 MiB por contentor], [Playwright (Chromium), com gravação de cada execução],
    [Base, alvo e mínimo], [Fixados depois da medição inicial (secção 6.2)], [Fixados depois da medição inicial (secção 7.2)],
  ),
)

*Relação entre os dois candidatos.* São independentes: nenhum é condição do outro, e cada um foi especificado, implementado e medido por si. Tocam-se num ponto só, a ação 7 da M2.1, que carrega uma imagem durante uma execução pelo caminho alterado pelo CAND-1. Mexem no mesmo ficheiro do orquestrador (`projects/routes/projects.js`), em zonas diferentes: a receção de media e o processamento. Os efeitos noutros requisitos são os controlos C1.x e C2.x.

*Evidência exploratória.* O diagnóstico foi feito só pela leitura do código, porque a solução ainda não tinha sido lançada nessa máquina. A medição inicial (capítulo 5) mediu os dois candidatos com os scripts que depois serviram para a medição final.

== Conclusões e recomendações

*Adequação do padrão atual.* O padrão global serve o PictuRAS: isola as ferramentas e não faz esperar o cliente. O padrão do vídeo justifica-se pelo custo de codificar, mas afasta-se do global em dois pontos que geram fragilidades: o progresso não passa pelo orquestrador (operabilidade) e não há réplicas (capacidade). No caminho de carregamento, o padrão global foi mal aplicado: cada serviço guarda o ficheiro inteiro antes de o passar ao seguinte.

*Otimizações escolhidas para a Fase 2.* CAND-1 e CAND-2, com as táticas e decisões do capítulo 4.

*Evolução futura*, fora do âmbito por serem outros requisitos: réplicas do `video_tool` e uma fila própria para a legendagem (QS-03); confiança entre serviços e verificação de acesso nas salas do WebSocket (C6, EV-15); recuperação de trabalhos interrompidos (QS-04).

#tab([Riscos para a preservação funcional e mitigação],
  tabela(
    colunas: (1fr, 2.2cm, 1fr, 1fr),
    tamanho: 8.5pt,
    [Risco], [Funcionalidade afetada], [Mitigação], [Teste de regressão],
    [Validar depois de guardar muda as decisões ou as mensagens de validação], [Vídeo (carregamento)], [A mesma ordem de validação; comparar decisões e mensagens com a base], [T03, T04; controlo C1.5],
    [O ficheiro guardado ou o SHA-256 deixam de coincidir], [Imagem e vídeo], [Calcular o SHA-256 pelo caminho, sobre os mesmos bytes], [T02, T03; controlo C1.4],
    [Mudar o destino do progresso do vídeo atrasa ou perde as pré-visualizações], [Vídeo], [O orquestrador reencaminha o mesmo evento], [T08 a T12],
    [Um relatório de progresso atrasado reabre ou faz recuar uma execução], [Imagem e vídeo (processamento)], [Atualizações só sobre execuções `running` com o mesmo _token_, com `$max`], [Testes unitários do `projects`; T16],
    [A interface nova deixa editar ou apagar media durante a execução], [Imagem e vídeo], [Pipeline e media só de leitura enquanto o projeto processa], [U01 a U03; controlo C2.5],
    [O cancelamento deixa de devolver as quotas ou de limpar os resultados], [Imagem e vídeo], [O mesmo caminho de cancelamento, que só passa a fechar a execução], [T16, T17, U03],
  ),
)
