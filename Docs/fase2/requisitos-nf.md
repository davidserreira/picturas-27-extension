# Fase 2 — Especificação dos requisitos não funcionais a melhorar

Grupo PL5-G5 · 16 de novembro de 2026 · parte do diagnóstico em `diagnostico.md`

Este documento especifica os dois requisitos não funcionais escolhidos para a Fase 2, de forma que
cada um possa ser medido na solução de base e outra vez depois do refactoring, com o mesmo método.
Os valores medidos na base vêm da medição inicial de 17 de novembro de 2026 (secção 1 e `medicoes/baseline/`).

| ID | Requisito | ISO/IEC 25010:2011 | Candidato no diagnóstico |
| --- | --- | --- | --- |
| RNF-F2-01 | Carregamento de ficheiros grandes com memória limitada | Eficiência de desempenho — utilização de recursos | C5 |
| RNF-F2-02 | Trabalho em segundo plano durante o processamento | Usabilidade — operabilidade | C4 |

Os dois requisitos são independentes: cada um é especificado, implementado e avaliado por si.
Tocam-se num único ponto, registado em 4.3.

## 1. Regras comuns às medições

1. **Mesma máquina e mesmas condições.** A medição inicial e a final correm na mesma máquina, com
   a mesma versão do Docker, a mesma memória atribuída ao Docker e sem outras cargas relevantes.
2. **Versões medidas.** A inicial corre sobre o commit de partida `0523102`, sem alterações ao
   código. A final corre sobre o commit entregue. O hash de cada uma fica registado com os resultados.
3. **Arranque limpo.** Antes de cada série: `docker compose down -v --remove-orphans` e
   `docker compose up -d --build`, à espera de todos os serviços prontos. O conjunto de serviços
   lançado é o mesmo nas duas medições e fica registado.
4. **Só se mede por fora.** Os scripts usam a interface pública (`https://localhost:8080`) e
   comandos do Docker. Não dependem de código interno, para servirem às duas versões.
5. **Configuração de medição.** Os limites de memória por contentor usados em M1.2 são aplicados
   por um ficheiro de override do Compose que só existe para medir, igual nas duas medições. Não
   faz parte da solução.
6. **Dados gerados por script.** Os ficheiros de teste são produzidos de forma determinística por
   um script entregue com as medições; não são versionados.
7. **Conta de teste.** As medições usam uma conta premium criada por script, porque o perfil
   gratuito limita os vídeos a 100 MB e a 5 operações por dia.
8. **Resultados em bruto.** Ficam em `Docs/fase2/medicoes/baseline/` e `Docs/fase2/medicoes/final/`.

**Ambiente de medição** (a preencher na medição inicial):

| Elemento | Valor |
| --- | --- |
| Máquina (modelo, CPU, núcleos) | HP Victus 15-fa0xxx; Intel Core i5-12450H, 8 núcleos, 12 processadores lógicos |
| RAM total e RAM atribuída ao Docker | 15,7 GiB; 7,59 GiB e 12 CPUs atribuídos ao Docker |
| Sistema operativo | Windows 11 Home 10.0.26300; Docker em WSL 2 (kernel 6.6.87.2) |
| Docker Engine e Docker Compose | Docker Desktop, Engine 29.9.3, Compose 5.7.0 |
| Browser usado pelo script (RNF-F2-02) | Chromium do Playwright 1.55.0, sem interface, janela 1440×900; Node.js 24.11.1 |
| Serviços lançados | Os 32 serviços do `docker-compose.yaml`, sem alterações |
| Versão medida | `43a2e08` (código igual a `0523102`; só `Docs/` e `.gitignore` diferem) |
| Data | 17 de novembro de 2026, entre as 01:34 e as 04:23 |

Resultados em bruto e resumo em `medicoes/baseline/`; método e scripts em `medicoes/README.md`.

**Como se decide o resultado.** Um requisito fica *cumprido* se todas as suas medidas principais
atingirem o valor mínimo aceitável, e *com o alvo atingido* se atingirem o valor-alvo. As medidas
de controlo (secção 4) não decidem o cumprimento: uma que falhe é reportada como efeito colateral
negativo e analisada.

## 2. RNF-F2-01 — Carregamento de ficheiros grandes com memória limitada

### 2.1 Classificação

Eficiência de desempenho, subcaracterística **utilização de recursos**: o grau em que as
quantidades e os tipos de recursos usados pelo sistema, ao desempenhar as suas funções, cumprem os
requisitos. O recurso em causa é a memória dos serviços que o ficheiro atravessa.

### 2.2 Enunciado

> Ao receber um ficheiro de media de qualquer tamanho até ao limite do perfil de quem o carrega
> (1 GB no perfil premium), o sistema deve manter o acréscimo de memória de cada serviço que o
> ficheiro atravessa abaixo de um valor fixo, que não depende do tamanho do ficheiro.

Os serviços abrangidos são os contentores `nginx`, `api_gateway`, `projects` e `img_storage`. O
`seaweedfs` é medido e reportado, mas fica fora do critério, por ser um componente de terceiros.

Fora do âmbito, por decisão: a indicação de progresso do envio na interface, que seria uma
melhoria de usabilidade e mediria outra coisa; os envios em simultâneo, que não são medidos
(entram só como justificação do valor mínimo); e a memória usada na transferência de resultados em
ZIP, que tem o mesmo defeito mas é outro caminho.

### 2.3 Quantificação

**M1.1 — Acréscimo de memória por serviço (medida principal)**

| Campo | Definição |
| --- | --- |
| Escala | Acréscimo de memória de um contentor durante um envio, em MiB: o maior valor de memória observado entre o início do envio e a resposta, menos o valor em repouso imediatamente antes |
| Cenário | Um utilizador premium envia um vídeo para um projeto vazio por `POST /api-gateway/projects/:user/:project/video`, com o JWT válido, um envio de cada vez |
| Carga e dados | Vídeos MP4 (H.264, 1280×720, 30 fps, duração até 600 s) de 10, 100, 500 e 1000 MiB, com o tamanho fixado pelo débito de codificação. 1000 MiB fica abaixo do limite premium de 1024 MB com margem |
| Instrumento | `docker stats` em modo contínuo sobre os cinco contentores, lido a cada segundo por um script que regista a coluna de memória usada; cliente HTTP de linha de comandos para o envio |
| Procedimento | Para cada tamanho, 5 repetições. Antes de cada repetição reiniciam-se `api_gateway`, `projects` e `img_storage` e esperam-se 15 s, para o valor em repouso não herdar memória do envio anterior. A repetição só é válida se a resposta for 204 |
| Valor que se compara | O maior acréscimo das 5 repetições com o ficheiro de 1000 MiB, no serviço que mais cresce. Os outros tamanhos são reportados para mostrar como o acréscimo varia com o tamanho |
| Valor medido na base | **2001 MiB** (`api_gateway`, 500 MiB). Com 1000 MiB a medição não se completa: nas duas tentativas, o envio esgotou os 7,6 GiB atribuídos ao Docker e o motor deixou de responder. Até esse momento, o `api_gateway` tinha crescido 3455 MiB e o `projects` 1981 MiB. Média do maior serviço com 10, 100 e 500 MiB: 28, 305 e 1692 MiB. Ver 2.5 |
| Valor-alvo | ≤ 64 MiB em cada serviço |
| Valor mínimo aceitável | ≤ 128 MiB em cada serviço |

Origem dos valores:

- **Tamanhos de 10 MB e 500 MB**: são os do critério de aceitação do REQ-VID-SUBMIT-008 do
  documento de requisitos de base (PL1-G4, Tabela 30). **100 MB e 1 GB**: são os limites dos
  perfis gratuito e premium (`VIDEO_FREE_MAX_SIZE_MB`, `VIDEO_PREMIUM_MAX_SIZE_MB`,
  `docker-compose.yaml:145-147`).
- **Alvo de 64 MiB**: um envio em partes para armazenamento S3 precisa de ter em memória algumas
  partes de cada vez. O cliente que a base usa (`aws-sdk`, `ManagedUpload`) trabalha por omissão
  com partes de 5 MiB e 4 em paralelo, ou seja, 20 MiB. O alvo é esse valor com uma folga de cerca
  de três vezes para o que o instrumento não distingue (memória do runtime, analisador do corpo).
- **Mínimo de 128 MiB**: é o maior acréscimo que ainda deixa um serviço com 512 MiB receber três
  envios em simultâneo (3 × 128 = 384 MiB, mais a memória em repouso). É também cerca de um oitavo
  do ficheiro maior, longe o bastante para se poder afirmar que a memória deixou de acompanhar o
  tamanho.
- **512 MiB por contentor**: a base é dimensionada para 8 GB de RAM com cerca de 25 contentores
  (README, pré-requisitos), o que dá uma média perto de 320 MiB; 512 MiB é o escalão corrente
  imediatamente acima.

**M1.2 — Maior ficheiro aceite com a memória limitada (medida principal)**

Complementa a M1.1 com um resultado que não depende da frequência de amostragem: um serviço que
guarde o ficheiro inteiro em memória não consegue passar.

| Campo | Definição |
| --- | --- |
| Escala | Tamanho, em MiB, do maior ficheiro da série 10, 100, 500, 1000 que é carregado com sucesso nas 3 repetições |
| Cenário | O da M1.1, com `nginx`, `api_gateway`, `projects` e `img_storage` limitados a 512 MiB de memória cada um |
| Sucesso de um envio | Resposta 204; nenhum dos quatro contentores reinicia nem é terminado por falta de memória durante o envio; o media aparece no projeto; o ficheiro devolvido pelo sistema tem o mesmo SHA-256 do enviado |
| Instrumento | Override do Compose com os limites; script de envio; `docker inspect` para o número de reinícios e o indicador de terminação por falta de memória |
| Procedimento | Por ordem crescente de tamanho, 3 repetições cada, com reinício dos três serviços Node antes de cada uma. A série pára no primeiro tamanho que falhe |
| Valor medido na base | **100 MiB**. Com 500 MiB o `api_gateway` é terminado por falta de memória nas 3 repetições e o cliente recebe 502 |
| Valor-alvo | 1000 MiB |
| Valor mínimo aceitável | 500 MiB |

Origem dos valores: o alvo é o maior ficheiro que o perfil premium pode carregar; o mínimo é o
maior ficheiro com que o REQ-VID-SUBMIT-008 exige que o carregamento seja verificado.

### 2.5 Observações da medição inicial

- **O consumo cresce com o tamanho do ficheiro.** O `projects` e o `img_storage` crescem cerca de
  uma vez o tamanho do ficheiro; o `api_gateway`, entre três e quatro vezes (305 MiB para
  100 MiB; 1692 MiB, em média, para 500 MiB).
- **Um único envio de 1000 MiB derruba a instalação inteira**, e não só o serviço que o recebe. A
  evidência da primeira ocorrência está em `medicoes/ocorrencias/2026-11-16-queda-docker/`.
- **Com 500 MiB, a primeira série teve uma repetição com 504.** O nginx deixou de esperar pela
  resposta do gateway. Essa repetição não foi contada; a série que conta teve 5 em 5 válidas.

### 2.4 Pré-requisitos

- Conta premium de teste criada por script, através do serviço de subscrições.
- Gerador dos ficheiros de teste (ffmpeg) e script de amostragem da memória.
- Override do Compose com os limites de memória, para a M1.2.
- Suite de regressão a passar na base antes de qualquer alteração (ver 4.4).

Não depende de nenhum outro requisito não funcional ser melhorado primeiro.

## 3. RNF-F2-02 — Trabalho em segundo plano durante o processamento

### 3.1 Classificação

Usabilidade, subcaracterística **operabilidade**: o grau em que o sistema tem atributos que o
tornam fácil de operar e de controlar. O que está em causa é o utilizador manter o controlo da
aplicação e de uma execução demorada.

### 3.2 Enunciado

> Enquanto um projeto é processado, o sistema deve permitir que o utilizador continue a usar a
> aplicação sem deixar de acompanhar essa execução, e deve permitir acompanhá-la e cancelá-la
> depois de recarregar a página.

O cancelamento mantém o significado que tem na base: a execução deixa de produzir resultados e o
projeto volta a ficar editável. Interromper o trabalho já entregue ao worker de vídeo fica fora
do âmbito (é a fragilidade C3 do diagnóstico). Alterar o pipeline do projeto que está a ser
processado também não faz parte do requisito; o que acontece nesse caso é uma medida de controlo
(C2.5).

A mudança é visível ao utilizador porque é o próprio objeto da melhoria, como as diretrizes
admitem para a usabilidade. Não acrescenta ferramentas nem operações novas sobre os media.

### 3.3 Cenário comum às três medidas

| Elemento | Definição |
| --- | --- |
| Utilizador | Conta premium de teste, com sessão iniciada num browser de secretária (janela de 1440×900) |
| Projeto P | Um vídeo sintético 1280×720 a 30 fps e duas imagens; pipeline com brilho e contraste, que se aplicam aos três media |
| Duração da execução | A duração do vídeo é calibrada na medição inicial para a execução de P demorar entre 150 s e 300 s na máquina de medição, e fica igual na medição final. Calibrado: vídeo de 330 s, com execuções de 223 s a 291 s (calibração e C2.1) |
| Projeto Q | Um segundo projeto do mesmo utilizador, com uma imagem e sem pipeline |
| Instrumento | Script de automação de browser (Playwright, Chromium) sobre `https://localhost:8080`, que executa os passos, cronometra e grava um vídeo de cada execução |

Os critérios são definidos pelo que o utilizador vê, e não por identificadores de elementos. Se a
interface mudar, os seletores do script são adaptados e a adaptação fica documentada; os critérios
não mudam. Um passo que não se consiga automatizar numa das versões é executado à mão com a mesma
lista e fica assinalado como tal.

### 3.4 Quantificação

**M2.1 — Ações concluídas durante uma execução (medida principal)**

| Campo | Definição |
| --- | --- |
| Escala | Percentagem das 10 ações da lista abaixo que o utilizador conclui enquanto P está a ser processado |
| Ação concluída | (a) o resultado esperado aparece em 10 s ou menos e (b) depois da ação a interface continua a mostrar o progresso da execução de P, na página em que o utilizador estiver |
| Procedimento | Inicia-se a execução de P e, a partir dos 10% de progresso, tentam-se as ações pela ordem da lista. 3 execuções. A execução só é válida se P ainda estiver a ser processado quando a última ação termina |
| Valor que se compara | O pior resultado das 3 execuções |
| Valor medido na base | **0%** nas 3 execuções. As ações 1 a 4 ficam tapadas pelo painel de processamento; as ações 5 a 9 funcionam, mas o progresso de P desaparece logo que se sai da página; a ação 10 abre P sem progresso |
| Valor-alvo | 100% (10 em 10) |
| Valor mínimo aceitável | 80%, com as seis ações do grupo G1 todas concluídas |

Lista de ações:

| # | Grupo | Ação | Resultado esperado |
| --- | --- | --- | --- |
| 1 | G2 | Em P, passar da grelha para o carrossel | A vista muda para carrossel |
| 2 | G2 | Em P, voltar à grelha | A grelha mostra os três media de P |
| 3 | G2 | Em P, descarregar os media originais | A transferência começa |
| 4 | G2 | Em P, abrir o diálogo de partilha | O diálogo abre |
| 5 | G1 | Abrir a página da conta | A página da conta é mostrada |
| 6 | G1 | Abrir o projeto Q pela barra lateral | Os media de Q são mostrados |
| 7 | G1 | Carregar uma imagem para Q | A imagem aparece em Q |
| 8 | G1 | Acrescentar brilho ao pipeline de Q e guardar | A ferramenta aparece na lista de Q |
| 9 | G1 | Criar um projeto novo pela barra lateral | O projeto novo abre |
| 10 | G1 | Voltar a P | P mostra o progresso da execução |

G1 são as ações fora do projeto em processamento; G2 são ações de leitura dentro dele.

Origem dos valores:

- **Alvo de 100%**: é a leitura direta da ideia das diretrizes da Fase 2 ("permitir que o
  utilizador continue a usar a aplicação enquanto um projeto é processado") e do interesse do
  utilizador registado ou premium na Tabela 2 do documento de base ("saber a todo o momento como
  vai o trabalho, mesmo quando já não acompanha").
- **Mínimo de 80% com G1 completo**: "continuar a usar a aplicação" obriga a tudo o que está fora
  do projeto em processamento; dentro dele admite-se que até duas ações de leitura fiquem por
  disponibilizar.
- **10 s por ação**: é o limite a partir do qual um utilizador deixa de manter a atenção numa
  tarefa (Nielsen, *Usability Engineering*, 1993, cap. 5).

**M2.2 — Tempo até a interface refletir o estado da execução (medida principal)**

| Campo | Definição |
| --- | --- |
| Escala | Tempo, em segundos, entre um acontecimento e a interface mostrar o estado correto da execução de P |
| Acontecimento R (recarregar) | A página de P é recarregada a meio da execução. Conta-se desde o fim do carregamento da página até aparecer um indicador de progresso de P com um valor não inferior ao que estava no ecrã antes de recarregar, menos 5 pontos percentuais |
| Acontecimento F (fim) | A execução termina no servidor com o utilizador noutra página da aplicação (a de Q). Conta-se desde o momento em que os resultados de P ficam disponíveis na API até a interface indicar a conclusão |
| Procedimento | 3 execuções. Em cada uma recarrega-se duas vezes, perto dos 25% e dos 60% (6 valores de R), e mede-se F uma vez (3 valores). Um acontecimento sem resposta em 60 s regista-se como "não recupera" |
| Valor que se compara | O maior valor de R e o maior valor de F |
| Valor medido na base | **R e F: não recupera** em 6 de 6 recargas e em 3 de 3 fins. Depois de recarregar, a interface não volta a mostrar a execução; no fim, nenhuma indicação aparece noutra página |
| Valor-alvo | R ≤ 2 s e F ≤ 2 s |
| Valor mínimo aceitável | R ≤ 5 s e F ≤ 5 s |

Origem dos valores: o REQ-VID-STATUS-003 do documento de base (Tabela 30) pede que o progresso de
uma edição seja atualizado "a cada 2 s ou menos" como alvo e "a cada 5 s ou menos" no produto
mínimo viável. Usam-se os mesmos dois valores para o tempo que o estado demora a ser reposto, por
serem a frequência com que o utilizador já espera ver o progresso mudar. O acontecimento F
corresponde ao REQ-VID-NOTIFY-001, que a base deixou por implementar.

**M2.3 — Cancelamento depois de recarregar (medida principal)**

| Campo | Definição |
| --- | --- |
| Escala | Percentagem das tentativas em que o utilizador cancela a execução de P pela interface depois de ter perdido a página onde a iniciou |
| Tentativa | Inicia-se a execução de P e, aos 10% de progresso, perde-se a página de uma de duas formas: (A) recarregando-a; (B) abrindo P numa sessão nova do browser, com novo início de sessão. Depois procura-se e aciona-se o cancelamento na interface |
| Sucesso | A interface oferece o cancelamento em 10 s ou menos; depois de acionado, mostra P como não estando em processamento em 5 s ou menos; 30 s depois, os resultados de P na API são os mesmos de antes da execução |
| Procedimento | 10 tentativas: 5 da forma A e 5 da forma B. Depois de uma tentativa falhada, a execução é cancelada pela API para a seguinte partir do mesmo estado |
| Valor medido na base | **0%** (0 em 10). Depois de perder a página, a interface não oferece o cancelamento em nenhuma das duas formas |
| Valor-alvo | 100% nas duas formas (10 em 10) |
| Valor mínimo aceitável | 100% na forma A (5 em 5) |

Origem dos valores: o cancelamento é uma ação de controlo que ou está ao alcance do utilizador ou
não está, pelo que não se aceita uma taxa parcial dentro da mesma forma. O mínimo cobre o caso
que as diretrizes nomeiam ("mesmo depois de recarregar a página"). O alvo estende-o a qualquer
sessão do mesmo utilizador, que é o que o interesse "mesmo quando já não acompanha" pede. Os
tempos de 10 s e 5 s têm as origens indicadas em M2.1 e M2.2.

### 3.5 Pré-requisitos

- **O estado de uma execução tem de existir no servidor.** Na base, o progresso só existe no
  browser e em mensagens que não são guardadas (diagnóstico, C4). Sem um estado que o servidor
  consiga devolver, nenhuma das três medidas pode melhorar. É um pré-requisito de
  recuperabilidade (fiabilidade) e faz parte do refactoring deste requisito.
- Conta premium de teste e gerador do vídeo sintético, partilhados com o RNF-F2-01.
- Script de automação de browser e a sua calibração da duração da execução.
- Suite de regressão a passar na base antes de qualquer alteração (ver 4.4).

Não depende do RNF-F2-01.

## 4. Efeitos colaterais e como se controlam

Cada medida de controlo é medida na base e no fim, com o método indicado. O limite diz quando o
efeito conta como degradação.

### 4.1 Do RNF-F2-01

| ID | Requisito afetado (ISO/IEC 25010) | Risco ou efeito esperado | Medida e método | Limite |
| --- | --- | --- | --- | --- |
| C1.1 | Eficiência de desempenho — comportamento temporal (REQ-VID-SUBMIT-008) | Processar o ficheiro em fluxo pode atrasar a aceitação | Tempo entre o cliente enviar o último byte e receber a resposta, com 10 e 500 MiB, mediana de 5 repetições, medido pelo script de envio. Reporta-se também face aos 3 s e 1 s do REQ-VID-SUBMIT-008 | Não exceder o valor da base em mais de 10% |
| C1.2 | Eficiência de desempenho — comportamento temporal | O envio completo pode ficar mais lento | Tempo total do envio de 1000 MiB, mediana de 5 repetições | Não exceder o valor da base em mais de 10% |
| C1.3 | Segurança — autenticidade | Efeito positivo esperado: na base o corpo é aceite antes de o JWT ser verificado (diagnóstico, C5) | Envio de 500 MiB sem JWT: código da resposta e acréscimo de memória do `api_gateway`, pelo método da M1.1 | Resposta 401 e acréscimo dentro do mínimo da M1.1 |
| C1.4 | Adequação funcional — correção | O ficheiro guardado ou a sua impressão digital podem deixar de coincidir com o enviado | SHA-256 do ficheiro devolvido pelo sistema comparado com o do enviado, nos quatro tamanhos | Iguais em todos |
| C1.5 | Adequação funcional — correção | A validação do vídeo deixa de ter o ficheiro em memória e pode decidir de outra maneira | Aceitação ou recusa, e mensagem, para os ficheiros de `samples/video/`, um ficheiro acima do limite do perfil e um ficheiro que não é vídeo | As mesmas decisões e mensagens da base |
| C1.6 | Eficiência de desempenho — utilização de recursos (disco) | Um envio em fluxo pode deixar ficheiros temporários, sobretudo se for interrompido | Número de ficheiros temporários nos contentores do caminho de carregamento depois de um envio concluído e de um interrompido a meio | Zero em ambos |
| C1.7 | Fiabilidade e eficiência — utilização de recursos (armazenamento) | Acrescentado com o ADR-01: validar depois de guardar pode deixar objetos órfãos no armazenamento, e um envio interrompido pode deixar um envio em partes aberto | Número de objetos no prefixo `src/` de cada projeto, lido pela API do filer do SeaweedFS, depois de cada caso do C1.5, de um envio com versão antiga (409) e de um envio interrompido a meio; número de envios em partes abertos (`.uploads`) antes e depois | Um objeto por envio aceite, nenhum nos outros casos; nenhum envio em partes aberto a mais |

### 4.2 Do RNF-F2-02

| ID | Requisito afetado (ISO/IEC 25010) | Risco ou efeito esperado | Medida e método | Limite |
| --- | --- | --- | --- | --- |
| C2.1 | Eficiência de desempenho — comportamento temporal | Guardar o estado da execução acrescenta escritas e mensagens | Tempo total da execução de P sem interação, do pedido à disponibilidade dos resultados na API, mediana de 3 execuções | Não exceder o valor da base em mais de 10% |
| C2.2 | Usabilidade — operabilidade (REQ-VID-STATUS-003) | O progresso pode passar a ser atualizado com menos frequência | Maior intervalo entre duas mudanças do progresso mostrado durante a execução de P, lido pelo script de browser | ≤ 5 s |
| C2.3 | Segurança — confidencialidade (REQ-VID-ACCESS-001) | O estado da execução passa a poder ser consultado e não pode ficar visível a terceiros | Pedido do estado da execução de P com o JWT de outro utilizador e sem JWT | Recusado nos dois casos |
| C2.4 | Adequação funcional — correção | Passa a ser possível iniciar uma execução noutro projeto enquanto P corre, um caminho que a interface da base não deixava usar | Execução de P e de Q iniciadas com sobreposição: número e tipo de resultados de cada uma, e conteúdo das imagens, comparados com os das mesmas execuções feitas em separado | Iguais |
| C2.5 | Adequação funcional — correção | Com a interface desbloqueada, o utilizador pode tentar alterar o pipeline de P durante a execução | Tentativa de acrescentar uma ferramenta a P a meio da execução: a alteração é impedida, ou é aceite sem alterar os resultados da execução em curso | Um dos dois comportamentos, sempre o mesmo, sem erro por tratar |
| C2.6 | Fiabilidade — recuperabilidade | Efeito positivo esperado: o estado deixa de se perder com a página | Coberto pela M2.2 e pela M2.3; não tem medida própria | — |

O limite de 10% nas medidas de tempo é uma tolerância para a variação entre execuções. Se a
dispersão medida na base for maior do que 10%, usa-se essa dispersão como tolerância e o facto
fica registado.

### 4.3 Entre os dois requisitos

O único ponto de contacto é a ação 7 da M2.1, que carrega um ficheiro durante uma execução e por
isso usa o caminho que o RNF-F2-01 altera. Cada requisito é medido primeiro no seu ramo, isolado.
No fim, com os dois integrados, repetem-se todas as medidas principais, para verificar que nenhum
piora o outro.

### 4.4 Preservação funcional

Vale para os dois requisitos: a suite de regressão da funcionalidade de imagem e de vídeo
(carregamento, pipelines de imagem, ferramentas de vídeo, legendas, extração de fotogramas,
cancelamento, projetos mistos) corre na base antes de qualquer alteração e outra vez no fim, e tem
de dar os mesmos resultados. Inclui os testes que o repositório já traz (`Tools/video/tests/`,
`projects/tests/`). A suite, a sua composição e o resultado na base estão em `regressao/`
(`README.md` e `baseline.md`).

### 4.5 Valores de base dos controlos

Medidos na mesma série da medição inicial. Os tempos são média ± desvio-padrão.

| ID | Valor na base | Nota |
| --- | --- | --- |
| C1.1 | 10 MiB: 0,36 ± 0,10 s; 500 MiB: 11,2 ± 5,9 s (mediana 9,0 s) | A base já falha o critério do MVP do REQ-VID-SUBMIT-008 (< 3 s) com 500 MiB |
| C1.2 | 1000 MiB: não mensurável (motor do Docker em baixo). 500 MiB: 12,7 ± 6,0 s (mediana 10,2 s) | Na medição final compara-se com 1000 MiB e, como referência, com 500 MiB |
| C1.3 | Resposta 401, mas o `api_gateway` cresce **1006 MiB** antes de recusar | Confirma a falha do diagnóstico (C5) |
| C1.4 | SHA-256 igual com 10, 100 e 500 MiB | |
| C1.5 | MP4 e MOV de exemplo aceites; WebM de 177 s, MP4 de 90 s e o de 100,1 MB recusados por excederem o perfil gratuito; ficheiro corrompido e imagem recusados, cada um com a sua mensagem | As sete decisões e mensagens estão em `rnf1-memoria.json` |
| C1.6 | Nenhum ficheiro novo em `/tmp` depois de um envio completo e de um interrompido | |
| C1.7 | Sete casos do C1.5 e envio interrompido sem objetos a mais; **o envio recusado com 409 deixa o ficheiro guardado sem dono** (2 objetos em `src/`, esperado 1); nenhum envio em partes aberto | Medido depois da série da base, no passo 0 do ADR-01 (`medicoes/passos/passo-0/`), sobre o mesmo código |
| C2.1 | 275,9 ± 13,1 s | |
| C2.2 | **16,9 ± 1,0 s** (máx. 18,1 s) | A base não cumpre o limite de 5 s. O limite mantém-se, por ser o do REQ-VID-STATUS-003 |
| C2.3 | Não aplicável: a base não expõe o estado de uma execução | |
| C2.4 | Resultados iguais, sobrepostos e separados, em P e em Q | |
| C2.5 | A ferramenta é aceite (201) e os resultados da execução em curso não mudam | |

O C2.2 é o único controlo que a base já não cumpre. A medição final tem de o cumprir, mas a
análise deve separar o que vem do refactoring do que já falhava antes.

## 5. Limitações conhecidas desta especificação

- O RNF-F2-01 mede um envio de cada vez. O comportamento com vários envios em simultâneo é
  deduzido do acréscimo por envio e não é medido.
- A M1.1 lê a memória uma vez por segundo. Um pico mais curto pode escapar; a M1.2 existe para
  cobrir esse caso.
- O RNF-F2-02 é medido com um script e não com utilizadores. Mede se o controlo está disponível e
  em quanto tempo, e não a satisfação nem a facilidade de aprendizagem.
- Com um único worker de vídeo, uma segunda execução iniciada durante outra fica à espera. A
  interface passa a poder mostrá-lo, mas o tempo de espera não melhora com estes dois requisitos.
