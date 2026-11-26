#import "../template.typ": *

#heading(numbering: none, outlined: false)[Histórico de versões]

Os _commits_ são do repositório do grupo; o histórico completo está no ramo `fase2/integracao`.

#tabela(
  colunas: (1.5cm, 2.3cm, 1fr, 2.6cm),
  [Versão], [Data], [Alterações], [Autores],
  [v1.0], [2026-11-18], [Primeira versão: diagnóstico arquitetural, cenários e candidatos (Exercício 6), táticas e decisões (Exercício 7) e o ciclo completo dos dois requisitos, medidos cada um no seu ramo (`50d9081`)], [DC],
  [v1.1], [2026-11-19], [Medição com os dois requisitos integrados e comparação A-B-A do tempo de processamento; revisão da equipa (`3f977dc`, `c34da1d`)], [DC; revisão: DC, MP, PR, TB],
  [v1.2], [2026-11-19], [Organização da entrega: o código e este relatório no `main`, as medições no `fase2/integracao` (`99ce0f5`, `5c152ad`)], [DC],
  [v2.0], [2026-11-23], [Passagem para o _template_ oficial da Fase 2; reproduções das medições noutras duas máquinas e correções dos _scripts_ que elas mostraram], [DC, MP, PR],
  [v2.1], [2026-11-25], [Resultados da reprodução do Pedro no repositório (`medicoes/reproducao/pedro/`): valores da secção 10.4 atualizados a partir dos ficheiros; na tabela das reproduções, a máquina de medição passa a ter os valores com os dois requisitos integrados], [PR],
  [v2.2], [2026-11-26], [Reprodução no Mac com os quatro tamanhos da M1.1 e experiência com o limite do V8 no `projects` (`65540b0`): análise das reproduções (10.4), H-05 e trabalho futuro (11.2, 11.4) atualizados], [MP],
)
