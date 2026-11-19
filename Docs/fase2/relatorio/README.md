# PictuRAS · RAS 2026/2027 — Relatório da Fase 2, Grupo 5

Fonte em Typst do relatório da Fase 2 (melhoria de requisitos não funcionais), feita a partir do
template da Fase 1 (`../../fase1/relatorio/`). A estrutura segue os enunciados e templates dos
Exercícios 6 e 7 e os seis pontos que as diretrizes pedem para cada requisito. Quando houver um
template oficial do relatório, o conteúdo dos capítulos passa para ele sem mudar.

## Compilar

Requer [Typst](https://typst.app) ≥ 0.13 (CLI), ou o pacote Python `typst` (`pip install typst`):

```bash
typst compile --font-path fonts main.typ relatorio-fase2.pdf
python -c "import typst; open('relatorio-fase2.pdf','wb').write(typst.compile('main.typ', font_paths=['fonts']))"
```

A fonte é a Carlito (equivalente livre da Calibri, licença OFL), incluída em `fonts/`.

## Estrutura

```
main.typ                 capa, índices e ordem dos capítulos
template.typ, cover.typ  estilos e capa (do template da Fase 1)
capitulos/01-04          introdução; arquitetura e padrões (Ex. 6, Bloco 1); trade-offs, cenários
                         e candidatos (Ex. 6, Bloco 2); táticas e decisões (Ex. 7)
capitulos/05-07          método de medição; RNF-F2-01; RNF-F2-02 (ciclo completo de cada um)
capitulos/08-10          os dois requisitos juntos; uso de IA; conclusão
capitulos/99-anexos      como repetir as medições, commits e mapa dos resultados
images/                  diagramas em SVG (vista da base e vistas antes/depois das decisões)
```

Os números vêm dos ficheiros de `Docs/fase2/` no ramo `fase2/integracao` (`analise.md`, `medicoes/`,
`regressao/`, `adr/`); no `main` estão só `adr/`, `ia.md` e este relatório. Esses ficheiros
têm o pormenor e os resultados em bruto.
