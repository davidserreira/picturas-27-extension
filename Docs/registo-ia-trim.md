# Registo de desenvolvimento assistido por IA — UC-VID-001 (Recortar vídeo)

Autor: Miguel Páscoa · Branch: `feature/video-trim`
Ferramenta de IA: Claude (Anthropic).
Este registo documenta, por fase, o que foi pedido à IA, as decisões tomadas,
as alternativas rejeitadas e a validação feita pelo aluno.

---

## Fase 0 — Análise do sistema existente

**Tarefa apoiada:** leitura do código existente para perceber onde encaixar o recorte.

Conclusões:
- As ferramentas de imagem seguem o padrão: `projects` publica no RabbitMQ
  (exchange `picturas`, uma fila por ferramenta) → worker Python em `Tools/` processa
  → responde em `project_queue` → `projects` envia para `ws_queue` → `wsGateway`
  emite por Socket.IO para o browser.
- A importação (UC-VID-002, David) guarda o vídeo no SeaweedFS (API S3), bucket
  `user-{id}`, chave `{projeto}/video/{ficheiro}`, através do serviço `img_storage`;
  os metadados (formato, codec, duração…) ficam no modelo `video` do `projects`.
- O `img_storage` gera URLs pré-assinados internos (rede Docker) e públicos (browser).

---

## Fase 1 — Worker `Tools/video_trim`

**Ficheiros:** `Tools/video_trim/{video_trim.py, Dockerfile, requirements.txt}`,
`docker-compose.yaml` (serviço `video_trim_tool`).

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D1 | Novo microserviço worker, igual aos de `Tools/` | Recortar dentro do `projects` | Mantém a arquitetura existente; processamento pesado fora do serviço que responde ao utilizador (RN6: confirmação ≤ 2 s); escala com mais contentores |
| D2 | Filas próprias: pedido em `video_trim_queue`, respostas em `video_job_queue` | Reutilizar `project_queue` | O formato das respostas de imagem não serve (progresso, cancelamento, metadados do vídeo); evita partir o consumidor existente |
| D3 | O worker lê o original por URL pré-assinado interno e o `ffmpeg` lê diretamente por HTTP | Copiar o vídeo para um volume partilhado; dar credenciais S3 ao worker | Sem cópias de ficheiros grandes; o worker não precisa de credenciais do armazenamento |
| D4 | O resultado é escrito num diretório temporário e só é enviado para o armazenamento quando está completo | Escrever diretamente no armazenamento | Garante que falhas e cancelamentos não deixam ficheiros parciais (REQ-014, REQ-020, garantia mínima) |
| D5 | H.264: recodificar com `libx264` (corte exato). Outros codecs MOV: cópia de streams (`-c copy`) | Usar sempre `-c copy` | `-c copy` é rápido mas só corta em keyframes (erro pode passar 1 s, violando REQ-015). Para codecs MOV sem codificador disponível, a cópia é a única forma de manter o codec (RN1); limitação documentada |
| D6 | Progresso lido de `ffmpeg -progress` e enviado a cada 2 s | Só enviar no fim | RN6 / REQ-012 exigem atualização ≤ 5 s; 2 s dá margem |
| D7 | Cancelamento: o worker pergunta ao `projects` o estado do pedido a cada 2 s e termina o `ffmpeg` se estiver "cancelado" | Mensagem de cancelamento pelo RabbitMQ | O consumidor RabbitMQ está ocupado durante o processamento e não recebe mensagens novas; a consulta é simples e robusta |
| D8 | `ack` manual depois de terminar e `prefetch=1` | `auto_ack` como nas ferramentas de imagem | Se o worker morrer a meio, o pedido volta à fila em vez de se perder |
| D9 | Tempo máximo de processamento de 15 min (configurável), tratado como falha | Sem limite | Evita pedidos presos indefinidamente (E5) |
| D10 | Os heartbeats do RabbitMQ são servidos enquanto o `ffmpeg` corre | — | Sem isto, recortes com mais de ~60 s fariam cair a ligação |

**Contrato de mensagens:** documentado no topo de `video_trim.py`.

**Pendente para a Fase 2:** o `projects` tem de publicar os pedidos, consumir
`video_job_queue` e expor `GET /internal/video-jobs/:id/state` (usado em D7).

**Validação feita pelo aluno:** build do contentor `video_trim_tool` e confirmação nos logs de que o worker arranca e fica à espera de pedidos; revisão do código no VS Code. _[completar]_

---

## Fase 2 — Backend (`projects`), gateways e RabbitMQ

**Ficheiros novos:** `projects/models/videoJob.js`, `projects/controllers/videoJob.js`,
`projects/utils/videoJobs.js`, `projects/routes/videoJobs.js`.
**Alterados (mínimo):** `projects/app.js` (montar rotas e consumidor),
`projects/routes/videos.js` (exportar funções auxiliares já existentes),
`projects/utils/videoLimits.js` (`maxActiveJobs`), `apiGateway/routes/videos.js`
(4 rotas), `wsGateway/index.js` (evento `video-job-update`),
`rabbitMQ/definitions.json` (filas `video_trim_queue` e `video_job_queue`).

**Rotas (via API gateway, prefixo `/projects`):**
- `POST /:user/:project/videos/:video/trim` `{start, end}` → 202 `{job}`
- `GET /:user/:project/video-jobs` · `GET /:user/:project/video-jobs/:job`
- `POST /:user/:project/video-jobs/:job/cancel`
- Interna (só rede Docker): `GET /internal/video-jobs/:job/state` (usada pelo worker, D7)

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D11 | Modelo `videoJob` genérico (campo `tool`), separado do modelo `video` | Guardar o estado do recorte no próprio vídeo | Um vídeo pode ter vários pedidos; o UC-VID-003 pode reutilizar o mesmo modelo, estados e rotas de cancelamento |
| D12 | Quota: reservar 1 operação no `users` ao submeter e reembolsar se o pedido não terminar "Concluído" | Descontar só no fim | Reutiliza os endpoints existentes (`/process/:n` e `/process/refund/:n`); reservar no início impede que vários pedidos simultâneos ultrapassem as 5 operações; o efeito final é o pedido pela RN4/REQ-018 (só conta se concluir) |
| D13 | Verificações de pedidos ativos, espaço e quota executadas em série por utilizador (`withUserLock`, já usado na importação) | Sem bloqueio | Dois pedidos ao mesmo tempo podiam passar ambos a verificação de "1 pedido ativo" (REQ-008) |
| D14 | Resposta 202 imediata; o pedido é publicado no RabbitMQ e processado pelo worker | Esperar pelo resultado | REQ-010: confirmação em ≤ 2 s independentemente da duração |
| D15 | Transições de estado condicionais (`updateIfState`) | Atualizações simples | Evita que um cancelamento e uma conclusão simultâneos se sobreponham; se o cancelamento chegar no último instante, o vídeo criado é desfeito |
| D16 | Pedidos sem notícias há mais de 20 min passam a "Falhado" (com reembolso) | — | Se o worker desaparecer, o pedido não fica preso para sempre (E5) |
| D17 | Intervalo em segundos inteiros; o fim pode ir até à duração arredondada para cima e é limitado à duração real ao enviar ao worker | Exigir fim ≤ duração exata | RN2 usa resolução de 1 s; um vídeo de 30,5 s deve poder ser recortado até ao fim |
| D18 | Verificação de espaço da biblioteca antes de recortar | Não verificar | O resultado ocupa espaço na biblioteca (limite já existente na importação) |
| D19 | Funções auxiliares da importação (`requireOwner`, `loadProfile`, `withUserLock`…) reutilizadas em vez de duplicadas | Copiar o código | Mesmo comportamento de autorização e perfis em todo o módulo de vídeo; alteração mínima ao código do colega (só uma linha de exportação) |

**Problema encontrado no primeiro teste e corrigido:** o primeiro recorte falhou com
`TypeError("can't concat NoneType to bytes")`. A leitura "não bloqueante" do progresso do
`ffmpeg` em modo texto não é suportada em Python. Correção: a saída do `ffmpeg` passou a
ser lida em threads separadas (D20), e o ciclo principal continua livre para os
heartbeats, o progresso e o cancelamento. Este teste também confirmou o caminho de erro
(E5): o pedido ficou "Falhado", com a mensagem prevista, e não foi criado nenhum vídeo.
A correção foi validada localmente com um vídeo sintético de 20 s (recorte 3–13 s →
resultado com 10,0 s, em H.264).

| D20 | Saída do `ffmpeg` lida por threads em segundo plano | Leitura não bloqueante no ciclo principal | A leitura não bloqueante falha em modo texto; as threads também esvaziam o `stderr`, que de outro modo podia encher e bloquear o `ffmpeg` |

**Proposta de alteração ao caso de uso (a discutir com o grupo):** acrescentar a
exceção E7 — "Espaço da biblioteca esgotado" (D18), que não estava prevista no UC-VID-001.

**Validação feita pelo aluno (testes manuais ao backend com `curl`, vídeo `video_teste.mp4` de 60 s, perfil registado):**
- Recorte 10–40 s → pedido "Em fila" devolvido de imediato (REQ-009/010); concluído em ~6 s; criado `video_teste_recorte.mp4` na biblioteca (REQ-015/016).
- Segundo pedido enquanto o primeiro estava ativo → rejeitado com `TOO_MANY_JOBS` (E6, REQ-008).
- Primeira tentativa (antes da correção D20) → pedido "Falhado" com a mensagem prevista e sem vídeo criado (E5, REQ-019).

---

## Fase 3 — Tempo real

Feita junto com a fase 2: o `projects` envia `video-job-update` para a `ws_queue` e o
`wsGateway` emite-o para a sala do utilizador (o mesmo mecanismo já usado para o
progresso do processamento de imagens).

---

## Fase 4 — Frontend

**Ficheiros novos:** `frontend/lib/video-jobs.ts` (tipos, API, validação do intervalo,
exportação), `frontend/lib/queries/video-jobs.ts` (React Query + eventos WebSocket),
`frontend/components/project-page/video-tools-dialog.tsx` (diálogo com as abas "Ver" e
"Ferramentas de vídeo").
**Alterado:** `frontend/components/project-page/project-video-tiles.tsx`: o diálogo de
reprodução passa a ser o novo diálogo com abas, e o menu de contexto do vídeo ganha
"Ferramentas de vídeo" e "Exportar".

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D21 | A aba "Ferramentas de vídeo" fica no diálogo que já abre ao clicar num vídeo (abas "Ver" / "Ferramentas de vídeo"), e também é acessível pelo menu de contexto | Uma página nova; botões na barra de ferramentas de imagem | Segue o fluxo do UC (passos 1–2: selecionar o vídeo e abrir a aba); reutiliza o diálogo existente; o UC-VID-003 pode acrescentar a sua ferramenta na mesma aba |
| D22 | Intervalo definido por um slider com dois marcadores e por campos `m:ss`, com o botão "Posição atual" para usar o instante do leitor | Só campos de texto | Mais fácil acertar o trecho; resolução de 1 s (RN2) |
| D23 | Validação do intervalo também no browser (mesmas regras do backend), com o motivo visível e "Aplicar recorte" desativado | Validar só no servidor | REQ-003 / E4 pedem o motivo e o botão desativado; o backend continua a validar (o browser não é de confiança) |
| D24 | "Pré-visualizar" reproduz só o intervalo no leitor, sem processamento nem quota | — | Permite confirmar o trecho antes de gastar uma operação |
| D25 | Estado dos pedidos por WebSocket (`video-job-update`) e, enquanto houver um pedido ativo, também por consulta a cada 3 s | Só WebSocket; só consulta | Se o WebSocket falhar, o progresso continua a atualizar dentro dos 5 s da RN6 |
| D26 | Exportar descarrega o ficheiro pelo URL assinado (via `fetch` + `Blob`), com o nome do vídeo | Abrir o URL num separador | Em domínios diferentes o browser ignora o atributo `download`; assim o ficheiro é guardado com o nome certo (REQ-021) |
| D27 | Quando um pedido termina, a biblioteca e as operações restantes são atualizadas | — | O novo vídeo aparece sem recarregar a página e o contador de operações fica correto (REQ-018) |

**Verificações automáticas antes do teste manual:** `tsc --noEmit` (0 erros) e
`next lint` aos ficheiros novos e alterados (sem avisos).

**Validação feita pelo aluno (teste no browser):** recorte com intervalo inválido (mensagem e botão desativado), pré-visualização, aplicar recorte com estado e progresso em tempo real, exportação do resultado e cancelamento durante o processamento: tudo funcionou.

---

## Alteração pedida após o teste — nomes repetidos

**Problema detetado pelo aluno:** recortes sucessivos do mesmo vídeo ficavam todos com o
nome "{nome}_recorte", e era impossível distingui-los na biblioteca.

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D28 | Se "{nome}_recorte" já existir no projeto (num vídeo ou num pedido ainda em curso), acrescenta-se o primeiro número livre: "_2", "_3", … O nome é escolhido dentro do bloqueio por utilizador (D13) | Pôr o intervalo no nome ("_recorte_0m05-0m15") | Escolha do aluno: mantém o formato do REQ-016 e só muda quando há colisão |

**Impacto na documentação:** RN7 e REQ-VID-TRIM-016 atualizados no documento do grupo
(`RAS-exercicio_1_2_entrega_grupo_3UC.md`), incluindo o "Como verificar".

---

## Fase 5 — Verificação dos requisitos

**Ficheiros:** `tests/uc-vid-001/test_trim_requirements.py` (testes automáticos ao
backend, a correr contra o sistema em Docker), `tests/uc-vid-001/resultados.md`
(relatório gerado) e `tests/uc-vid-001/checklist-manual.md` (testes de interface).

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D29 | Testes de aceitação "caixa negra" contra o sistema real em Docker, um por cada "Como verificar" da secção 4.1 | Testes unitários com mocks | Os requisitos descrevem comportamento do sistema completo (worker + RabbitMQ + armazenamento + quota); um teste com mocks não provaria, por exemplo, a duração real do vídeo (REQ-015) nem que o original fica intacto (REQ-017) |
| D30 | Falhas e limites simulados com cópias temporárias do vídeo de teste na base de dados (ficheiro inexistente, formato AVI, 6 min, 250 MB) | Arranjar vídeos reais para cada caso | A importação já rejeita esses ficheiros, por isso não podiam chegar à biblioteca por outro caminho; as cópias são removidas no fim |
| D31 | Quota esgotada simulada com os endpoints do `users` (reservar até ao limite e reembolsar no fim) | Alterar diretamente a base de dados | Usa a mesma interface que o sistema usa e deixa o utilizador como estava |

**Resultado:** 23 de 23 testes passaram (ver `tests/uc-vid-001/resultados.md`),
cobrindo REQ-003 a REQ-020. Os REQ-001, 002, 021 e 022 e o FA1 são verificados
pela checklist manual.


---

## Fase 6 — Regressão após a integração do UC-VID-003 e teste do FA1 (2026-10-21)

- Depois de integrado o UC-VID-003 (que generalizou `projects/routes/videoJobs.js` e
  `projects/utils/videoJobs.js` para servir o recorte e a aplicação de ferramentas), os
  testes do recorte foram corridos outra vez, sem alterações: **23/23**. A integração não
  partiu o UC-VID-001.
- Alterações do colega que afetam o recorte, revistas e aceites:
  - o limite de duração passou a comparar a duração exata (antes era arredondada para baixo);
  - a verificação de espaço (E7) passou a ser feita em dois momentos: ao submeter (biblioteca
    já cheia) e ao concluir (tamanho real do resultado), o que é mais correto do que estimar
    pelo tamanho do original (D18);
  - reembolso de quota idempotente (por pedido e dia), evitando reembolsos em duplicado.
- **Novo bloco de testes [7] (FA1, premium):** o utilizador passa temporariamente a premium.
  Verifica 3 pedidos ativos e o 4.º rejeitado, recortes concluídos sem gasto de quota, e os
  limites de 30 min / 2 GB. Resultado total: **28/28**.
- **Novo bloco de testes [8]:** testes que estavam como manuais "por executar" no relatório,
  automatizados:
  - LIB-002: a ocupação da biblioteca aumenta exatamente o tamanho do resultado;
  - TRIM-027 (E7): com a biblioteca cheia (1 GB), o recorte é rejeitado com a ocupação e o limite;
  - TRIM-031: um vídeo gerado de 5 min a 1080p (H.264) é recortado por inteiro em **42 s**
    (alvo do MVP ≤ 5 min; alvo de produção ≤ 1 min, também cumprido neste equipamento:
    macOS 27.0.1, Apple M1 Pro, 16 GB).
  Resultado total: **31/31**.

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D32 | Testar o FA1 alterando temporariamente o tipo do utilizador na base de dados (e repondo-o no fim, mesmo em caso de erro) | Criar e pagar uma subscrição premium; deixar por testar | Não havia conta premium; o comportamento depende só do tipo do utilizador lido pelo `projects` |
| D33 | Desempenho medido com um vídeo sintético gerado dentro do contentor do processador (`testsrc2`, 1920 × 1080, 30 fps, 300 s), enviado para o armazenamento e removido no fim; corre como premium | Gravar e importar manualmente um vídeo real de 5 min | Repetível em qualquer máquina e sem ficheiros grandes no repositório; o perfil premium evita o limite de 200 MB, que não é o que o requisito mede |

---

## Fase 7 — O recorte passa a substituir o vídeo (v1.4, 2026-10-21)

Alteração feita pelo David (commit `9a55b81`) e aceite pelo autor do UC-VID-001, depois
de revista: o resultado do recorte deixa de ser um vídeo novo ("{nome}\_recorte", "\_2",
…) e passa a substituir o vídeo recortado, com o mesmo nome.

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D34 | O recorte substitui o vídeo, só quando o pedido termina "Concluído"; até lá, e se falhar ou for cancelado, o vídeo fica inalterado. Um vídeo só pode ter um pedido ativo de cada vez (nova E8) | Manter a criação de um vídeo novo (D28); guardar versões para desfazer | Comporta-se como um editor de vídeo e não enche a biblioteca de cópias nem duplica o espaço ocupado. Custo: não há "desfazer" no MVP (UC-VID-001/Q6, adiada para a Fase 3); o utilizador pode exportar uma cópia antes. Substitui a D28 |

**Revisão do código (aluno):** a substituição é feita só na conclusão; um cancelamento
que chegue no último instante repõe o vídeo anterior; o ficheiro antigo só é apagado
depois de o pedido ficar "Concluído"; uma resposta repetida após uma falha do serviço não
apaga o resultado.

**Validação:** os testes do recorte foram adaptados para trabalhar sobre cópias do vídeo
(para não alterar o vídeo do utilizador) e corridos outra vez: **31/31** (2026-10-21).
TST-TRIM-07 verifica a substituição (mesmo vídeo e nome, sem vídeo novo, 30 s) e
TST-TRIM-08 que um recorte cancelado deixa o vídeo igual (SHA-256).

---

## Fase 8 — Melhorias do recorte (v1.5, 2026-10-21)

Pedidas pelo aluno depois de usar a aplicação: (1) nomes repetidos ganham um número,
(2) no fim do recorte escolhe-se se o original é mantido, (3) o recorte faz-se nas
faixas de vídeo e áudio, arrastando as extremidades da seleção, e pode remover um
excerto do meio. Ramo `feature/recorte-melhorias`.

| ID | Decisão | Alternativas consideradas | Porquê |
|----|---------|---------------------------|--------|
| D35 | Um nome repetido no projeto recebe um número: "praia.mp4" → "praia (2).mp4" → "praia (3).mp4" (como no Finder/Explorador). Aplica-se às importações (UC-VID-002/RN12) e às cópias do recorte. O nome é escolhido dentro do *lock* do utilizador e conta também os nomes reservados por recortes em curso. O nome do ficheiro original fica em `file_name`, para a retoma de importações continuar a funcionar | Recusar o nome repetido; sufixo "\_2" (D28) | Pedido do aluno; nunca há dois vídeos com o mesmo nome e não obriga o utilizador a mudar o nome do ficheiro |
| D36 | Ao aplicar o recorte, a aplicação pergunta "Manter também o original?". Sim → o resultado é guardado como um vídeo novo com nome numerado (D35) e o original não é tocado; Não → substitui (D34). Fica no pedido (`keep_original`) e a cópia só é criada quando o pedido termina "Concluído" | Opção fixa nas definições; perguntar antes de abrir o recorte | A decisão é tomada no momento em que o utilizador vê o resultado que vai pedir; recupera o comportamento da D28 sem perder a D34. Uma cópia conta para a biblioteca: se não couber, o pedido é rejeitado logo (E7) |
| D37 | Seleção nas faixas: com "Recortar" ligado, a seleção aparece sobre as faixas de vídeo e de áudio, com as duas extremidades arrastáveis (em segundos inteiros, RN2) e editáveis pelo teclado; o painel Recortar mostra a mesma seleção (estado partilhado em `CurrentVideoProvider`). Novo modo "Remover seleção" (FA5): o processador corta o intervalo e junta o que fica antes e depois (`trim`/`atrim` + `concat` do FFmpeg, recodificado em H.264/AAC); só para vídeos H.264 e o vídeo tem de ficar com ≥ 1 s | Vários cortes e arrastar excertos (*timeline* completa de editor); remover com `-c copy` | Cobre o pedido "cortar no meio" com um só pedido e um só resultado. Mover/reordenar excertos e vários cortes exigiam um modelo de projeto de edição (lista de segmentos), fora do âmbito da Fase 1; ficam registados como evolução. Juntar com `-c copy` só corta em *keyframes* e dá saltos visíveis |

**Verificação do aluno:** o comando do FFmpeg do modo remover foi experimentado fora
do sistema com vídeos de 20 s, com e sem áudio, removendo o meio, o início e o fim
(15 s em todos os casos). TypeScript e ESLint sem erros. Testes novos no bloco [9] de
`tests/uc-vid-001/test_trim_requirements.py` (TST-TRIM-25 a 28).
