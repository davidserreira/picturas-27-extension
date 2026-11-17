# Fase 2 — Diagnóstico da solução de base

Grupo PL5-G5 · 16 de novembro de 2026 · entrega a 20 de novembro de 2026

Este documento regista o estudo da solução de base da Fase 2 e as fragilidades encontradas, com a
evidência no código, o impacto nos stakeholders e uma comparação dos candidatos a requisito não
funcional. Termina com a recomendação de dois requisitos. É a entrada para a especificação
(`requisitos-nf.md`), que fixa escalas, métodos de medição e valores-alvo.

## 1. Âmbito e método

| Item | Referência |
| --- | --- |
| Commit de partida | `052310226c51fa57a17101c7bd1ad795674aac95` (`0523102`, 2026-11-04) de `github.com/picturas-um/picturas-27` |
| Estado do nosso `main` | Igual a esse commit no código. Diferenças: a pasta `Docs/` e quatro linhas no `.gitignore` |
| Documentos lidos | `fase-2-guidelines.pdf`, `doc-ext-requisitos-2627.pdf` (PL1-G4), `README.md`, `AGENTS.md` |
| Código lido | `docker-compose.yaml`, `nginx/`, `rabbitMQ/`, `apiGateway/`, `projects/`, `imageStorageService/`, `wsGateway/`, `users/` (rotas), `Tools/video/`, `Tools/utils/`, uma ferramenta de imagem (`Tools/brightness/`) e as partes do `frontend/` ligadas a carregamento, barra de ferramentas e processamento |

**Limite deste diagnóstico.** A evidência é toda estática (leitura do código e da configuração).
A solução não foi lançada, porque o Docker Desktop não estava a correr na máquina onde o estudo
foi feito, e por isso não há medições exploratórias. Onde o texto diz "esperado" ou "a confirmar",
o valor é deduzido do código e tem de ser medido na baseline antes de entrar no relatório.

As referências têm a forma `ficheiro:linha` e são relativas à raiz do repositório.

## 2. A solução de base

### 2.1 Arquitetura

Cerca de 25 contentores num único `docker-compose.yaml`, todos na rede `elk`. O tráfego do
utilizador entra pelo nginx em `https://localhost:8080` (`docker-compose.yaml:39-52`).

| Componente | Papel | Tecnologia |
| --- | --- | --- |
| `nginx` | Proxy inverso e terminação TLS; encaminha `/`, `/api-gateway/`, `/socket.io`, `/s3/` | nginx |
| `frontend` | Interface | Next.js, React, TypeScript |
| `api_gateway` | Entrada REST; verifica o JWT e reencaminha | Express |
| `users`, `subscriptions` | Contas, perfis, quota diária; planos e pagamentos simulados | Express + MongoDB |
| `projects` | Orquestrador: projetos, media, pipelines, processamento | Express + MongoDB |
| `img_storage` | Fachada sobre o armazenamento de objetos (`src`, `out`, `preview`, `preview_cache`) | Express + SeaweedFS (S3) |
| `ws_gateway` | Consome `ws_queue` e envia eventos ao browser | Socket.IO |
| 16 ferramentas de imagem | Um microsserviço por efeito, uma fila por ferramenta | Python + PIL |
| `video_tool` | O único worker de vídeo: efeitos, corte, velocidade, legendas, fotogramas | Python + ffmpeg + Faster-Whisper |
| `rabbitmq` | Exchange direta `picturas`, 20 filas | RabbitMQ |

Os ficheiros de trabalho passam entre o orquestrador e as ferramentas pelo volume partilhado
`image_data`; as mensagens levam só caminhos.

### 2.2 Como é orquestrado o processamento em lote

O pedido `POST /:user/:project/process` (`projects/routes/projects.js:1521`) faz, por esta ordem:

1. Valida o pipeline: extração de fotogramas no fim, e nenhum efeito sem suporte de vídeo se o
   projeto tiver vídeos (`projects.js:1546-1562`).
2. Calcula as operações a debitar e pergunta ao `users` se há quota (`projects.js:1564-1566`,
   `1746-1747`).
3. Abre uma execução nova incrementando `activeToken` (`projects.js:1708`, `1765`).
4. Descarrega cada media do armazenamento para o volume partilhado, um de cada vez
   (`projects.js:1603-1621`).
5. Cria um registo `Process` por media e só depois publica as mensagens
   (`projects.js:1668-1672`, `projects/utils/processBatch.js`).

As respostas das ferramentas chegam a `project_queue` e são tratadas por `process_msg`
(`projects.js:169-541`), que guarda o resultado, cria o passo seguinte e, quando não sobra nenhum
`Process` da execução, marca-a como concluída (`committedToken`).

### 2.3 Como se distinguem imagens e vídeos

A diferença está no campo `media_type` de cada media do projeto (`projects/utils/video.js:55-57`)
e atravessa o orquestrador em ramos `if`: há 18 ocorrências de testes ao tipo de media ou à
extração de fotogramas só em `projects/routes/projects.js`.

| | Imagem | Vídeo |
| --- | --- | --- |
| Carregamento | `POST /:user/:project/img` | `POST /:user/:project/video`, com validação por `ffprobe` e limites do perfil (`projects.js:1298-1318`) |
| Mensagens | Uma por par (imagem, ferramenta). O orquestrador encadeia: recebe a resposta e publica o passo seguinte (`projects.js:486-524`) | Uma por vídeo, com o pipeline inteiro, para `video_queue` (`projects.js:1634-1641`) |
| Quem aplica o efeito | O microsserviço da ferramenta | `video_tool`, com as operações PIL copiadas para `Tools/video/effects.py` |
| Progresso | O browser conta eventos `process-update` | Percentagem enviada pelo worker diretamente para `ws_queue` (`Tools/video/video.py:112-124`) |
| Confirmação da mensagem | Automática ao receber (`Tools/utils/rabbit_mq.py:40`) | Manual, só no fim (`Tools/video/video.py:170`) |
| Efeitos só de vídeo | Ignorados (`projects/utils/video.js:146-150`) | `trim` e `speed` por vídeo; `subtitles` e `extract_frames` para todos os vídeos |

### 2.4 Stakeholders usados na avaliação de impacto

Da Tabela 2 do documento do PL1-G4, os interesses que estas fragilidades tocam são:

- **Utilizador registado ou premium**: "saber a todo o momento como vai o trabalho, mesmo quando
  já não acompanha".
- **Videógrafo, gestor de redes sociais, formador**: editar depressa, trabalhar em alta resolução e
  com gravações longas (o premium aceita até 600 s e 1 GB).
- **Operação e infraestrutura (DevOps)**: "controlar o custo de processamento e de armazenamento
  de vídeo e evitar trabalhos presos".
- **Equipa de desenvolvimento** (implícita na solução de base): acrescentar e alterar ferramentas
  sem tocar no resto.

## 3. Diagnóstico por candidato

### C1 — Usabilidade: criação de pipelines

ISO/IEC 25010: usabilidade (reconhecibilidade da adequação, proteção contra erros do utilizador).

**Situação na base**

- Num projeto com vídeos, a barra de ferramentas desaparece na vista em grelha
  (`frontend/components/toolbar/toolbar.tsx:67`) e as oito ferramentas só de imagem deixam de ser
  desenhadas, sem qualquer texto que o explique (`toolbar.tsx:86-97`).
- `Trim` e `Speed` só aparecem com um vídeo selecionado e devolvem `null` nos outros casos
  (`frontend/components/toolbar/trim-tool.tsx:61`).
- Acrescentar uma ferramenta só valida a extração de fotogramas (`projects.js:1426`). A
  compatibilidade com vídeo só é verificada ao executar ou pré-visualizar
  (`projects.js:1101-1108`, `1550-1558`).
- Carregar um vídeo para um projeto que já tem ferramentas de IA no pipeline é aceite
  (`projects.js:1269-1382` não olha para `project.tools`). O pipeline fica inválido, as ferramentas
  que o invalidam deixam de estar na barra, e o erro só aparece no `Apply`.
- A lista de ferramentas só de vídeo está repetida à mão no frontend
  (`frontend/app/dashboard/[pid]/page.tsx:114`) e no orquestrador (`projects/utils/video.js:16-25`).

**Impacto.** O utilizador casual e o pequeno negócio, que não conhecem as regras, encontram
ferramentas que somem e erros tardios. O custo é sobretudo de confusão e de tentativas perdidas.

**Como se mediria.** Contagem de pipelines inválidos detetados antes da execução, sobre um
conjunto fixo de casos; número de ferramentas indisponíveis com explicação visível. Uma medida de
usabilidade com valor (taxa de sucesso e tempo por tarefa) exige participantes, antes e depois.

### C2 — Manutenibilidade: modularidade do processamento de vídeo

ISO/IEC 25010: manutenibilidade (modularidade, modificabilidade).

**Situação na base**

- Um só serviço, `video_tool`, faz os oito efeitos de fotograma, o corte, a velocidade, as
  legendas e a extração (`docker-compose.yaml:256-273`; `Tools/video/` tem 807 linhas em cinco
  módulos).
- A mesma imagem leva ffmpeg, fontes e Faster-Whisper (`Tools/video/Dockerfile:4-6`,
  `Tools/video/requirements.txt`), mesmo para quem só quer um ajuste de brilho.
- Os efeitos de fotograma são cópias das ferramentas de imagem; o próprio módulo o diz
  ("mirrors exactly the PIL operation of the matching image microservice",
  `Tools/video/effects.py:1-6`). Um efeito altera-se em dois sítios.
- Legendas e extração entram por casos especiais no processador, não por um mecanismo comum
  (`Tools/video/video_processor.py:161`, `294-315`, `316-363`).
- O requisito REQ-VID-EDIT-013 do PL1-G4 (acrescentar um efeito de vídeo sem alterar os
  existentes) fica por cumprir para efeitos que não sejam de fotograma. Um efeito novo desse tipo
  obriga a mexer em `projects/utils/video.js:16-21`, `video_processor.py:161` e no ramo de
  `process_video`, em `page.tsx:114` e em `toolbar.tsx`.

**Impacto.** Recai na equipa de desenvolvimento e na operação: não se pode publicar, escalar nem
falhar uma parte do vídeo sem as outras. É também a condição para a elasticidade (C3) ter efeito
sobre as legendas.

**Como se mediria.** Número de ficheiros e serviços a alterar para acrescentar um efeito; tamanho
da imagem e tempo de construção por serviço; acoplamento entre módulos. São medidas estáticas,
reproduzíveis, mas menos diretas para o utilizador.

**Dificuldade.** Dividir o worker obriga o orquestrador a encadear etapas de vídeo entre serviços,
quando hoje envia uma mensagem só. Perde-se a passagem única de descodificação e codificação, que
a base preserva de propósito para efeitos contíguos, e é preciso refazer a agregação do progresso
e a regra da extração terminal.

### C3 — Eficiência de desempenho: elasticidade e capacidade

ISO/IEC 25010: eficiência de desempenho (capacidade, utilização de recursos, comportamento temporal).

**Situação na base**

- Um `video_tool`, sem réplicas, sem limites de CPU ou memória: o `docker-compose.yaml` não tem
  nenhuma chave `deploy`, `resources`, `cpus` ou `mem_limit`.
- O worker trata uma mensagem de cada vez (`Tools/video/video.py:54`), por isso os vídeos de um
  lote são processados em série. O README confirma-o na secção de problemas ("videos are processed
  one at a time").
- Pré-visualizações e execuções completas partilham `video_queue` (`projects.js:1112`, `1636`).
  Uma pré-visualização, que o REQ-VID-PREVIEW-005 quer "quase imediata", espera atrás de qualquer
  trabalho em curso.
- As legendas correm reconhecimento de fala em CPU com 2 threads dentro do mesmo worker
  (`Tools/video/subtitles.py:16-22`, `60-63`) e a renderização tem um limite de 30 minutos
  (`subtitles.py:79`). A interface já admite esperas de dez minutos numa pré-visualização
  (`frontend/components/toolbar/toolbar-button.tsx:187`).
- O cancelamento apaga os registos `Process` e muda o token (`projects.js:2252-2355`), mas não
  envia nada ao worker. O trabalho cancelado continua a ocupar o único worker até acabar. O PL1-G4
  regista-o como limitação conhecida (secção 10.3).
- O REQ-VID-EDIT-011 do PL1-G4 pede "pelo menos 2 em paralelo quando há capacidade" já no MVP. A
  base não o cumpre com a configuração entregue.

**Impacto.** O gestor de redes sociais e o videógrafo, que trabalham em lote, esperam a soma dos
tempos de todos os vídeos. Um utilizador com legendas atrasa todos os outros utilizadores da
instância. A operação não tem como ajustar recursos à carga.

**Como se mediria.** Débito (vídeos por minuto) e tempo total de um lote de N vídeos; tempo de
espera de uma pré-visualização enquanto corre um trabalho de legendas; tempo até o worker ficar
livre depois de um cancelamento. Tudo por script sobre a API.

**Dificuldade.** Réplicas fixas resolvem-se com `docker compose up --scale video_tool=N`, quase sem
refactoring, o que dá pouca complexidade a avaliar. Elasticidade a sério no Compose pede um
componente novo que leia a profundidade das filas e ajuste as réplicas, com acesso ao socket do
Docker. Os ganhos medidos dependem dos núcleos da máquina de teste.

### C4 — Usabilidade: trabalho em segundo plano

ISO/IEC 25010: usabilidade (operabilidade), com efeito em fiabilidade (recuperabilidade).

**Situação na base**

- Durante o processamento, um painel cobre toda a área de trabalho do projeto e fica por cima dela
  (`frontend/app/dashboard/[pid]/page.tsx:894-927`; a classe é
  `absolute top-0 left-0 h-screen w-screen bg-black/70 z-50`, linha 903). O único controlo
  disponível nessa área é `Cancelar`.
- O painel está dentro do `main` da aplicação, que o recorta
  (`frontend/app/dashboard/layout.tsx:17`). A barra lateral fica fora do `main` (linha 16), pelo
  que, em ecrãs largos, é de esperar que continue clicável. A confirmar na baseline.
- O estado "a processar" vive só no browser, num `useState(false)` da página do projeto
  (`page.tsx:89`). Um refresh repõe-o a `false`, e sair da página pela barra lateral destrói-o da
  mesma maneira: a saída que a interface deixa aberta faz perder o acompanhamento.
- O progresso das imagens é calculado no browser a contar eventos `process-update`
  (`page.tsx:301-315`). Se um evento se perder, a contagem nunca chega ao total e o painel não fecha.
- Depois de um refresh, os eventos que chegam são ignorados porque `processing` é falso
  (`page.tsx:303`, `431`).
- O servidor não tem como responder "esta execução vai em X%". Não há rota de estado: as rotas
  `GET .../process` devolvem só resultados já concluídos (`projects.js:972`, `1032`). O progresso do
  vídeo vai do worker para a `ws_queue` e nunca é guardado (`Tools/video/video.py:112-124`,
  `wsGateway/index.js:65-72`).
- O botão de cancelar está dentro do painel. Depois de um refresh, a execução continua no servidor
  e a interface deixa de oferecer forma de a acompanhar ou cancelar.
- Quando a execução acaba com o utilizador fora da página, nada o avisa. O PL1-G4 lista como
  limitação a falta de "aviso de conclusão quando o utilizador já saiu" (secção 10.3).

**Impacto.** Atinge todos os utilizadores em todas as execuções, e pesa mais onde o vídeo pesa: um
trabalho de minutos prende a aplicação inteira. Contradiz o interesse declarado do utilizador
registado e premium (secção 2.4). Para a operação, execuções órfãs depois de um refresh são
"trabalhos presos" que continuam a gastar CPU.

**Como se mediria.** Proporção das ações de uma lista fixa que o utilizador consegue concluir
durante uma execução sem deixar de a acompanhar; tempo até a interface mostrar o progresso certo
depois de um refresh; taxa de sucesso do cancelamento feito depois de um refresh. Automatizável
com um script de browser. Os valores de base esperados são extremos (nenhuma ação sem perder o
acompanhamento, recuperação impossível), o que torna a melhoria fácil de demonstrar.

**Dificuldade.** Média. O orquestrador passa a guardar o estado e o progresso de cada execução e a
expô-los; o frontend troca o painel bloqueante por um indicador não bloqueante e reconstrói o
estado ao carregar. Há uma decisão arquitetural real sobre quem guarda o progresso: hoje o worker
fala diretamente com o `ws_gateway`, sem passar pelo orquestrador.

### C5 — Eficiência de desempenho: carregamento de ficheiros grandes

ISO/IEC 25010: eficiência de desempenho (utilização de recursos, comportamento temporal).

**Situação na base**

O ficheiro é guardado inteiro em memória em três serviços seguidos:

| Passo | Evidência | Efeito |
| --- | --- | --- |
| nginx | `nginx/nginx.conf:13` (`client_max_body_size 1100m`) | Aceita o corpo e, por omissão, guarda-o antes de o passar |
| `api_gateway` | `apiGateway/routes/projects.js:23-24` (`multer.memoryStorage()` sem limites), `467` (reenvia `req.file.buffer`) | Cópia integral em RAM |
| `projects` | `projects/routes/projects.js:72-73` (o mesmo), `1309`, `1322`, `1343` | Cópia integral em RAM, mais uma escrita em disco para o `ffprobe` (`projects/utils/video.js:86`) e o SHA-256 sobre o buffer |
| `img_storage` | `imageStorageService/route/upload.js:6`, `services/uploadImage.js:15` | Cópia integral em RAM antes de enviar para o S3 |

- Um vídeo de 1 GB (o limite premium) ocupa, pelo esperado, pelo menos 3 GB de RAM ao mesmo tempo
  nos três serviços Node, numa instalação que o README dimensiona para 8 GB. A confirmar por medição.
- O limite de tamanho do perfil só é verificado no `projects`, depois de o ficheiro ter atravessado
  o nginx e o gateway (`projects.js:1314`).
- No gateway, o `multer` corre antes da verificação do JWT (`apiGateway/routes/projects.js:411-412`,
  `460-461`). Um pedido sem autenticação consegue fazer o gateway guardar em memória um corpo até
  1,1 GB antes de ser recusado.
- O frontend envia os ficheiros um a um, sem indicação de progresso, e pára no primeiro recusado
  (`frontend/lib/projects.ts:467-487`).
- O mesmo padrão repete-se na saída: os resultados sobem para o `img_storage` com `memoryStorage`,
  e a transferência em ZIP lê cada resultado inteiro para memória e monta o arquivo em RAM
  (`projects.js:1006`, `1015`, `1023`).

**Impacto.** O premium paga precisamente pelos ficheiros grandes, e é nesses que a base está mais
perto de falhar. O gateway é o ponto único de entrada: se ficar sem memória, todos os utilizadores
perdem o acesso, e não só quem carregou. Para a operação, a memória necessária cresce com o tamanho
do ficheiro e com o número de envios em simultâneo.

**Como se mediria.** Pico de memória de cada serviço durante o envio de ficheiros de tamanhos
fixos (por exemplo 10 MB, 100 MB, 500 MB e 1 GB), com `docker stats`; maior ficheiro aceite com um
limite de memória por contentor; tempo até à aceitação. O REQ-VID-SUBMIT-008 do PL1-G4 já define
este último ("menos de 3 s", medido com 10 MB e 500 MB), o que dá origem identificável aos valores.

**Dificuldade.** Média, e contida no caminho de carregamento. Há alternativas a comparar: fluxo
contínuo através dos três serviços, ou envio direto do browser para o armazenamento com URL
assinado e validação posterior. A validação por `ffprobe` e o cálculo do SHA-256 têm de deixar de
depender do buffer.

### C6 — Segurança

ISO/IEC 25010: segurança (confidencialidade, autenticidade, integridade).

**Situação na base**

- **Serviços internos publicados no anfitrião** (`docker-compose.yaml`): `projects` em 9002
  (linha 136), `users` em 10001 (174), `subscriptions` em 11001 (205), `img_storage` em 11000 (83),
  RabbitMQ em 5672 e 15672 (97-98), MongoDB em 27018 e 27019 (119, 158), SeaweedFS em 9000 e
  9090 (64-65), `ws_gateway` em 4000 (503).
- **Confiança cega entre serviços.** O `projects` identifica quem chama pelo cabeçalho
  `X-Caller-Id`, ou descodificando o JWT sem verificar a assinatura
  (`projects/utils/caller.js:4-5`, `10`). Sem link de partilha, as rotas não exigem autenticação
  nenhuma (`projects/middleware/shareAuth.js:7`). Quem chega à porta 9002 lê e altera projetos de
  qualquer utilizador.
- **`users` devolve todos os utilizadores sem autenticação** em `GET /`
  (`users/routes/users.js:78-82`), sem passar pelo filtro de campos sensíveis usado nas outras rotas.
- **`img_storage` não tem autenticação** em nenhuma rota e emite URL assinados a quem os pedir
  (`imageStorageService/route/images.js:10-31`, `server.js`).
- **TLS interno sem validação**: `rejectUnauthorized: false` em oito sítios, entre eles
  `apiGateway/routes/projects.js:18`, `projects/routes/projects.js:80` e
  `users/routes/users.js:17`. Os certificados internos estão expirados desde janeiro de 2026.
  O `projects` fala com o `img_storage` em HTTP simples (`projects/utils/imageStorage.js:15`).
- **Segredos versionados**: `JWT_SECRET_KEY` e `FIELD_ENCRYPTION_KEY`
  (`docker-compose.yaml:178-179`, `222`, `512`), `SECRET_KEY` dos cartões (208), credenciais do
  RabbitMQ (100-101, `rabbitMQ/definitions.json:4-5`), valores por omissão do S3 (68-71) e seis
  chaves privadas em `*/certs/selfsigned.key`.
- **WebSocket**: uma ligação sem token não é recusada (`wsGateway/index.js:20-31`) e qualquer
  socket entra na sala de qualquer projeto (`index.js:33-37`), recebendo as operações de coedição
  de projetos alheios.

**Impacto.** Confidencialidade dos media e dos dados de conta de todos os utilizadores. O
REQ-VID-ACCESS-001 do PL1-G4 (acesso restrito a quem tem acesso ao projeto) só se cumpre para quem
entra pelo gateway.

**Como se mediria.** Contagens: portas publicadas, rotas internas acessíveis sem credenciais,
segredos detetados por uma ferramenta de análise do repositório, ligações internas sem validação
de certificado; e um conjunto de tentativas de acesso indevido que têm de passar a falhar.

**Dificuldade.** Muitas alterações pequenas em todos os serviços. Cada uma é simples, mas juntas
tocam na configuração de que o arranque depende, e a medição é sobretudo uma lista de verificação.

### C7 — Fiabilidade: tolerância a falhas e recuperação (fora da lista das diretrizes)

ISO/IEC 25010: fiabilidade (tolerância a falhas, recuperabilidade).

**Situação na base**

- As ferramentas de imagem confirmam a mensagem ao recebê-la (`Tools/utils/rabbit_mq.py:40`). Se o
  contentor cair a meio, o passo perde-se, o `Process` fica órfão e a execução nunca conclui. É a
  tarefa T-01 do PL1-G4, com prioridade alta e pendente.
- O orquestrador confirma cada mensagem logo a seguir a chamar o tratamento, sem esperar que ele
  termine (`projects/utils/rabbit_mq.js:48-50`).
- O consumidor do orquestrador não se religa se o RabbitMQ reiniciar
  (`projects/utils/rabbit_mq.js:33-44`); o do `ws_gateway` já o faz.
- Cada mensagem publicada pelo orquestrador abre uma ligação nova e fecha-a 500 ms depois
  (`projects/utils/rabbit_mq.js:11-29`).
- Não há tempo limite para uma execução.
- Há um defeito no tratamento de uma falha de cópia da pré-visualização: a variável `key8` é usada
  fora do bloco onde foi declarada (`projects.js:297`, `302`), o que transforma uma falha
  recuperável num erro genérico.

**Impacto.** Trabalhos presos e operações debitadas sem resultado, que o utilizador só resolve
cancelando.

**Como se mediria.** Injeção de falhas: parar um contentor a meio de N execuções e contar as que
concluem; tempo até à recuperação.

**Dificuldade.** Média. A ferramenta `watermark` vem de uma imagem pública que não podemos alterar,
e a reentrega obriga a tornar idempotente o tratamento no orquestrador.

### C8 — Eficiência de desempenho: tempo de processamento do vídeo (fora da lista)

O worker descodifica para RGB, aplica os efeitos fotograma a fotograma em Python e volta a
codificar (`Tools/video/video_processor.py:207-223`). O PL1-G4 mediu cerca de 1 vez a duração para
1080p a 30 fps com um efeito, em 2 núcleos, e aponta-o como "o principal candidato a otimização na
Fase 2". O valor medido já cumpre o alvo de produção do REQ-VID-EDIT-010 ("até 1 vez a duração"),
pelo que a fragilidade é menos evidente do que nas restantes, e passar os efeitos para filtros do
ffmpeg põe em causa a igualdade de resultados entre imagem e vídeo (REQ-VID-EDIT-009).

## 4. Comparação dos candidatos

Escala: alta, média, baixa. O risco considera a entrega a 20 de novembro, quatro dias depois deste
diagnóstico, com medição inicial, refactoring, medição final, regressão e relatório pelo meio.

| # | Candidato | Pertinência | Complexidade técnica | Facilidade de medir | Risco para 20/11 |
| --- | --- | --- | --- | --- | --- |
| C1 | Usabilidade — criação de pipelines | Média: confusão e erros tardios, sem perda de trabalho | Baixa a média: quase só frontend | Baixa: uma medida credível pede participantes, duas vezes | Médio: fronteira com funcionalidade nova |
| C2 | Manutenibilidade — modularidade do vídeo | Média: sentida pela equipa e pela operação, não pelo utilizador | Alta: orquestração de etapas de vídeo entre serviços | Média: medidas estáticas | Alto: mexe na semântica de todo o pipeline de vídeo |
| C3 | Eficiência — elasticidade | Alta: lotes em série, legendas a bloquear todos | Baixa com réplicas fixas; alta com ajuste dinâmico | Alta, mas dependente da máquina | Médio a alto: componente novo e resultados sensíveis ao hardware |
| C4 | Usabilidade — trabalho em segundo plano | Alta: todos os utilizadores, todas as execuções | Média: estado da execução no servidor e interface não bloqueante | Alta: valores de base extremos, automatizável | Médio: a lógica de progresso do frontend é frágil |
| C5 | Eficiência — carregamento de ficheiros grandes | Alta: premium e disponibilidade do gateway | Média: três serviços e alternativas arquiteturais reais | Alta: memória e tempo por script | Baixo a médio: contido no carregamento |
| C6 | Segurança | Alta em produção; menos visível numa instalação local | Média: muitas alterações simples | Média: contagens e lista de verificação | Médio: toca no arranque de todos os serviços |
| C7 | Fiabilidade — tolerância a falhas | Alta: trabalho perdido e operações debitadas | Média | Alta: injeção de falhas | Médio: ferramenta externa e idempotência |
| C8 | Eficiência — tempo de processamento | Baixa: a base já cumpre o alvo | Alta | Alta | Alto: pode quebrar a igualdade de resultados |

## 5. Recomendação

**RNF-A — Eficiência de desempenho (utilização de recursos): carregamento de ficheiros grandes (C5).**

**RNF-B — Usabilidade (operabilidade): trabalho em segundo plano (C4).**

Justificação:

1. **Pertinência.** São as duas fragilidades que tocam mais stakeholders com consequência direta.
   A C4 afeta toda a gente em cada execução e contradiz um interesse escrito no documento de
   requisitos de base. A C5 atinge o perfil que paga e põe em causa a disponibilidade da entrada
   única do sistema.
2. **Fragilidade concreta e já reconhecida.** Ambas constam das diretrizes e das limitações que o
   próprio PL1-G4 registou ("faltam o progresso do envio", falta de aviso de conclusão), e ambas
   têm evidência no código que se aponta linha a linha.
3. **Quantificação sólida.** Cada uma tem uma escala objetiva, um método que corre por script e
   valores de base que se esperam muito afastados do alvo. A C5 herda um valor com origem
   identificável no REQ-VID-SUBMIT-008.
4. **Complexidade suficiente sem risco desproporcionado.** As duas pedem decisões arquiteturais
   com alternativas reais (onde passa o ficheiro; quem é dono do estado de uma execução), sem
   reescrever o pipeline de vídeo.
5. **Trabalho em paralelo.** A C5 mexe no caminho de carregamento (`apiGateway`, rota de media do
   `projects`, `imageStorageService`). A C4 mexe no fluxo de processamento do `projects`, no
   `wsGateway` e na página do projeto. Quase não se sobrepõem, o que permite dividir a equipa em
   duas frentes com poucos conflitos.

Efeitos colaterais a medir, porque as diretrizes o pedem:

- C5 sobre segurança: verificar o JWT antes de aceitar o corpo fecha a falha descrita em C5 e C6.
  C5 sobre tempo: o fluxo contínuo não pode piorar o tempo de aceitação.
- C4 sobre fiabilidade: guardar o estado da execução no servidor melhora a recuperação (C7). C4
  sobre desempenho: mais escritas por execução no MongoDB e mais mensagens, a quantificar.

**Alternativa mais ambiciosa, não recomendada para este prazo:** C2 como condição de C3 (separar
as legendas e a extração do `video_tool` para as escalar à parte). É o par com mais peso
arquitetural e encaixa no exemplo das diretrizes de um requisito ser condição do outro, mas reúne
os dois riscos mais altos da tabela.

**Decisões que ficam com a equipa antes da especificação:**

1. Confirmar ou trocar o par recomendado.
2. Na C5, se a indicação de progresso do envio entra no requisito ou fica como efeito colateral.
   Recomenda-se deixá-la de fora, para o requisito medir uma coisa só.
3. Em que máquina se fazem as medições, já que a baseline e a medição final têm de usar a mesma.
