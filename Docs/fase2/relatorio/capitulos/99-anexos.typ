#import "../template.typ": *

#set heading(numbering: "A.1.")
#counter(heading).update(0)

= Instruções de execução

== Lançar a solução e repetir as medições

Pré-requisitos: Docker Desktop (ou Docker Engine) com Compose v2 e 8 GB ou mais de memória, Node.js 18 ou mais recente, Bash (no Windows, o Git Bash) e cerca de 20 GB livres. O ffmpeg não é preciso no anfitrião: os dados são gerados com o da imagem `projects`. O código do `main` é igual ao do ramo `fase2/integracao`, que tem também os _scripts_ e os dados das medições.

```bash
# 1. Arranque limpo da versão a medir (no ramo fase2/integracao, código igual ao do main)
git switch fase2/integracao
docker compose down -v --remove-orphans
docker compose up -d --build        # depois, https://localhost:8080

# 2. Dados de teste e browser (uma vez)
cd Docs/fase2/medicoes
node gerar-dados.mjs && node gerar-dados.mjs --video 330
(cd rnf2 && npm install && npx playwright install chromium)

# 3. Série completa, pela ordem da medição inicial
PICTURAS_STATE_PATH=/projects/{user}/{project}/process/status \
  MEDICAO=final/teste ./correr-tudo.sh   # no Git Bash, com MSYS_NO_PATHCONV=1

# 4. Regressão (pytest e node --test nas imagens dos serviços; ponta a ponta e interface no anfitrião)
cd ../regressao && npm install && npx playwright install chromium
REGRESSAO=teste ./correr.sh
```

Para medir a base, cria-se uma cópia de trabalho em `43a2e08` (`git worktree add`) e arranca-se a solução a partir dela, como na comparação A-B-A (`medicoes/final/integrado/scripts/`). Na base, o envio de 1000 MiB deita abaixo o motor do Docker: vai no fim da série de propósito. Cada série escreve em `medicoes/<MEDICAO>/` os JSON em bruto, os registos e um `resumo.md`, e a regressão escreve `regressao/<REGRESSAO>.md`, comparado com as impressões da base.

Uma reprodução curta, numa hora, está em `medicoes/reproducao/reproducao.sh`: a M1.1 com 500 MiB na base e no código do `main`, a regressão, e a M2.2 e a M2.3 uma vez cada.

== Commits e ramos

#tab([Ramos do repositório entregue],
  tabela(
    colunas: (5.6cm, 1fr),
    [Ramo], [Conteúdo],
    [`main`], [A entrega: a base `43a2e08` mais `126c319` (RNF-F2-01: o código de `7740230`, medido no seu ramo, e o ADR-01) e `d959150` (RNF-F2-02: o código de `eb8a37d`, medido com os dois integrados, o ADR-02 e o `ia.md`), com este relatório],
    [`fase2/integracao`], [Os dois ramos juntos, com o histórico completo: as medições (base, passos, finais, integrada, A-B-A, reproduções), a suite de regressão, a análise (`analise.md`), os documentos de cada etapa e este relatório],
    [`fase2/rnf-f2-01-carregamento`], [A DA-1 sozinha: um _commit_ por passo (secção 8.1) e a medição final isolada],
    [`fase2/rnf-f2-02-segundo-plano-medido`], [A DA-2 sozinha: um _commit_ por passo (secção 8.2) e a medição final isolada],
  ),
)

#tab([Mapa dos resultados (ramo `fase2/integracao`, `Docs/fase2/`)],
  tabela(
    colunas: (6.4cm, 1fr),
    [Pasta], [Conteúdo],
    [`medicoes/baseline/`], [Medição inicial, 17 de novembro],
    [`medicoes/passos/`, `medicoes/passos-rnf2/`], [Medições intermédias de cada passo das duas decisões],
    [`medicoes/final/rnf-f2-01/`, `medicoes/final/rnf-f2-02/`], [Medição final de cada requisito no seu ramo, com os complementos],
    [`medicoes/final/integrado/`], [Medição com os dois integrados e comparação A-B-A com a base],
    [`medicoes/reproducao/`], [Reproduções noutras máquinas],
    [`medicoes/ocorrencias/`], [Registos da queda do Docker com 1000 MiB na base],
    [`regressao/`], [Suite de regressão, impressões da base (`referencia.json`) e resultados na base, em cada passo, no fim e nas reproduções],
    [`adr/`, `analise.md`, `diagnostico.md`, `requisitos-nf.md`, `ia.md`], [Decisões, análise, diagnóstico, especificação e uso de IA],
  ),
)

= Glossário

#tabela(
  colunas: (4cm, 1fr),
  [Termo], [Definição],
  [A-B-A], [Comparação de tempos na mesma sessão, em três blocos seguidos: base (A), versão nova (B) e base outra vez, para separar o efeito do código da variação da máquina],
  [ADR], [_Architecture Decision Record_: registo de uma decisão arquitetural, com o contexto, as alternativas, a decisão e as consequências],
  [Acréscimo de memória], [O maior valor de memória de um contentor durante um envio, menos o valor em repouso imediatamente antes (M1.1)],
  [Cenário de qualidade], [Descrição verificável de um requisito de qualidade, com fonte, estímulo, artefacto, ambiente, resposta e medida da resposta],
  [Controlo (C1.x, C2.x)], [Medida de um efeito colateral noutro requisito não funcional; não decide o cumprimento, mas é reportado e analisado],
  [Execução (_run_)], [Uma aplicação do pipeline a todos os media de um projeto, iniciada por _Apply_],
  [Impressão (regressão)], [Resumo do resultado de um teste ponta a ponta (SHA-256 dos ficheiros, durações, resoluções, mensagens), comparado com o da base],
  [Medida principal (M1.x, M2.x)], [Medida que decide se um requisito fica cumprido (mínimo) ou com o alvo atingido],
  [Processamento em fluxo], [Passar os dados de um serviço ao seguinte à medida que chegam, em blocos, sem guardar o ficheiro inteiro],
  [Projeto P, projeto Q], [Projetos de teste do RNF-F2-02: P com um vídeo de 330 s e duas imagens, em processamento; Q de apoio, com uma imagem],
  [Tática (TAT-nn)], [Decisão de desenho que influencia a resposta a um estímulo de um atributo de qualidade (Bass, Clements e Kazman)],
)
