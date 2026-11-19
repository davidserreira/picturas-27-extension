#import "../template.typ": *

= Os dois requisitos juntos

Cada requisito foi medido primeiro no seu ramo, isolado. Este capítulo verifica, com os dois integrados, que nenhum piora o outro (`requisitos-nf.md`, 4.3), e faz a comparação dos tempos com a base na mesma sessão, que as séries isoladas não permitiam.

== Integração

O ramo `fase2/integracao` junta os dois ramos a partir do RNF-F2-01. Na primeira junção houve três conflitos, todos em documentos (`AGENTS.md`, `ia.md`, `medicoes/README.md`), resolvidos mantendo o conteúdo dos dois lados. Na segunda, que trouxe a medição final do RNF-F2-02, houve um conflito no cabeçalho de um script de medição (as opções `--so c21` e `--so c23`). O código juntou-se sem conflitos: os dois ADR mexem em `projects/routes/projects.js`, mas em zonas diferentes (a receção de media e o processamento), como o ADR-02 previa (secção 4.4).

== Medição conjunta

Commit `eb8a37d`, a partir das 21:54 de 18 de novembro, com o procedimento da medição inicial (`medicoes/final/integrado/`). A série inclui a M1.1 e o C1.4 com 1000 MiB, que a série do RNF-F2-02 não podia repetir. Depois da série correram a regressão, de um arranque limpo, e três blocos A-B-A do C2.1 e do C2.2: A é a base (`43a2e08`) e B este ramo, cada bloco com o seu arranque limpo.

#tab([Medidas principais: base, cada requisito isolado e os dois integrados],
  tabela(
    colunas: (3.2cm, 2.2cm, 2.6cm, 2.6cm, 1.6cm, 1fr),
    tamanho: 8.5pt,
    [Medida], [Base], [Isolado], [Integrado], [Alvo], [Resultado],
    [M1.1 (1000 MiB)], [Não mensurável], [56,3 MiB], [*62,4 MiB*], [≤ 64 MiB], [*Alvo atingido*],
    [M1.2], [100 MiB], [1000 MiB], [*1000 MiB*], [1000 MiB], [*Alvo atingido*],
    [M2.1], [0%], [100%], [*100%*], [100%], [*Alvo atingido*],
    [M2.2 R], [Não recupera], [0,63 s], [*0,43 s*], [≤ 2 s], [*Alvo atingido*],
    [M2.2 F], [Não recupera], [0,11 s], [*0,12 s*], [≤ 2 s], [*Alvo atingido*],
    [M2.3], [0/10], [12/12], [*10/10*], [10/10], [*Alvo atingido*],
  ),
)

*Nenhum requisito piora o outro nas medidas principais.* A única diferença com algum peso é a margem da M1.1: o `img_storage` subiu até 62,4 MiB com 1000 MiB (entre 49 e 62 MiB nas cinco repetições), contra 56,3 MiB no ramo isolado. O código do `img_storage` é o mesmo nas duas versões, e a explicação mais provável é a recolha de memória do V8, que varia de repetição para repetição; o instrumento não o confirma. Com 1,6 MiB de margem, uma repetição desfavorável pode passar o alvo, embora longe do mínimo de 128 MiB.

#tab([Controlos com os dois requisitos integrados],
  tabela(
    colunas: (3.4cm, 2.2cm, 2.6cm, 2.6cm, 1fr),
    tamanho: 8pt,
    [Controlo], [Base], [Isolado], [Integrado], [Resultado],
    [C1.1 — aceitação de 500 MiB], [8,96 s], [0,84 s], [0,97 s], [Cumpre],
    [C1.2 — envio de 1000 MiB], [Não mensurável], [7,58 s], [7,67 s], [Cumpre],
    [C1.3 — sem JWT], [+1006 MiB], [+24 MiB], [+19,6 MiB], [Cumpre],
    [C1.4 a C1.7], [—], [Cumprem], [Cumprem: SHA-256 iguais, as mesmas 7 decisões, sem temporários nem órfãos], [Cumpre],
    [C2.1 — duração de P], [269,3 s], [336,6 s], [309,6 s], [Cumpre na mesma sessão (A-B-A)],
    [C2.2 — maior intervalo do progresso], [16,9 s], [2,22 s], [2,30 s], [Cumpre],
    [C2.3 a C2.5], [—], [Cumprem], [Cumprem: estado recusado a terceiros; resultados iguais], [Cumpre],
  ),
)

== Comparação A-B-A do C2.1

Dos controlos de tempo, o C2.1 é o único perto do limite. O C1.1 e o C1.2 ficaram muito abaixo da base, mas o C2.1 fica perto dela, e entre sessões a mesma versão variou mais do que a tolerância de 10%. Por isso, a comparação com a base foi feita na mesma sessão, em três blocos seguidos: A (a base, `43a2e08`), B (este ramo, `eb8a37d`) e A outra vez. Cada bloco partiu de um arranque limpo e correu três execuções de P com o vídeo de 330 s. O tempo do worker é o que o `video_tool` regista no fim de cada vídeo.

#tab([Blocos A-B-A, 19 de novembro (`medicoes/final/integrado/ab/`)],
  tabela(
    colunas: (1.3cm, 1.9cm, 2.9cm, 1.4cm, 2.9cm, 2.2cm, 1fr),
    tamanho: 8pt,
    [Bloco], [Hora], [C2.1 (s)], [Mediana], [Worker (s)], [Fora do worker (s)], [C2.2 (s)],
    [1 — A], [00:08–00:23], [282,1; 289,5; 284,5], [284,5], [279,6; 287,6; 282,9], [2,5; 1,9; 1,6], [17,2; 18,8; 17,6],
    [2 — B], [00:36–00:52], [282,5; 279,7; 346,1], [*282,5*], [280,2; 277,1; 343,9], [2,3; 2,6; 2,2], [2,0; 1,8; 1,9],
    [3 — A], [00:55–01:10], [287,6; 295,8; 285,6], [287,6], [285,6; 293,6; 283,8], [2,0; 2,2; 1,8], [18,3; 18,3; 31,1],
  ),
)

*O C2.1 cumpre o limite.* A mediana de B fica 1,2% abaixo do ponto médio das medianas de A (286,1 s), e o limite (base + 10%) é 314,7 s. Mesmo com as médias, que contam a execução mais lenta, B fica 5,3% acima de A.

A terceira execução de B (346,1 s) ficou 21% acima de A. O tempo a mais esteve todo no worker (343,9 s, contra 277 a 280 s nas outras duas de B); fora dele foram 2,2 s, como nas restantes. O worker de B só difere do de A nos relatórios de progresso. Um atraso sistemático causado por eles apareceria nas três execuções, e as outras duas de B estão entre as três mais rápidas das nove. O instrumento não regista a carga da máquina nem a do RabbitMQ, por isso a causa desta execução fica por confirmar.

O tempo fora do worker é onde o ADR-02 acrescenta trabalho (as escritas da execução no MongoDB e os eventos `run-status`): 2,2 a 2,6 s em B e 1,6 a 2,5 s em A, 0,4 s a mais em média, cerca de 0,1% da duração de P. O C2.2 confirma na mesma sessão o resultado da série: cerca de 2 s em B, contra 17 a 31 s em A.

A primeira tentativa do bloco 2 parou no fim da primeira execução, por uma falha do instrumento: a execução acabou, a interface retirou a barra de progresso, como devia, e o script esperou 30 s por ela. O script passou a tratar uma barra que desaparece como "sem barra", e os blocos 2 e 3 foram repetidos seguidos. A tentativa falhada ficou guardada com os resultados.

== Preservação funcional

#tab([Regressão com os dois requisitos integrados (`regressao/final.md`)],
  tabela(
    colunas: (4cm, 1fr, 1fr),
    [Suite], [Base], [Integrado],
    [Worker de vídeo (pytest)], [74/74], [75/75],
    [Orquestrador (`node --test`)], [8/8], [19/19: os 8 da base, 5 do RNF-F2-01 e 6 do RNF-F2-02],
    [Ponta a ponta (T01–T18)], [18/18], [18/18, todos com a mesma impressão da base],
    [Interface (U01–U03)], [3/3], [3/3],
  ),
)

A funcionalidade existente de imagem e de vídeo mantém-se com os dois requisitos juntos: os mesmos testes passam, e os 18 testes ponta a ponta produzem as mesmas impressões da base (SHA-256 das imagens, duração, resolução, codec e som dos vídeos, fotogramas extraídos, códigos e mensagens de recusa).
