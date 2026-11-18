# Uso de IA na Fase 2

As diretrizes pedem que as ferramentas de IA, as tarefas que apoiaram e a validação feita pela
equipa fiquem documentadas no relatório e no código. Este ficheiro é o registo; o relatório resume-o.
A equipa é responsável por todo o conteúdo entregue.

## Ferramentas

| Ferramenta | Modelos | Como foi usada |
| --- | --- | --- |
| Claude Code (extensão do VS Code, Windows 11) | Claude Opus 5.5 e Claude Fable 5.2, escolhidos por etapa (tabela seguinte) | Agente com acesso ao repositório, ao terminal (PowerShell e Git Bash) e ao Docker local. Lê código, corre a stack, escreve ficheiros e faz commits quando lhe é pedido |

Não foram usadas *skills* nem servidores MCP no trabalho sobre o repositório. O agente só faz
*push* quando a equipa o pede: para publicar o ramo do RNF-F2-01 (a primeira vez com
reescrita do histórico, `medicoes/passos/README.md`), e os ramos seguintes.

Por decisão da equipa, as mensagens dos commits não levam linhas de coautoria da ferramenta. O uso
de IA fica registado aqui, nos comentários do código alterado (que remetem para o ADR) e no
`AGENTS.md`.

## Método

1. Um pedido escrito por etapa (diagnóstico, especificação, medição, regressão, decisão, implementação,
   medição final, relatório), cada um com o resultado esperado e o que não pode fazer (por exemplo, "não
   alteres código da aplicação" nas etapas de medição).
2. Cada etapa deixa o resultado em ficheiros em `Docs/fase2/`, que a equipa revê antes da etapa
   seguinte.
3. Nada conta como medido sem script e dados em bruto no repositório. As medições guardam o commit e as
   alterações por versionar.
4. Na implementação, cada passo do plano do ADR é um commit com testes unitários novos, medição
   intermédia e a suite de regressão completa.

## Tarefas apoiadas e validação

| Etapa | Modelo | O que a IA fez | Como foi validado |
| --- | --- | --- | --- |
| 1. Diagnóstico (`diagnostico.md`) | A confirmar pela equipa | Leu o código e a documentação da base e propôs oito fragilidades candidatas, cada uma com evidência em `ficheiro:linha` | Evidência verificável no código. A IA corrigiu uma conclusão errada sobre o ecrã sobreposto (C4) depois de reler `frontend/app/dashboard/layout.tsx`. Revisão da equipa: a preencher |
| 2. Especificação (`requisitos-nf.md`) | A confirmar pela equipa | Propôs as medidas, os valores-alvo e mínimos e os controlos dos efeitos colaterais | Revisão da equipa: a preencher. Os valores-alvo são decisão da equipa |
| 3. Medição da base (`medicoes/`) | A confirmar pela equipa | Escreveu os scripts e correu a série completa sobre a base, com volumes limpos | Repetições com média e desvio-padrão; ambiente registado; a queda do motor do Docker com 1000 MiB ficou registada em `medicoes/ocorrencias/`, e não descartada. Duas correções aos scripts depois de resultados anómalos: o 409 ao aplicar logo depois de abrir o projeto e a deriva da calibração do vídeo, com a primeira tentativa guardada em `baseline/rnf2-primeira-tentativa/` |
| 4. Regressão (`regressao/`) | A confirmar pela equipa | Reaproveitou os testes existentes (pytest e node) e escreveu as suites ponta a ponta (18 testes) e de interface (3) | Duas corridas na base com impressões iguais (`resultados/repeticao-e2e.json`). As diferenças falsas da primeira repetição (ordem das chaves, bytes do watermark) foram corrigidas na comparação, não escondidas |
| 5. Decisão (`adr/ADR-01-carregamento-em-fluxo.md`) | Claude Opus 5.5 | Propôs três alternativas, escolheu uma e escreveu o plano por passos | Causa da segunda cópia em memória confirmada no código instalado nos contentores (`follow-redirects`). Revisão da equipa: a preencher |
| 6. Implementação do ADR-01 (ramo `fase2/rnf-f2-01-carregamento`) | Claude Opus 5.5 | Implementou os passos 0 a 5 e uma afinação da memória (5b), um commit por passo, com testes unitários novos | Ver a secção seguinte |
| 7. Medição final do RNF-F2-01 e análise (`medicoes/final/rnf-f2-01/`, `analise.md`) | Claude Opus 5.5 | Correu a série final com os scripts da base, repetiu de um arranque limpo as partes com ocorrências, fez uma comparação A/B do C2.1 entre a base e o ramo e escreveu a análise | As três ocorrências da série (regressão ponta a ponta interrompida, falha passageira do `docker inspect`, C2.1 mais lento) ficaram registadas com os registos que as explicam, e não foram descartadas. O aumento do C2.1 só foi atribuído à máquina depois da comparação A/B. A IA corrigiu uma afirmação sua sobre as previsões do ADR-01 ao conferi-la com os números. Revisão da equipa: a preencher |
| 5. Decisão do RNF-F2-02 (`adr/ADR-02-estado-da-execucao-no-servidor.md`) | Claude Opus 5.5 | Propôs três alternativas (estado no orquestrador, estado no `ws_gateway`, só no browser), escolheu a primeira e escreveu o plano em cinco passos | A causa do C2.2 da base (16,9 s) foi confirmada no código da página e do worker antes de decidir. A IA corrigiu o ADR durante a implementação, ao ver que a sala do projeto no `ws_gateway` não tem verificação de acesso (secção seguinte). Revisão da equipa: a preencher |
| 6. Implementação do ADR-02 (ramo `fase2/rnf-f2-02-segundo-plano-medido`) | Claude Opus 5.5 | Implementou os passos 0 a 5, um commit por passo, com testes unitários novos | Ver a secção "Implementação do ADR-02" |
| 7. Medição final do RNF-F2-02 (`medicoes/final/rnf-f2-02/`) | Claude Opus 5.5 | Correu a série final com os scripts da base e, depois da paragem a meio da M2.3, o complemento de um arranque limpo; escreveu a secção 7.3 do ADR-02 e a secção 6 da `analise.md` | A paragem e o C2.3 inválido do complemento ficaram registados (secção seguinte), e não foram descartados. O C2.1 não foi comparado entre sessões: fica para os blocos A-B-A da medição conjunta. Revisão da equipa: a preencher |

## Implementação do ADR-01

Ficheiros novos ou alterados com apoio de IA, todos com um comentário que remete para o ADR-01:

| Passo | Ficheiros | Testes novos |
| --- | --- | --- |
| 0 | `Docs/fase2/medicoes/rnf1/medir-memoria.mjs` (controlo C1.7) | — |
| 1 | `imageStorageService/services/streamStorage.js`, `services/uploadImage.js`, `route/upload.js` | `imageStorageService/tests/stream-storage.test.js` |
| 2 | `projects/utils/imageStorage.js` | — (coberto pela regressão) |
| 3 | `projects/utils/mediaUpload.js`, `utils/video.js`, `utils/imageStorage.js`, `routes/projects.js` (só a receção de media) | `projects/tests/media-upload.test.js` |
| 4 | `apiGateway/utils/streamProxy.js`, `routes/projects.js` (só as duas rotas de carregamento) | `apiGateway/tests/stream-proxy.test.js` |
| 5 | `nginx/nginx.conf` | — (coberto pela regressão) |
| 5b | `docker-compose.yaml` (opções do V8 e da glibc nos três serviços Node), `imageStorageService/services/uploadImage.js` (`QUEUE_SIZE`) | — (coberto pela regressão) |

Validação feita em cada passo, com os resultados em `medicoes/passos/` e `regressao/passos/`:

- testes unitários novos do serviço alterado, a correr na imagem do serviço;
- a suite de regressão completa (`REGRESSAO=passos/passo-N ./correr.sh`), comparada com a impressão da base;
- a M1.1 com 100 e 500 MiB (duas repetições), para atribuir a cada passo a redução de memória que provoca;
- nos passos que mexem na validação (3) e no fim, os controlos C1.5 e C1.7.

O resultado de cada passo está na secção "Implementação" do ADR-01.

Problemas encontrados pela validação durante a implementação, e como foram tratados:

| Problema | Como apareceu | Tratamento |
| --- | --- | --- |
| A previsão do passo 2 estava errada: o pico do `projects` não desceu | M1.1 do passo 2 igual à do passo 1 | A cópia temporária para o `ffprobe` (cache de páginas) dava um pico do mesmo tamanho. Registado no commit e no ADR; o pico desapareceu no passo 3 |
| Um teste unitário novo falhava por uma promessa rejeitada sem tratamento no próprio teste | Primeira corrida de `media-upload.test.js` | Corrigido o teste; o código não mudou |
| O `nodemon` do `api_gateway` não dá pelas alterações feitas no Windows (montagem de pastas do Docker Desktop) | Sem reinício nos registos depois de alterar o código | Reinício explícito do contentor antes de medir; a nota ficou no `AGENTS.md` |
| Os três serviços ficavam entre 80 e 100 MiB com 500 MiB, acima do alvo de 64 | M1.1 dos passos 3 a 5 | Seis variantes de configuração medidas com o mesmo método (`medicoes/passos/afinacao/`). A causa é a recolha tardia dos buffers já enviados, e não cópias do ficheiro. Escolhida a afinação do passo 5b |
| Commit não pedido (`cf4b5be`), feito fora do agente durante a implementação, com a mensagem do passo 0 | Revisão do histórico do ramo | Mantido; assinalado à equipa |

### Revisão pela equipa do ADR-01 (a preencher)

| Passo | Revisto por | Data | Observações |
| --- | --- | --- | --- |
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 5b | | | |

## Implementação do ADR-02

Ficheiros novos ou alterados com apoio de IA, todos com um comentário que remete para o ADR-02. O
ramo parte do commit dos documentos (`47c303b`), sem as alterações do RNF-F2-01.

| Passo | Ficheiros | Testes novos |
| --- | --- | --- |
| 0 | `Docs/fase2/adr/ADR-02-estado-da-execucao-no-servidor.md` | — |
| 1 | `projects/models/run.js`, `controllers/run.js`, `utils/runState.js`, `routes/projects.js` (abrir, avançar e fechar a execução; duas rotas `GET`); `apiGateway/routes/projects.js` (as duas rotas); `Docs/fase2/medicoes/rnf2/estado.mjs` | `projects/tests/run-state.test.js` |
| 2 | `Tools/video/video.py`, `Tools/video/video_processor.py`; `projects/routes/projects.js` (mensagens de progresso), `projects/utils/project_msg.js` | `Tools/video/tests/test_video_processor.py` (progresso com uma casa decimal e ritmo) |
| 3 | `projects/routes/projects.js`, `projects/utils/project_msg.js` (`run-status`); `wsGateway/index.js`, `wsGateway/utils/runStatus.js` | `wsGateway/tests/run-status.test.js` |
| 4 | `frontend/providers/runs-provider.tsx`, `frontend/components/runs/background-runs.tsx`, `frontend/app/dashboard/layout.tsx`, `frontend/app/dashboard/[pid]/page.tsx`, `frontend/components/project-page/project-image.tsx`, `frontend/components/ui/progress.tsx`, `frontend/lib/projects.ts` | — (coberto pela regressão e pelas medidas do RNF-F2-02) |
| 5 | `AGENTS.md`, `Docs/fase2/medicoes/README.md`, este ficheiro | — |

Validação feita em cada passo, com os resultados em `medicoes/passos-rnf2/` e `regressao/passos-rnf2/`:

- testes unitários novos do serviço alterado, a correr na imagem do serviço;
- a suite de regressão completa (`REGRESSAO=passos-rnf2/passo-N ./correr.sh`), comparada com a impressão da base;
- nos passos 1 a 3, `rnf2/estado.mjs` com o vídeo de 120 s: estado pela rota e pelos eventos, maior
  intervalo entre mudanças do progresso, C2.3 e, num segundo caso, o cancelamento;
- no passo 4, capturas de ecrã da interface durante uma execução e as medidas M2.2 e M2.3 com uma
  execução cada, com o vídeo de 330 s. A M2.1 e o C2.1/C2.2 também estavam previstos, mas não ficaram
  registados (tabela seguinte) e passaram para a medição final.

Problemas encontrados pela validação durante a implementação, e como foram tratados:

| Problema | Como apareceu | Tratamento |
| --- | --- | --- |
| A conta esperada num teste unitário novo estava errada (40,4 em vez de 40,3) | Primeira corrida de `run-state.test.js` | Corrigido o teste: com as quatro unidades das imagens feitas, 40,37% do vídeo dá 40,39% da execução, arredondado para baixo; o código não mudou |
| Mandar o `run-status` também para a sala `project:<id>` (como dizia o ADR) exporia o estado a qualquer socket, porque o `ws_gateway` não verifica quem entra nessa sala | Leitura do `ws_gateway` ao escrever o passo 3 | Só as salas do dono e de quem iniciou, que exigem JWT; teste unitário que o garante; ADR corrigido |
| Ao abrir um projeto já processado, a última execução (`done`) ficaria guardada no fornecedor e apareceria noutras páginas como "terminou" | Revisão do código do passo 4 antes de construir o frontend | O fornecedor só guarda uma execução pedida à rota se estiver em curso, ou se for o fim de uma que mostrava; abrir o projeto apaga o aviso de uma execução já terminada |
| A M2.1 do passo 4 parou com `ECONNRESET` num `GET` à API | Registo da medida (`medicoes/passos-rnf2/passo-4/logs/rnf2-m21.log`); o pedido não aparece no registo do nginx | Falha do reencaminhamento de portas do Docker Desktop, e não da aplicação. O instrumento passou a repetir uma vez um `GET` que falhe por `ECONNRESET` ou `EPIPE` (`medicoes/lib/comum.mjs`); os pedidos que alteram estado não se repetem |
| A execução do C2.1/C2.2 do passo 4 foi interrompida pela suspensão do portátil | Intervalo nos registos | Execução terminada e descartada. As duas medidas passaram para a medição final, com o portátil ligado à corrente e sem suspensão |
| O C2.3 do complemento da medição final deu 404 ao dono, a outro utilizador e sem JWT, e o script contou-o como "recusado nos dois casos" | Revisão dos resultados: o URL registado era `C:/Program Files/Git/projects/...` | O Git Bash converte em caminho do Windows um valor que comece por `/` antes de o passar ao node. O C2.3 foi repetido com `MSYS_NO_PATHCONV=1` (`medicoes/final/rnf-f2-02/complemento/c23/`), e o script passou a só contar a recusa quando o dono recebe 200 do mesmo URL (`rnf2/medir.mjs`, opção `--so c23`). O script da medição conjunta já desliga a conversão |

### Revisão pela equipa do ADR-02 (a preencher)

| Passo | Revisto por | Data | Observações |
| --- | --- | --- | --- |
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
