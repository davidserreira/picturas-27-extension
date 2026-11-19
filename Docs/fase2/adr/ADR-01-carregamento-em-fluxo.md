# ADR-01 — Carregamento de ficheiros em fluxo, sem cópias completas em memória

| Campo | Valor |
| --- | --- |
| Estado | Aceite. Implementado e medido no ramo `fase2/rnf-f2-01-carregamento` e com o RNF-F2-02 integrado no ramo `fase2/integracao` (secção 7). Alvo atingido nas duas medidas principais, nas duas medições (`../analise.md`, secções 1 a 5 e 7). Revisto pela equipa a 19/11/2026 (`../ia.md`) |
| Data | 17 de novembro de 2026 |
| Requisito | RNF-F2-01 — Carregamento de ficheiros grandes com memória limitada (`../requisitos-nf.md`, secção 2) |
| Base | Commit `0523102` (no nosso repositório, `43a2e08`) |
| Evidência | `../diagnostico.md` (C5), `../medicoes/baseline/` |

## 1. Contexto

### 1.1 O caminho de um ficheiro na base

Um ficheiro carregado pelo utilizador atravessa quatro serviços até ao armazenamento de objetos:

```
browser ──► nginx ──► api_gateway ──► projects ──► img_storage ──► SeaweedFS (S3)
            (disco)    (RAM: multer)   (RAM: multer)  (RAM: multer)
```

Cada serviço Node lê o pedido inteiro para memória (`multer.memoryStorage()`) antes de fazer
alguma coisa com ele, e só depois o reenvia ao seguinte:

| Serviço | Onde | O que guarda em memória |
| --- | --- | --- |
| `api_gateway` | `apiGateway/routes/projects.js:23-24`, `409-455`, `458-505` | O ficheiro inteiro (multer), lido **antes** de verificar o JWT; depois uma segunda cópia, porque reenvia com `axios` e `maxBodyLength: Infinity` |
| `projects` | `projects/routes/projects.js:72-73`, `1269-1394` | O ficheiro inteiro (multer); uma cópia em disco para o `ffprobe` (`projects/utils/video.js:84-111`); outra cópia ao reenviar com `axios` (`projects/utils/imageStorage.js:29-36`) |
| `img_storage` | `imageStorageService/route/upload.js:6`, `services/uploadImage.js:15` | O ficheiro inteiro (multer), entregue de uma vez ao cliente S3 |

**A segunda cópia vem do `axios`.** Em Node, o `axios` usa por omissão o `follow-redirects` para
seguir redirecionamentos. Este guarda cada fragmento do corpo enviado para o poder repetir. Com
`maxBodyLength: Infinity`, que é o valor da base, guarda o corpo inteiro. Confirmei-o no código
instalado nos contentores `api_gateway` e `projects`: `follow-redirects` 1.16.3,
`index.js:164-166`. Com `maxRedirects: 0`,
o `axios` 1.21.1 usa o módulo `http`/`https` nativo (`lib/adapters/http.js:1171-1172`) e não
guarda nada.

### 1.2 O que a medição inicial mostrou

Valores de `../medicoes/baseline/` (máquina e método em `../requisitos-nf.md`, secção 1):

| Ficheiro | `api_gateway` | `projects` | `img_storage` | `nginx` |
| --- | --- | --- | --- | --- |
| 100 MiB | +305 MiB (3,0×) | +219 MiB (2,2×) | +205 MiB (2,1×) | +5 MiB |
| 500 MiB | +1692 MiB (3,4×) | +1023 MiB (2,0×) | +991 MiB (2,0×) | +18 MiB |
| 1000 MiB | o motor do Docker deixa de responder | | | |

- **M1.1:** 2001 MiB de acréscimo máximo com 500 MiB. O alvo é ≤ 64 MiB e o mínimo ≤ 128 MiB.
- **M1.2:** com 512 MiB por contentor, o maior ficheiro aceite é 100 MiB. O alvo é 1000 MiB e o
  mínimo 500 MiB.
- **C1.3:** um envio de 500 MiB sem JWT ocupa 1006 MiB no gateway antes de ser recusado com 401.
- **C1.1:** a aceitação de um ficheiro de 500 MiB demora 11,2 ± 5,9 s depois do último byte. O
  ficheiro só começa a ir para o serviço seguinte quando o anterior acaba de o receber.

O nginx já cumpre o requisito: guarda o corpo num ficheiro temporário em disco, e não em memória.

### 1.3 Forças da decisão

1. **Atingir M1.1 e M1.2:** a memória de cada serviço tem de deixar de depender do tamanho do ficheiro.
2. **Preservar o comportamento funcional.** Os mesmos endpoints, campos, códigos de resposta e
   mensagens; os mesmos bytes guardados e o mesmo SHA-256; as mesmas decisões de validação e pela
   mesma ordem. Vigiado pela regressão (T02 a T04, T14) e pelos controlos C1.4 e C1.5.
3. **Não piorar outros requisitos:** os tempos (C1.1, C1.2), a segurança (C1.3) e o disco (C1.6).
4. **Não mexer no frontend.** O RNF-F2-02 altera a página do projeto; dois refactorings no mesmo
   código do frontend aumentam o risco de conflitos e de regressões cruzadas.
5. **Respeitar a arquitetura existente:** o `img_storage` é a fachada única do armazenamento de
   objetos.
6. **Prazo:** a entrega é a 20 de novembro. A implementação tem de caber em passos pequenos, cada
   um medível e reversível.

## 2. Alternativas consideradas

### A — Fluxo contínuo, com o ficheiro guardado em disco no `projects` até ser validado

O gateway passa o pedido ao `projects` em fluxo, sem o interpretar. O `projects` escreve o ficheiro
num temporário em disco, calcula o SHA-256 enquanto escreve, valida com `ffprobe` sobre o
temporário e só depois o envia em fluxo ao `img_storage`, que o envia em partes ao S3.

| A favor | Contra |
| --- | --- |
| Mantém o invariante da base: um ficheiro recusado nunca chega ao armazenamento | O envio ao armazenamento só começa depois do último byte do cliente. A aceitação de 1000 MiB continua a ser de vários segundos (C1.1 melhora pouco) |
| A validação corre sobre um ficheiro local, como na base | O ficheiro é escrito em disco e lido duas vezes. Como as páginas lidas duas vezes passam a "ativas" na cache, essa cache conta na memória do contentor que o `docker stats` reporta. O `projects` pode continuar a mostrar um acréscimo da ordem do tamanho do ficheiro na M1.1, embora a memória seja recuperável (risco a medir) |
| | Cada envio em curso ocupa até 1,1 GB no sistema de ficheiros do contentor `projects`, que não tem limite |

### B — Fluxo contínuo de ponta a ponta, com validação sobre o objeto guardado (escolhida)

Nenhum serviço guarda o ficheiro inteiro, nem em memória nem em disco. O gateway passa o pedido
ao `projects` em fluxo. O `projects` interpreta o multipart com um motor de armazenamento do
multer que envia o ficheiro diretamente ao `img_storage`, contando os bytes e calculando o SHA-256
pelo caminho. O `img_storage` envia-o em partes ao S3. Quando o último byte chega, o ficheiro já
está guardado. O `projects` valida então o vídeo com `ffprobe` sobre o URL interno do objeto e, se
recusar o ficheiro por qualquer razão, apaga o objeto antes de responder, com a mesma mensagem da
base.

| A favor | Contra |
| --- | --- |
| A memória de cada serviço fica limitada pelos buffers dos streams e pelas partes S3 em curso (4 × 5 MiB no `img_storage`), sem disco nem cache de páginas nos serviços medidos | Um ficheiro recusado é guardado e depois apagado. O utilizador não vê a diferença, mas uma falha entre o envio e a remoção deixa um objeto órfão |
| O envio ao armazenamento decorre em paralelo com o envio do cliente. A aceitação passa a ser o tempo de fechar o último bloco S3 e correr o `ffprobe` (C1.1 deve melhorar muito) | O `ffprobe` lê o vídeo por HTTP (pedidos com intervalo de bytes ao SeaweedFS). Tem de dar exatamente os mesmos metadados que sobre o ficheiro local (T03, C1.5) |
| Contrato da API, frontend e mensagens iguais | O armazenamento recebe também os ficheiros que depois são recusados, mesmo os muito grandes, até ao limite de 1100 MB do nginx |
| Corrige a falha de segurança do C1.3: o JWT passa a ser verificado antes de ler o corpo | |
| Os envios internos de resultados e pré-visualizações (`post_image`) passam pelo mesmo caminho e também deixam de duplicar a memória | |

### C — Envio direto do browser para o armazenamento com URL assinado

O browser pede ao `projects` um URL assinado de escrita e envia o ficheiro diretamente para o
SeaweedFS através do `/s3/` do nginx. No fim chama um novo endpoint de conclusão, onde o `projects`
valida o objeto e o regista no projeto, ou o apaga.

| A favor | Contra |
| --- | --- |
| Os bytes não atravessam nenhum serviço da aplicação: a melhor escalabilidade das três | Muda o contrato da API (dois endpoints novos) e o frontend. Choca com o RNF-F2-02 no mesmo código e obriga a refazer os testes de interface |
| | Contorna a fachada do `img_storage` e expõe escrita direta no armazenamento ao browser. Piora a segurança (diagnóstico, C6) |
| | O limite de tamanho por perfil deixa de poder ser imposto antes do envio, porque um URL assinado de escrita não limita o tamanho no SeaweedFS (a política de POST com `content-length-range` não está garantida). O limite passaria a ser verificado só depois de o ficheiro estar guardado |
| | É a alternativa com mais trabalho e mais risco para três dias |

### Descartadas sem análise detalhada

- **Limitar a concorrência ou a memória dos contentores sem mudar o código.** Não altera a memória
  por envio: com 512 MiB por contentor, a base já falha com 500 MiB (M1.2).
- **Envio em blocos com retoma (estilo tus).** Limita a memória pelo tamanho do bloco, mas
  acrescenta uma funcionalidade nova (retomar envios), que as diretrizes excluem e que o PL1-G4
  deixou fora de âmbito (UC-VID-001/A2). Também obriga a mudar o frontend.

## 3. Decisão

**Adota-se a alternativa B: fluxo contínuo de ponta a ponta, com validação sobre o objeto
guardado e remoção se for recusado.**

Justificação:

1. **É a única que atinge M1.1 sem depender da contabilização da cache de páginas.** Em A, o
   resultado medido no `projects` é incerto; em B não há ficheiro local.
2. **Melhora os controlos em vez de os ameaçar.** C1.1 e C1.2 descem, porque as etapas passam a
   correr em paralelo; o C1.3 fica corrigido; o C1.6 fica garantido, porque deixa de haver
   temporários. A alternativa C melhoraria os tempos, mas piora a segurança.
3. **Preserva o comportamento funcional sem tocar no frontend:** os mesmos endpoints, os mesmos
   campos (`image`, `video`), os mesmos códigos e as mesmas mensagens, pela mesma ordem de
   validação.
4. **Mantém a arquitetura:** cada serviço continua a ter o mesmo papel, e o `img_storage` continua
   a ser a única porta para o S3. A mudança é a forma como os bytes passam, e não por onde passam.
5. **Divide-se em passos independentes** (secção 6), um por serviço, cada um medível e reversível.

## 4. Consequências

### 4.1 Comportamento funcional

| Aspeto | Na base | Depois | Como se verifica |
| --- | --- | --- | --- |
| Endpoints, campos, códigos e corpo das respostas | `POST .../img` e `.../video`; 204 com `X-Project-Version`; erros com a mensagem do `projects` | Iguais | Regressão T02 a T04, U01 |
| Ordem das validações | Tipo de ficheiro, nome repetido, perfil, `ffprobe`, formato, codec, duração, tamanho, resolução | Igual, sobre o objeto já guardado | C1.5 (mesmas decisões e mensagens) |
| Ficheiro recusado | Nunca chega ao armazenamento | Chega e é apagado antes da resposta | Novo controlo C1.7 |
| Bytes guardados e SHA-256 (`og_sha256`, usado na chave da cache de pré-visualizações) | Calculado sobre o buffer | Calculado pelo caminho, sobre os mesmos bytes | C1.4, T02, T03 |
| Metadados do vídeo (`duration`, `width`, `height`, `fps`, codecs, `format_name`, `size_bytes`) | `ffprobe` sobre um ficheiro temporário | `ffprobe` sobre o URL interno; `size_bytes` contado no fluxo | Impressão do T03 igual à da base |
| Conflito de versão (409) depois do envio | O ficheiro fica guardado sem dono (órfão) | O objeto é apagado | C1.7 |
| Resultados e pré-visualizações gerados pelo processamento | Enviados ao `img_storage` com cópias em memória | O mesmo envio, sem cópias | Regressão T05 a T12 |

### 4.2 Outros requisitos não funcionais

| Requisito | Efeito esperado | Controlo |
| --- | --- | --- |
| Eficiência — comportamento temporal | Aceitação e envio completo mais rápidos, porque as etapas se sobrepõem. O cliente passa a enviar ao ritmo do serviço mais lento da cadeia (contrapressão), o que só se nota se o SeaweedFS escrever mais devagar do que a rede local | C1.1, C1.2 |
| Segurança — autenticidade | O JWT é verificado antes de ler o corpo; um pedido sem JWT é recusado sem ocupar memória | C1.3 |
| Segurança — confidencialidade | Um ficheiro recusado existe no armazenamento durante a validação (segundos), no prefixo do próprio utilizador, com a mesma proteção dos outros. A confiança entre serviços (`X-Caller-Id`, TLS sem validação) não muda e continua fora de âmbito | C1.7 |
| Fiabilidade — tolerância a falhas | Um envio interrompido tem de cancelar o envio em partes ao S3 em todos os saltos; senão ficam partes órfãs no SeaweedFS. Uma falha do `projects` entre o envio e a remoção deixa um objeto órfão, sem impacto funcional | C1.6, C1.7 |
| Eficiência — utilização de recursos (disco) | Deixa de haver cópias temporárias em disco nos serviços da aplicação. O SeaweedFS passa a receber ficheiros que depois são recusados | C1.6 |
| Manutenibilidade — modificabilidade | Dois módulos novos e pequenos (proxy em fluxo no gateway, motor de armazenamento no `projects`) e menos código de reenvio. A lógica de validação fica igual | Revisão de código |

### 4.3 Valores esperados

Previsões a confirmar em cada passo:

| Serviço | Base (500 MiB) | Esperado | Porque |
| --- | --- | --- | --- |
| `nginx` | +18 MiB | Igual ou menor | Com `proxy_request_buffering off`, deixa de guardar o corpo em disco antes de o passar |
| `api_gateway` | +1692 MiB | Menos de 20 MiB | Só os buffers do stream (64 KiB) e do socket |
| `projects` | +1023 MiB | Menos de 20 MiB | Buffers do parser e do pedido ao `img_storage`; o hash não guarda dados |
| `img_storage` | +991 MiB | Menos de 40 MiB | No máximo 4 partes de 5 MiB em curso, mais os buffers |

Se algum serviço ficar acima do alvo de 64 MiB, há três afinações, por esta ordem: `queueSize`
do envio S3 (4 → 2), `highWaterMark` dos streams, e limitar a heap do V8
(`--max-old-space-size`) para a recolha de lixo correr mais cedo e libertar os buffers já
enviados. A M1.2, com o limite real de 512 MiB, decide o resultado.

### 4.4 Riscos

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| O `ffprobe` por HTTP dá metadados diferentes do `ffprobe` local (por exemplo, a duração de um WebM sem índice) | Média | O passo 3 compara as impressões do T03 e as decisões do C1.5 com a base. Se divergir, usa-se o URL só para ler o cabeçalho e a duração calcula-se como na base, ou volta-se à alternativa A só para vídeos |
| O `projects` responde cedo (409, 403) enquanto o cliente ainda envia, e o browser vê um erro de rede em vez da mensagem | Média | O gateway só devolve a resposta depois de receber o pedido inteiro, como na base (passo 4) |
| Um erro no motor de armazenamento chega ao tratador de erros do Express e muda a resposta (500 em HTML em vez de 501 com a mensagem da base) | Alta, se não for tratado | O multer é envolvido para traduzir os erros nas mesmas respostas da base (passo 3) |
| A interrupção a meio deixa partes S3 por concluir | Média | Cancelar o `ManagedUpload` quando o pedido é abortado; o C1.6 e o C1.7 cobrem o caso interrompido |
| Conflitos com o RNF-F2-02 em `projects/routes/projects.js` | Média | Este ADR só mexe na configuração do multer (linhas 72-73) e em `addProjectMedia` (1267-1394). O RNF-F2-02 mexe no processamento. Integrar com frequência no `main` |

## 5. Validação da decisão

A decisão fica confirmada se a medição final der:

- **M1.1:** ≤ 64 MiB (alvo) ou ≤ 128 MiB (mínimo) em `nginx`, `api_gateway`, `projects` e
  `img_storage`, com 1000 MiB.
- **M1.2:** 1000 MiB aceites com 512 MiB por contentor.
- **Controlos:** C1.1 e C1.2 iguais ou melhores; C1.3 com 401 e um acréscimo dentro do mínimo da
  M1.1; C1.4 a C1.7 sem diferenças.
- **Regressão:** `REGRESSAO=final ./correr.sh` sem falhas e sem diferenças face à referência.

## 6. Plano de refactoring

Cada passo é um commit no ramo `fase2/rnf-f2-01-carregamento`. A ordem vai do fim da cadeia para o
início, para que a cadeia funcione depois de cada passo e se possa atribuir a cada um a redução
que provoca.

Depois de cada passo:

```bash
# serviços com código copiado para a imagem: reconstruir os que o passo alterou
docker compose up -d --build <serviços> && docker compose restart nginx
cd Docs/fase2/medicoes && MEDICAO=passos/passo-N node rnf1/medir-memoria.mjs --reps 2 --sizes 100,500 --only m11
cd ../regressao && REGRESSAO=passo-N node e2e.mjs --only <testes do passo>
```

`REGRESSAO` diferente de `baseline` compara as impressões com `referencia.json`. As medições
intermédias ficam em `medicoes/passos/` e servem para atribuir o ganho a cada passo no relatório;
não substituem a medição final.

### Passo 0 — Preparação (sem código da aplicação)

- Criar o ramo a partir do `main`.
- Acrescentar o controlo **C1.7** a `../medicoes/rnf1/medir-memoria.mjs` e a
  `../requisitos-nf.md` (4.1). Mede o número de objetos no prefixo `src/` do projeto depois de cada
  caso do C1.5, de um conflito de versão e de um envio interrompido, pela API do filer do SeaweedFS
  (`http://localhost:9090`).
- Medir o C1.7 na base, ainda sem alterações.
- **Validação:** o C1.7 corre na base e o valor fica registado.

### Passo 1 — `img_storage` envia ao S3 em fluxo

| | |
| --- | --- |
| Ficheiros | `imageStorageService/route/upload.js`; `imageStorageService/services/uploadImage.js`; novo `imageStorageService/services/streamStorage.js` (motor de armazenamento do multer); novo `imageStorageService/tests/stream-storage.test.js` |
| Alteração | O motor recebe `file.stream` e passa-o a `s3.upload({ Body: stream }, { partSize: 5 MiB, queueSize: 4 })`. Se o pedido for abortado, cancela o envio (`upload.abort()`). Devolve `{ imageKey, location }`, com a mesma chave e a mesma extensão derivada do tipo MIME. `uploadImage` deixa de usar `file.buffer`. As rotas de cópia, remoção e URL não mudam |
| Testes unitários | Com um cliente S3 falso: os bytes recebidos são os enviados; o pedido abortado chama `abort`; a resposta tem a mesma forma |
| Regressão | T02, T03 (bytes iguais), T05 a T12 (resultados e pré-visualizações passam por aqui) |
| Medição | `img_storage` com 500 MiB: de cerca de 990 MiB para menos de 40 MiB |
| Reconstruir | `img_storage` |

### Passo 2 — `projects` deixa de duplicar o corpo ao enviar para o `img_storage`

| | |
| --- | --- |
| Ficheiros | `projects/utils/imageStorage.js` |
| Alteração | Em `post_image`, `maxRedirects: 0`, para o `axios` usar o `http` nativo em vez do `follow-redirects`. Acrescentar ao comentário porque é que é preciso. Com corpos de tamanho desconhecido (passo 3), o `form-data` passa a enviar em *chunked*, que o multer do `img_storage` aceita |
| Regressão | T02 a T12 |
| Medição | `projects` com 500 MiB: de cerca de 1020 MiB para cerca de 500 MiB (fica só a cópia do multer, que sai no passo 3) |
| Reconstruir | `projects` |

### Passo 3 — `projects` interpreta o carregamento em fluxo e valida sobre o objeto guardado

| | |
| --- | --- |
| Ficheiros | Novo `projects/utils/mediaUpload.js`; `projects/utils/video.js`; `projects/routes/projects.js` (só as linhas 72-73 e `addProjectMedia`, 1267-1394); novo `projects/tests/media-upload.test.js` |
| `mediaUpload.js` | Motor de armazenamento do multer. Encaminha `file.stream` por um contador de bytes e um `crypto.createHash("sha256")`, e passa-o a `post_image(user, project, "src", form)`. Devolve em `req.file` os campos `size`, `sha256` e `imageKey`. Implementa `_removeFile` (apaga o objeto) e cancela o pedido ao `img_storage` se o cliente abortar |
| `video.js` | `probeVideoBuffer(buffer, name)` passa a `probeVideo(url, sizeBytes)`. Corre o mesmo `ffprobe` com o URL interno e devolve o mesmo objeto, com `size_bytes` igual aos bytes contados. A função auxiliar `ffprobe()` e `validateVideo()` não mudam |
| `addProjectMedia` | A mesma sequência de verificações e as mesmas mensagens. Usa `req.file.sha256`, `req.file.imageKey` e `get_image_internal_url(...)` para o `ffprobe`. Qualquer recusa ou falha depois de o objeto existir (tipo errado, nome repetido, perfil, `ffprobe`, validação, conflito de versão, erro ao atualizar o projeto) apaga o objeto com `delete_image(..., "src", key)` antes de responder. O multer das duas rotas é envolvido para que um erro de armazenamento dê o mesmo `501 "Error storing image"` da base |
| Testes unitários | Com um `post_image` falso: hash e tamanho certos; abortar a meio cancela o envio e não deixa nada; uma recusa apaga o objeto. Os 8 testes existentes continuam a passar |
| Regressão | T02, T03 (impressão dos metadados igual à da base), T04, T14, T15, T17; controlos C1.4, C1.5 e C1.7 |
| Medição | `projects` com 500 MiB: menos de 20 MiB |
| Reconstruir | `projects` |

### Passo 4 — `api_gateway` verifica o JWT e passa o carregamento em fluxo

| | |
| --- | --- |
| Ficheiros | Novo `apiGateway/utils/streamProxy.js`; `apiGateway/routes/projects.js` (as rotas `POST /:user/:project/img` e `/video`; o `multer` deixa de ser usado neste ficheiro); novo `apiGateway/tests/stream-proxy.test.js` (`node --test`, com servidores HTTP locais) |
| `streamProxy.js` | Passa `req` para `https.request` em `projectsURL`, com o mesmo agente, os cabeçalhos `Content-Type` (com o *boundary*), `Content-Length`, `Authorization`, `X-Project-Version` e `X-Caller-Id`, e o parâmetro `share`. Só responde ao cliente depois de ler o pedido inteiro, como na base. Em sucesso responde 204 com `X-Project-Version`; em erro, o mesmo estado e corpo que o `forwardAxiosError` produzia. Se o `projects` estiver em baixo, responde 500 com `"Projects service unavailable"`. Se o cliente abortar, destrói o pedido ao `projects` |
| Rotas | `auth.checkToken` passa a ser o primeiro *middleware* das duas rotas |
| Testes unitários | Bytes iguais do outro lado; cabeçalhos passados; erro do `projects` devolvido igual; JWT inválido recusado sem ler o corpo; cliente abortado cancela o pedido ao destino |
| Regressão | T02 a T04, T18, U01; controlo C1.3 |
| Medição | `api_gateway` com 500 MiB: de cerca de 1690 MiB para menos de 20 MiB. C1.3: 401 com acréscimo próximo de zero |
| Reconstruir | Nenhum (o `api_gateway` monta o código e reinicia com o nodemon); `docker compose restart nginx` |

### Passo 5 — nginx passa o corpo sem o guardar primeiro

| | |
| --- | --- |
| Ficheiros | `nginx/nginx.conf`, bloco `location /api-gateway/` |
| Alteração | `proxy_request_buffering off;` e `proxy_http_version 1.1;`. O `client_max_body_size 1100m` mantém-se |
| Porquê em último | O nginx já cumpre o critério de memória. Este passo só muda os tempos, e fica isolado para se ver o seu efeito no C1.1 e no C1.2 |
| Regressão | Suite completa (`correr.sh`), porque o bloco serve toda a API |
| Medição | C1.1 e C1.2 com 10 e 500 MiB, comparados com o passo 4. Se piorarem, reverte-se este passo e regista-se porquê |
| Reconstruir | `docker compose restart nginx` |

### Passo 6 — Medição final, documentação e fecho

- Arranque limpo e série completa: `MEDICAO=final ./correr-tudo.sh` (as medidas do RNF-F2-02
  também correm, para verificar que não foram afetadas) e `REGRESSAO=final ./correr.sh`.
- Atualizar o `AGENTS.md` e o `README.md`: o carregamento passa em fluxo; não reintroduzir
  `memoryStorage` nem pedidos `axios` com `maxBodyLength: Infinity` sem `maxRedirects: 0`.
- Registar em `../ia.md` o uso de IA neste ADR e na implementação, e a validação feita pela equipa.
- Atualizar o estado deste ADR para "Aceite" ou "Aceite com alterações", com os valores medidos.

### Resumo

| Passo | Serviços | Risco | Esforço estimado | Efeito esperado na M1.1 (500 MiB) |
| --- | --- | --- | --- | --- |
| 0 | — | Baixo | 1 h | — |
| 1 | `img_storage` | Baixo | 2 h | `img_storage` −950 MiB |
| 2 | `projects` (1 linha) | Baixo | 0,5 h | `projects` −500 MiB |
| 3 | `projects` | Médio | 4 h | `projects` −500 MiB |
| 4 | `api_gateway` | Médio | 3 h | `api_gateway` −1670 MiB |
| 5 | `nginx` | Baixo | 0,5 h | Tempos (C1.1, C1.2) |
| 6 | — | — | Série de cerca de 3 h, a correr sozinha | Medição final |

## 7. Implementação

Feita a 17 de novembro de 2026, no ramo `fase2/rnf-f2-01-carregamento`, com um commit por passo e
um passo de afinação (5b) que o plano previa como possível (secção 4.3). Depois de cada passo
correram os testes unitários do serviço alterado, a regressão completa
(`../regressao/passos/`) e a M1.1 com 100 e 500 MiB, com duas repetições (`../medicoes/passos/`).
São medições intermédias: o valor de cada requisito é o da medição final.

### 7.1 Resultados por passo

Acréscimo máximo de memória com 500 MiB (máximo das repetições; na base, de 5) e tempos do envio
(mediana):

| Passo | `nginx` | `api_gateway` | `projects` | `img_storage` | C1.1 aceitação | C1.2 envio completo | Regressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Base | 19 | 2001 | 1044 | 1016 | 8,96 s | 10,22 s | 74/74, 8/8, 18/18, 3/3 |
| 1. `img_storage` em fluxo | 19 | 1922 | 1039 | **96** | 16,49 s | 17,61 s | 74/74, 8/8, 18/18, 3/3 |
| 2. `projects` sem `follow-redirects` | 19 | 1986 | 1048 | 90 | 8,43 s | 9,61 s | 74/74, 8/8, 18/18, 3/3 |
| 3. `projects` em fluxo | 19 | 1727 | **50** | 111 | 7,77 s | 9,10 s | 74/74, 13/13, 18/18, 3/3 |
| 4. `api_gateway` em fluxo | 98 | **75** | 95 | 108 | 4,96 s | 6,44 s | 74/74, 13/13, 18/18, 3/3 |
| 5. nginx sem guardar o corpo | **10** | 82 | 98 | 101 | **1,11 s** | 5,13 s | 74/74, 13/13, 18/18, 3/3 |
| 5b. Afinação | 11 | **41** | **18** | **51** | 0,65 s | 5,04 s | 74/74, 13/13, 18/18, 3/3 |
| 5b, com 1000 MiB | 11 | 42 | 19 | 52 | 0,77 s | 10,26 s | |

Em todos os passos, as 18 impressões da regressão ponta a ponta são iguais às da base. Nos passos 3
a 5b, as sete decisões e mensagens do C1.5 são iguais às da base, e o C1.7 não encontra objetos
órfãos nem envios em partes abertos. O C1.3 passou de 401 com +1006 MiB para 401 com +41 MiB (passo 4)
e +20 MiB (passo 5b). Os 13 testes do `projects` incluem os 8 existentes. Os tempos do passo 1 estão
dentro da variação da base (desvio-padrão de 5,9 s).

### 7.2 Afinação (passo 5b)

Depois do passo 5, nenhum serviço guardava o ficheiro, mas os três serviços Node ainda subiam 80 a
100 MiB com 500 MiB, acima do alvo de 64 MiB. A causa não eram cópias do ficheiro, e sim a recolha
tardia dos buffers já enviados: o V8 só recolhe os blocos de memória externa ao fim de dezenas de MiB,
e a glibc guarda a memória libertada nas suas *arenas*. Seis variantes, medidas com o mesmo método
(500 MiB, duas repetições, `../medicoes/passos/afinacao/`):

| Variante | `api_gateway` | `projects` | `img_storage` |
| --- | --- | --- | --- |
| Sem afinação | 80 | 86 | 99 |
| glibc devolve a memória (`MALLOC_*`) | 77 | 87 | 83 |
| Geração nova do V8 menor (`--max-semi-space-size=1`) | 44 | 21 | 94 |
| As duas | 42 | 16 | 71 |
| Geração nova menor e *old space* de 96 MiB | 42 | 17 | 81 |
| As três | 42 | 30 | 63 |

Adotou-se a geração nova menor e as opções da glibc nos três serviços, através do
`docker-compose.yaml`. No `img_storage`, que é pequeno e guarda partes de 5 MiB, juntou-se o limite
da *old space* de 96 MiB e o envio de 2 partes em paralelo em vez de 4 (a primeira afinação da
secção 4.3). O limite da *old space* não se aplicou ao `projects`, que monta ZIPs e usa o `sharp`
e poderia ficar sem memória. Custo medido: o envio completo de 100 MiB demora cerca de 0,3 s mais
do que no passo 5 (1,2 a 1,5 s; base 1,9 s), pela recolha de lixo mais frequente.

### 7.3 Desvios ao plano

| Desvio | Porquê |
| --- | --- |
| O passo 2 não baixou o pico do `projects` | A previsão estava errada: na base, o pico de 2× vinha também da cópia temporária para o `ffprobe`, que conta como cache de páginas e tem o mesmo tamanho. A cópia do `follow-redirects` saiu no passo 2, mas o pico só caiu no passo 3 |
| O `projects` não chega a guardar um ficheiro do tipo errado para o endpoint (imagem em `/video`, vídeo em `/img`) | O motor de armazenamento lê esse ficheiro e descarta-o, porque a rota o recusa de qualquer maneira. Menos escritas e menos órfãos possíveis; a resposta é a mesma |
| Um pedido sem JWT válido não ocupa memória, mas o gateway lê o corpo até ao fim e descarta-o antes de responder 401 | É o comportamento que o cliente via na base, que só recebia a resposta depois de enviar tudo. Responder a meio do envio dava ao browser um erro de rede em vez da mensagem |
| Passo 5b, não previsto como passo | Previsto como afinação possível na secção 4.3. Os valores dos passos 3 a 5 ficavam acima do alvo |
| O `nodemon` do `api_gateway` não deu pelas alterações | Montagem de pastas do Docker Desktop no Windows; o serviço foi reiniciado à mão antes de medir. Nota no `AGENTS.md` |

### 7.4 Medição final

Feita a 17 e 18 de novembro de 2026 com o método completo da base (`../medicoes/final/rnf-f2-01/`,
análise em `../analise.md`):

| Medida | Base | Final | Alvo | Mínimo |
| --- | --- | --- | --- | --- |
| M1.1 (1000 MiB, serviço que mais cresce) | Não mensurável (motor do Docker em baixo) | 56,3 MiB (`img_storage`) | ≤ 64 MiB | ≤ 128 MiB |
| M1.2 | 100 MiB | 1000 MiB | 1000 MiB | 500 MiB |

Os sete controlos C1.x cumprem o limite. A regressão final dá os mesmos resultados da base:
- pytest 74/74;
- `node --test` 13/13;
- ponta a ponta 18/18, com as mesmas impressões;
- interface 3/3.

As medidas do RNF-F2-02 não mudaram. Uma comparação A/B na mesma sessão mostrou que o aumento do
C2.1 na série final vinha da máquina e não deste ADR (`../analise.md`, 4.2). Das previsões da
secção 4.3, só a do nginx se confirmou (18 → 10 MiB com 500 MiB). Nos três serviços Node, o
máximo com 500 MiB ficou acima do previsto:

| Serviço | Previsto | Medido |
| --- | --- | --- |
| `api_gateway` | < 20 MiB | 42,6 MiB |
| `projects` | < 20 MiB | 42,7 MiB |
| `img_storage` | < 40 MiB | 55,3 MiB |

A previsão contava só com os buffers dos streams e não com a memória que o V8 e a glibc demoram a
devolver (secção 7.2). Mesmo assim, os três ficam abaixo do alvo.

### 7.5 Medição com o RNF-F2-02 integrado

Feita a 18 e 19 de novembro de 2026 no ramo `fase2/integracao` (commit `eb8a37d`), com o mesmo
método (`../medicoes/final/integrado/`; análise em `../analise.md`, secção 7):

| Medida | Isolado | Integrado | Alvo | Mínimo |
| --- | --- | --- | --- | --- |
| M1.1 (1000 MiB, serviço que mais cresce) | 56,3 MiB (`img_storage`) | 62,4 MiB (`img_storage`) | ≤ 64 MiB | ≤ 128 MiB |
| M1.2 | 1000 MiB | 1000 MiB | 1000 MiB | 500 MiB |

O alvo continua atingido, e os sete controlos C1.x cumprem o limite. O código do `img_storage` é o
mesmo nas duas versões: o máximo variou entre 49 e 62 MiB nas cinco repetições da série conjunta, e
a margem para o alvo ficou em 1,6 MiB. A regressão deu os mesmos resultados da base, e as medidas e
os controlos do RNF-F2-02 também cumprem, incluindo o C2.1, comparado com a base na mesma sessão.

### 7.6 Revisão

Revisto pela equipa a 19 de novembro de 2026, passo a passo, sem alterações (`../ia.md`). O estado
passou a "Aceite".
