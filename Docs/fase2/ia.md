# Uso de IA na Fase 2

As diretrizes pedem que as ferramentas de IA, as tarefas que apoiaram e a validação feita pela
equipa fiquem documentadas no relatório e no código. Este ficheiro é o registo; o relatório resume-o.
A equipa é responsável por todo o conteúdo entregue.

## Ferramentas

| Ferramenta | Modelos | Como foi usada |
| --- | --- | --- |
| Claude Code (extensão do VS Code, Windows 11) | Claude Opus 5.5 e Claude Fable 5.2, escolhidos por etapa (tabela seguinte) | Agente com acesso ao repositório, ao terminal (PowerShell e Git Bash) e ao Docker local. Lê código, corre a stack, escreve ficheiros e faz commits quando lhe é pedido |

Não foram usadas *skills* nem servidores MCP no trabalho sobre o repositório. O agente não tem
acesso ao GitHub nem faz *push*: os commits ficam locais até a equipa os rever e publicar.

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
| 6. Implementação do ADR-01 (ramo `fase2/rnf-f2-01-carregamento`) | Claude Opus 5.5 | Implementou os passos 0 a 5, um commit por passo, com testes unitários novos | Ver a secção seguinte |

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

Validação feita em cada passo, com os resultados em `medicoes/passos/` e `regressao/passos/`:

- testes unitários novos do serviço alterado, a correr na imagem do serviço;
- a suite de regressão completa (`REGRESSAO=passos/passo-N ./correr.sh`), comparada com a impressão da base;
- a M1.1 com 100 e 500 MiB (duas repetições), para atribuir a cada passo a redução de memória que provoca;
- nos passos que mexem na validação (3) e no fim, os controlos C1.5 e C1.7.

O resultado de cada passo está na secção "Implementação" do ADR-01.

### Revisão pela equipa (a preencher)

| Passo | Revisto por | Data | Observações |
| --- | --- | --- | --- |
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
