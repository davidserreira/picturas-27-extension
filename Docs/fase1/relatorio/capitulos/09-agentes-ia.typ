#import "../template.typ": *

= Implementação Assistida por Agentes de IA

== Ferramentas, modelos e configuração

#tabela(
    colunas: (3.8cm, 1fr),
    [Ferramenta / modelo], [Configuração e utilização (_skills_, instruções de projeto, MCP, …)],
    [Claude (Anthropic), via Claude Code], [Usado no UC-VID-001 (análise da arquitetura, código e testes), na nova interface de vídeo e na redação e verificação da especificação. Sem _skills_ nem instruções de projeto versionadas no repositório: #preencher[acrescentar `.claude/skills/...` ou `CLAUDE.md`, se existirem, ou indicar que não foram usados].],
    [ChatGPT / Codex (OpenAI)], [Usado no UC-VID-003 (análise do repositório, implementação e testes). Registo em `Docs/registo-ia-apply.md`. #preencher[modelo e configuração usados]],
    [#preencher[ferramenta]], [#preencher[UC-VID-002: indicar se foi usado um agente de IA na importação e com que configuração]],
  )

== Tarefas apoiadas e validação

#tab([Tarefas apoiadas por agentes de IA e validação],
  tabela(
    colunas: (2.4cm, 2.2cm, 1fr, 1fr, 2.6cm),
    tamanho: 8.5pt,
    [Ferramenta / _skill_], [Caso de uso], [Tarefa apoiada], [Validação realizada pela equipa], [Evidência],
    [Claude], [UC-VID-001/002/003], [Primeira versão dos 3 casos de uso e do esboço de requisitos (v1.0)], [#preencher[o que o grupo reviu, alterou ou descartou]], [e875c99],
    [Claude], [UC-VID-001], [Análise do sistema existente; processador de recorte; backend (pedidos, validações, quota, cancelamento); tempo real; interface], [Revisão do código; 23/23 testes automáticos e checklist manual; erro detetado no 1.º teste e corrigido (D20); numeração dos nomes pedida pelo aluno (D28). Decisões D1–D31 em `Docs/registo-ia-trim.md`], [64ece01, 61268ea, f85e10d, faf0fde, 3ff4da7; PR \#1],
    [ChatGPT / Codex], [UC-VID-003], [Processador de aplicação de ferramentas, backend, interface e testes (Python, Node, CI)], [Testes executados pelo assistente (20 + 38 passaram, build sem erros). #preencher[revisão do código e checklist manual pelo aluno]], [827234c, e811949, 55b4b68 #preencher[confirmar]],
    [Claude Code], [UC-VID-001, UC-VID-003], [Vídeo no visualizador do projeto e ferramentas de vídeo na barra de ferramentas], [Build do frontend com verificação de tipos sem erros. #preencher[teste manual no browser]], [811d12e (ramo feature/video-carousel-view)],
    [Claude Code], [UC-VID-001, UC-VID-003], [Substituição do vídeo pelo resultado das ferramentas, com um pedido ativo por vídeo; adaptação dos testes da API e caixa-preta; atualização do relatório (v1.4)], [Testes Node da API executados pelo assistente. #preencher[repetir `tests/uc-vid-001` e validar no browser]], [#preencher[commit]],
    [Claude Code], [UC-VID-002 (FA4)], [Faixas de vídeo e de áudio ao abrir um vídeo: rota e cálculo da forma de onda (`videoTracks`), componente da linha temporal (`video-tracks`), escala e marcador arrastável, testes e atualização do relatório (v1.3)], [8 testes automáticos e chamada à rota real no ambiente Docker executados pelo assistente; build do frontend com verificação de tipos sem erros. #preencher[teste manual no browser (TST-LIB-M01 a M04)]], [#preencher[commit]],
    [Claude Code], [Todos], [Exercício 2 e relatório: ERS com RNF ISO/IEC 25010, decisões de qualidade, eliminação de requisitos duplicados, matrizes e verificação automática de órfãos, elementos sem requisito e requisitos sem teste], [#preencher[revisão da equipa: requisitos aceites, alterados ou descartados; alvos]], [#preencher[commit do relatório]],
    [#preencher[…]], [UC-VID-002], [#preencher[…]], [#preencher[…]], [cea6c23],
  ),
)

== Análise crítica

*O que correu bem.* Os agentes aceleraram a análise de um código de base grande e a produção de código repetitivo (rotas, modelos, componentes de interface, testes), e ajudaram a manter a coerência entre o caso de uso, os requisitos e os testes: cada critério de aceitação deu origem a um teste. Pedir à IA um registo de decisões com alternativas (Docs/registo-ia-trim.md e registo-ia-apply.md) tornou as escolhas justificáveis.

*Onde a IA errou e como foi detetado.* No recorte, a primeira versão lia o progresso do FFmpeg de forma não bloqueante, o que não funciona em Python em modo texto; o erro só apareceu no primeiro teste real (o pedido ficou "Falhado") e foi corrigido com leitura em threads (D20). Na aplicação de ferramentas, os testes detetaram uma verificação de tamanho feita antes de o ficheiro existir e uma resposta repetida que podia apagar um resultado concluído. Na especificação, a IA propôs requisitos duplicados entre funcionalidades, eliminados na v1.2 com a verificação automática de rastreabilidade. #preencher[outros erros detetados pela equipa]

*Práticas adotadas.* Rever todo o código no editor; exigir testes contra o sistema real em Docker, e não apenas com substitutos; registar decisões e alternativas; não declarar como validado nada que não tenha sido executado (o registo do UC-VID-003 separa o que o assistente testou do que o aluno ainda tem de validar). #preencher[completar com a reflexão da equipa]
