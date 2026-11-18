# Fase 2 — Análise dos resultados

Grupo PL5-G5 · 17 a 19 de novembro de 2026

Compara a medição inicial (`medicoes/baseline/`) com a medição final, à luz dos valores-alvo e
mínimos de `requisitos-nf.md`. A especificação (secção 4.3) manda medir cada requisito primeiro no
seu ramo, isolado, e depois os dois integrados:

| Secções | Medição |
| --- | --- |
| 1 a 5 | **RNF-F2-01** no ramo `fase2/rnf-f2-01-carregamento` (commit `7740230`) |
| 6 | **RNF-F2-02** no ramo `fase2/rnf-f2-02-segundo-plano-medido` (commit `77c9bf7`) |
| 7 | Os dois integrados, no ramo `fase2/integracao` |

## 1. Como foi medido o RNF-F2-01

| | Base | Final do RNF-F2-01 |
| --- | --- | --- |
| Versão | `43a2e08` (código igual ao `0523102` de partida) | `7740230` (ramo `fase2/rnf-f2-01-carregamento`) |
| Quando | 17 nov., 01:34–04:23 | 17 nov., 15:23–17:32 (série completa) e 22:26–23:19 (complemento, ver 1.1) |
| Máquina e Docker | HP Victus 15, i5-12450H, 15,7 GiB; Docker Desktop 29.9.3 com 12 CPUs e 7,59 GiB; 32 serviços | Iguais (`ambiente.json` de cada série) |
| Alimentação | Corrente | Corrente (registo de energia do Windows, evento 105) |
| Arranque | Limpo (`down -v`, `up --build`) | Limpo, antes de cada parte |
| Procedimento | `correr-tudo.sh` e `regressao/correr.sh` | Os mesmos scripts e parâmetros. Os scripts só mudaram em dois pontos desde a base: o controlo C1.7, acrescentado no passo 0 do ADR-01 e medido também sobre o código da base; e a opção `--so c21` do `rnf2/medir.mjs`, usada só na comparação A/B |

Resultados em bruto:

| Pasta | O que tem |
| --- | --- |
| `medicoes/final/rnf-f2-01/` | Série completa: M1.1, M1.2, C1.1–C1.7 e as medidas e controlos do RNF-F2-02 |
| `medicoes/final/rnf-f2-01/complemento/` | C2.1–C2.5, M1.1 e C1.4 com 1000 MiB, repetidos de um arranque limpo (ver 1.1) |
| `medicoes/final/rnf-f2-01/ab/` | Comparação A/B do C2.1 entre a base e o ramo, na mesma sessão (secção 4.2) |
| `regressao/final/rnf-f2-01.md` | Regressão final do ramo; a tentativa interrompida está em `regressao/resultados/final/tentativa-1/` |

### 1.1 Ocorrências na série completa

| Ocorrência | Evidência | Tratamento |
| --- | --- | --- |
| A suite ponta a ponta não produziu resultados: o primeiro pedido falhou com `ECONNRESET` | Começou 2 s depois de a série de 1000 MiB parar (linha seguinte), com os serviços ainda a reiniciar | Regressão repetida no complemento, de um arranque limpo e com espera antes de começar: 18/18. As outras suites tinham passado na primeira tentativa (74/74, 13/13, 3/3) |
| M1.1 com 1000 MiB: 3 repetições válidas em 4. Na 4.ª, o envio deu 204, mas o `docker inspect` seguinte falhou e o script parou, como faz quando o motor do Docker deixa de responder | O registo do Docker Desktop mostra o motor a criar contentores 2 s depois (`logs/docker-desktop-17h29.log`). Foi uma falha passageira do comando, e não a queda do motor que acontece na base | As 5 repetições foram feitas de novo no complemento, de um arranque limpo: 5/5 válidas. A secção 2 usa as 8 repetições válidas das duas partes |
| C2.1 a 332 s, contra 276 s na base | O tempo a mais está todo dentro do worker de vídeo, que este ramo não altera (secção 4.2) | Repetido no complemento e depois numa comparação A/B com a base na mesma sessão (secção 4.2) |

A máquina foi suspensa às 17:44, depois do fim da série, e voltou às 21:55. Nenhuma medição
estava a correr nesse intervalo, e o complemento começou com um arranque limpo.

## 2. RNF-F2-01 — medidas principais

| Medida | Base | Final | Alvo | Mínimo | Resultado |
| --- | --- | --- | --- | --- | --- |
| M1.1 — maior acréscimo de memória com 1000 MiB, no serviço que mais cresce | Não mensurável: o envio esgota os 7,6 GiB do Docker e o motor deixa de responder. Até lá, `api_gateway` +3455 MiB e `projects` +1981 MiB | **56,3 MiB** (`img_storage`), máximo das 8 repetições válidas | ≤ 64 MiB | ≤ 128 MiB | **Alvo atingido** |
| M1.1 com 500 MiB (referência medida nas duas versões) | 2001 MiB (`api_gateway`) | 55,3 MiB (`img_storage`) | — | — | 36 vezes menos |
| M1.2 — maior ficheiro aceite com 512 MiB por contentor | 100 MiB (com 500 MiB o `api_gateway` é terminado por falta de memória nas 3 repetições) | **1000 MiB**: 3 em 3 em todos os tamanhos, sem reinícios | 1000 MiB | 500 MiB | **Alvo atingido** |

**O RNF-F2-01 fica cumprido, com o alvo atingido nas duas medidas principais.**

Maior acréscimo por serviço (MiB), por tamanho de ficheiro:

| Ficheiro | `nginx` | `api_gateway` | `projects` | `img_storage` |
| --- | --- | --- | --- | --- |
| 10 MiB | 1,2 → 1,0 | 35,0 → 7,2 | 34,4 → 16,6 | 24,0 → 24,4 |
| 100 MiB | 7,1 → 9,7 | 307,9 → 32,0 | 225,0 → 13,4 | 206,1 → 55,7 |
| 500 MiB | 18,8 → 10,2 | 2001,0 → 42,6 | 1044,3 → 42,7 | 1016,2 → 55,3 |
| 1000 MiB | (≥ 33) → 11,8 | (≥ 3455) → 45,0 | (≥ 1981) → 49,1 | (≥ 282) → 56,3 |

Na base, a memória crescia com o ficheiro: cerca de uma vez o tamanho no `projects` e no
`img_storage`, três a quatro vezes no `api_gateway`. No fim, a partir de 100 MiB o valor
praticamente não muda (`img_storage`: 55,7, 55,3 e 56,3 MiB), que é o que o enunciado pede: "um
valor fixo, que não depende do tamanho do ficheiro". Com 10 MiB o valor é menor porque o ficheiro
cabe em duas partes do envio ao S3.

**O que melhorou, por passo.** As medições intermédias (`medicoes/passos/`, resumidas no ADR-01,
secção 7) atribuem a redução a cada passo:
- o passo 1 retirou a cópia do `img_storage`;
- os passos 2 e 3 retiraram as do `projects`;
- o passo 4 retirou a do `api_gateway`;
- o passo 5 retirou a cópia em disco do nginx.

Depois do passo 5, os três serviços Node ainda ficavam entre 80 e 100 MiB com 500 MiB. A
afinação do passo 5b, com as opções do V8 e da glibc no `docker-compose.yaml`, trouxe-os para
baixo do alvo.

**Margem.** O `img_storage` fica 8 MiB abaixo do alvo, e essa margem depende da afinação do
passo 5b. Sem ela, o mesmo serviço chegava a 99 MiB com 500 MiB: abaixo do mínimo, mas acima do
alvo (ADR-01, 7.2). Por isso o `AGENTS.md` pede para voltar a medir antes de retirar essas opções.

## 3. RNF-F2-01 — controlos

| ID | Base | Final | Limite | Resultado |
| --- | --- | --- | --- | --- |
| C1.1 — aceitação (mediana) | 10 MiB: 0,33 s; 500 MiB: 8,96 s | 10 MiB: 0,27 s; 500 MiB: 0,84 s; 1000 MiB: 0,63 s (série) e 1,03 s (complemento) | ≤ base + 10% | Cumpre; melhora |
| C1.1 face ao REQ-VID-SUBMIT-008 | 500 MiB falha o produto mínimo (< 3 s) | 500 MiB abaixo de 1 s, o alvo do requisito | — | Passa a cumprir |
| C1.2 — envio completo (mediana) | 1000 MiB: não mensurável; 500 MiB: 10,22 s | 1000 MiB: 7,58 s (série, n = 3) e 11,02 s (complemento, n = 5); 500 MiB: 7,03 s | ≤ base + 10% | Cumpre com 500 MiB, a referência medida nas duas versões. O envio de 1000 MiB demora cerca do mesmo que o de 500 MiB na base (7,6–11,0 s contra 10,2 s) |
| C1.3 — 500 MiB sem JWT | 401; `api_gateway` +1006 MiB | 401; `api_gateway` +24 MiB | 401 e dentro do mínimo da M1.1 | Cumpre; corrige a falha do diagnóstico (C5) |
| C1.4 — SHA-256 do ficheiro guardado | Igual com 10, 100 e 500 MiB | Igual com 10, 100, 500 e 1000 MiB | Iguais | Cumpre |
| C1.5 — decisões de validação | 7 casos | Os mesmos 7 casos com o mesmo código e a mesma mensagem, carácter a carácter | Iguais | Cumpre |
| C1.6 — ficheiros temporários | Nenhum novo | Nenhum novo, depois de um envio completo e de um interrompido | Zero | Cumpre |
| C1.7 — objetos órfãos no armazenamento | O envio recusado com 409 deixa o ficheiro guardado sem dono | Um objeto por envio aceite, nenhum nos recusados (409 incluído) nem no interrompido; nenhum envio em partes aberto | Sem órfãos | Cumpre; corrige o caso do 409 |

No complemento, o envio completo de 1000 MiB demorou mais do que na série completa, com o mesmo
código (mediana de 11,02 s contra 7,58 s). Foi na mesma sessão em que o código da base, medido
outra vez, ficou 15% a 40% mais lento do que na série da base (secção 4.2). As melhorias de tempo
do C1.1 e do C1.2 são muito maiores do que essa variação.

## 4. Outros requisitos não funcionais

### 4.1 Medidas do RNF-F2-02

Este ramo não implementa o RNF-F2-02, por isso as suas medidas servem para verificar que o
RNF-F2-01 não as piora:

| Medida | Base | Final do RNF-F2-01 |
| --- | --- | --- |
| M2.1 | 0% nas 3 execuções | 0% nas 3 execuções, com a mesma tabela por ação |
| M2.2 | R e F não recuperam (6/6 e 3/3) | Igual |
| M2.3 | 0/10 | 0/10 |

A ação 7 da M2.1 (carregar uma imagem para Q durante a execução) é o único ponto de contacto entre
os dois requisitos, porque usa o caminho que o RNF-F2-01 alterou. O resultado esperado apareceu nas
3 execuções, em 620–691 ms na base e em 619–688 ms no fim.

### 4.2 Controlos do RNF-F2-02

| ID | Base | Final do RNF-F2-01 | Limite | Resultado |
| --- | --- | --- | --- | --- |
| C2.1 — duração de uma execução de P (mediana) | 269,3 s na série da base; 340,9 s com o mesmo código, na sessão da comparação A/B | 335,2 s na comparação A/B (330,8 s na série completa; 444,1 s no complemento) | ≤ base + 10% | Cumpre na comparação na mesma sessão (−1,7%). A comparação com a série da base não é válida (ver abaixo) |
| C2.2 — maior intervalo do progresso | 16,9 s na série da base; 21,2–25,6 s na sessão A/B | 23,3–28,5 s na sessão A/B | ≤ 5 s | Falha, como na base. O caminho do progresso não foi alterado (ver abaixo) |
| C2.3 | Não aplicável | Não aplicável | — | — |
| C2.4 — execuções sobrepostas | Iguais às separadas | Iguais às separadas, na série e no complemento | Iguais | Cumpre |
| C2.5 — ferramenta acrescentada a meio | 201; resultados iguais | 201; resultados iguais, na série e no complemento | O mesmo comportamento, sem erro | Cumpre |

**C2.1: porque não se compara com a série da base.** Na série completa, o C2.1 deu 332 s em
média, 20% acima da média da base (276 s). No complemento deu 399, 444 e 503 s. Antes de atribuir o aumento ao refactoring
mediu-se onde está o tempo:

1. **Está todo dentro do worker de vídeo.** O registo do worker mostra a duração de cada execução.
   A diferença entre o C2.1 e a duração no worker fica entre 2 e 3,5 s em todas as execuções,
   nas duas versões. O worker não foi alterado neste ramo. O diff do ramo não toca em `Tools/`,
   `wsGateway/`, `rabbitMQ/` nem `frontend/`, e no `docker-compose.yaml` só mexe no
   `img_storage`, no `projects` e no `api_gateway`.
2. **O worker variou durante a própria série.** A mesma execução (vídeo de 330 s, brilho e
   contraste) demorou 231–298 s no worker ao longo da série completa. A exceção foram as três do
   C2.1, entre as 16:49 e as 17:06, com 323–338 s. Logo antes e logo depois (C2.4 e C2.5) voltou a
   243–247 s (`final/rnf-f2-01/logs/video_tool.log`).
3. **Comparação A/B na mesma sessão** (`final/rnf-f2-01/ab/`). Três blocos seguidos, cada um com
   arranque limpo e 3 execuções do C2.1:
   - **A:** a base, só com os quatro serviços que o ramo altera (nginx, `api_gateway`, `projects`
     e `img_storage`) na versão do `main` e sem as opções do V8 e da glibc;
   - **B:** o ramo;
   - **A:** a base outra vez.

   Cada bloco regista a versão que correu (`variante.txt`) e a CPU dos contentores minuto a
   minuto.

| Bloco | Versão | C2.1 (s) | Diferença para o worker (s) | CPU média do worker |
| --- | --- | --- | --- | --- |
| 1 (23:26–23:45) | A, base | 358,6 · 380,5 · 368,2 | 2,0–3,5 | 204% |
| 2 (23:48–00:06) | B, ramo | 381,9 · 324,8 · 335,2 | 2,4–2,7 | 202% |
| 3 (00:08–00:25) | A, base | 312,0 · 310,7 · 323,1 | 2,4–3,0 | 185% |

O código da base demorou 311–381 s nesta sessão, contra 267–291 s na série da base (17 de
novembro, de madrugada), e baixou 15% entre o primeiro e o último bloco. O ramo, medido entre os
dois, fica no meio:
- mediana de 335,2 s, contra 340,9 s das seis execuções da base (−1,7%);
- contra o ponto médio dos dois blocos da base, 340,1 s (−1,4%).

O worker usou cerca de dois CPUs em todos os blocos, por isso a diferença está na velocidade de
cada CPU da máquina, e não na carga do resto da aplicação. Os serviços que o ramo altera gastaram
entre 0% e 15% de um CPU enquanto o worker trabalhava, nas duas versões. A conclusão medida é que
o RNF-F2-01 não piora o C2.1. A variação da máquina entre sessões (até 40%) é maior do que a
tolerância de 10% do controlo.

**C2.2.** O maior intervalo entre mudanças do progresso acompanha a duração da execução: fica
entre 6,7% e 7,2% da duração em 8 das 9 execuções da comparação A/B. A exceção é uma execução do
ramo, com 8,5% (28,5 s em 335 s). O progresso vai do worker ao browser pelo RabbitMQ e pelo
`ws_gateway`, e nenhum dos dois foi alterado. O C2.2 já falhava na base e é do âmbito do
RNF-F2-02. Volta a ser medido na medição conjunta.

### 4.3 Preservação funcional

| Suite | Base | Final |
| --- | --- | --- |
| Worker de vídeo (pytest) | 74/74 | 74/74 |
| Orquestrador (`node --test`) | 8/8 | 13/13 (os 8 da base e 5 novos do passo 3) |
| Ponta a ponta (T01–T18) | 18/18 | 18/18, todos com a mesma impressão da base (`referencia.json`) |
| Interface (U01–U03) | 3/3 | 3/3 |

Os testes unitários novos do `img_storage` (4) e do `api_gateway` (6) correram em cada passo
(`regressao/passos/`) e não fazem parte da suite de regressão da base.

### 4.4 Memória do SeaweedFS (fora do critério)

O SeaweedFS fica fora do critério da M1.1 por ser de terceiros, mas é medido. O acréscimo durante
os envios é muito variável nas duas versões: o desvio-padrão é da ordem da média.

| Ficheiro | Base, média (máx.) | Final, média (máx.) |
| --- | --- | --- |
| 10 MiB | 37 (81) | 40 (117) |
| 100 MiB | 77 (239) | 163 (332) |
| 500 MiB | 14 (56) | 129 (255) |
| 1000 MiB | não mensurável | 165 (522) |

No fim, o acréscimo é maior com 100 e 500 MiB. Há duas explicações possíveis. Uma é a própria
memória do SeaweedFS, que passa a receber as partes ao ritmo do envio do cliente em vez de as
receber todas no fim. A outra é a cache de páginas dos ficheiros que o contentor escreve, que o
`docker stats` também conta. Este instrumento não distingue as duas, por isso não se tira
conclusão: fica registado como ponto a observar. A
memória em repouso do SeaweedFS cresce com os dados guardados nas duas versões. Chegou a 3,9 GiB no
fim da série completa, que guarda mais dados do que a base porque a M1.2 passa a aceitar os
ficheiros de 500 e 1000 MiB.

## 5. O que não foi atingido e porquê

**No RNF-F2-01, nada ficou por atingir.** As duas medidas principais atingem o valor-alvo, e os
sete controlos cumprem o limite. Três deles melhoram (C1.1, C1.2, C1.3) e um corrige um defeito
da base (C1.7, o ficheiro órfão do 409).

**Controlos de outros requisitos.** O C2.2 falha, mas já falhava na base pela mesma ordem de
grandeza e não depende deste refactoring (4.2). Fica para o RNF-F2-02, que trata o progresso.
Nenhuma medida ou controlo piorou por causa do RNF-F2-01, segundo o que foi medido.

**Limitações e pontos a observar:**

| Ponto | Porquê | O que fazer |
| --- | --- | --- |
| As medidas de tempo não se comparam bem entre sessões | O mesmo código da base demorou 267–291 s numa sessão e 311–381 s noutra, com a mesma máquina, a mesma alimentação e arranque limpo. A causa provável é a velocidade dos CPUs (temperatura, turbo), que os scripts não registam | Na medição conjunta, medir os controlos de tempo (C1.1, C1.2, C2.1) também com a base na mesma sessão, em blocos A-B-A, como em 4.2 |
| Margem do `img_storage` na M1.1 (8 MiB) | Depende das opções do V8 e da glibc do passo 5b. Sem elas, o valor fica entre o alvo e o mínimo | Manter as opções e voltar a medir se forem alteradas (nota no `AGENTS.md`) |
| A M1.1 com 1000 MiB junta duas partes da medição | Na série completa, a 4.ª repetição parou por uma falha passageira do `docker inspect` (1.1) | Usaram-se as 8 repetições válidas. O máximo de cada parte (52,9 e 56,3 MiB) está abaixo do alvo |
| Memória do SeaweedFS | Fora do critério, mas o acréscimo durante os envios é maior do que na base, com muita variação (4.4) | Observar na medição conjunta; se for relevante, medir a memória do contentor sem a cache de páginas |
| Envios em simultâneo não medidos | Decisão da especificação (secção 5): o mínimo de 128 MiB foi escolhido para três envios em simultâneo em 512 MiB, mas isso é deduzido e não medido | — |
| Amostragem de 1 s na M1.1 | Um pico mais curto pode escapar | A M1.2 com 512 MiB por contentor cobre esse caso e passa com 1000 MiB |

## 6. RNF-F2-02 — medição no seu ramo

### 6.1 Como foi medido

| | Base | Final do RNF-F2-02 |
| --- | --- | --- |
| Versão | `43a2e08` | `77c9bf7` (série) e `ed34cd7` (complemento), ramo `fase2/rnf-f2-02-segundo-plano-medido`. Os dois commits diferem só em `Docs/` |
| Quando | 17 nov., 01:34–04:23 | 18 nov., 15:15–16:35 (série) e 20:40–21:51 (complemento; C2.3 repetido às 21:53) |
| Máquina, Docker, alimentação | Ver secção 1 | Iguais (`ambiente.json` de cada parte); ligado à corrente |
| Arranque | Limpo | Limpo, antes de cada parte |
| Procedimento | `correr-tudo.sh` e `regressao/correr.sh` | Os mesmos passos e parâmetros, com duas diferenças. A M2.2 recarrega aos 25% e 60% da execução de referência da base (`rnf2-calibracao-330s.json`, 222,8 s), copiada para junto dos resultados. O C2.3 pede a rota de estado que o ADR-02 acrescenta (`PICTURAS_STATE_PATH`) |

Resultados em bruto em `medicoes/final/rnf-f2-02/`, com os scripts que correram em `scripts/`.

**Ocorrências.**

| Ocorrência | Tratamento |
| --- | --- |
| A série foi parada às 16:35, a meio da M2.3, porque a máquina tinha de ser desligada. Estavam feitas 8 das 10 tentativas (A1–A5, B1–B3), todas gravadas antes da paragem | O resto correu no mesmo dia, de um arranque limpo (`complemento/`): 4 tentativas da M2.3 (A1, A2, B1, B2), os controlos C2.1–C2.5, a M1.2 e a regressão. A M2.3 junta as tentativas das duas partes |
| O C2.3 do complemento deu 404 ao dono, a outro utilizador e sem JWT, e o script contou-o como recusado | O Git Bash converteu o valor de `PICTURAS_STATE_PATH` num caminho do Windows (`C:/Program Files/Git/projects/...`). O C2.3 foi repetido com `MSYS_NO_PATHCONV=1` (`complemento/c23/`), e o script passou a só contar a recusa quando o dono recebe 200 do mesmo URL |
| A série não repete a M1.1 e o C1.4 com 1000 MiB | Decisão (ADR-02, 7.2): este ramo mantém o caminho de carregamento da base, onde esse envio deitou abaixo o motor do Docker duas vezes. A medida com 1000 MiB faz-se com os dois requisitos integrados (secção 7) |

### 6.2 Medidas principais

| Medida | Base | Final | Alvo | Mínimo | Resultado |
| --- | --- | --- | --- | --- | --- |
| M2.1 — ações concluídas durante uma execução (pior de 3) | 0% | **100%**: as 10 ações nas 3 execuções | 100% | 80%, com G1 completo | **Alvo atingido** |
| M2.2 R — repor o estado depois de recarregar (maior de 6) | Não recupera (6/6) | **0,63 s** (mediana 0,36 s) | ≤ 2 s | ≤ 5 s | **Alvo atingido** |
| M2.2 F — avisar o fim noutra página (maior de 3) | Não recupera (3/3) | **0,11 s** | ≤ 2 s | ≤ 5 s | **Alvo atingido** |
| M2.3 — cancelar depois de perder a página | 0/10 | **12/12**: 7/7 na forma A, 5/5 na forma B | 10/10 | 5/5 na forma A | **Alvo atingido** |

**O RNF-F2-02 fica cumprido, com o alvo atingido nas três medidas principais.**

Observações:

- **M2.1.** As ações dentro de P (1 a 4), que na base ficavam tapadas pelo painel, demoram 0,1 a
  0,3 s; transferir os originais demora cerca de 4 s, abaixo dos 10 s. As ações fora de P demoram
  0,1 a 0,4 s mais do que na base (criar um projeto: 0,65–0,95 s contra 0,43–0,50 s), muito
  abaixo do limite; a diferença não foi investigada. Os 10% de progresso, a partir dos quais as
  ações começam, chegaram aos 31–45 s, e não aos 0,8 s da base. A barra passou a seguir o vídeo,
  que é quase todo o trabalho, em vez de contar cada imagem como um quinto da execução. As três
  execuções foram válidas: P ainda estava a ser processado quando a última ação terminou.
- **M2.2.** O valor mostrado depois de recarregar nunca foi inferior ao de antes (por exemplo,
  15,0% → 15,3%). Num dos fins, a interface mostrou a conclusão no mesmo instante em que os
  resultados ficaram disponíveis na API (0 s).
- **M2.3.** Em todas as tentativas, o `Cancel` apareceu em 0,27 a 1,02 s (o valor mais alto é o
  da forma B, que abre P numa sessão nova), P deixou de estar em processamento em 0,03 s ou
  menos, e os resultados ficaram iguais aos de antes.

### 6.3 Controlos do RNF-F2-02

| ID | Base | Final do RNF-F2-02 | Limite | Resultado |
| --- | --- | --- | --- | --- |
| C2.1 — duração de uma execução de P (mediana de 3) | 269,3 s (série da base) | 336,6 s (330,3–341,5 s) | ≤ base + 10% | Não se compara entre sessões (ver abaixo); medido em blocos A-B-A na secção 7 |
| C2.2 — maior intervalo entre mudanças do progresso | 16,9 s (máx. 18,1 s) | 2,22 s (1,51–2,22 s) | ≤ 5 s | **Passa a cumprir**; a base não cumpria |
| C2.3 — estado da execução com o JWT de outro utilizador e sem JWT | Não aplicável | Dono 200; outro utilizador 401; sem JWT 401 (`complemento/c23/`) | Recusado nos dois casos | Cumpre |
| C2.4 — P e Q com sobreposição | Iguais às execuções separadas | Iguais, em P e em Q | Iguais | Cumpre |
| C2.5 — ferramenta acrescentada a P a meio da execução | 201; resultados da execução em curso iguais | 201; resultados iguais | O mesmo comportamento, sem erro | Cumpre. Pela interface, o pipeline passa a estar só de leitura durante a execução; pela API, o comportamento é o da base |

**C2.1.** As três execuções demoraram 330–342 s, 25% acima da mediana da série da base. A série do
RNF-F2-01 mostrou que esta comparação não é válida: o mesmo código da base demorou 267–291 s numa
sessão e 311–381 s noutra (secção 4.2). No registo do worker, as três execuções do C2.1 demoraram
328,7, 334,8 e 339,2 s. O C2.1 fica 1,6 a 2,3 s acima disso, contra 2 a 3,5 s na base, por isso o
tempo a mais está dentro do worker, e não no orquestrador. Na mesma sessão, outras execuções do
mesmo trabalho demoraram 240 a 300 s no worker (as execuções canceladas da M2.3, que o worker leva
até ao fim, e as do C2.4 e do C2.5). A série do RNF-F2-01 mostrou o mesmo padrão: as execuções do
C2.1, com o browser aberto a acompanhar o progresso, foram as mais lentas no worker. O RNF-F2-02 muda o worker de vídeo (relatório de
progresso a cada segundo, para a `project_queue`) e o orquestrador (cerca de uma escrita no MongoDB
por segundo durante o vídeo). O efeito destas alterações no C2.1 mede-se com a base na mesma sessão,
nos blocos A-B-A da medição conjunta (secção 7).

**C2.2.** O progresso mostrado mudou 356 a 375 vezes por execução, contra 25 na base. O maior
intervalo ficou entre 1,5 e 2,2 s. O REQ-VID-STATUS-003 pede atualizações a cada 2 s como alvo e a
cada 5 s no mínimo: o mínimo é cumprido em todas as execuções, e o alvo em duas das três.

### 6.4 Medidas do RNF-F2-01 neste ramo

Este ramo não altera o caminho de carregamento. As medidas do RNF-F2-01 servem para verificar que o
RNF-F2-02 não o piora:

| Medida | Base | Final do RNF-F2-02 |
| --- | --- | --- |
| M1.1 com 500 MiB (serviço que mais cresce) | 2001 MiB (`api_gateway`) | 2009 MiB (`api_gateway`) |
| M1.1 com 10 e 100 MiB | 35,0 e 307,9 MiB | 39,4 e 375,8 MiB |
| M1.2 | 100 MiB | 100 MiB: com 500 MiB o `api_gateway` é terminado nas 3 repetições |
| C1.3 | 401; +1006 MiB | 401; +1006 MiB |
| C1.4, C1.5, C1.6 | Iguais / 7 decisões / nenhum | Iguais / as mesmas 7 decisões e mensagens / nenhum |
| C1.7 | O 409 deixa o ficheiro sem dono | Igual: o 409 deixa o ficheiro sem dono |

**Tempos de envio (C1.1, mediana).** 10 MiB: 0,60 s (base 0,33 s); 100 MiB: 3,75 s (base 1,69 s);
500 MiB: 8,21 s (base 8,96 s). As medianas de 10 e 100 MiB são puxadas pelas primeiras
repetições de cada tamanho. Na base, essas repetições também eram as mais lentas, mas aqui foram
mais (100 MiB: 13,2 s na primeira, 1,8 e 2,1 s nas duas últimas; 500 MiB: 41,8 s na primeira,
contra 21,6 s na base). As duas últimas repetições de cada tamanho ficam dentro do intervalo da
base (100 MiB: 1,8–2,1 s contra 1,5–2,8 s; 500 MiB: 7,2–8,2 s contra 7,2–10,2 s). O diff do ramo
não toca no caminho de carregamento: as rotas `POST .../img` e `.../video`, o `img_storage` e o
nginx são os da base. A diferença fica registada como variação da sessão, e não como efeito do
RNF-F2-02. A medição conjunta (secção 7) compara os tempos de carregamento com o RNF-F2-01 isolado.

### 6.5 Preservação funcional

| Suite | Base | Final do RNF-F2-02 |
| --- | --- | --- |
| Worker de vídeo (pytest) | 74/74 | 75/75 (os 74 da base e o teste de cadência do passo 2) |
| Orquestrador (`node --test`) | 8/8 | 14/14 (os 8 da base e 6 do cálculo do progresso) |
| Ponta a ponta (T01–T18) | 18/18 | 18/18, todos com a mesma impressão da base (`referencia.json`) |
| Interface (U01–U03) | 3/3 | 3/3 |

Regressão em `regressao/final/rnf-f2-02.md`, corrida no fim do complemento. Os 3 testes unitários
novos do `ws_gateway` passam (3/3, `regressao/resultados/final/rnf-f2-02-wsgateway.txt`) e não
fazem parte da suite da base.

### 6.6 O que não foi atingido e porquê

**No RNF-F2-02, nada ficou por atingir nas medidas principais**: as três atingem o valor-alvo.
Dos controlos, o C2.2, que a base não cumpria, passou a cumprir, e o C2.3 a C2.5 cumprem. O C2.1
fica por decidir com a base na mesma sessão (secção 7).

| Ponto | Porquê | O que fazer |
| --- | --- | --- |
| C2.1 sem comparação válida neste ramo | A velocidade do worker varia entre sessões mais do que a tolerância de 10% | Blocos A-B-A na medição conjunta (secção 7) |
| Um vídeo cancelado continua a ocupar o worker até ao fim | Interromper o trabalho já entregue ao worker ficou fora do âmbito (requisitos-nf, 3.2). O cancelamento mostra P como parado em 0,03 s, mas a execução seguinte espera na `video_queue` | Fora do âmbito; ligado à capacidade (C3 do diagnóstico) |
| A sala `project:<id>` do `ws_gateway` aceita qualquer socket | Fragilidade da base (EV-15), contornada e não corrigida: o `run-status` não passa por lá | Fora do âmbito (segurança, C6 do diagnóstico) |
| O C2.3 do complemento foi inválido | O Git Bash converteu o valor de `PICTURAS_STATE_PATH` num caminho do Windows | Repetido com a conversão desligada; o script só conta a recusa se o dono receber 200 |

## 7. Medição com os dois requisitos integrados

{a preencher depois da série conjunta}
