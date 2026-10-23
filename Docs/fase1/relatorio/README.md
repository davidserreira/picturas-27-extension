# PictuRAS · RAS 2026/2027 — Relatório da Fase 1 (Suporte a Vídeo), Grupo 5

Fonte em Typst do documento de requisitos (extensão) `doc-ext-requisitos.pdf`, feita a partir do
template da equipa docente.

## Compilar

Requer [Typst](https://typst.app) ≥ 0.13 (CLI) ou o editor web typst.app (carregar todo o conteúdo desta pasta).

```bash
typst compile --font-path fonts main.typ doc-ext-requisitos.pdf
```

Sem a CLI, também compila com o pacote Python `typst` (`pip install typst`):
`python -c "import typst; open('doc-ext-requisitos.pdf','wb').write(typst.compile('main.typ', font_paths=['fonts']))"`.

A fonte é a **Carlito** (equivalente livre da Calibri, licença OFL), incluída em `fonts/`.

## Estrutura

```
main.typ                 capa, índices e ordem dos capítulos
template.typ, cover.typ  estilos e capa (do template)
capitulos/               Partes I a III (capítulos 1 a 12) e anexos
casos-uso/               UC-VID-001 (recortar), UC-VID-002 (importar e consultar as faixas),
                         UC-VID-003 (aplicar ferramentas a todos os fotogramas)
images/                  diagramas (casos de uso, domínio, sequência) e capturas da interface
```

A implementação, os testes e os registos de decisões com IA estão no repositório
https://github.com/davidserreira/picturas-27-extension (`solucao-ext-mvp.zip`); as instruções de
execução estão no Anexo A.
