# PictuRAS · RAS 2026/2027 — Relatório da Fase 2, Grupo 5

Fonte em Typst do relatório da Fase 2 (melhoria de requisitos não funcionais), sobre o template
oficial da Fase 2 (`src-doc-fase2-template.zip`): `template.typ`, `cover.typ` e a ordem dos capítulos
são os do template, com as caixas de orientação escondidas. O conteúdo reúne os Exercícios 6 e 7, a
implementação e as medições.

## Compilar

Requer [Typst](https://typst.app) ≥ 0.13 (CLI), ou o pacote Python `typst` (`pip install typst`):

```bash
typst compile --font-path fonts main.typ relatorio-fase2.pdf
python -c "import typst; open('relatorio-fase2.pdf','wb').write(typst.compile('main.typ', font_paths=['fonts']))"
```

A fonte é a Carlito (equivalente livre da Calibri, licença OFL), incluída em `fonts/`.

## Estrutura

```
main.typ                 capa, histórico de versões, índices e ordem dos capítulos
template.typ, cover.typ  estilos e capa (do template oficial, sem alterações)
capitulos/00             histórico de versões
capitulos/01             introdução (Parte I)
capitulos/02-04          âmbito e vista, padrões atuais, alternativas e matriz (Ex. 6, Bloco 1)
capitulos/05-06          cenários de qualidade e candidatos a RNF, com a quantificação (Ex. 6, Bloco 2)
capitulos/07-10          táticas, decisões (com a implementação), vistas antes e depois, trade-offs,
                         medição, resultados e preservação funcional (Ex. 7 e implementação)
capitulos/11-12          conclusões; utilização de IA
capitulos/99-anexos      instruções de execução, ramos e mapa dos resultados, glossário
images/                  diagramas em SVG: vista da base, sequência de um pedido, vistas antes/depois
```

Os números vêm dos ficheiros de `Docs/fase2/` no ramo `fase2/integracao` (`analise.md`, `medicoes/`,
`regressao/`, `adr/`); no `main` estão só `adr/`, `ia.md` e este relatório. Esses ficheiros
têm o pormenor e os resultados em bruto.
