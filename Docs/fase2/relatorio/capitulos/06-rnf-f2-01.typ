#import "../template.typ": *

= RNF-F2-01 — Carregamento de ficheiros grandes com memória limitada

== Diagnóstico

Na base, um ficheiro carregado fica inteiro em memória em três serviços seguidos, e o nginx também o guarda antes de o passar:

#tab([Por onde passa um vídeo carregado na base],
  tabela(
    colunas: (2.6cm, 1fr, 1fr),
    [Serviço], [Evidência], [Efeito],
    [`nginx`], [`nginx/nginx.conf:13` (`client_max_body_size 1100m`)], [Guarda o corpo antes de o passar],
    [`api_gateway`], [`apiGateway/routes/projects.js:23-24` (`multer.memoryStorage()` sem limites) e `467` (reenvia `req.file.buffer`)], [Cópia integral em memória],
    [`projects`], [`projects/routes/projects.js:72-73`, `1309-1343`; `projects/utils/video.js:86`], [Cópia integral em memória, mais uma cópia em disco para o `ffprobe` e o SHA-256 calculado sobre o buffer],
    [`img_storage`], [`imageStorageService/route/upload.js:6`, `services/uploadImage.js:15`], [Cópia integral em memória antes de enviar para o S3],
  ),
)

Há ainda duas consequências. O limite de tamanho do perfil só é verificado no `projects`, depois de o ficheiro ter atravessado o nginx e o gateway. E, no gateway, o `multer` corre antes de verificar o JWT, pelo que um pedido sem autenticação faz o gateway guardar em memória até 1,1 GB antes de ser recusado.

*Impacto.* O perfil premium paga pelos ficheiros grandes, e é com eles que a base falha. Como o `api_gateway` é a entrada única, quando fica sem memória todos os utilizadores perdem o acesso, e não só quem carregou. Para a operação, a memória necessária cresce com o tamanho do ficheiro e com o número de envios em simultâneo.

#tab([Cenário de fragilidade e cenário de qualidade do RNF-F2-01],
  tabela(
    colunas: (3.2cm, 1fr, 1fr),
    [Parte], [Na base (fragilidade)], [Pretendido (qualidade)],
    [Fonte], table.cell(colspan: 2)[Utilizador premium com sessão iniciada],
    [Estímulo], table.cell(colspan: 2)[Carrega um vídeo de 1000 MiB para um projeto],
    [Artefacto], table.cell(colspan: 2)[Caminho de carregamento: `nginx`, `api_gateway`, `projects`, `img_storage`],
    [Ambiente], table.cell(colspan: 2)[Operação normal, um envio de cada vez, contentores com 512 MiB],
    [Resposta], [Com 500 MiB, o `api_gateway` é terminado por falta de memória e o cliente recebe 502. Sem limites, 1000 MiB esgota os 7,6 GiB do Docker e a instalação inteira deixa de responder], [O vídeo é aceite e guardado sem alteração, e a memória de cada serviço não depende do tamanho do ficheiro],
    [Medida da resposta], [Acréscimo de memória de 2001 MiB com 500 MiB; maior ficheiro aceite: 100 MiB], [Acréscimo ≤ 64 MiB (mínimo 128 MiB); maior ficheiro aceite: 1000 MiB (mínimo 500 MiB)],
  ),
)

== Quantificação

*Classificação.* Eficiência de desempenho, subcaracterística _utilização de recursos_. O recurso em causa é a memória dos serviços que o ficheiro atravessa.

*Enunciado.* Ao receber um ficheiro de media de qualquer tamanho até ao limite do perfil de quem o carrega (1 GB no perfil premium), o sistema deve manter o acréscimo de memória de cada serviço que o ficheiro atravessa abaixo de um valor fixo, que não depende do tamanho do ficheiro.

Os serviços abrangidos são o `nginx`, o `api_gateway`, o `projects` e o `img_storage`. O SeaweedFS é medido e reportado, mas fica fora do critério, por ser de terceiros. Ficam fora do âmbito a indicação de progresso do envio (outra melhoria, de usabilidade), os envios em simultâneo e a transferência de resultados em ZIP.

#tab([M1.1 — Acréscimo de memória por serviço (medida principal)],
  tabela-campos(
    [Escala], [Acréscimo de memória de um contentor durante um envio, em MiB: o maior valor observado entre o início do envio e a resposta, menos o valor em repouso imediatamente antes],
    [Cenário e carga], [Um utilizador premium envia um vídeo MP4 (H.264, 1280×720) para um projeto vazio, pela API, com o JWT válido, um envio de cada vez. Tamanhos de 10, 100, 500 e 1000 MiB],
    [Instrumento], [`docker stats` sobre os cinco contentores, lido a cada segundo por script; cliente HTTP do mesmo script],
    [Procedimento], [5 repetições por tamanho, com os três serviços Node reiniciados e 15 s de espera antes de cada uma; só contam respostas 204],
    [Valor comparado], [O maior acréscimo das 5 repetições com 1000 MiB, no serviço que mais cresce],
    [Base], [*2001 MiB* (`api_gateway`, com 500 MiB). Com 1000 MiB não se completa: o envio esgota a memória do Docker],
    [Alvo / mínimo], [≤ 64 MiB / ≤ 128 MiB em cada serviço],
  ),
)

#tab([M1.2 — Maior ficheiro aceite com memória limitada (medida principal)],
  tabela-campos(
    [Escala], [Tamanho, em MiB, do maior ficheiro da série 10, 100, 500, 1000 carregado com sucesso nas 3 repetições],
    [Cenário], [O da M1.1, com os quatro serviços limitados a 512 MiB cada um (_override_ do Compose usado só para medir)],
    [Sucesso], [Resposta 204, nenhum contentor reiniciado ou terminado por falta de memória, o media aparece no projeto e o ficheiro devolvido tem o mesmo SHA-256 do enviado],
    [Base], [*100 MiB*. Com 500 MiB, o `api_gateway` é terminado nas 3 repetições e o cliente recebe 502],
    [Alvo / mínimo], [1000 MiB / 500 MiB],
  ),
)

*Origem dos valores.* Os tamanhos de 10 e 500 MB são os do critério de aceitação do REQ-VID-SUBMIT-008 do PL1-G4 (Tabela 30); 100 MB e 1 GB são os limites dos perfis gratuito e premium. O alvo de 64 MiB parte do envio em partes ao S3 que a base já usa (`aws-sdk`, partes de 5 MiB, 4 em paralelo: 20 MiB), com uma folga de cerca de três vezes para o que o instrumento não distingue. O mínimo de 128 MiB é o maior acréscimo que ainda deixa um serviço de 512 MiB receber três envios em simultâneo. O valor de 512 MiB por contentor é o escalão logo acima da média que o README da base implica (8 GB para cerca de 25 contentores).

*Efeitos colaterais a controlar* (`requisitos-nf.md`, 4.1): tempo de aceitação (C1.1) e de envio completo (C1.2), envio sem JWT (C1.3), SHA-256 do ficheiro guardado (C1.4), decisões e mensagens de validação (C1.5), ficheiros temporários (C1.6) e objetos órfãos no armazenamento (C1.7, acrescentado com o ADR-01).

== Medição inicial

Feita a 17 de novembro de 2026, entre as 01:34 e as 04:23, sobre `43a2e08` (`medicoes/baseline/`).

- *A memória cresce com o ficheiro.* O `projects` e o `img_storage` crescem cerca de uma vez o tamanho do ficheiro; o `api_gateway`, três a quatro vezes. A média do serviço que mais cresce é de 28, 305 e 1692 MiB com 10, 100 e 500 MiB.
- *Um único envio de 1000 MiB derruba a instalação inteira.* Nas duas tentativas, o envio esgotou os 7,6 GiB atribuídos ao Docker e o motor deixou de responder. Até esse momento, o `api_gateway` tinha crescido 3455 MiB e o `projects` 1981 MiB. A ocorrência ficou registada com os registos do Docker (`medicoes/ocorrencias/2026-11-16-queda-docker/`).
- *Com 512 MiB por contentor, só passa até 100 MiB* (M1.2).
- *O envio sem JWT é recusado (401), mas só depois de o gateway guardar o corpo:* +1006 MiB (C1.3).

== Decisão arquitetural (ADR-01)

O registo completo está em `Docs/fase2/adr/ADR-01-carregamento-em-fluxo.md`.

#tab([Alternativas consideradas no ADR-01],
  tabela(
    colunas: (3.6cm, 1fr, 1fr),
    [Alternativa], [A favor], [Contra],
    [A — Fluxo contínuo, com o ficheiro em disco no `projects` até ser validado], [Um ficheiro recusado nunca chega ao armazenamento; a validação corre sobre um ficheiro local, como na base], [O envio ao armazenamento só começa depois do último byte; o ficheiro é escrito e lido duas vezes em disco, e a cache de páginas conta na memória do contentor],
    [*B — Fluxo contínuo de ponta a ponta, com validação sobre o objeto guardado (escolhida)*], [Nenhum serviço guarda o ficheiro, nem em memória nem em disco; o envio ao S3 decorre em paralelo com o do cliente; contrato da API, frontend e mensagens iguais; o JWT passa a ser verificado antes de ler o corpo], [Um ficheiro recusado é guardado e depois apagado; o `ffprobe` passa a ler o vídeo por HTTP e tem de dar os mesmos metadados],
    [C — Envio direto do browser para o armazenamento, com URL assinado], [Os bytes não atravessam nenhum serviço da aplicação], [Muda o contrato da API e o frontend; expõe escrita direta no armazenamento; o limite do perfil só se verifica depois de guardar; mais trabalho e mais risco],
  ),
)

Foram descartadas sem análise detalhada duas opções: limitar a memória dos contentores sem mudar o código (a base falha com 500 MiB em 512 MiB) e o envio em blocos com retoma (uma funcionalidade nova).

*Decisão: alternativa B.* É a única que atinge a M1.1 sem depender da contabilização da cache de páginas. Melhora os controlos em vez de os ameaçar: os tempos descem, o C1.3 fica corrigido e deixa de haver temporários. Preserva o comportamento sem tocar no frontend: os mesmos endpoints, códigos, mensagens e ordem de validação. Mantém a arquitetura, porque cada serviço continua com o mesmo papel e o `img_storage` continua a ser a única porta para o S3: muda a forma como os bytes passam, e não por onde passam. Divide-se num passo por serviço, cada um medível e reversível.

*Táticas.* Processar em fluxo e limitar o que fica em memória (TAT-01 e TAT-02). A alternativa C corresponde à TAT-03, e limitar ou aumentar a memória dos contentores à TAT-04, que só serviu como condição de medida (M1.2). A decisão está resumida na DA-1 (secção 4.3).

*Consequências registadas.* Um ficheiro recusado passa a existir no armazenamento durante a validação e é apagado antes da resposta, o que deu origem ao controlo C1.7. Um envio interrompido tem de cancelar o envio em partes em todos os saltos. O padrão que realiza a decisão é _pipes and filters_ em fluxo (streams).

== Refactoring

Ramo `fase2/rnf-f2-01-carregamento`, com um commit por passo. Depois de cada passo correram os testes unitários do serviço alterado, a regressão completa e a M1.1 com 100 e 500 MiB.

#tab([Passos do ADR-01 e acréscimo máximo de memória com 500 MiB (MiB)],
  tabela(
    colunas: (5cm, 1.4cm, 1.9cm, 1.6cm, 1.9cm, 1.7cm),
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

A regressão passou em todos os passos com as mesmas impressões da base. Os passos 1 a 4 retiraram, um a um, a cópia de cada serviço, e o passo 5 retirou a cópia em disco do nginx. A aceitação do passo 1 está dentro da variação da base (desvio-padrão de 5,9 s).

*Afinação (passo 5b).* Depois do passo 5, nenhum serviço guardava o ficheiro, mas os três serviços Node ainda subiam 80 a 100 MiB com 500 MiB, acima do alvo. A causa não eram cópias, mas a recolha tardia dos buffers já enviados: o V8 só os recolhe ao fim de dezenas de MiB, e a glibc guarda a memória libertada. Foram medidas seis variantes de configuração com o mesmo método (`medicoes/passos/afinacao/`). Adotou-se uma geração nova do V8 mais pequena e as opções da glibc nos três serviços, e, no `img_storage`, um limite à _old space_ e duas partes S3 em paralelo em vez de quatro. O custo medido é de cerca de 0,3 s a mais no envio completo de 100 MiB.

#tab([Desvios ao plano do ADR-01],
  tabela(
    colunas: (5.4cm, 1fr),
    [Desvio], [Porquê],
    [O passo 2 não baixou o pico do `projects`], [A previsão estava errada: o pico vinha também da cópia temporária para o `ffprobe` (cache de páginas). Só caiu no passo 3],
    [O `projects` deixa de guardar um ficheiro do tipo errado para o endpoint], [O motor de armazenamento lê-o e descarta-o, porque a rota o recusa de qualquer maneira; a resposta é a mesma],
    [Um pedido sem JWT não ocupa memória, mas o gateway lê o corpo até ao fim antes de responder 401], [É o que o cliente via na base. Responder a meio do envio dava ao browser um erro de rede em vez da mensagem],
    [Passo 5b], [Previsto no ADR como afinação possível; os passos 3 a 5 ficavam acima do alvo],
  ),
)

== Medição final e análise

Medido no seu ramo, a 17 e 18 de novembro, com os scripts da base (`medicoes/final/rnf-f2-01/`; análise em `analise.md`).

#tab([RNF-F2-01: medidas principais],
  tabela(
    colunas: (3.6cm, 1fr, 1fr, 1.6cm, 1.6cm, 2cm),
    [Medida], [Base], [Final], [Alvo], [Mínimo], [Resultado],
    [M1.1 (1000 MiB)], [Não mensurável: o motor do Docker cai], [*56,3 MiB* (`img_storage`), máximo de 8 repetições], [≤ 64 MiB], [≤ 128 MiB], [*Alvo atingido*],
    [M1.1 (500 MiB, referência)], [2001 MiB], [55,3 MiB], [—], [—], [36 vezes menos],
    [M1.2], [100 MiB], [*1000 MiB*, 3 em 3 em todos os tamanhos], [1000 MiB], [500 MiB], [*Alvo atingido*],
  ),
)

#tab([Maior acréscimo por serviço, base → final (MiB)],
  tabela(
    colunas: (2.2cm, 1fr, 1fr, 1fr, 1fr),
    [Ficheiro], [`nginx`], [`api_gateway`], [`projects`], [`img_storage`],
    [10 MiB], [1,2 → 1,0], [35,0 → 7,2], [34,4 → 16,6], [24,0 → 24,4],
    [100 MiB], [7,1 → 9,7], [307,9 → 32,0], [225,0 → 13,4], [206,1 → 55,7],
    [500 MiB], [18,8 → 10,2], [2001,0 → 42,6], [1044,3 → 42,7], [1016,2 → 55,3],
    [1000 MiB], [(≥ 33) → 11,8], [(≥ 3455) → 45,0], [(≥ 1981) → 49,1], [(≥ 282) → 56,3],
  ),
)

*O RNF-F2-01 fica cumprido, com o alvo atingido nas duas medidas principais.* A partir de 100 MiB, o acréscimo praticamente não muda com o tamanho do ficheiro (`img_storage`: 55,7, 55,3 e 56,3 MiB), que é o que o enunciado pede.

#tab([RNF-F2-01: controlos],
  tabela(
    colunas: (3.4cm, 1fr, 1fr, 2.6cm),
    tamanho: 8.5pt,
    [Controlo], [Base], [Final], [Resultado],
    [C1.1 — aceitação (mediana)], [500 MiB: 8,96 s], [500 MiB: 0,84 s; 1000 MiB: 0,63–1,03 s], [Cumpre; passa a cumprir o alvo do REQ-VID-SUBMIT-008],
    [C1.2 — envio completo (mediana)], [500 MiB: 10,22 s; 1000 MiB: não mensurável], [500 MiB: 7,03 s; 1000 MiB: 7,58–11,02 s], [Cumpre],
    [C1.3 — 500 MiB sem JWT], [401; `api_gateway` +1006 MiB], [401; +24 MiB], [Cumpre; corrige a falha da base],
    [C1.4 — SHA-256 do ficheiro guardado], [Igual (10–500 MiB)], [Igual (10–1000 MiB)], [Cumpre],
    [C1.5 — decisões de validação], [7 casos], [As mesmas 7 decisões e mensagens, carácter a carácter], [Cumpre],
    [C1.6 — ficheiros temporários], [Nenhum], [Nenhum, também num envio interrompido], [Cumpre],
    [C1.7 — objetos órfãos], [O envio recusado com 409 deixa o ficheiro sem dono], [Nenhum órfão, nem envios em partes abertos], [Cumpre; corrige o 409],
  ),
)

*O que ficou abaixo do previsto.* Das previsões do ADR-01 para 500 MiB, só a do nginx se confirmou. Nos serviços Node, o máximo ficou entre 42 e 55 MiB, acima dos menos de 20 a 40 MiB previstos, porque a previsão só contava com os buffers dos streams e não com a memória que o V8 e a glibc demoram a devolver. A margem do `img_storage` em relação ao alvo (8 MiB) depende da afinação do passo 5b: sem ela, o valor ficaria entre o alvo e o mínimo. Por isso, o `AGENTS.md` pede para voltar a medir antes de retirar essas opções.

*Outros requisitos não funcionais.* As medidas do RNF-F2-02 não mudaram neste ramo (M2.1 0%, M2.2 sem recuperação, M2.3 0/10, como na base). O C2.1 (duração de uma execução) saiu 20% acima da base na série final, mas o tempo a mais estava todo dentro do worker de vídeo, que este ramo não altera. Uma comparação na mesma sessão, com blocos base, ramo e base, deu ao ramo uma mediana 1,7% abaixo da da base. A conclusão foi que a máquina variou até 40% entre sessões, mais do que a tolerância do controlo. O C2.2 falha como na base, porque o progresso não passa pelo caminho alterado. A memória do SeaweedFS, fora do critério, cresce mais do que na base com 100 e 500 MiB, com muita variação. O instrumento não distingue a memória do processo da cache de páginas, por isso fica como ponto a observar.

== Preservação funcional

#tab([Regressão do RNF-F2-01, no seu ramo],
  tabela(
    colunas: (4cm, 1fr, 1fr),
    [Suite], [Base], [Final],
    [Worker de vídeo (pytest)], [74/74], [74/74],
    [Orquestrador (`node --test`)], [8/8], [13/13 (os 8 da base e 5 novos)],
    [Ponta a ponta (T01–T18)], [18/18], [18/18, com as mesmas impressões da base],
    [Interface (U01–U03)], [3/3], [3/3],
  ),
)

Os testes unitários novos do `img_storage` (4) e do `api_gateway` (6) correram em cada passo e não fazem parte da suite da base. Na série final, a suite ponta a ponta não produziu resultados à primeira, porque o primeiro pedido falhou com `ECONNRESET` logo depois da série de 1000 MiB. Foi repetida de um arranque limpo, com 18/18, e a tentativa falhada ficou guardada.
