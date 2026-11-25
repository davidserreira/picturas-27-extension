#import "../template.typ": *

= Trade-offs, Medição e Preservação Funcional

== Matriz de efeitos

#paisagem[
#tab([Matriz de efeitos das decisões (↑ melhora, ↓ degrada, = neutro), prevista e confirmada pela medição],
  tabela(
    colunas: (1.6cm, 3.2cm, 3.4cm, 3cm, 2.6cm, 3.2cm, 1fr),
    tamanho: 8.5pt,
    [Decisão], [Desempenho], [Disponibilidade / Fiabilidade], [Segurança], [Usabilidade], [Manutenibilidade / Testabilidade], [Justificação],
    [DA-1], [↑ utilização de recursos e tempo de aceitação], [↑ a entrada única deixa de cair com envios grandes; = armazenamento (risco de órfãos controlado)], [↑ JWT verificado antes de ler o corpo], [\= o frontend não muda], [\= o mesmo número de serviços; ↓ opções do V8 e da glibc a manter], [Medido: M1.1 de 2001 para 56 MiB (500 MiB: 55 MiB); aceitação de 500 MiB de 9 s para menos de 1 s (C1.1); C1.3 de +1006 para +24 MiB; C1.7 sem órfãos. Custo gerido: a afinação do passo 5b ficou documentada no `docker-compose.yaml` e no `AGENTS.md`, que pede para voltar a medir antes de a retirar],
    [DA-2], [\= tempo de processamento (mais escritas e mensagens); ↑ frequência do progresso], [↑ recuperabilidade: o estado sobrevive à página, à sessão e ao reinício do `ws_gateway`], [\= o estado é recusado a terceiros (C2.3); a sala sem verificação (EV-15) foi evitada, não corrigida], [↑ operabilidade], [↑ o vídeo volta a seguir a orquestração central; ↑ testes do cálculo do progresso e das salas], [Medido: M2.1 de 0 para 100%; M2.2 de "não recupera" para menos de 1 s; C2.2 de 16,9 para 2,2 s. Custo gerido: o C2.1 foi comparado com a base na mesma sessão (A-B-A, secção 10.4), sem diferença fora da variação],
  ),
)
]

== Interação entre DA-1 e DA-2

#tab([Interação entre as decisões],
  tabela(
    colunas: (2.2cm, 2.2cm, 4.4cm, 1fr),
    [Decisão A], [Decisão B], [Efeito (pré-requisito, sinergia ou conflito)], [Razão / evidência],
    [DA-1], [DA-2], [Independentes, sem conflito medido], [Nenhuma é pré-requisito da outra. O único ponto de contacto é a ação 7 da M2.1 (carregar uma imagem para Q durante uma execução), que usa o caminho da DA-1. As duas mexem em `projects/routes/projects.js`, em zonas diferentes, e a integração dos dois ramos não teve conflitos de código. Medido com as duas integradas: nenhuma medida principal nem controlo piorou (secção 10.4)],
  ),
)

== Plano de medição

#tab([Plano de medição],
  tabela(
    colunas: (1.4cm, 1fr, 3cm, 3cm, 2.6cm, 2.6cm),
    tamanho: 8pt,
    [Cenário], [Cenário de teste e carga], [Ambiente (máquina, recursos, versões)], [O que se regista], [Repetições e agregação], [Onde ficam os _scripts_ e os dados],
    [QS-01], [Envio pela API de vídeos de 10, 100, 500 e 1000 MiB, um de cada vez; depois, com 512 MiB por contentor; controlos C1.1 a C1.7], [A máquina da secção 2.1; arranque limpo antes de cada série], [Memória de cada contentor a cada segundo; códigos; SHA-256; tempos de aceitação e de envio], [5 por tamanho (M1.1) e 3 (M1.2); máximo e mediana], [`Docs/fase2/medicoes/rnf1/`],
    [QS-02], [Projeto P (vídeo de 330 s e duas imagens) em processamento; 10 ações, 6 recargas, 3 fins, 10 cancelamentos; controlos C2.1 a C2.5], [Igual; Chromium do Playwright 1.55, 1440×900; Node.js 24], [Ações concluídas; segundos até repor o estado e avisar o fim; sucesso de cada cancelamento; um vídeo de cada execução], [3 execuções (M2.1, M2.2) e 10 tentativas (M2.3); pior valor], [`Docs/fase2/medicoes/rnf2/`],
  ),
)

As regras valem para as duas medições, antes e depois:

+ *Mesma máquina e mesmas condições.* A mesma versão do Docker e a mesma memória atribuída, ligada à corrente e sem outras cargas; cada série guarda o seu ambiente em `ambiente.json`.
+ *Versão registada.* Cada resultado guarda o _hash_ do _commit_ medido e as alterações por versionar.
+ *Arranque limpo* antes de cada série (`down -v` e `up --build`), à espera de todos os serviços.
+ *Só se mede por fora:* os _scripts_ usam a interface pública e comandos do Docker, para servirem às duas versões sem depender do código interno.
+ *Dados gerados por _script_* (`gerar-dados.mjs`), de forma determinística, e uma conta premium de teste criada por _script_.

Um requisito fica _cumprido_ se todas as medidas principais atingirem o mínimo, e _com o alvo atingido_ se atingirem o alvo. Os controlos não decidem o cumprimento: um controlo que falhe é um efeito colateral, reportado e analisado.

Além das medições inicial e final, cada passo das duas decisões teve uma medição curta (`medicoes/passos/` e `medicoes/passos-rnf2/`), para atribuir a cada passo o seu efeito. Cada requisito foi medido primeiro no seu ramo e depois com os dois integrados (`medicoes/final/`). Como a velocidade da máquina variou até 40% entre sessões, mais do que a tolerância de 10% dos controlos de tempo, o C2.1 também foi comparado com a base na mesma sessão, em três blocos seguidos: base, versão nova, base (A-B-A). Por fim, dois membros da equipa repetiram uma parte das medições nas suas máquinas (`medicoes/reproducao/`).

== Resultados das medições

#tab([Resultados das medições],
  tabela(
    colunas: (1.4cm, 1fr, 2.3cm, 2.3cm, 2.1cm, 1.7cm, 1.7cm, 1.6cm),
    tamanho: 8pt,
    [Cenário], [Medição (o que se mede, unidade)], [Antes (_baseline_)], [Depois, no seu ramo], [Depois, com os dois integrados], [Valor-alvo], [Mínimo aceitável], [Atingido?],
    [QS-01], [M1.1 — maior acréscimo de memória num serviço com 1000 MiB (MiB)], [Não mensurável: o motor do Docker cai], [56,3 (`img_storage`)], [62,4 (`img_storage`)], [≤ 64], [≤ 128], [Alvo],
    [QS-01], [M1.1 com 500 MiB, referência (MiB)], [2001 (`api_gateway`)], [55,3], [62,9], [—], [—], [—],
    [QS-01], [M1.2 — maior ficheiro aceite com 512 MiB por contentor (MiB)], [100], [1000], [1000], [1000], [500], [Alvo],
    [QS-02], [M2.1 — ações concluídas durante uma execução (%)], [0], [100], [100], [100], [80], [Alvo],
    [QS-02], [M2.2 R — repor o estado depois de recarregar (s, pior)], [Não recupera], [0,63], [0,43], [≤ 2], [≤ 5], [Alvo],
    [QS-02], [M2.2 F — avisar o fim noutra página (s, pior)], [Não recupera], [0,11], [0,12], [≤ 2], [≤ 5], [Alvo],
    [QS-02], [M2.3 — cancelamentos depois de perder a página], [0/10], [12/12], [10/10], [10/10], [5/5 a recarregar], [Alvo],
  ),
)

#tab([QS-01: maior acréscimo por serviço, base → final no seu ramo (MiB)],
  tabela(
    colunas: (2.2cm, 1fr, 1fr, 1fr, 1fr),
    [Ficheiro], [`nginx`], [`api_gateway`], [`projects`], [`img_storage`],
    [10 MiB], [1,2 → 1,0], [35,0 → 7,2], [34,4 → 16,6], [24,0 → 24,4],
    [100 MiB], [7,1 → 9,7], [307,9 → 32,0], [225,0 → 13,4], [206,1 → 55,7],
    [500 MiB], [18,8 → 10,2], [2001,0 → 42,6], [1044,3 → 42,7], [1016,2 → 55,3],
    [1000 MiB], [(≥ 33) → 11,8], [(≥ 3455) → 45,0], [(≥ 1981) → 49,1], [(≥ 282) → 56,3],
  ),
)

#tab([Controlos dos efeitos colaterais],
  tabela(
    colunas: (3.6cm, 2.4cm, 2.8cm, 2.8cm, 1fr),
    tamanho: 8pt,
    [Controlo], [Base], [No seu ramo], [Integrado], [Resultado],
    [C1.1 — aceitação de 500 MiB (mediana)], [8,96 s], [0,84 s], [0,97 s], [Cumpre; passa a cumprir o REQ-VID-SUBMIT-008],
    [C1.2 — envio completo (mediana)], [500 MiB: 10,22 s; 1000 MiB: não mensurável], [500 MiB: 7,03 s; 1000 MiB: 7,58 s], [500 MiB: 6,40 s; 1000 MiB: 7,67 s], [Cumpre],
    [C1.3 — 500 MiB sem JWT], [401; +1006 MiB], [401; +24 MiB], [401; +19,6 MiB], [Cumpre; corrige a falha da base],
    [C1.4 a C1.6 — SHA-256, validação, temporários], [Iguais; 7 decisões; nenhum], [Iguais até 1000 MiB; as mesmas 7 decisões e mensagens; nenhum], [Iguais], [Cumpre],
    [C1.7 — objetos órfãos], [O 409 deixa o ficheiro sem dono (EV-16)], [Nenhum], [Nenhum], [Cumpre; corrige o 409],
    [C2.1 — duração de P (mediana)], [269,3 s], [336,6 s (outra sessão)], [309,6 s (outra sessão)], [Cumpre na mesma sessão: ver A-B-A],
    [C2.2 — maior intervalo do progresso], [16,9 s], [2,22 s], [2,30 s], [Passa a cumprir (≤ 5 s); a base não cumpria],
    [C2.3 — estado pedido por outro utilizador e sem JWT], [Não aplicável], [401 e 401 (dono: 200)], [401 e 401 (dono: 200)], [Cumpre],
    [C2.4, C2.5 — execuções sobrepostas; ferramenta a meio], [Iguais; 201 e iguais], [Iguais; 201 e iguais], [Iguais; 201 e iguais], [Cumpre; pela interface, o pipeline fica só de leitura],
  ),
)

#tab([C2.1 na mesma sessão: blocos A-B-A (A: base `43a2e08`; B: os dois integrados, `eb8a37d`), 19 de novembro],
  tabela(
    colunas: (1.4cm, 2cm, 3cm, 1.5cm, 3cm, 2.3cm, 1fr),
    tamanho: 8pt,
    [Bloco], [Hora], [C2.1 (s)], [Mediana], [Worker (s)], [Fora do worker (s)], [C2.2 (s)],
    [1 — A], [00:08–00:23], [282,1; 289,5; 284,5], [284,5], [279,6; 287,6; 282,9], [2,5; 1,9; 1,6], [17,2; 18,8; 17,6],
    [2 — B], [00:36–00:52], [282,5; 279,7; 346,1], [*282,5*], [280,2; 277,1; 343,9], [2,3; 2,6; 2,2], [2,0; 1,8; 1,9],
    [3 — A], [00:55–01:10], [287,6; 295,8; 285,6], [287,6], [285,6; 293,6; 283,8], [2,0; 2,2; 1,8], [18,3; 18,3; 31,1],
  ),
)

*Análise do RNF-F2-01.* O requisito fica cumprido, com o alvo atingido nas duas medidas principais, no seu ramo e com os dois integrados. A partir de 100 MiB, o acréscimo praticamente não muda com o tamanho do ficheiro (`img_storage`: 55,7, 55,3 e 56,3 MiB), que é o que o enunciado pede. Os controlos melhoraram em vez de piorar: a aceitação de 500 MiB desceu de 9 s para menos de 1 s, porque os serviços passaram a trabalhar em paralelo; o envio sem JWT deixou de ocupar memória; e o ficheiro órfão do 409 desapareceu. Ficou abaixo do previsto a memória dos serviços Node: 42 a 55 MiB com 500 MiB, acima dos menos de 20 a 40 MiB que o ADR-01 previa, porque a previsão só contava com os _buffers_ dos _streams_ e não com a memória que o V8 e a glibc demoram a devolver. A margem para o alvo depende da afinação do passo 5b: sem ela, o valor ficaria entre o alvo e o mínimo. Com os dois integrados, o `img_storage` chegou a 62,4 MiB (entre 49 e 62 MiB nas cinco repetições), o que deixa 1,6 MiB de margem: o código do `img_storage` é o mesmo nas duas versões, e a explicação mais provável é a variação da recolha de memória entre repetições, que o instrumento não confirma. As medidas do RNF-F2-02 não mudaram no ramo do RNF-F2-01.

*Análise do RNF-F2-02.* O requisito fica cumprido, com o alvo atingido nas três medidas principais. As ações dentro de P, que na base ficavam tapadas pelo painel, demoram 0,1 a 0,3 s. O valor mostrado depois de recarregar nunca foi inferior ao de antes, e num dos fins a interface mostrou a conclusão no mesmo instante em que os resultados ficaram disponíveis na API. O `Cancel` apareceu em 0,27 a 1,02 s, nas duas formas. O C2.2, que a base não cumpria (16,9 s), passou para 1,5 a 2,2 s: o progresso mudou 356 a 375 vezes por execução, contra 25 na base. O C2.1 não se compara entre sessões: no ramo, as execuções demoraram 330 a 342 s, mas o tempo fora do worker ficou em 1,6 a 2,3 s, como na base, e na mesma série o mesmo trabalho demorou 240 a 300 s no worker. Na comparação A-B-A, a mediana com os dois integrados (282,5 s) ficou 1,2% abaixo do ponto médio das medianas da base (286,1 s), dentro do limite de 314,7 s. Uma das três execuções de B demorou 346,1 s, com o tempo a mais todo no worker (343,9 s) e 2,2 s fora dele, como nas outras; o instrumento não regista a carga da máquina, por isso a causa fica por confirmar. O tempo fora do worker, onde a DA-2 acrescenta trabalho, foi de 2,2 a 2,6 s em B e de 1,6 a 2,5 s em A, cerca de 0,1% da duração.

*Os dois integrados.* Nenhum requisito piora o outro: as medidas principais dos dois mantêm o alvo atingido, os doze controlos cumprem o limite e a regressão dá os mesmos resultados da base.

#tab([Reprodução noutras máquinas (`medicoes/reproducao/`): M1.1 com 500 MiB, M2.2, M2.3 e regressão, sobre o código do `main`],
  tabela(
    colunas: (3.4cm, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [], [Máquina de medição (oficial, os dois integrados)], [Pedro: Linux, Intel i5-11300H, 15 GB], [Miguel: macOS, Apple M1 Pro, 16 GiB, imagens ARM],
    [M1.1 na base (`api_gateway`)], [2001 MiB], [1694 MiB], [1961 MiB],
    [M1.1 no `main`, serviço pior], [`projects`: 36,0 MiB; `img_storage`: 62,9 MiB], [`projects`: 15, 87 e 77 MiB], [`projects`: 112, 147 e 182 MiB],
    [M2.2 R / F], [0,43 / 0,12 s], [0,44 / 0 s (vídeo de 120 s)], [0,13 / 0 s (vídeo de 330 s)],
    [M2.3], [10/10], [2/2], [2/2],
    [Regressão], [75/75, 19/19, 18/18, 3/3], [75/75, 19/19, 18/18, 3/3], [75/75, 19/19, 16/18 (T05 e T06 diferentes da referência), 3/3],
  ),
)

*Análise das reproduções.* As duas reproduções confirmam a melhoria: na base, o `api_gateway` sobe 1694 a 1961 MiB com 500 MiB, e no código do `main` nenhum serviço do critério passa de 182 MiB; o estado é reposto em menos de 0,5 s, e os cancelamentos foram conseguidos em todas as tentativas. Mas *a margem da M1.1 não se repete noutras máquinas*. O `projects` ficou acima do alvo de 64 MiB nas duas, e na do Miguel acima do mínimo de 128 MiB em duas das três repetições. Na máquina de medição, o mesmo serviço ficou nos 36,0 MiB. *H-05*: a diferença vem da memória que o V8 e a glibc demoram a devolver (a causa da afinação do passo 5b), que depende da plataforma (Linux nativo, macOS com imagens ARM, WSL 2); não verificado. Como as reproduções só mediram 500 MiB, não mostram se nessas máquinas o acréscimo depende do tamanho do ficheiro. Os resultados em bruto e as notas estão em `medicoes/reproducao/pedro/` e `medicoes/reproducao/miguel/`. Na máquina do Pedro, o `projects` ficou entre o alvo e o mínimo em duas repetições; a M2.2 usou o vídeo de 120 s, e o fim em 0 s só diz que o aviso foi visto o mais tardar quando a API deu o resultado (as diferenças negativas contam como zero). Na máquina do Miguel, a M2.2 com o vídeo de 120 s do primeiro _script_ deu "não recupera": a execução acabou antes das recargas, por ser mais rápida do que a calibração. É uma falha do instrumento, e não da aplicação; repetida com o vídeo de 330 s das séries oficiais, deu 0,13 s, e o _script_ foi corrigido. A diferença do ponta a ponta trata-se na secção 10.5.

*Ameaças à validade.*
- *Uma só máquina para as séries oficiais.* As reproduções mostram que a margem da M1.1 depende da máquina; o resultado "alvo atingido" vale para a máquina de medição.
- *Tempos entre sessões.* A velocidade variou até 40% entre sessões; só a comparação A-B-A, na mesma sessão, é válida para o C2.1. Mesmo dentro de um bloco, uma execução ficou 21% acima, sem mudar a mediana.
- *Instrumento.* A memória do SeaweedFS (fora do critério) não distingue o processo da cache de páginas. Quatro falhas do instrumento ficaram registadas, e não foram descartadas: um `ECONNRESET` do Docker Desktop, a conversão de caminhos do Git Bash no C2.3, uma barra de progresso que desaparece no fim (A-B-A) e o vídeo curto na reprodução.
- *O que não se mediu.* Envios em simultâneo (o mínimo da M1.1 assume três, mas por cálculo) e a usabilidade com utilizadores reais (o RNF-F2-02 foi medido por _script_).

== Preservação funcional

A suite de regressão (`Docs/fase2/regressao/`) correu na base antes de qualquer alteração, em cada passo das duas decisões e no fim, com os dois integrados. Os testes que o repositório já tinha não passam pelo gateway, pelo armazenamento nem pela interface, que são as partes alteradas; por isso a equipa acrescentou 18 testes ponta a ponta (T01–T18), pelo nginx, pela API e pelo WebSocket, e 3 de interface (U01–U03). Cada teste ponta a ponta guarda uma impressão do resultado (SHA-256 dos ficheiros, durações, resoluções, codec, som, fotogramas e mensagens de recusa); uma versão só preserva a funcionalidade se der as mesmas impressões da base. Duas corridas na base deram impressões iguais.

#pagebreak(weak: true)
#tab([Preservação funcional e testes de regressão],
  tabela(
    colunas: (2.6cm, 3.6cm, 3cm, 3.4cm, 1fr),
    tamanho: 8pt,
    [Zona alterada], [Testes de regressão existentes (`Tools/video/tests`, `projects/tests`, …)], [Lacunas de teste], [Testes acrescentados], [Resultado (imagem e vídeo)],
    [DA-1: receção de media no nginx, no `api_gateway`, no `projects` e no `img_storage`], [`projects/tests` (8), sem o carregamento], [Nenhum teste passava pelo gateway, pelo armazenamento nem pela validação real], [Ponta a ponta T02–T04 e T14; unitários do `img_storage` (4), do `api_gateway` (6) e do `projects` (5); controlos C1.4 a C1.7], [Base 74/74, 8/8, 18/18, 3/3; no ramo 74/74, 13/13, 18/18, 3/3, com as mesmas impressões],
    [DA-2: processamento no `projects`, `video_tool`, `ws_gateway` e frontend], [`Tools/video/tests` (74); `projects/tests` (8)], [Nenhum teste do frontend, das rotas com MongoDB e RabbitMQ, nem do `ws_gateway`], [Ponta a ponta T05–T17; interface U01–U03; unitários do progresso (6), da cadência do worker (1) e das salas do `ws_gateway` (3); controlos C2.3 a C2.5], [No ramo 75/75, 14/14, 18/18, 3/3; com os dois integrados 75/75, 19/19, 18/18, 3/3, com as mesmas impressões],
  ),
)

#tab([Riscos para a preservação funcional e mitigação],
  tabela(
    colunas: (3.6cm, 2.6cm, 1fr, 3cm),
    tamanho: 8.5pt,
    [Risco], [Funcionalidade afetada (imagem / vídeo)], [Mitigação], [Teste de regressão],
    [Validar depois de guardar muda as decisões ou as mensagens de validação], [Vídeo (carregamento)], [A mesma ordem de validação; decisões e mensagens comparadas com a base], [T03, T04; C1.5],
    [O ficheiro guardado ou o SHA-256 deixam de coincidir], [Imagem e vídeo], [SHA-256 calculado pelo caminho, sobre os mesmos bytes], [T02, T03; C1.4],
    [Mudar o destino do progresso do vídeo atrasa ou perde as pré-visualizações], [Vídeo], [O orquestrador reencaminha o mesmo evento `video-progress`], [T08 a T12],
    [Um relatório de progresso atrasado reabre ou faz recuar uma execução], [Imagem e vídeo (processamento)], [Atualizações só sobre execuções `running` com o mesmo _token_, com `$max`], [Unitários do `projects`; T16],
    [A interface nova deixa editar ou apagar media durante a execução], [Imagem e vídeo], [Pipeline e media só de leitura enquanto o projeto processa], [U01 a U03; C2.5],
    [O cancelamento deixa de devolver as quotas ou de limpar os resultados], [Imagem e vídeo], [O mesmo caminho de cancelamento, que só passa a fechar a execução], [T16, T17, U03],
  ),
)

A interface mudou, por ser o objeto da melhoria, mas os testes de interface da base continuaram a passar sem alterações: o U03 procura um botão cujo nome contenha "cancel", que passou do painel para a faixa da página do projeto. Nas reproduções, a máquina do Pedro deu os mesmos resultados. Na do Miguel, o T05 e o T06 deram impressões diferentes da referência só no SHA-256 de imagens, com o mesmo código. *H-06*: a diferença vem da compressão PNG das imagens Docker ARM, e não do código, porque numa máquina Intel o mesmo código dá as impressões da referência; não verificado. Fica como limite da comparação por SHA-256: as impressões só são comparáveis entre máquinas da mesma arquitetura.
