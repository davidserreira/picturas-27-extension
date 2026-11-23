#import "../template.typ": *

#paisagem[
= Candidatos a Requisitos Não Funcionais

O estudo da base (`Docs/fase2/diagnostico.md`) comparou oito candidatos: as seis ideias das diretrizes (C1 a C6) e duas fragilidades encontradas no código (C7 e C8). Os dois escolhidos correspondem aos dois cenários mais prioritários do capítulo 5 (QS-02 e QS-01).

#tab([Comparação dos oito candidatos estudados],
  tabela(
    colunas: (0.9cm, 4.4cm, 1fr, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [\#], [Candidato], [Pertinência], [Complexidade técnica], [Facilidade de medir], [Risco para o prazo],
    [C1], [Usabilidade — criação de pipelines], [Média: confusão e erros tardios, sem perda de trabalho], [Baixa a média: quase só frontend], [Baixa: pede participantes, duas vezes], [Médio: fronteira com funcionalidade nova],
    [C2], [Manutenibilidade — modularidade do vídeo], [Média: sentida pela equipa e pela operação], [Alta], [Média: medidas estáticas], [Alto],
    [C3], [Eficiência — elasticidade], [Alta: lotes em série], [Baixa com réplicas fixas; alta com ajuste dinâmico], [Alta, mas dependente da máquina], [Médio a alto],
    [*C4*], [*Usabilidade — trabalho em segundo plano*], [Alta: todos os utilizadores], [Média], [Alta: valores de base extremos], [Médio],
    [*C5*], [*Eficiência — carregamento de ficheiros grandes*], [Alta: premium e entrada única], [Média: três serviços], [Alta: memória e tempo por _script_], [Baixo a médio],
    [C6], [Segurança], [Alta em produção; menos visível em local], [Média: muitas alterações simples], [Média], [Médio],
    [C7], [Fiabilidade — tolerância a falhas], [Alta: trabalho perdido], [Média], [Alta: injeção de falhas], [Médio],
    [C8], [Eficiência — tempo de processamento], [Baixa: a base já cumpre], [Alta], [Alta], [Alto],
  ),
)

#tab([Candidatos a requisitos não funcionais da Fase 2],
  tabela(
    colunas: (1.6cm, 2.6cm, 3cm, 2.4cm, 2.8cm, 2.6cm, 1.8cm, 3.2cm, 1fr),
    tamanho: 7.5pt,
    [\#], [Característica / subcaracterística (ISO/IEC 25010)], [Fragilidade na base (evidência)], [Origem (padrão global / vídeo / interação)], [Impacto nos stakeholders (pertinência)], [Exigência técnica (complexidade)], [Cenário (`QS-nn`, cap. 5)], [Escala e método de medição (esboço)], [Pré-requisitos / efeitos colaterais],
    [CAND-1 (RNF-F2-01)], [Eficiência de desempenho — utilização de recursos], [O ficheiro fica inteiro em memória em cada serviço do caminho de carregamento (EV-13)], [Padrão global], [Alta: o premium não consegue carregar 1 GB e a entrada única cai para todos], [Média a alta: quatro serviços e validação sobre o objeto guardado], [QS-01], [MiB por serviço com `docker stats`; maior ficheiro aceite com 512 MiB por contentor], [Efeitos no tempo de envio (C1.1, C1.2), na segurança (C1.3) e na correção (C1.4 a C1.7)],
    [CAND-2 (RNF-F2-02)], [Usabilidade — operabilidade], [Painel que bloqueia e estado só no browser (EV-03, EV-04, EV-14)], [Interação: o vídeo não reporta o progresso ao orquestrador], [Alta: todos os utilizadores, em todas as execuções], [Média a alta: orquestrador, worker, gateway de WebSocket e frontend], [QS-02], [_Script_ Playwright: ações concluídas, tempos até repor o estado, cancelamentos], [Pré-requisito: estado no servidor. Efeitos no tempo (C2.1), no progresso (C2.2), na segurança (C2.3) e na correção (C2.4, C2.5)],
  ),
)

*Porquê estes dois.* São as duas fragilidades com mais impacto nos _stakeholders_, ambas com evidência no código e já apontadas pelas diretrizes e pelo PL1-G4. As duas têm uma escala objetiva, medível por _script_, e pedem decisões com alternativas reais (por onde passam os bytes; quem é dono do estado de uma execução) sem reescrever o processamento de vídeo. O par C2 + C3 (separar as legendas e a extração para as escalar à parte) era a alternativa mais ambiciosa, mas juntava os dois riscos mais altos da tabela.

== Quantificação

*Enunciados.* *RNF-F2-01:* ao receber um ficheiro de media de qualquer tamanho até ao limite do perfil de quem o carrega (1 GB no premium), o sistema mantém o acréscimo de memória de cada serviço que o ficheiro atravessa abaixo de um valor fixo, que não depende do tamanho do ficheiro. *RNF-F2-02:* enquanto um projeto é processado, o sistema permite continuar a usar a aplicação sem deixar de acompanhar essa execução, e acompanhá-la e cancelá-la depois de recarregar a página.

#tab([Quantificação dos requisitos não funcionais],
  tabela(
    colunas: (3.6cm, 1fr, 1fr),
    tamanho: 8pt,
    [], [CAND-1 (RNF-F2-01)], [CAND-2 (RNF-F2-02)],
    [Escala (o que se mede e em que unidade)], [*M1.1*: acréscimo de memória de cada contentor durante um envio, em MiB (o maior valor entre o início do envio e a resposta, menos o valor em repouso imediatamente antes). *M1.2*: maior ficheiro, em MiB, carregado com sucesso nas 3 repetições com 512 MiB por contentor], [*M2.1*: % de 10 ações concluídas durante uma execução. *M2.2*: segundos até a interface repor o estado depois de recarregar (R) e avisar o fim com o utilizador noutra página (F). *M2.3*: cancelamentos conseguidos depois de perder a página, em 10 tentativas],
    [Cenário de medição], [Um utilizador premium envia um vídeo MP4 (H.264, 1280×720) para um projeto vazio, pela API, com JWT válido], [Projeto P (um vídeo de 330 s e duas imagens, com brilho e contraste) em processamento; projeto Q de apoio. As ações, as recargas e os cancelamentos são feitos no browser, como um utilizador],
    [Carga], [Um envio de cada vez; 10, 100, 500 e 1000 MiB; 5 repetições (M1.1) e 3 (M1.2) por tamanho], [Uma execução de cada vez; 3 execuções (M2.1, M2.2), 10 tentativas de cancelamento (5 a recarregar, 5 noutra sessão)],
    [Ambiente], table.cell(colspan: 2)[A máquina da secção 2.1, com o mesmo Docker, ligada à corrente, sem outras cargas e com um arranque limpo antes de cada série],
    [Instrumento], [`docker stats` a cada segundo (`medicoes/rnf1/medir-memoria.mjs`); _override_ do Compose com 512 MiB por contentor (`medir-limite.mjs`)], [Playwright com Chromium, 1440×900, com gravação de cada execução (`medicoes/rnf2/medir.mjs`)],
    [Valor medido na base], [M1.1: *não mensurável* com 1000 MiB (o motor do Docker cai); 2001 MiB com 500 MiB, no `api_gateway`. M1.2: *100 MiB*], [M2.1: *0%*. M2.2: *não recupera* (6/6 recargas e 3/3 fins). M2.3: *0/10*],
    [Valor-alvo (e origem)], [M1.1 ≤ 64 MiB: o envio em partes ao S3 que a base já usa (4 partes de 5 MiB, 20 MiB) com uma folga de cerca de três vezes. M1.2 = 1000 MiB: o limite do perfil premium], [M2.1 = 100%: a ideia das diretrizes e o interesse do utilizador (Tabela 2 do PL1-G4). M2.2 ≤ 2 s: alvo do REQ-VID-STATUS-003. M2.3 = 10/10],
    [Valor mínimo aceitável (e origem)], [M1.1 ≤ 128 MiB: o maior acréscimo que deixa um serviço de 512 MiB receber três envios em simultâneo. M1.2 = 500 MiB: o critério de aceitação do REQ-VID-SUBMIT-008 (Tabela 30)], [M2.1 ≥ 80%, com as 6 ações fora de P concluídas. M2.2 ≤ 5 s: mínimo do REQ-VID-STATUS-003. M2.3: 5/5 a recarregar, o caso que as diretrizes nomeiam],
  ),
)

O SeaweedFS é medido, mas fica fora do critério da M1.1, por ser de terceiros. Os 512 MiB por contentor são o escalão logo acima da média que o README da base implica (8 GB para cerca de 25 contentores). Na M2.1, uma ação conta se o resultado aparece em 10 s ou menos (o limite da atenção numa tarefa, segundo Nielsen, _Usability Engineering_, 1993) e o progresso de P continua visível. Na M2.3, um cancelamento conta se é oferecido em 10 s, se P deixa de processar em 5 s e se os resultados ficam iguais aos de antes. Ficam fora do âmbito a indicação de progresso do envio (outra melhoria, de usabilidade), os envios em simultâneo e notificações fora da aplicação.

#tab([Controlos dos efeitos colaterais],
  tabela(
    colunas: (1.4cm, 6cm, 1fr, 4.6cm),
    tamanho: 8pt,
    [ID], [O que se controla], [Como se mede], [Limite],
    [C1.1], [Tempo de aceitação (REQ-VID-SUBMIT-008)], [Do último byte enviado à resposta, com 10 e 500 MiB, mediana de 5], [≤ base + 10%],
    [C1.2], [Tempo do envio completo], [Envio de 1000 MiB, mediana de 5 (500 MiB como referência)], [≤ base + 10%],
    [C1.3], [Envio de 500 MiB sem JWT], [Código da resposta e acréscimo de memória do `api_gateway`, pelo método da M1.1], [401 e dentro do mínimo da M1.1],
    [C1.4], [Ficheiro guardado igual ao enviado], [SHA-256 do ficheiro devolvido, nos quatro tamanhos], [Iguais em todos],
    [C1.5], [Decisões e mensagens de validação], [Aceitação ou recusa, e mensagem, para os ficheiros de `samples/video/`, um acima do limite do perfil e um que não é vídeo (7 casos)], [As mesmas decisões e mensagens da base],
    [C1.6], [Ficheiros temporários deixados nos serviços], [Ficheiros temporários depois de um envio concluído e de um interrompido a meio], [Zero em ambos],
    [C1.7], [Objetos órfãos no armazenamento (acrescentado com o ADR-01)], [Objetos em `src/` de cada projeto, lidos no SeaweedFS, depois dos casos do C1.5, de um envio com versão antiga (409) e de um envio interrompido], [Sem órfãos nem envios em partes abertos],
    [C2.1], [Duração da execução de P], [Do pedido à disponibilidade dos resultados na API, mediana de 3], [≤ base + 10% na mesma sessão],
    [C2.2], [Maior intervalo entre mudanças do progresso mostrado], [Lido no browser durante a execução], [≤ 5 s (REQ-VID-STATUS-003)],
    [C2.3], [Estado da execução pedido por outro utilizador e sem JWT (REQ-VID-ACCESS-001)], [Código da resposta da rota de estado], [Recusado nos dois casos],
    [C2.4], [Resultados com execuções sobrepostas (P e Q)], [Número, tipo e conteúdo dos resultados, comparados com execuções separadas], [Iguais],
    [C2.5], [Ferramenta acrescentada a P a meio da execução], [Resposta e resultados da execução em curso], [Impedida, ou aceite sem mudar os resultados; sempre o mesmo, sem erro],
  ),
)

== Relação entre os dois candidatos

São independentes: nenhum é condição do outro, e cada um foi especificado, implementado e medido por si, no seu ramo, antes de serem medidos juntos. Tocam-se num ponto: a ação 7 da M2.1 carrega uma imagem durante uma execução, pelo caminho alterado pelo CAND-1. Mexem no mesmo ficheiro do orquestrador (`projects/routes/projects.js`), em zonas diferentes: a receção de media e o processamento. O CAND-1 pode afetar o tempo de envio, a autenticação e a correção do armazenamento (C1.1 a C1.7); o CAND-2 pode afetar o tempo de processamento, a confidencialidade do estado e os resultados (C2.1 a C2.5). Os controlos de cada um são medidos também na série do outro e na série com os dois integrados.

== Evidência exploratória (se existir)

O diagnóstico foi feito pela leitura do código, antes de a solução ser lançada na máquina de medição. A medição inicial correu depois, com os _scripts_ que serviram também para a medição final.

#tab([Evidência exploratória],
  tabela(
    colunas: (6cm, 6.5cm, 1fr),
    [Descrição], [Localização (_scripts_, dados, resultados)], [Como repetir],
    [Queda do motor do Docker com um envio de 1000 MiB na base (primeira série, 16 de novembro)], [`Docs/fase2/medicoes/ocorrencias/2026-11-16-queda-docker/`, com os registos do Docker], [Arranque limpo da base e `medicoes/rnf1/medir-memoria.mjs --sizes 1000` (anexo A.1). Deita abaixo o Docker],
    [Medição inicial completa dos dois candidatos], [`Docs/fase2/medicoes/baseline/` (`resumo.md`, JSON em bruto, `ambiente.json`)], [`MEDICAO=baseline ./correr-tudo.sh` sobre `43a2e08` (anexo A.1)],
  ),
)
]
