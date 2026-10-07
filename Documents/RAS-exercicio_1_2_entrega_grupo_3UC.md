# 📝 Exercício 1 e 2 — Casos de Uso e Requisitos Derivados
### Fase 1: Suporte a Vídeo no PictuRAS

---

## 0. Identificação

| **Campo** | **Valor** |
|-----------|-----------|
| **Grupo / Equipa** | [PREENCHER: nº do grupo] |
| **Autores** | [PREENCHER: nome (nº mecanográfico) — UC-VID-001; nome (nº) — UC-VID-002; nome (nº) — UC-VID-003] |
| **Data** | 2026-10-07 |
| **Versão do documento** | v1.0 |
| **Unidade Curricular** | Requisitos e Arquiteturas de Software — MEI, Universidade do Minho |

---

## 1. Funcionalidade de vídeo escolhida

### UC-VID-001 — Recortar um vídeo e exportar o resultado

| **Campo** | **Valor** |
|-----------|-----------|
| **Funcionalidade** | Recorte temporal de vídeo (*trim*) na aba "Ferramentas de vídeo", com exportação do resultado |
| **Perfil(s) de utilizador abrangido(s)** | Registado e premium, com limites e quota diferentes. O anónimo fica fora do MVP de vídeo por o processamento ser pesado. |

**Justificação no contexto do MVP**

É a edição de vídeo mais básica e a primeira que usa a aba de ferramentas. Valida de uma só vez parâmetros do utilizador, processamento demorado com estados, impacto na quota e exportação. Sem ela, fica por validar como o vídeo se articula com perfis e quotas.

### UC-VID-002 — Importar um vídeo para a biblioteca

| **Campo** | **Valor** |
|-----------|-----------|
| **Funcionalidade** | Importar vídeo, com a ação "Importar vídeo" ao lado de "Adicionar imagens" |
| **Perfil(s) de utilizador abrangido(s)** | Registado e premium, com limites de duração, tamanho e armazenamento diferentes. O anónimo fica fora porque os ficheiros precisam de uma conta. |

**Justificação no contexto do MVP**

Sem importação não há vídeo no sistema: todas as outras funcionalidades de vídeo dependem dela. Valida o envio de ficheiros grandes, a validação de formato e limites por perfil e o armazenamento.

### UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas

| **Campo** | **Valor** |
|-----------|-----------|
| **Funcionalidade** | Aplicar uma cadeia de 1 a 3 ferramentas de imagem existentes (redimensionar, binarizar, rodar) a todos os fotogramas de um vídeo |
| **Perfil(s) de utilizador abrangido(s)** | Registado e premium, com limites de duração e resolução diferentes. O anónimo fica fora do MVP de vídeo. |

**Justificação no contexto do MVP**

Reaproveita as ferramentas de imagem e o encadeamento que o PictuRAS já tem e responde à pergunta central do enunciado: o que significa uma ferramenta aplicada a um vídeo. Sem ela, fica por validar se as ferramentas atuais funcionam sobre vídeo.

---

## 2. Caso de Uso

### Decisões comuns aos 3 casos de uso

| **Tema** | **Decisão** |
|----------|-------------|
| Formatos e limites | MP4 (H.264) e MOV. Vídeos até 5 min e 200 MB (registado) ou 30 min e 2 GB (premium) |
| Perfis e quota | Anónimo sem acesso a vídeo. Registado: 5 operações/dia, partilhadas com imagens. Premium: sem limite |
| Contagem | 1 pedido de ferramenta = 1 operação, só se terminar "Concluído". Importar não conta |
| Pedidos | Máximo de pedidos de vídeo ativos: 1 (registado) e 3 (premium), em conjunto. Estados: Em fila, Em processamento, Concluído, Falhado, Cancelado |
| Tempos | Confirmação do pedido em ≤ 2 s; progresso atualizado a cada ≤ 5 s |
| Resultado | Novo vídeo na biblioteca; o original nunca é alterado. UC-VID-002 é pré-condição dos outros dois |

### UC-VID-001 — Recortar um vídeo e exportar o resultado

#### 2.1 Cabeçalho

| **Secção** | **Detalhes** |
|------------|--------------|
| **ID do Caso de Uso** | UC-VID-001 |
| **Nome** | Recortar um vídeo e exportar o resultado |
| **Versão** | v1.0 |
| **Autor** | Miguel Páscoa |
| **Data** | 2026-10-07 |
| **Objetivo** | Obter um novo vídeo só com o intervalo escolhido de um vídeo da biblioteca, acompanhar o processamento e exportá-lo |
| **Âmbito** | Módulo de vídeo do PictuRAS: aba "Ferramentas de vídeo", fila de processamento, biblioteca e exportação |
| **Ator Principal** | Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado) |
| **Stakeholders e Interesses** | - **Utilizador**: quer o trecho certo sem esperar ao ecrã e sem perder o original<br>- **Proprietário do Sistema**: quer controlar o custo de processamento por perfil<br>- **Equipa de Operações**: não quer ficheiros parciais em armazenamento |
| **Pré-condições** | - Sessão iniciada com perfil registado ou premium<br>- O vídeo está na biblioteca (UC-VID-002) e o utilizador é o proprietário |
| **Trigger** | O utilizador seleciona um vídeo da biblioteca e abre a aba "Ferramentas de vídeo" |

#### 2.2 Fluxo Principal

| **Passo** | **Ação do Ator** | **Resposta do Sistema** |
|-----------|------------------|-------------------------|
| 1 | Seleciona um vídeo da biblioteca e abre a aba "Ferramentas de vídeo" | Apresenta as ferramentas e, no registado, as operações restantes no dia |
| 2 | Escolhe **Recortar** | Apresenta os controlos de início e fim e a duração total |
| 3 | Define o início e o fim | Valida o intervalo e apresenta a duração do resultado |
| 4 | Clica em **Aplicar recorte** | Verifica formato, limites, quota e pedidos ativos; cria o pedido "Em fila" e confirma a receção |
| 5 | Acompanha o progresso (pode sair da página) | Passa a "Em processamento" e apresenta estado e percentagem de progresso |
| 6 | — | Guarda o resultado como novo vídeo, marca "Concluído" e desconta 1 operação (registado) |
| 7 | Escolhe **Exportar** e confirma o descarregamento | Entrega o ficheiro; o original mantém-se inalterado |

#### 2.3 Fluxos Alternativos

| **Fluxo** | **Descrição** |
|-----------|---------------|
| FA1 – Utilizador premium | No passo 4, se o perfil é premium → aplicam-se os limites de premium e até 3 pedidos ativos, não se verifica a quota e o fluxo continua no passo 5 |
| FA2 – Cancelar | Nos passos 5 ou 6, o utilizador escolhe **Cancelar** → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e não cria vídeo |

#### 2.4 Exceções

| **Condição** | **Comportamento do Sistema** |
|--------------|------------------------------|
| E1 – Formato ou codec não suportado | **Recortar** fica indisponível com *"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"* |
| E2 – Duração ou tamanho excedem o limite do perfil | No passo 4, rejeita o pedido e apresenta o limite; no registado, sugere o premium |
| E3 – Quota diária esgotada (registado) | No passo 4, rejeita o pedido com *"Atingiu o limite de 5 operações diárias"* e sugere o premium |
| E4 – Intervalo inválido (início ≥ fim, fim acima da duração ou < 1 s) | Apresenta o motivo e mantém **Aplicar recorte** desativado |
| E5 – O processamento falha a meio | Marca "Falhado", apresenta *"Não foi possível recortar o vídeo. Tente novamente."*, remove parciais, não cria vídeo e não desconta quota |
| E6 – Número máximo de pedidos ativos | No passo 4, rejeita o pedido e indica que tem de aguardar ou cancelar um pedido ativo |

#### 2.5 Pós-condições

| **Tipo** | **Resultado** |
|----------|---------------|
| Garantia de Sucesso | Existe na biblioteca um novo vídeo só com o intervalo escolhido; o original está inalterado; o pedido está "Concluído"; no registado, a quota desceu 1 operação |
| Garantia Mínima | O original está inalterado; não existe vídeo parcial nem ficheiros temporários; a quota não mudou; o estado e o motivo são apresentados |

#### 2.6 Regras de Negócio e Restrições

| **ID** | **Regra** |
|--------|-----------|
| RN1 | Formatos aceites: MP4 (H.264) e MOV; o resultado mantém o formato e o codec do original |
| RN2 | Início < fim, fim ≤ duração do vídeo, intervalo mínimo de 1 s, com resolução de 1 s |
| RN3 | Limites: registado, vídeos até 5 min e 200 MB; premium, até 30 min e 2 GB |
| RN4 | Registado: 5 operações/dia; premium: sem limite; anónimo: sem acesso. Um recorte conta 1 operação, só se "Concluído" |
| RN5 | Pedidos ativos em simultâneo: 1 (registado) e 3 (premium), contando todas as ferramentas de vídeo |
| RN6 | Receção do pedido confirmada em ≤ 2 s; progresso atualizado pelo menos a cada 5 s |
| RN7 | O resultado é guardado como novo vídeo "{nome}_recorte"; o original nunca é alterado |

#### 2.7 Assunções

| **ID** | **Assunção** |
|--------|--------------|
| A1 | A importação do vídeo está especificada em UC-VID-002 |
| A2 | A quota de 5 operações/dia já existe e é partilhada entre imagens e vídeo |
| A3 | O estado do pedido é consultado dentro da aplicação, sem notificações por e-mail |
| A4 | Os limites de duração, tamanho e pedidos são valores iniciais de MVP, ajustáveis |

#### 2.8 Questões em Aberto

| **ID** | **Questão** |
|--------|-------------|
| Q1 | O perfil anónimo deve poder usar alguma ferramenta de vídeo? |
| Q2 | O recorte deve poder entrar no encadeamento de ferramentas e no lote? |
| Q3 | O utilizador deve poder escolher o formato de saída na exportação? |

### UC-VID-002 — Importar um vídeo para a biblioteca

#### 2.1 Cabeçalho

| **Secção** | **Detalhes** |
|------------|--------------|
| **ID do Caso de Uso** | UC-VID-002 |
| **Nome** | Importar um vídeo para a biblioteca |
| **Versão** | v1.0 |
| **Autor** | David Cruz |
| **Data** | 2026-10-07 |
| **Objetivo** | Enviar um vídeo do dispositivo para o PictuRAS, acompanhar o envio e a validação e ficar com o vídeo disponível na biblioteca |
| **Âmbito** | Módulo de vídeo do PictuRAS: biblioteca, envio de ficheiros, validação e armazenamento |
| **Ator Principal** | Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado) |
| **Stakeholders e Interesses** | - **Utilizador**: quer carregar o vídeo sem o perder a meio e saber depressa se serve<br>- **Proprietário do Sistema**: quer controlar o custo de armazenamento por perfil<br>- **Equipa de Desenvolvimento**: este caso de uso é pré-condição de todos os outros de vídeo |
| **Pré-condições** | - Sessão iniciada com perfil registado ou premium<br>- A biblioteca mostra as ações "Adicionar imagens" e "Importar vídeo" |
| **Trigger** | O utilizador clica em **Importar vídeo**, ao lado de **Adicionar imagens** |

#### 2.2 Fluxo Principal

| **Passo** | **Ação do Ator** | **Resposta do Sistema** |
|-----------|------------------|-------------------------|
| 1 | Abre a biblioteca | Apresenta **Adicionar imagens** e **Importar vídeo** lado a lado |
| 2 | Clica em **Importar vídeo** e seleciona um ficheiro do dispositivo | Abre o seletor de ficheiros e valida a extensão e o tamanho do ficheiro escolhido |
| 3 | Clica em **Importar** | Verifica o espaço livre e as importações ativas, cria o pedido "A carregar" e inicia o envio |
| 4 | Acompanha o envio (pode navegar para outras páginas) | Apresenta a percentagem de progresso |
| 5 | — | Passa a "A validar": verifica o formato e o codec reais, a legibilidade e a duração |
| 6 | — | Guarda o vídeo, marca "Disponível" e apresenta-o na biblioteca com nome, duração e tamanho |

#### 2.3 Fluxos Alternativos

| **Fluxo** | **Descrição** |
|-----------|---------------|
| FA1 – Utilizador premium | No passo 2, se o perfil é premium → aplicam-se os limites de premium (30 min, 2 GB, 10 GB de armazenamento e 3 importações ativas) |
| FA2 – Cancelar | Nos passos 4 ou 5, o utilizador escolhe **Cancelar** → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e não cria vídeo |
| FA3 – Retomar | O pedido está "Interrompido" há menos de 1 h → o utilizador escolhe **Retomar** e seleciona o mesmo ficheiro → o sistema continua a partir do ponto já recebido |

#### 2.4 Exceções

| **Condição** | **Comportamento do Sistema** |
|--------------|------------------------------|
| E1 – O ficheiro não é MP4 (H.264) nem MOV | Rejeita (extensão no passo 2, conteúdo no passo 5), apresenta *"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"* e remove o que recebeu |
| E2 – Tamanho ou duração excedem o limite do perfil | No passo 2 (tamanho) não inicia o envio; no passo 5 (duração) rejeita e remove o ficheiro; apresenta o limite e, no registado, sugere o premium |
| E3 – O ficheiro está corrompido ou ilegível | No passo 5, apresenta *"Não foi possível ler este vídeo"*, marca "Falhado" e remove o ficheiro |
| E4 – O tamanho excede o espaço livre da biblioteca de vídeo | No passo 3, não cria o pedido e apresenta o espaço livre |
| E5 – A ligação falha a meio do envio | Marca "Interrompido" e mantém o parcial durante 1 h; sem retoma nesse prazo, remove o parcial e marca "Falhado" |
| E6 – Número máximo de importações ativas | No passo 3, rejeita o pedido e indica que tem de aguardar ou cancelar uma importação ativa |

#### 2.5 Pós-condições

| **Tipo** | **Resultado** |
|----------|---------------|
| Garantia de Sucesso | O vídeo está na biblioteca como "Disponível", com o ficheiro idêntico ao enviado; a ocupação da biblioteca foi atualizada; a quota diária não mudou |
| Garantia Mínima | Não foi criado vídeo; a ocupação e a quota não mudaram; não restam parciais (exceto os de uma importação "Interrompida", até 1 h); o estado e o motivo são apresentados |

#### 2.6 Regras de Negócio e Restrições

| **ID** | **Regra** |
|--------|-----------|
| RN1 | Formatos aceites: MP4 (H.264) e MOV, validados pelo conteúdo do ficheiro |
| RN2 | Limites: registado, vídeos até 5 min e 200 MB; premium, até 30 min e 2 GB |
| RN3 | O perfil anónimo não tem acesso a funcionalidades de vídeo |
| RN4 | Armazenamento da biblioteca de vídeo: 1 GB (registado) e 10 GB (premium), incluindo vídeos resultantes de ferramentas |
| RN5 | Importações ativas em simultâneo: 1 (registado) e 3 (premium) |
| RN6 | O envio inicia em ≤ 2 s após a confirmação; o progresso é atualizado pelo menos a cada 5 s |
| RN7 | A importação não conta na quota diária de operações |
| RN8 | O ficheiro parcial de uma importação interrompida é mantido 1 h e depois removido |

#### 2.7 Assunções

| **ID** | **Assunção** |
|--------|--------------|
| A1 | A biblioteca mostra imagens e vídeos no mesmo ecrã, em secções separadas |
| A2 | Importa-se um ficheiro de cada vez |
| A3 | Não há verificação de vírus no MVP |
| A4 | Na retoma, o ficheiro é reconhecido pelo nome, tamanho e resumo criptográfico |

#### 2.8 Questões em Aberto

| **ID** | **Questão** |
|--------|-------------|
| Q1 | Deve ser possível importar vários vídeos de uma vez ou um .zip, como nas imagens? |
| Q2 | A miniatura do vídeo deve ser gerada automaticamente após a importação? |
| Q3 | O perfil anónimo deve poder importar vídeos pequenos? |

### UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas

#### 2.1 Cabeçalho

| **Secção** | **Detalhes** |
|------------|--------------|
| **ID do Caso de Uso** | UC-VID-003 |
| **Nome** | Aplicar ferramentas de imagem a todos os fotogramas de um vídeo |
| **Versão** | v1.0 |
| **Autor** | Guilherme Bento & João Sousa |
| **Data** | 2026-10-07 |
| **Objetivo** | Aplicar uma cadeia de 1 a 3 ferramentas de imagem a todos os fotogramas de um vídeo da biblioteca, obtendo um novo vídeo |
| **Âmbito** | Módulo de vídeo do PictuRAS: aba "Ferramentas de vídeo", ferramentas de imagem, encadeamento, fila de processamento e biblioteca |
| **Ator Principal** | Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado) |
| **Stakeholders e Interesses** | - **Utilizador**: quer transformar o vídeo inteiro com ferramentas que já conhece<br>- **Proprietário do Sistema**: quer limitar o custo (duração, resolução, pedidos simultâneos)<br>- **Equipa de Desenvolvimento**: valida a reutilização das ferramentas de imagem sobre vídeo |
| **Pré-condições** | - Sessão iniciada com perfil registado ou premium<br>- O vídeo está na biblioteca (UC-VID-002) e o utilizador é o proprietário |
| **Trigger** | O utilizador abre a aba "Ferramentas de vídeo" e escolhe **Aplicar ferramentas a todos os fotogramas** |

#### 2.2 Fluxo Principal

| **Passo** | **Ação do Ator** | **Resposta do Sistema** |
|-----------|------------------|-------------------------|
| 1 | Seleciona um vídeo, abre a aba "Ferramentas de vídeo" e escolhe **Aplicar ferramentas a todos os fotogramas** | Apresenta Redimensionar, Binarizar e Rodar e a cadeia vazia |
| 2 | Adiciona de 1 a 3 ferramentas à cadeia e define os parâmetros | Valida os parâmetros e a resolução final e apresenta a cadeia ordenada |
| 3 | Clica em **Aplicar a todos os fotogramas** | Verifica formato, limites, quota e pedidos ativos; cria o pedido "Em fila" e confirma a receção |
| 4 | Acompanha o progresso (pode sair da página) | Processa o vídeo aplicando a cadeia, por ordem, a todos os fotogramas; apresenta estado, percentagem e fotogramas processados |
| 5 | — | Guarda o resultado como novo vídeo, marca "Concluído" e desconta 1 operação (registado) |
| 6 | Abre o vídeo resultante e reproduz-o | Reproduz o vídeo resultante |

#### 2.3 Fluxos Alternativos

| **Fluxo** | **Descrição** |
|-----------|---------------|
| FA1 – Utilizador premium | No passo 3, se o perfil é premium → aplicam-se os limites de premium (10 min, resolução 3840 × 2160 e 3 pedidos ativos) e não se verifica a quota |
| FA2 – Cancelar | No passo 4, o utilizador escolhe **Cancelar** → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e não cria vídeo |

#### 2.4 Exceções

| **Condição** | **Comportamento do Sistema** |
|--------------|------------------------------|
| E1 – Formato ou codec não suportado | A ferramenta fica indisponível com *"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"* |
| E2 – Duração ou tamanho excedem o limite desta ferramenta | No passo 3, rejeita o pedido e apresenta o limite; no registado, sugere o premium |
| E3 – Quota diária esgotada (registado) | No passo 3, rejeita o pedido com *"Atingiu o limite de 5 operações diárias"* |
| E4 – Parâmetro fora do intervalo permitido | No passo 2, apresenta o intervalo permitido e mantém **Aplicar** desativado |
| E5 – A resolução final excede o limite do perfil | No passo 2, apresenta o limite aplicável e mantém **Aplicar** desativado |
| E6 – O processamento falha a meio (por exemplo, um fotograma ilegível) | Marca "Falhado", apresenta *"Não foi possível aplicar as ferramentas ao vídeo. Tente novamente."*, remove parciais, não cria vídeo e não desconta quota |
| E7 – Número máximo de pedidos ativos | No passo 3, rejeita o pedido e indica que tem de aguardar ou cancelar um pedido ativo |

#### 2.5 Pós-condições

| **Tipo** | **Resultado** |
|----------|---------------|
| Garantia de Sucesso | Existe um novo vídeo com a cadeia aplicada a todos os fotogramas, com o mesmo número e taxa de fotogramas e o mesmo áudio; o original está inalterado; no registado, a quota desceu 1 operação |
| Garantia Mínima | O original está inalterado; não existe vídeo parcial nem ficheiros temporários; a quota não mudou; o estado e o motivo são apresentados |

#### 2.6 Regras de Negócio e Restrições

| **ID** | **Regra** |
|--------|-----------|
| RN1 | Formatos aceites: MP4 (H.264) e MOV; o resultado mantém o formato e o codec do original |
| RN2 | Ferramentas aplicáveis: Redimensionar, Binarizar e Rodar (as avançadas, como OCR, não); cadeia de 1 a 3 ferramentas, aplicadas por ordem |
| RN3 | Parâmetros: largura e altura de 16 a 3840 px; limiar de 0 a 255; rotação de 90°, 180° ou 270° |
| RN4 | Resolução final até 1920 × 1080 px (registado) ou 3840 × 2160 px (premium) |
| RN5 | Limites desta ferramenta: registado, vídeos até 2 min e 200 MB; premium, até 10 min e 2 GB |
| RN6 | O resultado tem o mesmo número e taxa de fotogramas do original; o áudio é mantido inalterado |
| RN7 | Registado: 5 operações/dia; premium: sem limite; anónimo: sem acesso. Um pedido conta 1 operação, qualquer que seja o número de ferramentas, só se "Concluído" |
| RN8 | Pedidos ativos em simultâneo: 1 (registado) e 3 (premium), contando todas as ferramentas de vídeo |
| RN9 | Receção do pedido confirmada em ≤ 2 s; progresso atualizado pelo menos a cada 5 s |
| RN10 | O resultado é guardado como novo vídeo "{nome}_editado"; o original nunca é alterado |

#### 2.7 Assunções

| **ID** | **Assunção** |
|--------|--------------|
| A1 | A importação está em UC-VID-002 e a exportação do resultado segue UC-VID-001 |
| A2 | As ferramentas de imagem existentes podem ser aplicadas fotograma a fotograma com os mesmos parâmetros |
| A3 | O áudio não é processado, apenas copiado |
| A4 | Um vídeo de 2 min a 1920 × 1080 px e 30 fotogramas/s é processado em ≤ 10 min |
| A5 | O vídeo tem resolução constante em todos os fotogramas |

#### 2.8 Questões em Aberto

| **ID** | **Questão** |
|--------|-------------|
| Q1 | Um pedido deve contar 1 operação, 1 por ferramenta da cadeia ou em função dos fotogramas? |
| Q2 | As ferramentas avançadas (por exemplo, contagem de pessoas) devem poder ser aplicadas a vídeo? |
| Q3 | Deve ser possível aplicar a mesma cadeia a vários vídeos, como se faz com imagens? |


---

## 3. Utilização de agentes de IA

| **Ferramenta / *skill*** | **Tarefa apoiada** | **Validação realizada pela equipa** |
|--------------------------|--------------------|--------------------------------------|
| Claude (Anthropic) | Primeira versão dos 3 casos de uso e das tabelas da secção 4, a partir do template, do enunciado, dos exemplos e do guia | [PREENCHER: o que o grupo reviu, alterou ou descartou] |

---

## 4. Esboço de requisitos derivados

### UC-VID-001 — Recortar um vídeo e exportar o resultado

#### 4.1 Requisitos de Sistema

| **ID** | **Requisito** | **Tipo** | **Prioridade** | **Novo/Alt** | **Origem** | **Como verificar** |
|--------|---------------|----------|----------------|--------------|------------|--------------------|
| REQ-VID-TRIM-001 | O sistema deve permitir ao utilizador registado ou premium abrir a aba "Ferramentas de vídeo" e escolher Recortar num vídeo da sua biblioteca. | F | Deve ter | NOVO | Passos 1–2, Pré-condições | Dado um registado com um vídeo, quando abre a aba, então vê a ferramenta Recortar |
| REQ-VID-TRIM-002 | O sistema deve permitir ao utilizador definir o início e o fim do recorte com resolução de 1 s. | F | Deve ter | NOVO | Passo 3, RN2 | Definir início 00:00:10 e fim 00:00:40 e verificar que são aceites |
| REQ-VID-TRIM-003 | O sistema deve impedir o recorte e apresentar o motivo quando o início não for inferior ao fim, o fim exceder a duração do vídeo ou o intervalo for inferior a 1 s. | F | Deve ter | NOVO | Passo 3, E4, RN2 | Num vídeo de 60 s, definir início 50 s e fim 70 s e verificar a mensagem e **Aplicar recorte** desativado |
| REQ-VID-TRIM-004 | O sistema deve impedir o recorte de vídeos que não sejam MP4 (H.264) nem MOV e apresentar *"Formato não suportado"*. | F | Deve ter | NOVO | E1, RN1 | Selecionar um vídeo AVI e verificar que Recortar fica indisponível com a mensagem |
| REQ-VID-TRIM-005 | O sistema deve impedir o recorte de vídeos com duração superior a 5 min (registado) ou 30 min (premium) e apresentar o limite. | F | Deve ter | NOVO | E2, RN3, FA1 | Submeter um vídeo de 6 min como registado e de 31 min como premium e verificar a rejeição |
| REQ-VID-TRIM-006 | O sistema deve impedir o recorte de vídeos com tamanho superior a 200 MB (registado) ou 2 GB (premium) e apresentar o limite. | F | Deve ter | NOVO | E2, RN3, FA1 | Submeter um vídeo de 250 MB como registado e de 2,5 GB como premium e verificar a rejeição |
| REQ-VID-TRIM-007 | O sistema deve rejeitar o pedido de um utilizador registado que já tenha realizado 5 operações no dia e sugerir a subscrição premium. | F | Deve ter | ALT | E3, RN4 | Dado um registado com 5 operações hoje, verificar que o pedido é rejeitado com o limite |
| REQ-VID-TRIM-008 | O sistema deve rejeitar um novo pedido quando o utilizador já tem o número máximo de pedidos ativos (1 registado, 3 premium). | F | Deve ter | NOVO | E6, RN5, FA1 | Dado um registado com um pedido ativo, submeter outro e verificar a rejeição com o motivo |
| REQ-VID-TRIM-009 | O sistema deve criar o pedido com o estado "Em fila" e confirmar a sua receção ao utilizador. | F | Deve ter | NOVO | Passo 4 | Aplicar um recorte válido e verificar a confirmação e o estado "Em fila" |
| REQ-VID-TRIM-010 | O sistema deve confirmar a receção do pedido em ≤ 2 s, independentemente da duração do vídeo. | NF (Desempenho) | Deve ter | NOVO | Passo 4, RN6 | Submeter pedidos para vídeos de 1 min e de 30 min e medir ≤ 2 s em ambos |
| REQ-VID-TRIM-011 | O sistema deve apresentar o estado do pedido como "Em fila", "Em processamento", "Concluído", "Falhado" ou "Cancelado". | F | Deve ter | NOVO | Passo 5 | Seguir um pedido do início ao fim e verificar a sequência de estados |
| REQ-VID-TRIM-012 | O sistema deve atualizar a percentagem de progresso do pedido pelo menos a cada 5 s. | NF (Usabilidade) | Deve ter | NOVO | Passo 5, RN6 | Observar um pedido de 2 min e confirmar que a percentagem muda em intervalos ≤ 5 s |
| REQ-VID-TRIM-013 | O sistema deve permitir ao utilizador cancelar um pedido "Em fila" ou "Em processamento". | F | Deveria ter | NOVO | FA2 | Cancelar um pedido em processamento e verificar o estado "Cancelado" |
| REQ-VID-TRIM-014 | O sistema deve remover os ficheiros parciais e não criar vídeo quando um pedido é cancelado. | F | Deveria ter | NOVO | FA2, Garantia Mínima | Cancelar um pedido e verificar que não há ficheiros temporários nem vídeo novo |
| REQ-VID-TRIM-015 | O sistema deve produzir um vídeo apenas com o intervalo escolhido, no mesmo formato e codec do original, com duração igual a (fim − início) ± 1 s. | F | Deve ter | NOVO | Passo 6, RN1, Garantia de Sucesso | Recortar 00:00:10–00:00:40 e verificar formato, codec e duração de 30 s ± 1 s |
| REQ-VID-TRIM-016 | O sistema deve guardar o resultado na biblioteca como novo vídeo com o nome "{nome original}_recorte". | F | Deve ter | NOVO | Passo 6, RN7 | Recortar "praia.mp4" e verificar que a biblioteca contém "praia_recorte" |
| REQ-VID-TRIM-017 | O sistema deve manter o ficheiro do vídeo original inalterado após o recorte. | NF (Fiabilidade) | Deve ter | NOVO | Passo 7, RN7, Garantia de Sucesso | Comparar o resumo criptográfico do original antes e depois |
| REQ-VID-TRIM-018 | O sistema deve descontar 1 operação da quota diária do utilizador registado apenas quando o pedido termina "Concluído". | F | Deve ter | ALT | Passo 6, RN4, Garantia de Sucesso | Concluir um recorte e verificar 1 operação usada; cancelar outro e verificar que continua 1 |
| REQ-VID-TRIM-019 | O sistema deve marcar o pedido "Falhado" e apresentar *"Não foi possível recortar o vídeo. Tente novamente."* quando o processamento falha. | F | Deve ter | NOVO | E5 | Simular uma falha a meio e verificar o estado e a mensagem |
| REQ-VID-TRIM-020 | O sistema deve remover os ficheiros parciais, não criar vídeo e não descontar quota quando o processamento falha. | F | Deve ter | ALT | E5, RN4, Garantia Mínima | Simular uma falha e verificar que não há vídeo nem parciais e que a quota não mudou |
| REQ-VID-TRIM-021 | O sistema deve permitir ao utilizador exportar (descarregar) o vídeo resultante. | F | Deve ter | ALT | Passo 7 | Exportar o vídeo e verificar que o ficheiro abre num leitor externo com a duração esperada |
| REQ-VID-TRIM-022 | O sistema não deve disponibilizar a aba "Ferramentas de vídeo" ao perfil anónimo e deve sugerir o registo. | F | Deve ter | ALT | RN4 | Aceder como anónimo e verificar que a aba não está disponível |

#### 4.2 Impacto no sistema existente

| **Elemento existente afetado** | **Impacto (Manter / Estender / Alterar)** | **Descrição do impacto** | **Requisitos relacionados** |
|--------------------------------|-------------------------------------------|--------------------------|------------------------------|
| Perfis de utilização | Estender | Passam a ter limites de vídeo (duração, tamanho, pedidos ativos); o anónimo sem acesso | REQ-VID-TRIM-005, 006, 008, 022 |
| Quota diária de operações (5/dia) | Alterar | Passa a contar pedidos de vídeo, só quando terminam com sucesso | REQ-VID-TRIM-007, 018, 020 |
| Processamento de operações | Estender | Passa a suportar operações demoradas com fila, estados, progresso e cancelamento | REQ-VID-TRIM-009, 011, 012, 013 |
| Biblioteca e armazenamento | Estender | Recebe novos vídeos e remove ficheiros parciais | REQ-VID-TRIM-014, 016, 020 |
| Exportação | Estender | Passa a exportar vídeo | REQ-VID-TRIM-021 |
| Encadeamento e lote | Manter | O recorte não entra no encadeamento nem no lote no MVP (ver Q2) | — |

#### 4.3 Matriz de Rastreabilidade

| **Elemento do Caso de Uso** | **Descrição abreviada** | **Requisito(s) de Sistema** |
|------------------------------|-------------------------|------------------------------|
| Pré-condições | Sessão, vídeo na biblioteca | REQ-VID-TRIM-001 |
| Passo 1 | Selecionar vídeo e abrir aba | REQ-VID-TRIM-001 |
| Passo 2 | Escolher Recortar | REQ-VID-TRIM-001 |
| Passo 3 | Definir início e fim | REQ-VID-TRIM-002, 003 |
| Passo 4 | Aplicar e criar pedido | REQ-VID-TRIM-004, 005, 006, 007, 008, 009, 010 |
| Passo 5 | Acompanhar progresso | REQ-VID-TRIM-011, 012 |
| Passo 6 | Guardar resultado e descontar quota | REQ-VID-TRIM-015, 016, 018 |
| Passo 7 | Exportar | REQ-VID-TRIM-017, 021 |
| FA1 | Utilizador premium | REQ-VID-TRIM-005, 006, 008 |
| FA2 | Cancelar | REQ-VID-TRIM-013, 014 |
| E1 | Formato não suportado | REQ-VID-TRIM-004 |
| E2 | Duração ou tamanho excedidos | REQ-VID-TRIM-005, 006 |
| E3 | Quota esgotada | REQ-VID-TRIM-007 |
| E4 | Intervalo inválido | REQ-VID-TRIM-003 |
| E5 | Falha a meio | REQ-VID-TRIM-019, 020 |
| E6 | Pedidos ativos | REQ-VID-TRIM-008 |
| RN1 | Formatos | REQ-VID-TRIM-004, 015 |
| RN2 | Intervalo | REQ-VID-TRIM-002, 003 |
| RN3 | Limites por perfil | REQ-VID-TRIM-005, 006 |
| RN4 | Quota e perfis | REQ-VID-TRIM-007, 018, 020, 022 |
| RN5 | Pedidos ativos | REQ-VID-TRIM-008 |
| RN6 | Tempos | REQ-VID-TRIM-010, 012 |
| RN7 | Resultado e original | REQ-VID-TRIM-016, 017 |
| Pós-condição de sucesso | Novo vídeo, original inalterado, quota | REQ-VID-TRIM-015, 016, 017, 018 |
| Pós-condição mínima | Sem parciais, quota intacta | REQ-VID-TRIM-014, 020 |

### UC-VID-002 — Importar um vídeo para a biblioteca

#### 4.1 Requisitos de Sistema

| **ID** | **Requisito** | **Tipo** | **Prioridade** | **Novo/Alt** | **Origem** | **Como verificar** |
|--------|---------------|----------|----------------|--------------|------------|--------------------|
| REQ-VID-IMPORT-001 | O sistema deve apresentar a ação "Importar vídeo" ao lado de "Adicionar imagens" na biblioteca do utilizador registado ou premium. | F | Deve ter | NOVO | Passo 1, Pré-condições | Abrir a biblioteca como registado e verificar que "Importar vídeo" está junto a "Adicionar imagens" |
| REQ-VID-IMPORT-002 | O sistema deve permitir ao utilizador selecionar um ficheiro de vídeo do seu dispositivo. | F | Deve ter | NOVO | Passo 2 | Clicar em "Importar vídeo" e selecionar um MP4 e verificar que é aceite |
| REQ-VID-IMPORT-003 | O sistema deve rejeitar, antes do envio, ficheiros com extensão diferente de .mp4 e .mov e apresentar *"Formato não suportado"*. | F | Deve ter | NOVO | Passo 2, E1, RN1 | Selecionar um .avi e verificar a mensagem e que o envio não começa |
| REQ-VID-IMPORT-004 | O sistema deve impedir o envio de ficheiros com tamanho superior a 200 MB (registado) ou 2 GB (premium) e apresentar o limite. | F | Deve ter | NOVO | Passo 2, E2, RN2, FA1 | Selecionar um ficheiro de 250 MB como registado e de 2,5 GB como premium e verificar o bloqueio |
| REQ-VID-IMPORT-005 | O sistema deve impedir o início da importação quando o tamanho do ficheiro excede o espaço livre da biblioteca de vídeo (1 GB registado, 10 GB premium). | F | Deve ter | NOVO | Passo 3, E4, RN4, FA1 | Dado um registado com 900 MB ocupados, importar 150 MB e verificar que não começa e é indicado o espaço livre |
| REQ-VID-IMPORT-006 | O sistema deve rejeitar uma nova importação quando o utilizador já tem o número máximo de importações ativas (1 registado, 3 premium). | F | Deve ter | NOVO | Passo 3, E6, RN5, FA1 | Dado um registado com uma importação "A carregar", iniciar outra e verificar a rejeição |
| REQ-VID-IMPORT-007 | O sistema deve criar o pedido de importação com o estado "A carregar" e iniciar o envio do ficheiro. | F | Deve ter | NOVO | Passo 3 | Confirmar uma importação válida e verificar o estado "A carregar" e o envio |
| REQ-VID-IMPORT-008 | O sistema deve iniciar o envio do ficheiro em ≤ 2 s após a confirmação da importação. | NF (Desempenho) | Deve ter | NOVO | Passo 3, RN6 | Confirmar importações de 50 MB e de 1 GB e medir que o envio começa em ≤ 2 s |
| REQ-VID-IMPORT-009 | O sistema deve atualizar a percentagem de progresso do envio pelo menos a cada 5 s. | NF (Usabilidade) | Deve ter | NOVO | Passo 4, RN6 | Observar o envio de 200 MB e confirmar que a percentagem muda em intervalos ≤ 5 s |
| REQ-VID-IMPORT-010 | O sistema deve verificar o formato e o codec reais do ficheiro recebido e rejeitar os que não sejam MP4 (H.264) nem MOV. | F | Deve ter | NOVO | Passo 5, E1, RN1 | Enviar um AVI renomeado para .mp4 e verificar que é rejeitado |
| REQ-VID-IMPORT-011 | O sistema deve rejeitar ficheiros corrompidos ou ilegíveis com *"Não foi possível ler este vídeo"* e marcar o pedido "Falhado". | F | Deve ter | NOVO | Passo 5, E3 | Enviar um MP4 truncado e verificar a mensagem, o estado e a ausência de vídeo |
| REQ-VID-IMPORT-012 | O sistema deve rejeitar vídeos com duração superior a 5 min (registado) ou 30 min (premium), removendo o ficheiro recebido. | F | Deve ter | NOVO | Passo 5, E2, RN2, FA1 | Importar um vídeo de 6 min como registado e de 31 min como premium e verificar a rejeição |
| REQ-VID-IMPORT-013 | O sistema deve guardar o vídeo validado na biblioteca com o estado "Disponível". | F | Deve ter | NOVO | Passo 6, Garantia de Sucesso | Concluir uma importação e verificar o vídeo na biblioteca e o estado |
| REQ-VID-IMPORT-014 | O sistema deve guardar o ficheiro do vídeo sem o alterar, com resumo criptográfico igual ao do ficheiro enviado. | NF (Fiabilidade) | Deve ter | NOVO | Garantia de Sucesso | Comparar o resumo criptográfico do ficheiro no dispositivo e no armazenamento |
| REQ-VID-IMPORT-015 | O sistema deve apresentar o vídeo importado na lista da biblioteca com nome, duração e tamanho. | F | Deve ter | NOVO | Passo 6 | Abrir a biblioteca e verificar a linha com nome, duração e tamanho |
| REQ-VID-IMPORT-016 | O sistema deve permitir ao utilizador cancelar uma importação "A carregar", "Interrompido" ou "A validar". | F | Deveria ter | NOVO | FA2 | Cancelar uma importação a 50% e verificar que o envio pára |
| REQ-VID-IMPORT-017 | O sistema deve remover os ficheiros parciais e não criar vídeo quando uma importação é cancelada. | F | Deveria ter | NOVO | FA2, Garantia Mínima | Cancelar uma importação e verificar que não há parciais nem vídeo novo |
| REQ-VID-IMPORT-018 | O sistema deve marcar o pedido "Interrompido" quando a ligação falha durante o envio. | F | Deve ter | NOVO | E5 | Desligar a rede durante o envio e verificar o estado "Interrompido" |
| REQ-VID-IMPORT-019 | O sistema deve manter o ficheiro parcial de uma importação "Interrompida" durante 1 h e, passado esse prazo sem retoma, removê-lo e marcar o pedido "Falhado". | F | Deveria ter | NOVO | E5, RN8, Garantia Mínima | Interromper uma importação, verificar o parcial aos 59 min e a remoção e o estado "Falhado" após 1 h |
| REQ-VID-IMPORT-020 | O sistema deve permitir retomar uma importação "Interrompida", sem reenviar o que já foi recebido, quando o utilizador volta a selecionar o mesmo ficheiro. | F | Deveria ter | NOVO | FA3, A4 | Interromper a 60%, retomar e verificar que só os 40% restantes são enviados |
| REQ-VID-IMPORT-021 | O sistema não deve descontar quota diária de operações à importação de vídeo. | F | Deve ter | ALT | RN7, Garantia de Sucesso | Dado um registado com 0 operações usadas, importar um vídeo e verificar que continua com 0 |
| REQ-VID-IMPORT-022 | O sistema não deve disponibilizar a ação "Importar vídeo" ao perfil anónimo e deve sugerir o registo. | F | Deve ter | ALT | Pré-condições, RN3 | Aceder como anónimo e verificar que a ação está indisponível |

#### 4.2 Impacto no sistema existente

| **Elemento existente afetado** | **Impacto (Manter / Estender / Alterar)** | **Descrição do impacto** | **Requisitos relacionados** |
|--------------------------------|-------------------------------------------|--------------------------|------------------------------|
| Biblioteca do utilizador | Estender | Passa a ter "Importar vídeo" ao lado de "Adicionar imagens" e a listar vídeos | REQ-VID-IMPORT-001, 013, 015 |
| Envio de ficheiros (adicionar imagens) | Estender | Passa a suportar ficheiros grandes com progresso, cancelamento e retoma | REQ-VID-IMPORT-002, 007, 009, 016, 018, 020 |
| Perfis de utilização | Estender | Passam a ter limites de vídeo (tamanho, duração, armazenamento, importações) e o anónimo sem acesso | REQ-VID-IMPORT-004, 005, 006, 012, 022 |
| Armazenamento | Estender | Guarda vídeos grandes com limite por perfil e gere parciais com retenção de 1 h | REQ-VID-IMPORT-005, 017, 019 |
| Quota diária de operações | Manter | A importação não consome quota | REQ-VID-IMPORT-021 |
| Processamento em lote de imagens | Manter | Importar vários vídeos ou um .zip não entra no MVP (ver Q1) | — |

#### 4.3 Matriz de Rastreabilidade

| **Elemento do Caso de Uso** | **Descrição abreviada** | **Requisito(s) de Sistema** |
|------------------------------|-------------------------|------------------------------|
| Pré-condições | Sessão, biblioteca com "Importar vídeo" | REQ-VID-IMPORT-001, 022 |
| Passo 1 | Abrir a biblioteca | REQ-VID-IMPORT-001 |
| Passo 2 | Selecionar ficheiro e validar extensão e tamanho | REQ-VID-IMPORT-002, 003, 004 |
| Passo 3 | Confirmar e criar pedido | REQ-VID-IMPORT-005, 006, 007, 008 |
| Passo 4 | Acompanhar envio | REQ-VID-IMPORT-009 |
| Passo 5 | Validar formato, legibilidade e duração | REQ-VID-IMPORT-010, 011, 012 |
| Passo 6 | Guardar vídeo e apresentá-lo | REQ-VID-IMPORT-013, 015 |
| FA1 | Utilizador premium | REQ-VID-IMPORT-004, 005, 006, 012 |
| FA2 | Cancelar | REQ-VID-IMPORT-016, 017 |
| FA3 | Retomar | REQ-VID-IMPORT-020 |
| E1 | Formato não suportado | REQ-VID-IMPORT-003, 010 |
| E2 | Tamanho ou duração excedidos | REQ-VID-IMPORT-004, 012 |
| E3 | Ficheiro corrompido | REQ-VID-IMPORT-011 |
| E4 | Sem espaço livre | REQ-VID-IMPORT-005 |
| E5 | Ligação falha | REQ-VID-IMPORT-018, 019 |
| E6 | Importações ativas | REQ-VID-IMPORT-006 |
| RN1 | Formatos | REQ-VID-IMPORT-003, 010 |
| RN2 | Limites por perfil | REQ-VID-IMPORT-004, 012 |
| RN3 | Anónimo sem acesso | REQ-VID-IMPORT-022 |
| RN4 | Armazenamento por perfil | REQ-VID-IMPORT-005 |
| RN5 | Importações ativas | REQ-VID-IMPORT-006 |
| RN6 | Tempos | REQ-VID-IMPORT-008, 009 |
| RN7 | Não conta na quota | REQ-VID-IMPORT-021 |
| RN8 | Parcial retido 1 h | REQ-VID-IMPORT-019 |
| Pós-condição de sucesso | Vídeo "Disponível", ficheiro idêntico | REQ-VID-IMPORT-013, 014 |
| Pós-condição mínima | Sem vídeo nem parciais | REQ-VID-IMPORT-017, 019 |

### UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas

#### 4.1 Requisitos de Sistema

| **ID** | **Requisito** | **Tipo** | **Prioridade** | **Novo/Alt** | **Origem** | **Como verificar** |
|--------|---------------|----------|----------------|--------------|------------|--------------------|
| REQ-VID-APPLY-001 | O sistema deve permitir ao utilizador registado ou premium abrir a aba "Ferramentas de vídeo" e escolher "Aplicar ferramentas a todos os fotogramas" num vídeo da sua biblioteca. | F | Deve ter | NOVO | Passo 1, Pré-condições | Dado um registado com um vídeo, abrir a aba e verificar que a ferramenta está listada |
| REQ-VID-APPLY-002 | O sistema deve apresentar Redimensionar, Binarizar e Rodar como únicas ferramentas aplicáveis a todos os fotogramas. | F | Deve ter | NOVO | Passo 1, RN2 | Escolher a ferramenta e verificar que só essas três estão disponíveis e que OCR não está |
| REQ-VID-APPLY-003 | O sistema deve permitir ao utilizador adicionar de 1 a 3 ferramentas à cadeia e definir os seus parâmetros. | F | Deve ter | ALT | Passo 2, RN2 | Adicionar 3 ferramentas e verificar que são aceites e que uma 4.ª é recusada |
| REQ-VID-APPLY-004 | O sistema deve apresentar o intervalo permitido e manter a aplicação desativada quando um parâmetro está fora do intervalo (16 a 3840 px, limiar de 0 a 255, rotação de 90°, 180° ou 270°). | F | Deve ter | NOVO | Passo 2, E4, RN3 | Introduzir limiar 300 e verificar a mensagem "0 a 255" e **Aplicar** desativado |
| REQ-VID-APPLY-005 | O sistema deve impedir a aplicação quando a resolução final excede 1920 × 1080 px (registado) ou 3840 × 2160 px (premium) e apresentar o limite. | F | Deve ter | NOVO | Passo 2, E5, RN4, FA1 | Como registado, redimensionar para 2560×1440 e verificar a recusa com o limite 1920×1080 |
| REQ-VID-APPLY-006 | O sistema deve impedir a aplicação a vídeos que não sejam MP4 (H.264) nem MOV e apresentar *"Formato não suportado"*. | F | Deve ter | NOVO | E1, RN1 | Selecionar um vídeo AVI e verificar que a ferramenta fica indisponível |
| REQ-VID-APPLY-007 | O sistema deve impedir a aplicação a vídeos com duração superior a 2 min (registado) ou 10 min (premium) e apresentar o limite. | F | Deve ter | NOVO | E2, RN5, FA1 | Submeter um vídeo de 3 min como registado e de 11 min como premium e verificar a rejeição |
| REQ-VID-APPLY-008 | O sistema deve impedir a aplicação a vídeos com tamanho superior a 200 MB (registado) ou 2 GB (premium) e apresentar o limite. | F | Deve ter | NOVO | E2, RN5, FA1 | Submeter um vídeo de 250 MB como registado e de 2,5 GB como premium e verificar a rejeição |
| REQ-VID-APPLY-009 | O sistema deve rejeitar o pedido de um utilizador registado que já tenha realizado 5 operações no dia e sugerir a subscrição premium. | F | Deve ter | ALT | Passo 3, E3, RN7 | Dado um registado com 5 operações hoje, verificar que o pedido é rejeitado com o limite |
| REQ-VID-APPLY-010 | O sistema deve rejeitar um novo pedido quando o utilizador já tem o número máximo de pedidos ativos (1 registado, 3 premium). | F | Deve ter | NOVO | Passo 3, E7, RN8, FA1 | Dado um registado com um pedido ativo, submeter outro e verificar a rejeição com o motivo |
| REQ-VID-APPLY-011 | O sistema deve criar o pedido com o estado "Em fila" e confirmar a sua receção ao utilizador. | F | Deve ter | NOVO | Passo 3 | Aplicar uma cadeia válida e verificar a confirmação e o estado "Em fila" |
| REQ-VID-APPLY-012 | O sistema deve confirmar a receção do pedido em ≤ 2 s, independentemente da duração do vídeo. | NF (Desempenho) | Deve ter | NOVO | Passo 3, RN9 | Submeter pedidos para vídeos de 30 s e de 10 min e medir ≤ 2 s em ambos |
| REQ-VID-APPLY-013 | O sistema deve aplicar as ferramentas da cadeia, pela ordem definida, a todos os fotogramas do vídeo. | F | Deve ter | ALT | Passo 4, RN2, Garantia de Sucesso | Aplicar Binarizar e depois Rodar 90° e comparar fotogramas com o resultado esperado |
| REQ-VID-APPLY-014 | O sistema deve produzir um vídeo no mesmo formato e codec do original, com o mesmo número e a mesma taxa de fotogramas. | F | Deve ter | NOVO | Passo 4, RN1, RN6 | Comparar formato, codec, nº e taxa de fotogramas do original e do resultado |
| REQ-VID-APPLY-015 | O sistema deve manter a faixa de áudio do original inalterada no vídeo resultante. | F | Deve ter | NOVO | Passo 4, RN6, A3 | Comparar o resumo criptográfico da faixa de áudio do original e do resultado |
| REQ-VID-APPLY-016 | O sistema deve apresentar o estado do pedido como "Em fila", "Em processamento", "Concluído", "Falhado" ou "Cancelado". | F | Deve ter | NOVO | Passo 4 | Seguir um pedido do início ao fim e verificar a sequência de estados |
| REQ-VID-APPLY-017 | O sistema deve atualizar a percentagem de progresso e o número de fotogramas processados pelo menos a cada 5 s. | NF (Usabilidade) | Deve ter | NOVO | Passo 4, RN9 | Observar um pedido de 2 min e confirmar que ambos os valores mudam em intervalos ≤ 5 s |
| REQ-VID-APPLY-018 | O sistema deve permitir ao utilizador cancelar um pedido "Em fila" ou "Em processamento". | F | Deveria ter | NOVO | FA2 | Cancelar um pedido em processamento e verificar o estado "Cancelado" |
| REQ-VID-APPLY-019 | O sistema deve remover os ficheiros parciais e não criar vídeo quando um pedido é cancelado. | F | Deveria ter | NOVO | FA2, Garantia Mínima | Cancelar um pedido e verificar que não há ficheiros temporários nem vídeo novo |
| REQ-VID-APPLY-020 | O sistema deve guardar o resultado na biblioteca como novo vídeo com o nome "{nome original}_editado". | F | Deve ter | NOVO | Passo 5, RN10 | Concluir um pedido sobre "praia.mp4" e verificar que a biblioteca contém "praia_editado" |
| REQ-VID-APPLY-021 | O sistema deve manter o ficheiro do vídeo original inalterado após o processamento. | NF (Fiabilidade) | Deve ter | NOVO | RN10, Garantia de Sucesso | Comparar o resumo criptográfico do original antes e depois |
| REQ-VID-APPLY-022 | O sistema deve descontar 1 operação da quota diária do utilizador registado, qualquer que seja o número de ferramentas da cadeia, apenas quando o pedido termina "Concluído". | F | Deve ter | ALT | Passo 5, RN7, Garantia de Sucesso | Concluir um pedido com 3 ferramentas e verificar 1 operação usada; cancelar outro e verificar que continua 1 |
| REQ-VID-APPLY-023 | O sistema deve permitir ao utilizador reproduzir, na biblioteca, o vídeo resultante. | F | Deve ter | NOVO | Passo 6 | Abrir "praia_editado" e verificar que é reproduzido do início ao fim |
| REQ-VID-APPLY-024 | O sistema deve marcar o pedido "Falhado" e apresentar *"Não foi possível aplicar as ferramentas ao vídeo. Tente novamente."* quando o processamento falha. | F | Deve ter | NOVO | E6 | Simular a falha de um fotograma e verificar o estado e a mensagem |
| REQ-VID-APPLY-025 | O sistema deve remover os ficheiros parciais, não criar vídeo e não descontar quota quando o processamento falha. | F | Deve ter | ALT | E6, RN7, Garantia Mínima | Simular uma falha e verificar que não há vídeo nem parciais e que a quota não mudou |
| REQ-VID-APPLY-026 | O sistema não deve disponibilizar a aba "Ferramentas de vídeo" ao perfil anónimo e deve sugerir o registo. | F | Deve ter | ALT | RN7 | Aceder como anónimo e verificar que a aba não está disponível |

#### 4.2 Impacto no sistema existente

| **Elemento existente afetado** | **Impacto (Manter / Estender / Alterar)** | **Descrição do impacto** | **Requisitos relacionados** |
|--------------------------------|-------------------------------------------|--------------------------|------------------------------|
| Ferramentas básicas de imagem | Estender | Passam a ser aplicadas fotograma a fotograma sobre vídeo, com os mesmos parâmetros | REQ-VID-APPLY-002, 003, 013 |
| Ferramentas avançadas (OCR, contagem, objetos) | Manter | Não são aplicáveis a vídeo no MVP (ver Q2) | REQ-VID-APPLY-002 |
| Encadeamento de ferramentas | Estender | A cadeia passa a poder ser aplicada a vídeo, com máximo de 3 ferramentas | REQ-VID-APPLY-003, 013 |
| Quota diária de operações (5/dia) | Alterar | Passa a contar pedidos de vídeo, 1 por pedido, só com sucesso | REQ-VID-APPLY-009, 022, 025 |
| Perfis de utilização | Estender | Passam a ter limites de vídeo (duração, resolução, tamanho, pedidos ativos); o anónimo sem acesso | REQ-VID-APPLY-005, 007, 008, 010, 026 |
| Processamento de operações | Estender | Passa a suportar operações demoradas com fila, estados, progresso e cancelamento | REQ-VID-APPLY-011, 016, 017, 018 |
| Biblioteca e armazenamento | Estender | Recebe novos vídeos e remove ficheiros parciais | REQ-VID-APPLY-019, 020, 025 |
| Processamento em lote | Manter | Aplicar a vários vídeos não entra no MVP (ver Q3) | — |

#### 4.3 Matriz de Rastreabilidade

| **Elemento do Caso de Uso** | **Descrição abreviada** | **Requisito(s) de Sistema** |
|------------------------------|-------------------------|------------------------------|
| Pré-condições | Sessão, vídeo na biblioteca | REQ-VID-APPLY-001 |
| Passo 1 | Escolher a ferramenta | REQ-VID-APPLY-001, 002 |
| Passo 2 | Montar a cadeia e definir parâmetros | REQ-VID-APPLY-003, 004, 005 |
| Passo 3 | Aplicar e criar pedido | REQ-VID-APPLY-006, 007, 008, 009, 010, 011, 012 |
| Passo 4 | Processar e acompanhar | REQ-VID-APPLY-013, 014, 015, 016, 017 |
| Passo 5 | Guardar resultado e descontar quota | REQ-VID-APPLY-020, 022 |
| Passo 6 | Reproduzir resultado | REQ-VID-APPLY-023 |
| FA1 | Utilizador premium | REQ-VID-APPLY-005, 007, 008, 010 |
| FA2 | Cancelar | REQ-VID-APPLY-018, 019 |
| E1 | Formato não suportado | REQ-VID-APPLY-006 |
| E2 | Duração ou tamanho excedidos | REQ-VID-APPLY-007, 008 |
| E3 | Quota esgotada | REQ-VID-APPLY-009 |
| E4 | Parâmetro fora do intervalo | REQ-VID-APPLY-004 |
| E5 | Resolução final excedida | REQ-VID-APPLY-005 |
| E6 | Falha a meio | REQ-VID-APPLY-024, 025 |
| E7 | Pedidos ativos | REQ-VID-APPLY-010 |
| RN1 | Formatos | REQ-VID-APPLY-006, 014 |
| RN2 | Ferramentas e cadeia | REQ-VID-APPLY-002, 003, 013 |
| RN3 | Parâmetros | REQ-VID-APPLY-004 |
| RN4 | Resolução final | REQ-VID-APPLY-005 |
| RN5 | Limites desta ferramenta | REQ-VID-APPLY-007, 008 |
| RN6 | Fotogramas e áudio | REQ-VID-APPLY-014, 015 |
| RN7 | Quota e perfis | REQ-VID-APPLY-009, 022, 025, 026 |
| RN8 | Pedidos ativos | REQ-VID-APPLY-010 |
| RN9 | Tempos | REQ-VID-APPLY-012, 017 |
| RN10 | Resultado e original | REQ-VID-APPLY-020, 021 |
| Pós-condição de sucesso | Novo vídeo, original inalterado, quota | REQ-VID-APPLY-013, 014, 020, 021, 022 |
| Pós-condição mínima | Sem parciais, quota intacta | REQ-VID-APPLY-019, 025 |
