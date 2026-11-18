# ADR-02 — Estado da execução no servidor e interface que não bloqueia

| Campo | Valor |
| --- | --- |
| Estado | Proposto, para validação pela equipa |
| Data | 18 de novembro de 2026 |
| Requisito | RNF-F2-02 — Trabalho em segundo plano durante o processamento (`../requisitos-nf.md`, secção 3) |
| Base | Commit `0523102` (no nosso repositório, `43a2e08`) |
| Evidência | `../diagnostico.md` (C4), `../medicoes/baseline/` |

## 1. Contexto

### 1.1 Como se acompanha uma execução na base

| Parte | Onde | O que faz |
| --- | --- | --- |
| Estado "a processar" | `frontend/app/dashboard/[pid]/page.tsx:89-93` | Quatro `useState` da página do projeto. Recarregar ou sair da página apaga-os |
| Progresso das imagens | `page.tsx:300-400` | O browser conta eventos `process-update`, um por passo (imagem, ferramenta) concluído |
| Progresso dos vídeos | `Tools/video/video.py:112-124`, `wsGateway/index.js:65-72` | O worker envia a percentagem diretamente para a `ws_queue`; o orquestrador não a vê e ninguém a guarda |
| Barra mostrada | `page.tsx:116-132` | Cada vídeo conta como **um** passo, igual a um passo de imagem |
| Interface durante a execução | `page.tsx:894-927` | Um painel `absolute ... z-50` cobre a página do projeto. O único controlo é `Cancelar` |
| Estado no servidor | `projects/routes/projects.js:1521-1815`, `169-541` | `activeToken`, `committedToken` e um registo `Process` por passo em curso. Não há rota que diga "esta execução vai em X%": as rotas `GET .../process` só devolvem resultados concluídos (`projects.js:972`, `1032`) |
| Cancelamento | `projects.js:2252-2355`; botão em `page.tsx:914-924` | A rota existe, mas o botão só aparece dentro do painel, que desaparece com a página |

### 1.2 O que a medição inicial mostrou

| Medida | Base | Mínimo | Alvo |
| --- | --- | --- | --- |
| M2.1 (ações concluídas durante uma execução) | 0% | 80%, com G1 completo | 100% |
| M2.2 R (recarregar) e F (fim noutra página) | Não recupera em 60 s (6/6 e 3/3) | ≤ 5 s | ≤ 2 s |
| M2.3 (cancelar depois de perder a página) | 0/10 | 5/5 na forma A | 10/10 |
| C2.2 (maior intervalo entre mudanças do progresso) | 16,9 s (máx. 18,1 s) | ≤ 5 s | — |

O C2.2 da base explica-se pelo código: em P (um vídeo e duas imagens, duas ferramentas), a barra tem
5 passos e o vídeo vale um. O worker reporta de 2 em 2% (`Tools/video/video_processor.py:221`), o
que mexe a barra 0,4 pontos de cada vez; o número inteiro mostrado só muda a cada 5% do vídeo, cerca
de 13 a 16 s.

### 1.3 Forças da decisão

1. **Uma fonte de verdade.** O estado tem de sobreviver à página, à sessão do browser e ao reinício
   do `ws_gateway`, e ser o mesmo em todas as abas (M2.2, M2.3).
2. **Progresso que reflita o tempo real.** Num projeto misto, o vídeo é quase todo o trabalho; a barra
   tem de avançar ao ritmo dele (C2.2, REQ-VID-STATUS-003: atualizar a cada 2 s, no máximo 5 s).
3. **Comportamento funcional igual.** Os mesmos resultados, o mesmo cancelamento, as mesmas quotas e
   os mesmos eventos que a suite de regressão regista (`process-update`, `process-error`,
   `video-progress`, `preview-*`).
4. **Segurança.** O estado de uma execução só pode ser visto por quem pode ver o projeto (C2.3).
5. **Trabalho paralelo com o RNF-F2-01.** O ADR-01 mexe na receção de media
   (`addProjectMedia`); este mexe no processamento. Os dois tocam `projects/routes/projects.js`,
   em zonas diferentes.
6. **Prazo.** Entrega a 20 de novembro; a medição final demora cerca de 2,5 h por versão.

## 2. Alternativas consideradas

### A — Estado da execução no orquestrador, guardado no MongoDB e enviado ao browser (escolhida)

O `projects`, que já abre, encadeia, conclui e cancela as execuções, passa a guardar cada uma numa
coleção nova (`runs`): projeto, dono, quem a iniciou, *token*, estado (`running`, `done`, `failed`,
`cancelled`) e, por media, o trabalho total e o feito. O worker de vídeo passa a reportar o progresso
ao orquestrador (pela `project_queue`) em vez de o mandar ao browser. O orquestrador atualiza o
estado, reencaminha o evento antigo e publica um evento novo, `run-status`, que o `ws_gateway` entrega
ao dono e a quem a iniciou. Duas rotas novas devolvem o estado: a de um
projeto e a lista das execuções em curso do utilizador. O frontend passa a ter um fornecedor de estado
no *layout* do painel, um indicador que não bloqueia na página do projeto e uma lista de trabalho em
segundo plano visível nas outras páginas.

| A favor | Contra |
| --- | --- |
| Uma fonte de verdade, persistente, que serve a página recarregada, outra sessão e outra aba (M2.2, M2.3 nas formas A e B) | Mais escritas no MongoDB: uma por passo de imagem e cerca de uma por segundo por vídeo em curso (C2.1) |
| O progresso passa a ser calculado num só sítio, com o peso real de cada media | O worker de vídeo muda o destino das mensagens de progresso. As ferramentas de imagem não mudam |
| A rota de estado passa pelo gateway, com a mesma verificação de JWT e de dono das outras rotas (C2.3) | É a alternativa com mais ficheiros alterados: orquestrador, gateway, `ws_gateway`, worker e frontend |
| O orquestrador já sabe quando uma execução acaba, falha ou é cancelada; o estado fica coerente com os *tokens* que já existem | |
| Os eventos antigos continuam iguais; o novo acrescenta-se | |

### B — O `ws_gateway` guarda o último progresso em memória e repete-o a quem se liga

O worker e o orquestrador continuam a mandar eventos para a `ws_queue`; o `ws_gateway` guarda o último
de cada projeto e envia-o quando um socket entra na sala do projeto.

| A favor | Contra |
| --- | --- |
| Poucas alterações no servidor; nenhuma escrita no MongoDB | O estado perde-se quando o `ws_gateway` reinicia, e o serviço passa a ter estado, o que impede ter mais do que uma réplica |
| | Dois donos do estado: o orquestrador sabe se a execução está ativa ou cancelada, o gateway sabe o progresso. Um cancelamento ou uma falha podem deixar um progresso antigo a ser repetido |
| | O progresso das imagens continua a ser contado no browser, que não sabe quantos passos já tinham acontecido antes de recarregar |
| | O estado só existe pelo WebSocket. Não há forma de o pedir por REST, nem de o proteger com as regras de acesso das outras rotas |

### C — Só no browser: reconstruir o estado com os dados que a API já devolve

O frontend guarda no `localStorage` que iniciou uma execução e, ao carregar, deduz se ela continua
ativa a partir dos campos do projeto (`activeToken`, `committedToken`) e dos resultados.

| A favor | Contra |
| --- | --- |
| Sem alterações no servidor | Não serve a forma B da M2.3 (outra sessão, sem `localStorage`) nem outra máquina |
| | Os *tokens* não chegam para saber se uma execução está ativa: o cancelamento também incrementa o `activeToken`, e uma execução falhada nunca chega a `committedToken` |
| | O progresso perde-se ao recarregar até ao próximo evento do vídeo, e o das imagens não se consegue reconstruir |

### Descartadas sem análise detalhada

- **A com consulta periódica (polling) em vez de eventos.** Para cumprir o C2.2 cada aba aberta teria de
  pedir o estado de segundo a segundo. O WebSocket já existe e já chega a todas as páginas.
- **Notificações do sistema operativo (Web Push) ou por email.** Funcionalidade nova, que as
  diretrizes excluem; o aviso dentro da aplicação chega para a M2.2.
- **Um serviço novo de execuções.** Tiraria a orquestração do `projects`, o que é a fragilidade C2
  do diagnóstico e não cabe no prazo.

## 3. Decisão

**Adota-se a alternativa A: o estado de cada execução passa a ser do orquestrador, guardado no
MongoDB, exposto por REST e enviado ao browser por WebSocket; a interface deixa de bloquear.**

Justificação:

1. **É a única que serve as três medidas nas duas formas da M2.3.** B não sobrevive a um reinício
   do gateway nem permite pedir o estado; C não serve outra sessão.
2. **Corrige a causa do C2.2 em vez de a esconder.** O peso de cada media passa a refletir o
   trabalho, e o worker reporta pelo tempo (uma vez por segundo), que é a escala do
   REQ-VID-STATUS-003.
3. **Fica no sítio certo da arquitetura.** O orquestrador já é dono do ciclo de vida da execução; o
   `ws_gateway` continua a ser só um distribuidor de eventos, sem estado.
4. **Preserva o comportamento funcional.** As rotas, os resultados e os eventos existentes não
   mudam; a rota de estado e o evento `run-status` acrescentam-se.
5. **Divide-se em passos pequenos** (secção 6): primeiro o servidor, sem efeito visível, depois a
   interface.

### 3.1 Como se calcula o progresso

Cada media tem um trabalho total, em "fotogramas processados":

- uma imagem conta um fotograma por ferramenta de imagem do pipeline;
- um vídeo conta os seus fotogramas (`duração × fps`, lidos no carregamento), uma vez.

O progresso da execução é o trabalho feito sobre o total. Um passo de imagem concluído soma um; o
progresso de um vídeo é a percentagem que o worker reporta, vezes o total desse vídeo. Num projeto só
com imagens, o resultado é o mesmo da base (passos concluídos sobre passos totais). Em P, o vídeo vale
9 900 fotogramas e as imagens quatro, e a barra avança ao ritmo do vídeo.

O worker passa a reportar a percentagem com uma casa decimal, no máximo uma vez por segundo, além
dos 100% no fim. Na base reportava a cada 2%. O evento antigo `video-progress` continua a levar uma
percentagem inteira.

### 3.2 Interface

| Onde | Na base | Depois |
| --- | --- | --- |
| Página do projeto em processamento | Painel que cobre a página, com a barra e `Cancelar` | Uma faixa por baixo do cabeçalho com a barra, a percentagem e `Cancel`. O resto da página continua a funcionar: vistas, transferência, partilha, resultados anteriores |
| Edição do pipeline desse projeto | Impossível (estava tapada) | Bloqueada enquanto a execução corre, com o modo só de leitura que já existe para partilhas (`canEdit`); `Apply` fica desativado |
| Outras páginas da aplicação | Sem indicação | Um painel pequeno, no canto inferior direito, com o nome e o progresso de cada execução em curso noutro projeto |
| Fim de uma execução | Só na página do projeto: passa ao modo de resultados | Igual na página do projeto. Noutra página, o painel mostra que terminou (região `status`), com uma ligação para os resultados |
| Falha | Aviso (`process-error`) só na página do projeto | Igual; o progresso desaparece e, noutra página, o painel mostra a falha (região `alert`) |
| Recarregar, nova sessão | O estado perde-se | O estado é pedido ao servidor ao carregar e atualizado pelos eventos |

## 4. Consequências

### 4.1 Comportamento funcional

| Aspeto | Na base | Depois | Como se verifica |
| --- | --- | --- | --- |
| Rotas existentes (`POST`/`DELETE .../process`, `GET .../process`, `.../process/url`) | — | Iguais: mesmos códigos e corpos | Regressão T05 a T17 |
| Resultados de cada execução | — | Iguais; o encadeamento dos passos e o *commit* não mudam | Impressões T05 a T14 iguais às da base; C2.4 |
| Cancelamento | Apaga resultados e `Process`, devolve quotas | Igual, e marca a execução como cancelada | T16, U03, M2.3 |
| Eventos `process-update`, `process-error`, `video-progress`, `preview-*` | — | Iguais. O `video-progress` passa a chegar mais vezes (cada segundo, em vez de cada 2%) e via orquestrador | T08 a T12 |
| Novas rotas | — | `GET /projects/:user/:project/process/status` e `GET /projects/:user/process/active` | C2.3 e testes unitários |
| Novo evento | — | `run-status`, com o estado da execução | Medição intermédia de cada passo |
| Alterar o pipeline de P durante a execução | Pela API, aceite (C2.5); pela interface, impossível | Pela API, igual; pela interface, bloqueado | C2.5 |
| Colaborador com ligação de partilha que não iniciou a execução | Não via nada: os eventos iam só para quem a iniciou | Vê o estado ao abrir a página do projeto; as atualizações em tempo real só chegam ao dono e a quem iniciou (secção 4.2, confidencialidade) | Revisão de código |
| Cancelar logo depois de abrir o projeto | O `POST .../dirty` da abertura muda a versão; um pedido com a versão antiga recebe 409 | O cancelamento repete uma vez com a versão que o 409 devolve (`serverVersion`) | M2.3 |

### 4.2 Outros requisitos não funcionais

| Requisito | Efeito esperado | Controlo |
| --- | --- | --- |
| Eficiência — comportamento temporal | Uma escrita no MongoDB por passo de imagem e cerca de uma por segundo por vídeo, e uma mensagem a mais por relatório de progresso (worker → orquestrador → `ws_queue`). Esperado: diferença na duração de P abaixo da variação entre execuções | C2.1 |
| Usabilidade — operabilidade (REQ-VID-STATUS-003) | Progresso atualizado a cada segundo durante o vídeo, em vez de a cada 13 a 16 s | C2.2 |
| Segurança — confidencialidade | A rota de estado passa pelo `auth.checkToken` do gateway (JWT do próprio dono, ou ligação de partilha válida). O evento só vai para as salas do dono e de quem iniciou, que só se juntam com um JWT válido. A sala `project:<id>` fica de fora: no `ws_gateway`, qualquer socket entra nela sem verificação de acesso (fragilidade da base, que já expõe por ali os eventos `project-updated` e `project-op`) | C2.3 |
| Adequação funcional — correção | Duas execuções em projetos diferentes passam a poder ser iniciadas pela interface | C2.4 |
| Fiabilidade — recuperabilidade | O estado sobrevive à página, à sessão e ao reinício do `ws_gateway`. Se um worker morrer a meio, a execução fica "em curso", como os `Process` da base (C7, fora de âmbito); o cancelamento limpa-a | C2.6 (coberto por M2.2 e M2.3) |
| Manutenibilidade — modificabilidade | Um modelo, um módulo de cálculo com testes unitários e um fornecedor de estado no frontend. A página do projeto perde a contagem de eventos (cerca de 150 linhas) | Revisão de código |

### 4.3 Valores esperados

| Medida | Base | Esperado | Porque |
| --- | --- | --- | --- |
| M2.1 | 0% | 100% | Nada bloqueia a página; o progresso de P está na página de P e no painel das outras |
| M2.2 R | Não recupera | ≤ 2 s | O estado é pedido ao servidor quando a página carrega |
| M2.2 F | Não recupera | ≤ 1 s | O `run-status` final sai logo depois do *commit*, que é quando os resultados ficam disponíveis na API |
| M2.3 | 0/10 | 10/10 | O `Cancel` está na faixa da página de P, que se reconstrói a partir do servidor |
| C2.1 | 275,9 s | Igual, dentro da variação | O trabalho do worker é o mesmo |
| C2.2 | 16,9 s | Cerca de 1 s no vídeo; o maior intervalo deve ser o do arranque (descarregar os media e começar a descodificar), abaixo de 5 s | Relatório por segundo e peso real do vídeo |

### 4.4 Riscos

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| Um relatório de progresso chega depois do fim (as mensagens da `project_queue` são tratadas em paralelo) e faz recuar o estado | Alta, sem cuidado | As atualizações só tocam execuções `running` com o mesmo *token* e usam `$max` |
| O painel do canto tapa um controlo que a M2.1 usa | Média | Fica fora do `main`, sem ligações com o nome do projeto, e esconde o projeto da página atual. Validado pela M2.1 do passo 4 |
| Uma entrada em curso dentro de uma região `status` dá uma falsa notificação de fim na M2.2 F | Média | Só a entrada de execução terminada usa `role="status"` |
| Mudar o destino do progresso do worker atrasa as pré-visualizações de vídeo | Baixa | O orquestrador reencaminha o mesmo evento; T08 confirma |
| Conflitos com o RNF-F2-01 em `projects/routes/projects.js`, `AGENTS.md` e `ia.md` | Média | Zonas diferentes do ficheiro; a integração dos dois ramos faz-se na medição conjunta |
| A reconstrução do frontend demora e falha por tipos | Baixa | `bun run build` no passo 4 antes de medir |

## 5. Validação da decisão

A decisão fica confirmada se a medição final der:

- **M2.1:** 100% (alvo) ou 80% com G1 completo (mínimo), na pior de 3 execuções.
- **M2.2:** R e F ≤ 2 s (alvo) ou ≤ 5 s (mínimo), no pior valor.
- **M2.3:** 10/10 (alvo) ou 5/5 na forma A (mínimo).
- **Controlos:** C2.1 dentro de +10% da base medida na mesma sessão; C2.2 ≤ 5 s; C2.3 recusado sem
  JWT e com o de outro utilizador; C2.4 e C2.5 iguais à base.
- **Regressão:** `REGRESSAO=final ./correr.sh` sem falhas e sem diferenças face à referência.

## 6. Plano de refactoring

Cada passo é um commit no ramo `fase2/rnf-f2-02-segundo-plano`. O ramo parte do commit dos
documentos da fase 2 (`47c303b`, que é o `main` mais `Docs/fase2`, sem código), para não levar as
alterações do RNF-F2-01. A ordem vai do servidor para a interface: até ao passo 3 o browser vê o
mesmo que na base, e cada passo verifica-se pela API.

Depois de cada passo:

```bash
docker compose up -d --build <serviços do passo> && docker compose restart nginx
docker compose run --rm --no-deps -T projects sh -c "node --test tests/*.test.js"
cd Docs/fase2/medicoes && MEDICAO=passos-rnf2/passo-N node rnf2/estado.mjs --video 120
cd ../regressao && REGRESSAO=passos-rnf2/passo-N ./correr.sh
```

`rnf2/estado.mjs` (novo, passo 1) inicia P pela API, lê a rota de estado a cada 250 ms e os eventos
`run-status`, e regista a duração, o maior intervalo entre mudanças do progresso no servidor, o estado
final e as respostas da rota com o JWT de outro utilizador e sem JWT. Os resultados ficam em
`medicoes/passos-rnf2/` e `regressao/passos-rnf2/`.

### Passo 0 — Preparação (sem código da aplicação)

- Criar o ramo e este ADR.
- **Validação:** nenhuma alteração fora de `Docs/`.

### Passo 1 — Estado da execução no orquestrador

| | |
| --- | --- |
| Ficheiros | Novos `projects/models/run.js`, `projects/controllers/run.js`, `projects/utils/runState.js`, `projects/tests/run-state.test.js`; `projects/routes/projects.js` (rota `POST .../process`, `process_msg`, rota `DELETE .../process`, `deleteProjectAndResources`, duas rotas `GET` novas); `apiGateway/routes/projects.js` (as duas rotas novas) |
| `runState.js` | Funções puras: o trabalho de cada media a partir do projeto, o progresso de uma execução e a vista que se devolve (`projectId`, `projectName`, `ownerId`, `token`, `status`, `progress`, `startedAt`, `finishedAt`, `error`) |
| Orquestrador | Cria a execução quando a abre (depois de incrementar o `activeToken`), soma um passo quando uma imagem conclui um passo, marca o vídeo como completo quando o worker responde, passa a `done` no *commit*, a `failed` no primeiro erro e a `cancelled` no cancelamento. Nada muda no encadeamento nem no *commit* |
| Rotas | `GET /:user/:project/process/status` (com `checkSharePermission`): a última execução do projeto, ou `{ status: "idle" }`. `GET /:user/process/active` (só o próprio): as execuções em curso dos projetos do utilizador e das que ele iniciou |
| Testes unitários | Trabalho por media (imagens, vídeos, projeto misto, ferramentas só de vídeo); progresso monótono e limitado a 100; vista sem campos internos |
| Regressão | Suite completa |
| Medição | `estado.mjs`: a rota devolve `running` com progresso a subir e `done` no fim; outro utilizador e sem JWT recusados (C2.3) |
| Reconstruir | `projects`; reiniciar `api_gateway` e `nginx` |

### Passo 2 — O progresso do vídeo passa pelo orquestrador

| | |
| --- | --- |
| Ficheiros | `Tools/video/video.py`, `Tools/video/video_processor.py`, `Tools/video/tests/test_video_processor.py`; `projects/routes/projects.js` (só o início de `process_msg`); `projects/utils/project_msg.js` |
| Worker | `_progress` publica na `project_queue` uma mensagem `type: "progress"` com o `correlationId` do trabalho, a percentagem e o bloco `progress` que o orquestrador lhe mandou (com o *token*). Em `_process_video`, reporta com uma casa decimal, no máximo uma vez por segundo, e sempre os 100% |
| Orquestrador | Trata as mensagens de progresso antes de procurar o `Process`: atualiza o vídeo na execução (só se `running`, com `$max`) e reencaminha o `video-progress` de sempre para a `ws_queue`, com a percentagem inteira. Nas pré-visualizações só reencaminha |
| Testes | pytest: progresso monótono, com intervalo mínimo entre relatórios e 100% no fim. `node --test`: progresso de uma execução mista com o vídeo a meio |
| Regressão | Suite completa (T08 a T12 em especial) |
| Medição | `estado.mjs`: maior intervalo entre mudanças do progresso no servidor durante o vídeo, perto de 1 s |
| Reconstruir | `video_tool`, `projects` |

### Passo 3 — Evento `run-status`

| | |
| --- | --- |
| Ficheiros | `projects/utils/project_msg.js` (`send_msg_run_status`); `projects/routes/projects.js` (chamadas nos pontos do passo 1 e 2); `wsGateway/index.js`; novos `wsGateway/utils/runStatus.js` e `wsGateway/tests/run-status.test.js` |
| Alteração | O orquestrador publica o estado na `ws_queue` sempre que muda. O `ws_gateway` entrega-o como `run-status` às salas do dono e de quem iniciou, uma só vez por socket. Não o manda para a sala do projeto, onde qualquer socket entra sem verificação |
| Testes unitários | Salas escolhidas para cada mensagem, nunca a do projeto; mensagem sem projeto ignorada |
| Regressão | Suite completa |
| Medição | `estado.mjs`: eventos recebidos pelo dono com a mesma cadência da rota; um socket de outro utilizador não recebe nenhum |
| Reconstruir | `projects`, `ws_gateway` |

### Passo 4 — Interface que não bloqueia

| | |
| --- | --- |
| Ficheiros | `frontend/components/ui/progress.tsx` (passa o valor ao elemento acessível: `aria-valuenow`); novos `frontend/providers/runs-provider.tsx` e `frontend/components/runs/background-runs.tsx`; `frontend/lib/projects.ts` (pedidos de estado; repetição do cancelamento com a versão do 409); `frontend/app/dashboard/layout.tsx`; `frontend/app/dashboard/[pid]/page.tsx`; `frontend/components/project-page/project-image.tsx` (sem apagar media enquanto o projeto processa) |
| Fornecedor | Ao montar, pede as execuções em curso; ouve `run-status`; volta a pedir quando o socket se religa. A página do projeto pede o estado do seu projeto ao abrir |
| Página do projeto | Sai o painel que cobria a página e a contagem de eventos. Entra a faixa com a barra e `Cancel`. `Apply`, importar, *presets*, assistente e a barra de ferramentas ficam bloqueados enquanto o projeto processa. No fim, o mesmo de antes: atualiza os resultados e passa ao modo de resultados |
| Validação | `bun run build` sem erros; U01 a U03; M2.1, M2.2, M2.3 (uma tentativa por forma) e C2.1/C2.2 com uma execução cada, com o vídeo de 330 s |
| Reconstruir | `frontend`; `docker compose restart nginx` |

### Passo 5 — Documentação e fecho

- `AGENTS.md`: o estado da execução é do orquestrador; o worker de vídeo reporta ao orquestrador; a
  interface não bloqueia.
- `../medicoes/README.md`: o `PICTURAS_STATE_PATH` a usar e a tabela de ajustes de seletores, se for
  preciso algum.
- `../ia.md`: uso de IA neste ADR e na implementação.
- Atualizar o estado deste ADR com os valores medidos.

A medição final (série completa com `MEDICAO=final/rnf-f2-02` e regressão) é a etapa 7 e não faz parte
deste plano.

### Resumo

| Passo | Serviços | Risco | Esforço estimado | Efeito esperado |
| --- | --- | --- | --- | --- |
| 0 | — | Baixo | 0,5 h | — |
| 1 | `projects`, `api_gateway` | Médio | 3 h | Estado consultável pela API (C2.3); sem efeito visível |
| 2 | `video_tool`, `projects` | Médio | 1,5 h | Progresso do vídeo no servidor, a cada segundo |
| 3 | `projects`, `ws_gateway` | Baixo | 1 h | Evento `run-status` |
| 4 | `frontend` | Médio | 4 h | M2.1, M2.2, M2.3 e C2.2 |
| 5 | — | — | 1 h | Documentação |

## 7. Implementação

Feita a 18 de novembro de 2026, com um commit por passo (`f1714dc` a `77c9bf7`). Depois de cada
passo correram:

- os testes unitários do serviço alterado;
- a regressão completa (`../regressao/passos-rnf2/`);
- a verificação do passo (`../medicoes/passos-rnf2/`): nos passos 1 a 3, `estado.mjs` pelo servidor,
  com o vídeo de 120 s; no passo 4, as medidas do browser com o vídeo de 330 s e uma execução.

São verificações intermédias: o valor de cada requisito é o da medição final.

O ramo foi publicado como `fase2/rnf-f2-02-segundo-plano-medido`, e não com o nome da secção 6. Um
membro da equipa publicou com esse nome uma implementação diferente do mesmo requisito, feita em
paralelo. A escolha entre as duas é da equipa. A medição final é a desta.

### 7.1 Resultados por passo

Verificação pelo servidor, um projeto com o vídeo de 120 s e duas imagens:

| Passo | Rota de estado | Progresso no servidor | `video-progress` (maior intervalo) | `run-status` | C2.3 (outro utilizador / sem JWT) | Regressão |
| --- | --- | --- | --- | --- | --- | --- |
| Base | Não existe | Não existe | A cada 2% (C2.2 de 16,9 s com o vídeo de 330 s) | Não existe | — | 74/74, 8/8, 18/18, 3/3 |
| 1. Estado no orquestrador | `idle`, `running`, `done` com 100 | 2 mudanças: o vídeo só conta quando acaba | 3,98 s | — | 401 / 401 | 74/74, 14/14, 18/18, 3/3 |
| 2. Progresso pelo orquestrador | Igual | 107 mudanças, maior intervalo 2,06 s | 1,96 s | — | 401 / 401 | 75/75, 14/14, 18/18, 3/3 |
| 3. Evento `run-status` | Igual | 109 mudanças, maior intervalo 1,73 s | 1,79 s | 121 eventos, maior intervalo 1,79 s; nenhum chega a outro utilizador | 401 / 401 | 75/75, 14/14, 18/18, 3/3 |

A regressão aparece pela ordem pytest, `node --test` do `projects`, ponta a ponta e interface. Os 14
testes do `projects` incluem os 8 da base. O pytest passou de 74 para 75 testes com o teste de
cadência do passo 2. No passo 3 juntaram-se 3 testes unitários ao `ws_gateway`.

Também se verificou o cancelamento pelo servidor, nos passos 1 e 3. No passo 3, a rota mostrou
`cancelled` 0,27 s depois do pedido. Os eventos chegaram pela ordem `running` e `cancelled`, e o
projeto ficou sem resultados.

Passo 4, interface, com o vídeo de 330 s e uma execução:

| Medida | Base | Passo 4 | Alvo |
| --- | --- | --- | --- |
| M2.2 R (recarregar aos 25% e 60%) | Não recupera | 0,35 s e 0,57 s | ≤ 2 s |
| M2.2 F (fim noutra página) | Não recupera | 0,11 s | ≤ 2 s |
| M2.3, forma A (recarregar) | 0/5 | 1/1; `Cancel` oferecido em 0,36 s | 5/5 |
| M2.3, forma B (sessão nova) | 0/5 | 1/1; `Cancel` oferecido em 0,39 s | 5/5 |
| Regressão | 74/74, 8/8, 18/18, 3/3 | 75/75, 14/14, 18/18, 3/3 | Sem falhas |

`bun run build` correu sem erros. A M2.1 e o C2.1/C2.2 do passo 4 não ficaram registados, por duas
razões:

- a M2.1 parou num `ECONNRESET` do reencaminhamento de portas do Docker Desktop, antes de o pedido
  chegar ao nginx (`../medicoes/passos-rnf2/passo-4/logs/rnf2-m21.log`);
- a execução do C2.1/C2.2 foi interrompida pela suspensão do portátil.

As duas medidas ficam para a medição final. O instrumento passou a repetir uma vez um `GET` que
falhe por `ECONNRESET` ou `EPIPE` (`../medicoes/lib/comum.mjs`, passo 5).

### 7.2 Desvios ao plano

| Desvio | Porquê |
| --- | --- |
| O worker reporta a cada segundo e também a cada ponto percentual inteiro, e não só "no máximo uma vez por segundo" | O `video-progress` que o orquestrador reencaminha leva a percentagem inteira. Só com a regra do segundo, um vídeo em que cada ponto demora menos de um segundo saltava valores inteiros; na base, o evento chegava a cada 2 pontos. Com o vídeo de 330 s (cerca de 2,2 s por ponto), quem marca o ritmo é a regra do segundo |
| O `run-status` não vai para a sala `project:<id>` | O plano inicial incluía-a. Ao implementar o passo 3 viu-se que o `ws_gateway` deixa qualquer socket entrar nessa sala sem verificar o acesso, e o estado inclui o nome do projeto e o dono. O ADR e o `AGENTS.md` foram corrigidos no mesmo commit (`54386cc`). Quem tem o projeto partilhado vê o estado pela rota, ao abrir a página |
| O ramo foi publicado com outro nome | Ver o início desta secção |
| A série final não repete a M1.1/C1.4 com 1000 MiB | Este ramo mantém o caminho de carregamento da base. Nesse caminho, o envio de 1000 MiB sem limites deitou abaixo o motor do Docker duas vezes (`../medicoes/ocorrencias/2026-11-16-queda-docker/`). A medida com 1000 MiB faz-se na série com os dois requisitos juntos. As outras medidas do RNF-F2-01 correm como na base |
