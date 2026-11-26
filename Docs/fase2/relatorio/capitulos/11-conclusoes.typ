#import "../template.typ": *

= Conclusões e Recomendações

== Adequação do padrão atual (global e do vídeo)

O padrão global serve o PictuRAS: isola as falhas de cada ferramenta, escala por serviço e não faz esperar o cliente. O padrão do vídeo justifica-se pelo custo de codificar, e nenhuma das alternativas o melhorava sem perder tempo de processamento. As duas fragilidades escolhidas não pediam outro padrão, e sim corrigir a forma como os padrões estavam aplicados. No carregamento, o padrão global estava mal aplicado: cada serviço guardava o ficheiro inteiro antes de o passar ao seguinte. No progresso do vídeo, o padrão do vídeo afastava-se da orquestração central sem necessidade. As duas decisões corrigiram isso dentro dos padrões existentes: o carregamento passou a ser em fluxo, e o vídeo voltou a reportar ao orquestrador.

== Sugestões de otimização

Os dois requisitos ficaram cumpridos, com o alvo atingido em todas as medidas principais na máquina de medição, cada um no seu ramo e com os dois integrados. A aceitação de um envio de 500 MiB passou de 9 s para menos de 1 s, e o maior intervalo sem o progresso mudar passou de 17 s para 2 s. A regressão deu os mesmos resultados da base em cada passo e no fim. As otimizações seguintes, por ordem de prioridade, são:

+ *Margem de memória do RNF-F2-01 noutras máquinas.* É o ponto mais fraco do resultado: o alvo foi atingido na máquina de medição, mas noutras duas o `projects` ficou acima do alvo, e numa delas acima do mínimo. No Mac, a medição com os quatro tamanhos mostrou que o acréscimo continua fixo (não acompanha o ficheiro) e que limitar o _heap_ antigo do V8 não o baixa. O passo seguinte é medir a memória por processo dentro do contentor (`node` e `ffprobe`) e a cache de páginas, e só depois afinar por plataforma.
+ *Capacidade do vídeo* (QS-03, ALT-1): réplicas do `video_tool` e uma fila própria para a legendagem, para um vídeo curto não esperar por uma legendagem longa. Com o estado da execução já no orquestrador, o cancelamento passa a poder parar o trabalho no worker.
+ *Segurança*: verificar o acesso na sala `project:<id>` do WebSocket (EV-15), que a DA-2 contornou mas não corrigiu, e a confiança entre serviços.

== Considerações para evolução futura

A DA-2 é um primeiro passo para a recuperabilidade (QS-04): o estado da execução já vive no servidor, mas uma execução cujo worker morra a meio continua a aparecer "em curso". Recuperar trabalhos interrompidos e repetir mensagens de forma idempotente fica para outro requisito. A modularidade do vídeo (efeitos de imagem duplicados no worker) mantém-se: separá-la em módulos partilhados com as ferramentas de imagem é a parte da ALT-2 que não custa tempo de processamento.

== Trabalho futuro

Ficou por fazer, e porquê:

- *Confirmar a causa da variação da M1.1 entre máquinas* (H-05): no Mac o patamar não depende do tamanho do ficheiro nem do limite do _heap_ antigo do V8, mas o instrumento (`docker stats`) não separa os processos do contentor nem a cache de páginas.
- *Confirmar a causa das diferenças de SHA-256 em ARM* (H-06), e decidir se a comparação de impressões deve ser feita por arquitetura.
- *Medir os envios em simultâneo*: o mínimo da M1.1 assume três envios, mas por cálculo.
- *Avaliar a usabilidade com utilizadores reais*: o RNF-F2-02 foi medido por _script_.
- *Verificar a H-04* com injeção de falhas no worker.

*Ligação à Fase 3.* As duas decisões facilitam a integração de funcionalidades novas. Uma funcionalidade que acrescente efeitos ou formatos de vídeo maiores herda um carregamento que já não depende do tamanho do ficheiro. Uma que acrescente tipos de execução (por exemplo, processamento agendado ou partilhado) tem um estado de execução no servidor, com eventos e rotas de leitura, sobre o qual construir em vez de o reinventar no browser. O que não facilitam é a capacidade: um vídeo de cada vez continua a ser o limite do sistema.
