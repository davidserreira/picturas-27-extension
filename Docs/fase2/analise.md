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

### 7.1 Como foi medido

| | Valor |
| --- | --- |
| Versão | `eb8a37d`, ramo `fase2/integracao`: o RNF-F2-01 (`7740230`) e o RNF-F2-02 (`3eefe39`) juntos. O código juntou-se sem conflitos; os conflitos foram em documentos e no cabeçalho de `rnf2/medir.mjs` |
| Quando | 18 e 19 nov., a partir das 21:54 |
| Procedimento | `scripts/conjunta.sh`. (1) Série completa com `correr-tudo.sh`, incluindo a M1.1 e o C1.4 com 1000 MiB, com a calibração da base para a M2.2 e a rota de estado para o C2.3. (2) Regressão (`regressao/final.md`), de um arranque limpo. (3) Três blocos A-B-A do C2.1 e do C2.2 (A: a base, `43a2e08`; B: este ramo), cada um de um arranque limpo |
| Conversão de caminhos | O script exporta `MSYS_NO_PATHCONV=1` (secção 6.1, ocorrências) |

Resultados em bruto em `medicoes/final/integrado/`.

### 7.2 Medidas principais dos dois requisitos

| Medida | Base | Isolado (no seu ramo) | Integrado | Alvo | Resultado integrado |
| --- | --- | --- | --- | --- | --- |
| M1.1 (1000 MiB, serviço que mais cresce) | Não mensurável | 56,3 MiB (`img_storage`) | **62,4 MiB** (`img_storage`), máximo de 5 repetições | ≤ 64 MiB | **Alvo atingido**, com 1,6 MiB de margem |
| M1.1 com 500 MiB (referência) | 2001 MiB | 55,3 MiB | 62,9 MiB (`img_storage`) | — | — |
| M1.2 | 100 MiB | 1000 MiB | **1000 MiB**: 3 em 3 em todos os tamanhos, sem reinícios | 1000 MiB | **Alvo atingido** |
| M2.1 | 0% | 100% | 100% | 100% | **Alvo atingido** |
| M2.2 R | Não recupera | 0,63 s | 0,43 s | ≤ 2 s | **Alvo atingido** |
| M2.2 F | Não recupera | 0,11 s | 0,12 s | ≤ 2 s | **Alvo atingido** |
| M2.3 | 0/10 | 12/12 | 10/10 (5/5 em cada forma) | 10/10 | **Alvo atingido** |

**Os dois requisitos continuam cumpridos com o alvo atingido em todas as medidas principais.**
Nenhum piora o outro nas medidas principais. A única diferença com algum peso é a margem da M1.1:
o `img_storage` subiu até 62,4 MiB com 1000 MiB (52,2, 49,1, 54,6, 62,4 e 52,6 MiB nas cinco
repetições), contra 56,3 MiB no ramo isolado. O RNF-F2-02 não toca no `img_storage` nem no
caminho de carregamento, e o código do `img_storage` é o mesmo nas duas versões. A explicação mais
provável é a recolha de memória do V8, que varia de repetição para repetição (de 49 a 62 MiB nesta
série; secção 2: a margem depende da afinação do passo 5b). O instrumento não o confirma. Fica registada: com 1,6 MiB de margem, uma repetição desfavorável pode passar o alvo,
embora fique longe do mínimo de 128 MiB.

### 7.3 Controlos

| ID | Base | Isolado | Integrado | Limite | Resultado |
| --- | --- | --- | --- | --- | --- |
| C1.1 — aceitação (mediana) | 500 MiB: 8,96 s | 500 MiB: 0,84 s; 1000 MiB: 0,63 s | 500 MiB: 0,97 s; 1000 MiB: 0,76 s | ≤ base + 10% | Cumpre |
| C1.2 — envio completo (mediana) | 500 MiB: 10,22 s | 500 MiB: 7,03 s; 1000 MiB: 7,58 s | 500 MiB: 6,40 s; 1000 MiB: 7,67 s | ≤ base + 10% | Cumpre |
| C1.3 — 500 MiB sem JWT | 401; +1006 MiB | 401; +24 MiB | 401; +19,6 MiB | 401 e ≤ 128 MiB | Cumpre |
| C1.4 — SHA-256 | Igual (10–500 MiB) | Igual (10–1000 MiB) | Igual (10–1000 MiB) | Iguais | Cumpre |
| C1.5 — decisões de validação | 7 casos | Iguais | Iguais, com as mesmas mensagens | Iguais | Cumpre |
| C1.6 — temporários | Nenhum | Nenhum | Nenhum, também no envio interrompido | Zero | Cumpre |
| C1.7 — órfãos | O 409 deixa um órfão | Nenhum | Nenhum | Sem órfãos | Cumpre |
| C2.1 — duração de P (mediana) | 269,3 s | 336,6 s (sessão diferente) | 309,6 s (306,6–314,8 s) | ≤ base + 10% na mesma sessão | Cumpre: 282,5 s, contra 284,5 e 287,6 s da base na mesma sessão (7.4) |
| C2.2 — maior intervalo do progresso | 16,9 s | 2,22 s | 2,30 s | ≤ 5 s | Cumpre |
| C2.3 — estado a terceiros | Não aplicável | Dono 200; outro 401; sem JWT 401 | Dono 200; outro 401; sem JWT 401 | Recusado | Cumpre |
| C2.4 — sobreposição | Iguais | Iguais | Iguais | Iguais | Cumpre |
| C2.5 — ferramenta a meio | 201; iguais | 201; iguais | 201; iguais | Sem erro | Cumpre |

### 7.4 Comparação A-B-A do C2.1

Cada bloco partiu de um arranque limpo (`down -v`, `up --build`), esperou 90 s depois de o
frontend responder e correu três execuções de P com o vídeo de 330 s, como o C2.1 da série
(`rnf2/medir.mjs controlos --so c21`). A é a base (`43a2e08`, a partir de uma cópia de trabalho em
`C:/tmp/picturas-main`) e B este ramo (`eb8a37d`); o `variante.txt` de cada bloco confirma a
versão (só B tem `models/run.js`). O tempo do worker é o `t=` que o `video_tool` regista no fim de
cada vídeo (`logs/video_tool.log` de cada bloco).

| Bloco | Hora (19 nov.) | C2.1 (s) | Mediana (s) | Worker (s) | C2.1 menos worker (s) | C2.2 (s) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 — A | 00:08–00:23 | 282,1; 289,5; 284,5 | 284,5 | 279,6; 287,6; 282,9 | 2,5; 1,9; 1,6 | 17,2; 18,8; 17,6 |
| 2 — B | 00:36–00:52 | 282,5; 279,7; 346,1 | **282,5** | 280,2; 277,1; 343,9 | 2,3; 2,6; 2,2 | 2,0; 1,8; 1,9 |
| 3 — A | 00:55–01:10 | 287,6; 295,8; 285,6 | 287,6 | 285,6; 293,6; 283,8 | 2,0; 2,2; 1,8 | 18,3; 18,3; 31,1 |

**O C2.1 cumpre o limite.** A mediana de B (282,5 s) fica 1,2% abaixo do ponto médio das medianas
de A (286,1 s), e o limite de base + 10% na mesma sessão é 314,7 s. Com as médias, que contam a
execução mais lenta, B fica 5,3% acima de A (302,8 contra 287,5 s), também dentro do limite.

A terceira execução de B demorou 346,1 s, 21% acima do ponto médio de A. O tempo a mais esteve no
worker: 343,9 s, contra 280,2 e 277,1 s nas duas execuções anteriores do mesmo bloco. Fora do
worker foram 2,2 s, como nas outras. O worker de B só difere do de A nos relatórios de progresso
(ADR-02, passo 2). Um atraso sistemático causado por eles apareceria nas três execuções, e as duas
primeiras de B são a primeira e a terceira mais rápidas das nove. O instrumento não regista a carga
da máquina nem a do RabbitMQ, por isso a causa desta execução não se confirma. A variação do worker
não é nova: na série conjunta, o mesmo código com o mesmo vídeo demorou no worker de 229 a 316 s,
em 22 execuções das várias medidas.

O tempo fora do worker é onde o ADR-02 acrescenta trabalho: as escritas da execução no MongoDB e as
mensagens de estado. Foi de 2,2 a 2,6 s em B e de 1,6 a 2,5 s em A, ou seja, 0,4 s a mais em média,
cerca de 0,1% da duração de P.

O C2.2 confirma na mesma sessão o resultado da série: 1,8 a 2,0 s em B, abaixo do limite de 5 s,
contra 17,2 a 31,1 s em A.

Os blocos também mostram por que razão os tempos não se comparam entre sessões. O código de B
demorou 309,6 s de mediana na série conjunta, cerca de uma hora antes, e 282,5 s no bloco 2. O da
base demorou 269,3 s na série da base e 284,5 e 287,6 s nos blocos 1 e 3.

A primeira tentativa do bloco 2 parou por uma falha do instrumento, e os blocos 2 e 3 foram
repetidos seguidos (`medicoes/final/integrado/README.md`).

### 7.5 Preservação funcional

| Suite | Base | Integrado |
| --- | --- | --- |
| Worker de vídeo (pytest) | 74/74 | 75/75 |
| Orquestrador (`node --test`) | 8/8 | 19/19 (os 8 da base, 5 do RNF-F2-01 e 6 do RNF-F2-02) |
| Ponta a ponta (T01–T18) | 18/18 | 18/18, todos com a mesma impressão da base |
| Interface (U01–U03) | 3/3 | 3/3 |

Regressão em `regressao/final.md`, corrida de um arranque limpo depois da série. Os testes unitários
do `img_storage`, do `api_gateway` e do `ws_gateway` correram nos passos de cada ADR e não fazem
parte da suite da base.

### 7.6 Conclusão da medição conjunta

Com os dois requisitos integrados, as medidas principais dos dois mantêm o alvo atingido, os doze
controlos cumprem o limite e a regressão dá os mesmos resultados da base, com as mesmas impressões
ponta a ponta. O C2.1, que as séries isoladas não podiam comparar com a base, cumpre na mesma
sessão: mediana de 282,5 s com os dois requisitos, contra 284,5 e 287,6 s na base (7.4). Nenhum
dos requisitos piora o outro.

Ficam registados um risco e uma limitação do instrumento:

- **Margem da M1.1.** Nesta série foi de 1,6 MiB (7.2). Uma repetição desfavorável pode passar o
  alvo, embora longe do mínimo de 128 MiB.
- **Sensibilidade do C2.1.** O tempo do worker varia de execução para execução: uma execução de B
  ficou 21% acima da base sem mudar a mediana (7.4). Com a mediana de três execuções, uma segunda
  execução lenta no mesmo bloco bastaria para passar o limite, tanto em B como em A.

## 8. Reprodução noutras máquinas

De 19 a 23 de novembro, dois membros da equipa repetiram uma parte das medições nas suas máquinas, com
`medicoes/reproducao/reproducao.sh` sobre o código do `main`: a M1.1 com 500 MiB na base e no `main`,
a regressão, e a M2.2 e a M2.3 uma vez cada. Não substituem as séries oficiais: os tempos não se
comparam entre máquinas.

| | Máquina de medição (os dois integrados) | Pedro (Linux, Intel i5-11300H) | Miguel (macOS, Apple M1 Pro, imagens ARM) |
| --- | --- | --- | --- |
| M1.1 na base (`api_gateway`) | 2001 MiB | 1694 MiB | 1961 MiB |
| M1.1 no `main`, serviço pior | `projects` 36,0 MiB; `img_storage` 62,9 MiB | `projects` 15, 87 e 77 MiB | `projects` 112, 147 e 182 MiB |
| M2.2 R / F | 0,43 / 0,12 s | 0,44 / 0 s (vídeo de 120 s) | 0,13 / 0 s (vídeo de 330 s) |
| M2.3 | 10/10 | 2/2 | 2/2 |
| Regressão | 75/75, 19/19, 18/18, 3/3 | 75/75, 19/19, 18/18, 3/3 | 75/75, 19/19, 16/18, 3/3 |

Os resultados em bruto estão em `medicoes/reproducao/pedro/` e `medicoes/reproducao/miguel/`, cada
um com o seu `NOTAS.md`; os da máquina de medição são os de `medicoes/final/integrado/`.

**A melhoria repete-se, mas a margem da M1.1 não.** Nas duas máquinas, o `projects` ficou acima do
alvo de 64 MiB, e na do Miguel acima do mínimo de 128 MiB em duas das três repetições; na máquina de
medição, o mesmo serviço ficou nos 36,0 MiB. A hipótese é a mesma causa da afinação do passo 5b: a
memória que o V8 e a glibc demoram a devolver, que depende da plataforma. Não está verificada, e só
se mediu 500 MiB, por isso as reproduções não mostram se nessas máquinas o acréscimo depende do
tamanho do ficheiro. O resultado "alvo atingido" da secção 2 vale para a máquina de medição.

**O T05 e o T06 diferem da referência em ARM** só no SHA-256 de imagens; na máquina Intel do Pedro o
mesmo código deu as impressões da referência. A explicação provável é a compressão PNG das imagens
Docker ARM; não verificada.

**Falhas do instrumento encontradas.** O `regressao/correr.sh` não tinha permissão de execução no
git (exit 126 em Linux e macOS); com o vídeo de 120 s, a M2.2 dava "não recupera" numa máquina rápida,
porque a execução acabava antes das recargas; e o relatório da regressão escrevia sempre a máquina da
medição inicial. As três foram corrigidas (`0ec8e05`).
