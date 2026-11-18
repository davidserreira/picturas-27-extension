#import "../template.typ": *

= Introdução

Na Fase 1, o PictuRAS passou a suportar vídeo como um produto mínimo viável: o objetivo era a validação funcional. A Fase 2 escolhe dois requisitos não funcionais da solução e melhora-os por _refactoring_, sem acrescentar funcionalidades. Para cada requisito, este relatório fecha o ciclo pedido nas diretrizes: requisito, quantificação, medição inicial, _refactoring_ e medição final.

== Ponto de partida

#tabela-campos(
  [Repositório oficial], [#link("https://github.com/picturas-um/picturas-27")],
  [Commit de partida], [`052310226c51fa57a17101c7bd1ad795674aac95` (`0523102`, 4 de novembro de 2026), com a solução do PL1-G4, as correções da equipa docente, a legendagem automática e a extração de fotogramas],
  [Repositório do grupo], [#link("https://github.com/davidserreira/picturas-27-extension"). O `main` é o commit de partida mais a pasta `Docs/` (`43a2e08`): o código é igual ao de `0523102`],
  [Documentos de base], [`fase-2-guidelines.pdf`, `doc-ext-requisitos-2627.pdf` (PL1-G4), `README.md` e `AGENTS.md` do repositório],
)

== Requisitos escolhidos

#tab([Os dois requisitos não funcionais da Fase 2],
  tabela(
    colunas: (2.1cm, 4.4cm, 4.2cm, 1fr),
    [ID], [Requisito], [ISO/IEC 25010:2011], [Fragilidade de partida],
    [RNF-F2-01], [Carregamento de ficheiros grandes com memória limitada], [Eficiência de desempenho — utilização de recursos], [Cada vídeo (até 1 GB) fica inteiro em memória em três serviços seguidos; um envio de 1000 MiB deita abaixo toda a instalação],
    [RNF-F2-02], [Trabalho em segundo plano durante o processamento], [Usabilidade — operabilidade], [Um painel bloqueia a página durante o processamento, e o progresso só existe no browser: perde-se ao recarregar, e com ele o cancelamento],
  ),
)

Os dois partem de fragilidades que as diretrizes já apontavam e que o próprio PL1-G4 registou como limitações. A escolha está justificada no capítulo 3.

== Documentos seguidos

#tabela-campos(
  [Diretrizes], [_Diretrizes Fase 2 — Melhoria de Req. Não Funcionais do PictuRAS_, versão 1 (4 de novembro de 2026): os seis pontos esperados para cada requisito (diagnóstico, quantificação, medição inicial, decisões e _refactoring_, medição final e análise, preservação funcional)],
  [Exercício 6, Bloco 1], [Padrões e alternativas: capítulo 2],
  [Exercício 6, Bloco 2], [Enunciado 1.1 e template 1.1: _trade-offs_, cenários de qualidade e candidatos, no capítulo 3],
  [Exercício 7], [Template 3.0, compatível com o enunciado 3.0: táticas e decisões arquiteturais, no capítulo 4],
)

A estrutura final do relatório ainda não estava definida nas diretrizes quando este documento foi escrito. Por isso, segue a ordem dos exercícios e, para cada requisito, os seis pontos das diretrizes.

== Organização do trabalho e do relatório

Cada etapa deixou o resultado em ficheiros de `Docs/fase2/`, revistos antes da etapa seguinte. Este relatório resume-os e remete para eles:

#tabela(
  colunas: (5.2cm, 1fr),
  [Ficheiro ou pasta], [Conteúdo],
  [`diagnostico.md`], [Estudo da base e comparação de oito candidatos (capítulos 2 e 3)],
  [`requisitos-nf.md`], [Especificação: escalas, métodos, valores-alvo e mínimos, controlos dos efeitos colaterais],
  [`medicoes/`], [Scripts de medição, dados de teste, resultados em bruto da base, dos passos intermédios e da medição final],
  [`regressao/`], [Suite de regressão e os seus resultados na base, em cada passo e no fim],
  [`adr/`], [Um registo de decisão arquitetural por requisito, com o plano de _refactoring_ e os resultados por passo],
  [`analise.md`], [Comparação base, final, alvo e mínimo, e análise crítica],
  [`ia.md`], [Uso de IA: ferramentas, tarefas apoiadas e validação],
)

A Parte I faz a análise arquitetural: a arquitetura e os padrões da base (capítulo 2), os _trade-offs_, os cenários de qualidade e a escolha dos requisitos (capítulo 3), e as táticas e decisões (capítulo 4). A Parte II descreve o método de medição e de regressão (capítulo 5) e tem um capítulo por requisito (6 e 7), cada um com o ciclo completo: diagnóstico, quantificação, medição inicial, decisões e _refactoring_, medição final e análise, e preservação funcional. A Parte III trata os dois requisitos juntos (capítulo 8), o uso de IA (capítulo 9) e as conclusões. Os anexos dizem como repetir as medições.

Cada requisito foi implementado num ramo próprio, a partir do `main`, e medido isolado. Os dois ramos foram depois integrados e medidos juntos:

#tabela(
  colunas: (6.2cm, 1fr),
  [Ramo], [Conteúdo],
  [`fase2/rnf-f2-01-carregamento`], [ADR-01, passos 0 a 5b e medição final do RNF-F2-01],
  [`fase2/rnf-f2-02-segundo-plano-medido`], [ADR-02, passos 0 a 5 e medição final do RNF-F2-02],
  [`fase2/integracao`], [Os dois ramos juntos, a medição conjunta, a análise e este relatório],
)
