// =============================================================================
//  PictuRAS · RAS 2026/2027 · Relatório da Fase 2 — Melhoria de Requisitos Não Funcionais
//  Compilar:  typst compile --font-path fonts main.typ relatorio-fase2.pdf
//  Sem a CLI: python -c "import typst; open('relatorio-fase2.pdf','wb').write(typst.compile('main.typ', font_paths=['fonts']))"
// =============================================================================
#import "cover.typ": cover
#import "template.typ": *

#show: project

#mostrar-orientacoes.update(false)

#cover(
  title: "Fase 2 — Melhoria de Requisitos Não Funcionais",
  subtitle: "Especificação, Refactoring e Avaliação",
  group: "Grupo 5",
  authors: (
    (name: "David Cruz", number: "pg65403"),
    (name: "Miguel Páscoa", number: "pg64007"),
    (name: "Pedro Rebelo", number: "pg64018"),
    (name: "Tiago Barros", number: "pg64035"),
  ),
  "Novembro, 2026",
)

// --- Elementos iniciais (numeração romana) -----------------------------------
#set page(numbering: "i", number-align: center)
#counter(page).update(1)

#outline(title: [Índice], indent: auto, depth: 3)
#pagebreak()
#outline(title: [Lista de Figuras], target: figure.where(kind: image))
#outline(title: [Lista de Tabelas], target: figure.where(kind: table))

// --- Corpo do relatório -------------------------------------------------------
#set page(numbering: "1", number-align: center)
#counter(page).update(1)

// Parte I — Ponto de partida, análise arquitetural e decisões (Exercícios 6 e 7)
#include "capitulos/01-introducao.typ"
#include "capitulos/02-base-diagnostico.typ"
#include "capitulos/03-tradeoffs-cenarios.typ"
#include "capitulos/04-taticas-decisoes.typ"

// Parte II — Método e um capítulo por requisito, com o ciclo completo
#include "capitulos/05-metodo.typ"
#include "capitulos/06-rnf-f2-01.typ"
#include "capitulos/07-rnf-f2-02.typ"

// Parte III — Os dois juntos, IA e conclusão
#include "capitulos/08-integracao.typ"
#include "capitulos/09-ia.typ"
#include "capitulos/10-conclusao.typ"

// Anexos
#include "capitulos/99-anexos.typ"
