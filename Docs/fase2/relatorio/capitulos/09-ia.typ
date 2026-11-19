#import "../template.typ": *

= Uso de agentes de IA

O registo completo está em `Docs/fase2/ia.md`. No código, cada ficheiro alterado com apoio de IA tem um comentário que remete para o ADR do seu requisito, e o `AGENTS.md` descreve as alterações para quem (pessoa ou agente) trabalhar a seguir no repositório.

== Ferramentas e método

#tabela-campos(
  [Ferramenta], [Claude Code (extensão do VS Code, Windows 11): um agente com acesso ao repositório, ao terminal e ao Docker local],
  [Modelos], [Claude Fable 5.2 e Claude Opus 5.5. O plano das etapas foi pedido ao Fable 5.2, que recomendou o Fable para as etapas que decidem a qualidade do trabalho (diagnóstico, especificação, decisões) e o Opus para as de execução. Foram usados o Fable 5.2 no diagnóstico e na especificação, e o Opus 5.5 em todas as outras etapas, incluindo as decisões (`ia.md`)],
  [_Skills_, MCP], [Não foram usados no trabalho sobre o repositório],
  [Instruções de projeto], [O `AGENTS.md` do repositório, atualizado pelos dois requisitos],
  [Commits], [Por decisão da equipa, sem linhas de coautoria da ferramenta. O uso de IA fica registado no `ia.md`, nos comentários e no `AGENTS.md`],
)

O método foi o mesmo em todas as etapas:

1. Um pedido escrito por etapa (diagnóstico, especificação, medição, regressão, decisão, implementação, medição final, relatório), com o resultado esperado e o que o agente não podia fazer. Por exemplo, nas etapas de medição: "não alteres código da aplicação".
2. Cada etapa deixa o resultado em ficheiros de `Docs/fase2/`, que a equipa revê antes da seguinte.
3. Nada conta como medido sem um script e os dados em bruto no repositório; as medições guardam o commit e as alterações por versionar.
4. Na implementação, cada passo do plano do ADR é um commit, com testes unitários novos, uma medição intermédia e a suite de regressão completa.

== Tarefas apoiadas e validação

#tab([Tarefas apoiadas pela IA, o que foi aceite e rejeitado, e validação],
  tabela(
    colunas: (2.4cm, 1fr, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [Etapa], [Tarefa apoiada], [O que foi aceite], [O que foi rejeitado ou corrigido, e porquê], [Como foi validado],
    [Diagnóstico], [Ler o código e a documentação e propor fragilidades com evidência], [Oito candidatos, cada um com `ficheiro:linha`; a recomendação do par C4 + C5], [Uma conclusão errada sobre o painel que bloqueia a página: o painel não tapa a barra lateral, como se viu ao reler o _layout_], [Evidência conferida no código; a escolha do par é da equipa],
    [Exercícios 6 e 7], [Padrões, matriz, cenários, táticas e decisões], [Os padrões, as alternativas, os cenários QS e as táticas candidatas], [As táticas de classe C (pausar e retomar); as avaliações das alternativas não medidas ficaram como hipóteses (H-01 a H-03)], [Cada referência conferida no código e cada número nas medições],
    [Especificação], [Medidas, valores-alvo e mínimos, controlos], [As escalas, os métodos e os controlos C1.x e C2.x], [A indicação de progresso do envio ficou fora do RNF-F2-01, para o requisito medir uma coisa só], [Os valores-alvo têm origem identificável (REQ do PL1-G4, limites dos perfis); decisão da equipa],
    [Medição inicial], [Scripts e série completa sobre a base], [Os scripts e os resultados em bruto], [A primeira calibração do vídeo, que derivou, e o 409 ao aplicar logo depois de abrir o projeto: corrigidos nos scripts, com a primeira tentativa guardada], [Repetições com média e desvio-padrão; ocorrências registadas, e não descartadas],
    [Regressão], [Reutilizar os testes e escrever as suites ponta a ponta e de interface], [18 testes ponta a ponta e 3 de interface, com impressões], [Diferenças falsas na primeira repetição (ordem das chaves, bytes do watermark): corrigidas na comparação, e não escondidas], [Duas corridas na base com impressões iguais],
    [Decisões (ADR)], [Alternativas, decisão e plano por passos], [As alternativas B (ADR-01) e A (ADR-02)], [A sala `project:<id>` para o estado (sem verificação de acesso, EV-15); a previsão do passo 2 do ADR-01], [Causas confirmadas no código instalado antes de decidir; previsões confrontadas com as medições de cada passo],
    [Implementação], [Um commit por passo, com testes unitários novos], [O código dos dois ADR, com comentários que remetem para o ADR], [Expectativas erradas em testes novos; uma execução terminada que apareceria como "terminou" ao abrir o projeto], [Testes unitários, regressão completa e medição intermédia em cada passo (capítulos 6 e 7)],
    [Medição final e análise], [Séries finais, complementos e análise], [Os resultados e a análise], [Atribuir ao _refactoring_ o aumento do C2.1 na série do RNF-F2-01: só se atribuiu à máquina depois de uma comparação na mesma sessão], [Ocorrências registadas com os registos que as explicam],
    [Relatório], [Escrever este relatório a partir de `Docs/fase2/`], [A estrutura pelos exercícios e pelas diretrizes], [—], [Números conferidos com os resultados em bruto; revisto pela equipa],
  ),
)

== Erros da IA encontrados pela validação

#tab([Problemas encontrados durante a implementação e como foram tratados],
  tabela(
    colunas: (4.6cm, 3.2cm, 1fr),
    tamanho: 8.5pt,
    [Problema], [Como apareceu], [Tratamento],
    [Previsão errada: o passo 2 do ADR-01 não baixou o pico do `projects`], [M1.1 do passo 2 igual à do passo 1], [A cópia temporária para o `ffprobe` dava um pico do mesmo tamanho; registado e resolvido no passo 3],
    [Testes unitários novos com expectativas erradas (uma promessa rejeitada sem tratamento; 40,4% em vez de 40,3%)], [Primeira corrida dos testes], [Corrigidos os testes; o código não mudou],
    [O ADR-02 mandava o estado para a sala do projeto, onde qualquer socket entra sem verificação], [Leitura do `ws_gateway` ao implementar o passo 3], [Só as salas do dono e de quem iniciou; teste unitário que o garante; ADR corrigido],
    [Uma execução já terminada apareceria noutras páginas como "terminou" ao abrir o projeto], [Revisão do código antes de construir o frontend], [O fornecedor de estado só guarda execuções em curso ou o fim de uma que mostrava],
    [Os serviços Node ficavam entre 80 e 100 MiB com 500 MiB, acima do alvo], [M1.1 dos passos 3 a 5], [Seis variantes medidas; a causa era a recolha tardia dos buffers, e não cópias. Afinação do passo 5b],
    [Falha do instrumento: `ECONNRESET` num pedido à API], [M2.1 do passo 4], [Falha do Docker Desktop, e não da aplicação; o instrumento repete uma vez um `GET` nesse caso],
  ),
)

== Análise crítica

A IA foi mais útil onde o trabalho é extenso e verificável: ler um código de base grande e apontar evidência linha a linha, escrever scripts de medição e testes, e implementar passos pequenos com testes. Foi menos fiável nas previsões. Errou a previsão do passo 2 do ADR-01 e os valores esperados da memória dos serviços Node, e propôs enviar o estado para uma sala sem controlo de acesso. Todos estes erros foram apanhados por algo independente da própria IA: uma medição, um teste ou a leitura do código de outro serviço.

As práticas que mais contaram foram três. Medir em cada passo, e não só no fim, para cada efeito ter dono. Registar as ocorrências em vez de as descartar: a queda do Docker na base, a falha passageira de um comando e o aumento do C2.1 ficaram com os registos que os explicam. E não atribuir uma causa sem a medir: o aumento do C2.1 na série final do RNF-F2-01 só foi atribuído à máquina depois de uma comparação na mesma sessão. A equipa é responsável por todo o conteúdo entregue. A equipa reviu o resultado de cada etapa e cada passo dos dois ADR, e concordou com eles (tabelas de revisão do `ia.md`).
