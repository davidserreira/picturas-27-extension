# ADR-02 — Estado da execução no orquestrador, com progresso enviado por push

| Campo | Valor |
| --- | --- |
| Estado | Implementado no ramo `fase2/rnf-f2-02-segundo-plano` (secção 7). Regressão e medição preliminar feitas noutra máquina (secção 8), com o alvo atingido em M2.1, M2.2 e M2.3; **medição final oficial por fazer** |
| Data | 18 de novembro de 2026 |
| Requisito | RNF-F2-02 — Trabalho em segundo plano durante o processamento (`../requisitos-nf.md`, secção 3) |
| Decisão no Exercício 7 | DA-2, táticas TAT-5, TAT-6 e TAT-7 (`../taticas.md`) |
| Base | Commit `0523102` (no nosso repositório, `43a2e08`) |
| Evidência | `../diagnostico.md` (C4), `../arquitetura.md` (EV-03, EV-04, EV-14), `../medicoes/baseline/` |

## 1. Contexto

### 1.1 Onde vive o estado de uma execução na base

```
                      ┌──────────── process-update (ws_queue) ───────────┐
projects ──► ferramentas de imagem ──► projects                          ▼
    └──────► video_tool ──────────── video-progress (ws_queue) ──► ws_gateway ──► browser
                                                                                (useState + contagem)
```

- O "a processar" é um `useState(false)` da página do projeto (`page.tsx:89`). Recarregar ou sair
  da página perde-o.
- O progresso das imagens é calculado no browser a contar eventos (`page.tsx:301-315`); o do vídeo
  vai do worker para a `ws_queue` (`video.py:112-124`) e nunca é guardado.
- O orquestrador não tem rota que responda "esta execução vai em X %".
- Um painel `absolute ... z-50` tapa a área do projeto durante a execução (`page.tsx:894-927`), e o
  Cancelar só existe nesse painel.

### 1.2 O que a medição inicial mostrou

| Medida | Base |
| --- | --- |
| M2.1 — ações concluídas durante uma execução | 0 % nas 3 execuções |
| M2.2 — recarregar (R) / fim noutra página (F) | Não recupera (6/6 e 3/3) |
| M2.3 — cancelar depois de perder a página | 0/10 |
| C2.2 — maior intervalo entre mudanças do progresso | 16,9 s |

O C2.2 da base explica-se pelo cálculo no browser: o vídeo contava como **um** passo entre cinco
(2 imagens × 2 ferramentas + 1 vídeo), o worker reportava a cada 2 % e a barra arredondava a
inteiros. O progresso visível só mudava quando o vídeo avançava o suficiente para mexer o total,
muito mais devagar do que o próprio worker.

### 1.3 Forças da decisão

- O estado tem de sobreviver a recarregar, a mudar de página e a uma sessão nova (M2.2, M2.3 B).
- O progresso tem de mudar pelo menos a cada 5 s (C2.2) sem degradar a duração (C2.1 ≤ base + 10 %).
- Outro utilizador, ou alguém sem JWT, não pode ver o estado (C2.3).
- Não se podem criar conflitos de versão com o pipeline nem com o RNF-F2-01, que mexe no mesmo
  ficheiro de rotas.
- Refactoring, não funcionalidade: o cancelamento e o progresso já existiam; não se acrescenta
  pausa, histórico nem notificações fora da aplicação.

## 2. Alternativas consideradas

### A — Estado só no browser (`localStorage`)

| A favor | Contra |
| --- | --- |
| Só muda o frontend; risco de regressão baixo | Falha a forma B da M2.3 e o alvo da M2.2 numa sessão nova |
| | O browser não sabe o progresso real depois de recarregar: os eventos perdidos não voltam |
| | O progresso do vídeo continua a não passar pelo orquestrador (C4 fica por resolver) |

### B — Estado no orquestrador, numa coleção própria, com push pelo `ws_gateway` (escolhida)

| A favor | Contra |
| --- | --- |
| Fonte única de verdade, lida por qualquer página ou sessão | Atravessa quatro serviços (`projects`, `video_tool`, `ws_gateway`, `api_gateway`) e o frontend |
| O vídeo passa a reportar ao orquestrador, como as imagens: segue o padrão global | Mais escritas no MongoDB (uma por 1 % de cada vídeo) e mais mensagens |
| Push: a interface muda logo que o servidor muda; C2.2 deixa de depender do browser | Mais uma coleção a manter coerente com o cancelamento e com a apagar do projeto |
| Coleção separada: não mexe na versão do `Project` | |

### C — Estado no documento `Project`

| A favor | Contra |
| --- | --- |
| Sem coleção nova; o projeto já tem `activeToken` e `committedToken` | Cada atualização do progresso mudaria a versão do projeto: conflitos (409) com as edições do pipeline durante a execução (C2.5) e com o carregamento (ação 7 da M2.1, RNF-F2-01) |
| | Escritas concorrentes no mesmo documento, vindas de vários resultados em simultâneo |

### D — Polling do estado sem push

| A favor | Contra |
| --- | --- |
| Não muda o `ws_gateway` | Atraso até ao intervalo de polling, que soma ao tempo do servidor (pior C2.2 e M2.2) |
| | Carga proporcional ao número de páginas abertas, mesmo sem execuções |

Fica só como recurso: enquanto houver uma execução ativa, o browser confirma o estado a cada 5 s,
para o caso de um evento se perder.

### Descartadas sem análise detalhada

Pausar/retomar e histórico de execuções (classe C, funcionalidade nova); notificações por email ou
push do sistema operativo (classe C); interromper o trabalho já entregue ao `video_tool` ao
cancelar (fora do âmbito, `requisitos-nf.md` 3.2).

## 3. Decisão

Alternativa **B**:

1. **Coleção `runs` no `projects`.** Uma linha por execução (`project_id` + `token`, o
   `activeToken` da execução), com o estado `running | completed | cancelled | failed`, o dono, quem
   a iniciou, o nome do projeto e o trabalho feito.
2. **Progresso ponderado.** Cada passo de imagem vale 1 unidade; cada vídeo vale a sua duração em
   segundos, multiplicada pela percentagem que o worker reporta. A percentagem tem uma casa
   decimal, para que 1 % de um vídeo longo mude sempre o valor mostrado; nunca chega a 100 antes de
   a execução fechar.
3. **O worker de vídeo reporta ao orquestrador.** `video-progress` passa a ir para o
   `project_queue`, a cada 1 % (antes, 2 % e para a `ws_queue`). A pré-visualização mantém o
   caminho antigo, porque não é uma execução.
4. **Push.** Em cada mudança, o `projects` publica `run-update` na `ws_queue`; o `ws_gateway` envia-o
   ao dono e a quem iniciou a execução.
5. **Duas rotas de leitura** (passam pelo `api_gateway`):
   `GET /projects/:user/:project/process/status` (última execução do projeto; dono, quem tem a
   partilha, ou 403) e `GET /projects/:user/runs/active` (execuções ativas do dono, ou terminadas
   há menos de 60 s).
6. **Frontend.** Um `RunsProvider` no layout do dashboard junta o estado inicial (rota) com os
   `run-update`; a página do projeto troca o painel bloqueante por uma barra não bloqueante com a
   percentagem e o Cancelar; a barra lateral mostra o progresso ao lado do nome do projeto (e, na
   página da conta, numa secção "Em processamento"); o fim, o cancelamento e a falha aparecem num
   aviso com o nome do projeto.

## 4. Consequências

### 4.1 Comportamento funcional

- Igual: o pipeline, os resultados, o cancelamento (mesmo significado: a execução deixa de produzir
  resultados e o projeto volta a ser editável), as quotas, a pré-visualização.
- Muda só a interação, como objeto da melhoria (classe B): a página deixa de ficar tapada; o
  Apply fica desativado enquanto a execução decorre, como antes (o painel impedia-o).

### 4.2 Outros requisitos não funcionais

| Controlo | Efeito esperado |
| --- | --- |
| C2.1 — duração de P | Neutro: o caminho dos dados não muda; as escritas e mensagens novas são pequenas |
| C2.2 — maior intervalo do progresso | Melhora: no P de medição, 1 % do vídeo ≈ 0,99 % do total e cada 1 % do worker muda o valor |
| C2.3 — estado a terceiros | Cumpre por construção: as rotas verificam o dono ou a partilha; o `run-update` só vai para o dono e para quem iniciou |
| C2.4 — execuções sobrepostas | Neutro: cada execução tem a sua linha (`project_id` + `token`) |
| C2.5 — ferramenta acrescentada a meio | Neutro: a versão do projeto não é tocada pelo progresso |
| RNF-F2-01 | Neutro: zonas diferentes do mesmo ficheiro; aplicar a DA-2 sobre o ramo da DA-1 não deu conflitos |

### 4.3 Valores esperados

M2.1 = 100 % (as ações 1–4 deixam de estar tapadas; as 5–10 passam a mostrar o progresso);
M2.2 R e F ≤ 2 s (uma leitura da rota ao carregar; o fim chega por push); M2.3 = 10/10 (o
Cancelar aparece em qualquer sessão do dono). São expectativas, não medições.

### 4.4 Riscos

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| Um `run-update` perde-se e a interface fica parada | Baixa | Confirmação pela rota a cada 5 s enquanto há execuções ativas e ao reconectar o socket |
| O `projects` cai a meio e a execução fica `running` para sempre | Baixa | Igual à base para o `Process`; fica registado como limitação (QS-04, fora do âmbito) |
| Intervalos maiores no início (descarregar o vídeo) ou no fim (enviar o resultado) | Média | Medido pelo C2.2; se falhar, reportar as fases sem progresso |
| Toast duplicado em vários separadores | Baixa | Chave por execução guardada na sessão do browser |

## 5. Validação da decisão

Medição final com `medicoes/rnf2/medir.mjs` (m21, m22, m23, controlos), primeiro neste ramo e
depois com o RNF-F2-01 integrado, com o mesmo vídeo de 330 s e o procedimento de
`requisitos-nf.md`. Os seletores do script continuam válidos: barra `role=progressbar` com
`aria-valuenow`, junto ao nome do projeto fora da sua página; aviso `role=status` com o nome do
projeto; botão "Cancelar".

## 6. Plano de refactoring

| Passo | Alteração | Serviços a reconstruir | Verificação |
| --- | --- | --- | --- |
| 1 | `projects` guarda e publica o estado (modelo, controlador, utilitário de progresso, rotas, fecho, cancelamento, falha) e `ws_gateway` reencaminha `run-update`; `api_gateway` expõe as duas rotas | `projects`, `ws_gateway`, `api_gateway` | `projects/tests` (incluindo `run-progress.test.js`) |
| 2 | `video_tool` reporta o progresso ao `project_queue`, a cada 1 % | `video_tool` | `Tools/video/tests` |
| 3 | Frontend: `RunsProvider`, barra não bloqueante, progresso nas barras laterais, avisos | `frontend`, reiniciar o `nginx` | `tsc`, `eslint`, verificação manual (recarregar, outra página, conta, cancelar depois de recarregar) |
| 4 | Medição final e documentação | — | `medicoes/final/rnf-f2-02/`, `analise.md` |

## 7. Implementação

| Ficheiro | Alteração |
| --- | --- |
| `projects/models/run.js` | Novo: coleção `runs`, índice único `project_id` + `token` |
| `projects/controllers/run.js` | Novo: criar, ler, somar passo de imagem, percentagem do vídeo (`$max`), terminar (só a partir de `running`) |
| `projects/utils/runProgress.js` | Novo: unidades da execução, percentagem, forma enviada ao browser |
| `projects/utils/project_msg.js` | `send_msg_client_run` (`run-update` para a `ws_queue`) |
| `projects/routes/projects.js` | Cria a execução antes do despacho; trata `video-progress`; atualiza em cada resultado; fecha em conclusão, falha e cancelamento; apaga com o projeto; duas rotas |
| `wsGateway/index.js` | Envia `run-update` ao dono e a quem iniciou |
| `apiGateway/routes/projects.js` | Passa as duas rotas novas ao `projects` |
| `Tools/video/video.py`, `video_processor.py` | Progresso para o `project_queue`, a cada 1 % |
| `frontend/providers/runs-provider.tsx` | Novo: estado das execuções, socket, confirmação a cada 5 s, avisos |
| `frontend/app/dashboard/[pid]/page.tsx` | Painel bloqueante substituído por barra não bloqueante; estado reconstruído ao carregar |
| `frontend/components/dashboard-sidebar/project-item.tsx`, `components/runs/active-runs.tsx`, `components/account-sidebar.tsx` | Progresso junto ao nome do projeto, também na página da conta |
| `frontend/components/ui/progress.tsx` | Passa o valor ao elemento acessível (`aria-valuenow`) |

Ajustes durante a implementação, antes de medir:
- **Página da conta.** A sua barra lateral não lista projetos, pelo que a ação 5 da M2.1 (grupo G1)
  perdia o progresso. Acrescentada a secção "Em processamento".
- **Uma casa decimal.** Com percentagens inteiras, 1 % do vídeo de 330 s às vezes não mudava o
  total (0,99 %), o que podia levar o intervalo para perto de 5,4 s.
- **Passo 3b — cancelar depois de recarregar.** A medição preliminar deu M2.3 = 0/2: o Cancelar
  aparecia, mas o pedido era recusado com 409. Ao abrir o editor, o `ProjectProvider` marca o
  projeto como "com alterações por guardar" (`POST .../dirty`), o que sobe a versão no servidor,
  e a página enviava a versão que tinha em cache. O defeito já existia na base, mas não se via,
  porque o Cancelar não estava disponível depois de recarregar. A página passa a ler a versão atual
  antes de cancelar e não volta a mostrar a execução enquanto o cancelamento não é confirmado (ou
  volta a mostrá-la se ele falhar). Com a correção, M2.3 = 2/2.

Testes: `projects/tests` 13/13 (4 novos), `Tools/video/tests` 29/29, `tsc` e `eslint` sem erros.

## 8. Verificação preliminar

Corrida num MacBook (Apple Silicon), com arranque limpo da aplicação a partir deste ramo e os
scripts do ramo `fase2/rnf-f2-01-carregamento` (`78c5fce`), alterados só localmente para usar o
Google Chrome instalado (`PW_CHANNEL=chrome`) e não gravar vídeo (`SEM_VIDEO=1`), porque a
instalação dos browsers do Playwright ficou bloqueada nessa máquina. Não substitui a medição
oficial: tem uma só execução por medida e uma tentativa por forma, e os tempos não se comparam com
os da base, que foi medida noutra máquina.

**Regressão** (`regressao/final/rnf-f2-02.md` nessa cópia):

| Suite | Resultado |
| --- | --- |
| Worker de vídeo (pytest) | 74/74 |
| Orquestrador (`node --test`) | 13/13 |
| Ponta a ponta | 16/18; T05 e T06 com impressões SHA-256 diferentes da referência |
| Interface | 3/3 |

T05 e T06 comparam os bytes dos ficheiros de imagem com a referência gravada na máquina da base
(Intel, Windows). Este ramo não altera nenhuma ferramenta de imagem nem o armazenamento, e diferem
também ferramentas que só copiam píxeis (recorte). A explicação provável é a plataforma (imagens
Docker ARM e outra compressão PNG). **Hipótese**, a confirmar na corrida oficial, na máquina da
referência.

**Medidas do RNF-F2-02:**

| Medida | Base | Preliminar | Alvo | Mínimo |
| --- | --- | --- | --- | --- |
| M2.1 | 0 % | **100 %** (10/10, G1 completo) | 100 % | 80 % com G1 |
| M2.2 R | Não recupera | **0,13 s e 0,12 s** | ≤ 2 s | ≤ 5 s |
| M2.2 F | Não recupera | **0,1 s** | ≤ 2 s | ≤ 5 s |
| M2.3 | 0/10 | **2/2** (A: oferecido em 0,10 s, parado em 0,21 s; B: 0,10 s e 0,22 s; resultados iguais) | 10/10 | 5/5 em A |
| C2.2 | 16,9 s | **2,54 s** (104 mudanças) | ≤ 5 s | — |
| C2.1 | 276 s (outra máquina) | 174 s | ≤ base + 10 % | Só comparável na mesma máquina |

## 9. Uso de IA

Implementação e documento feitos com apoio de um agente de IA (Claude), a partir do diagnóstico
(C4), da especificação e do script de medição. A equipa:
- escolheu a alternativa B entre as propostas e rejeitou as de classe C;
- reviu o código passo a passo e correu os testes e a verificação manual;
- confirmou os seletores do script de medição contra a interface nova, o que levou aos dois
  ajustes da secção 7.

Os valores da secção 4.3 são expectativas: só a medição final os confirma.
