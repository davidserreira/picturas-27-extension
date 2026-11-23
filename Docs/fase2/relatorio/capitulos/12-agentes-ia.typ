#import "../template.typ": *

= Utilização de IA

O registo completo está em `Docs/fase2/ia.md`, no `main` e no ramo `fase2/integracao`. No código, cada ficheiro alterado com apoio de IA tem um comentário que remete para o ADR do seu requisito, e o `AGENTS.md` descreve as alterações para quem, pessoa ou agente, trabalhar a seguir no repositório.

== Ferramentas, modelos e configuração

#tabela(
  colunas: (3.5cm, 1fr),
  [Ferramenta / modelo], [Configuração e utilização (_skills_, instruções de projeto, MCP, …)],
  [Claude Code (extensão do VS Code, Windows 11)], [Agente com acesso ao repositório, ao terminal (PowerShell e Git Bash) e ao Docker local: lê código, corre a solução e as medições, escreve ficheiros e faz _commits_ quando lhe é pedido. Instruções de projeto: o `AGENTS.md` do repositório, atualizado pelos dois requisitos. Não foram usadas _skills_ nem servidores MCP no trabalho sobre o repositório],
  [Claude Fable 5.2], [Diagnóstico (`diagnostico.md`) e especificação (`requisitos-nf.md`). O plano das etapas, pedido ao Fable 5.2, recomendava-o também para as decisões],
  [Claude Opus 5.5], [Todas as outras etapas, incluindo as decisões (ADR-01 e ADR-02), a implementação, as medições, a análise e este relatório],
  [Claude Code nas máquinas do Pedro e do Miguel], [Reprodução das medições (`medicoes/reproducao/`) e notas da reprodução do Miguel (`NOTAS.md`)],
)

*Método.* Um pedido escrito por etapa (diagnóstico, especificação, medição, regressão, decisão, implementação, medição final, relatório), com o resultado esperado e o que o agente não podia fazer (por exemplo, "não alteres código da aplicação" nas etapas de medição); cada etapa deixa o resultado em ficheiros de `Docs/fase2/`, que a equipa revê antes da seguinte; nada conta como medido sem _script_ e dados em bruto no repositório; e, na implementação, cada passo do ADR é um _commit_ com testes unitários novos, medição intermédia e a suite de regressão completa. Por decisão da equipa, os _commits_ não levam linhas de coautoria da ferramenta.

== Tarefas apoiadas e validação

#tab([Tarefas apoiadas por IA e validação],
  tabela(
    colunas: (2.4cm, 2.6cm, 1fr, 1fr, 1fr),
    tamanho: 8pt,
    [Ferramenta / modelo / _skill_], [Tarefa apoiada (capítulo)], [O que foi aceite], [O que foi rejeitado e porquê], [Como foi validado pela equipa],
    [Claude Code, Fable 5.2], [Diagnóstico da base (cap. 2 a 4)], [Oito candidatos, cada um com evidência em `ficheiro:linha`; a recomendação do par C4 + C5], [Uma conclusão errada sobre o painel que bloqueia a página: não tapa a barra lateral, como se viu ao reler o _layout_], [Evidência conferida no código; a escolha do par é da equipa],
    [Claude Code, Fable 5.2], [Especificação (cap. 6)], [As escalas, os métodos e os controlos C1.x e C2.x], [A indicação de progresso do envio ficou fora do RNF-F2-01, para o requisito medir uma coisa só], [Valores-alvo com origem identificável (REQ do PL1-G4, limites dos perfis); decisão da equipa],
    [Claude Code, Opus 5.5], [Exercícios 6 e 7 no relatório (cap. 2 a 9)], [Os padrões, as alternativas, os cenários e as táticas da resolução da equipa (Miguel Páscoa), ajustados ao implementado], [As táticas de classe C; as avaliações das alternativas não medidas ficaram como hipóteses (H-01 a H-03)], [Cada referência conferida no código e cada número nas medições],
    [Claude Code, Opus 5.5], [Medição inicial e regressão (cap. 10)], [Os _scripts_, os resultados em bruto e as suites ponta a ponta e de interface], [A primeira calibração do vídeo e o 409 ao aplicar logo depois de abrir o projeto, corrigidos nos _scripts_ com a tentativa guardada; diferenças falsas na primeira repetição (ordem das chaves), corrigidas na comparação e não escondidas], [Repetições com média e desvio-padrão; duas corridas da regressão na base com impressões iguais],
    [Claude Code, Opus 5.5], [Decisões e implementação (cap. 8)], [O código das duas decisões, um _commit_ por passo, com comentários que remetem para o ADR], [Mandar o estado para a sala `project:<id>`, sem verificação de acesso (EV-15); a previsão do passo 2 do ADR-01; expectativas erradas em testes novos], [Testes unitários, regressão completa e medição intermédia em cada passo; causas confirmadas no código instalado nos contentores],
    [Claude Code, Opus 5.5], [Medições finais, integração e análise (cap. 10)], [Os resultados, a comparação A-B-A e a análise], [Atribuir o aumento do C2.1 ao _refactoring_: só se atribuiu à máquina depois de comparar na mesma sessão], [Ocorrências registadas com os registos que as explicam; números conferidos com os dados em bruto],
    [Claude Code (Pedro e Miguel)], [Reprodução noutras máquinas (cap. 10)], [Os resultados e as três correções de _scripts_ que mostraram], [A conclusão de que o acréscimo "já não cresce com o ficheiro" nessas máquinas: só se mediu 500 MiB; as causas das diferenças ficaram como hipóteses (H-05, H-06)], [A falha da M2.2 foi confirmada como do instrumento ao repetir com o vídeo de 330 s; resultados conferidos com o `resumo.md` de cada máquina],
    [Claude Code, Opus 5.5], [Este relatório (todos os capítulos)], [A estrutura do _template_ oficial, com o conteúdo de `Docs/fase2/`], [Uma afirmação sobre o uso do `doc-sol-arquitetural.pdf`, que nenhum documento da equipa sustentava; uma legenda com a origem errada dos valores de memória], [Números conferidos com os resultados em bruto; compilado sem erros nem avisos; a passagem para o _template_ oficial está por rever pela equipa],
  ),
)

== Análise crítica

A IA foi mais útil onde o trabalho é extenso e verificável: ler um código de base grande e apontar evidência linha a linha, escrever _scripts_ de medição e testes, e implementar passos pequenos com testes. Foi menos fiável nas previsões e nas generalizações. Errou a previsão do passo 2 do ADR-01 e os valores esperados da memória dos serviços Node, propôs enviar o estado para uma sala sem controlo de acesso, e, numa reprodução, generalizou a partir de um único tamanho de ficheiro. Todos estes erros foram apanhados por algo independente da própria IA: uma medição, um teste, a leitura do código de outro serviço ou a comparação com os dados em bruto.

As práticas que mais contaram foram quatro. Medir em cada passo, e não só no fim, para cada efeito ter dono. Registar as ocorrências em vez de as descartar: a queda do Docker na base, as falhas do instrumento e o aumento do C2.1 ficaram com os registos que os explicam. Não atribuir uma causa sem a medir: o aumento do C2.1 só foi atribuído à máquina depois de uma comparação na mesma sessão, e as causas das diferenças nas reproduções ficaram como hipóteses. E repetir as medições noutras máquinas, que mostrou o que uma só máquina escondia: a margem da M1.1 não é a mesma em todo o lado. A equipa reviu o resultado de cada etapa e cada passo dos dois ADR e é responsável por todo o conteúdo entregue.
