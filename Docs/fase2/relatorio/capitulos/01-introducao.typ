#import "../template.typ": *

= Introdução

== Propósito e âmbito

Na Fase 1, o PictuRAS passou a suportar vídeo como um produto mínimo viável, com o foco na validação funcional. Nesta fase, a equipa escolheu dois requisitos não funcionais da solução de base e melhorou-os por _refactoring_, sem acrescentar funcionalidades e preservando o comportamento funcional:

- *RNF-F2-01 — Carregamento de ficheiros grandes com memória limitada* (eficiência de desempenho, utilização de recursos). Na base, cada vídeo carregado fica inteiro em memória em três serviços seguidos, e um envio de 1000 MiB deita abaixo toda a instalação.
- *RNF-F2-02 — Trabalho em segundo plano durante o processamento* (usabilidade, operabilidade). Na base, um painel bloqueia a página durante o processamento, e o progresso só existe no browser: perde-se ao recarregar, e com ele a possibilidade de cancelar.

As duas fragilidades atingem a extensão de vídeo, mas têm origem diferente: a primeira está no padrão global (o caminho de carregamento), a segunda na interação entre o padrão global e o do vídeo (o progresso do vídeo não passa pelo orquestrador). Para cada requisito, o relatório fecha o ciclo pedido nas diretrizes: requisito, quantificação, medição inicial, _refactoring_ e medição final.

== _Baseline_ e repositório

#tab([Artefactos de partida],
  tabela(
    colunas: (5cm, 1fr),
    [Artefacto], [Versão / referência],
    [Documento de requisitos de base], [`doc-ext-requisitos-2627.pdf` (PL1-G4)],
    [Documento de solução arquitetural de base], [`doc-sol-arquitetural.pdf`],
    [Repositório de partida], [#link("https://github.com/picturas-um/picturas-27"), _commit_ `052310226c51fa57a17101c7bd1ad795674aac95` (`0523102`, 4 de novembro de 2026): a solução do PL1-G4 com as correções da equipa docente, a legendagem automática e a extração de fotogramas. No repositório do grupo, a base é `43a2e08`: o mesmo código mais a pasta `Docs/`],
    [Repositório entregue], [#link("https://github.com/davidserreira/picturas-27-extension"). Ramo `main`: a base mais um _commit_ por requisito (`126c319` e `d959150`), com os ADR, o registo de uso de IA e este relatório. Ramo `fase2/integracao`: o histórico completo, com as medições, a suite de regressão e a análise (anexo A.2)],
    [Diretrizes da Fase 2], [Versão 1, de 4 de novembro de 2026],
  ),
)

Este relatório estende os documentos de base; não os reescreve. O _commit_ de partida é o mesmo em todos os capítulos.

== Exercícios e versões usadas

#tab([Exercícios que alimentam este relatório],
  tabela(
    colunas: (3.6cm, 2.2cm, 2cm, 2cm, 1fr),
    [Exercício], [Capítulos], [Enunciado], [Template], [Versão do documento da equipa],
    [Exercício 6, Bloco 1: padrões arquiteturais], [2, 3 e 4], [1.1], [Não registada], [Resolução da equipa (`arquitetura.md`, Miguel Páscoa), sobre o `diagnostico.md` (v1.0 deste relatório)],
    [Exercício 6, Bloco 2: trade-offs, cenários e candidatos a RNF], [5 e 6], [1.1], [1.1], [A mesma resolução (`arquitetura.md`) (v1.0)],
    [Exercício 7: táticas arquiteturais], [7 a 10], [3.0], [3.0], [Resolução da equipa (`taticas.md`), ajustada ao que foi implementado (v1.0)],
  ),
)

A escolha dos dois requisitos foi feita antes do Exercício 6, a partir do estudo da base em `Docs/fase2/diagnostico.md`. Os exercícios formalizaram essa escolha com os IDs que os capítulos seguintes usam.

== Organização do documento

A *Parte II* (capítulos 2 a 4) descreve a solução de base: como foi lançada, a vista da arquitetura e a sequência de um pedido (capítulo 2), os padrões global e do vídeo (capítulo 3) e as alternativas, com a matriz de comparação (capítulo 4). A *Parte III* (capítulos 5 e 6) transforma as fragilidades em cenários de qualidade priorizados e escolhe e quantifica os dois candidatos a requisito. A *Parte IV* (capítulos 7 a 10) trata as táticas, as duas decisões arquiteturais e a sua implementação, as vistas antes e depois, e a medição: _trade-offs_, plano, resultados e preservação funcional. A *Parte V* tem as conclusões e o uso de IA. Os anexos dizem como lançar a solução e repetir as medições.

Os IDs encadeiam os capítulos: as evidências e hipóteses (`EV-nn`, `H-nn`) sustentam as alternativas (`ALT-n`); as fragilidades com evidência dão os cenários de qualidade (`QS-nn`), e os dois mais prioritários dão os candidatos (`CAND-1` e `CAND-2`); cada cenário tem as suas táticas candidatas (`TAT-nn`), e a tática escolhida fica registada numa decisão (`DA-1` e `DA-2`). Cada evidência é descrita no sítio onde é usada pela primeira vez.
