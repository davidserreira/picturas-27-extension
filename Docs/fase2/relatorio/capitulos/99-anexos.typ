#import "../template.typ": *

#set heading(numbering: "A.1.")
#counter(heading).update(0)

= Anexos

== Como repetir as medições

Pré-requisitos: Docker Desktop (ou Docker Engine) com Compose v2, Node.js 20 ou mais recente, Bash (no Windows, o Git Bash), cerca de 4 GB livres. O ffmpeg não é preciso no anfitrião: os dados são gerados com o da imagem `projects`.

```bash
# 1. Arranque limpo da versão a medir
docker compose down -v --remove-orphans
docker compose up -d --build

# 2. Dados de teste e browser (uma vez)
cd Docs/fase2/medicoes
node gerar-dados.mjs && node gerar-dados.mjs --video 330
(cd rnf2 && npm install && npx playwright install chromium)

# 3. Série completa, pela ordem da medição inicial
MEDICAO=baseline ./correr-tudo.sh             # na base
PICTURAS_STATE_PATH=/projects/{user}/{project}/process/status \
  MEDICAO=final/integrado ./correr-tudo.sh    # com o ADR-02, a rota de estado existe

# 4. Regressão (pytest e node --test nas imagens dos serviços; e2e e interface no anfitrião)
cd ../regressao && REGRESSAO=final ./correr.sh
```

Cada série escreve em `medicoes/<MEDICAO>/` os JSON em bruto, os registos e um `resumo.md`, e a regressão escreve `regressao/<REGRESSAO>.md`. Os scripts que correram cada série final estão na pasta `scripts/` da série, com as horas em `logs/`.

== Commits

#tab([Commits do RNF-F2-01 (ramo `fase2/rnf-f2-01-carregamento`)],
  tabela(
    colunas: (2cm, 1fr),
    [Commit], [Conteúdo],
    [`47c303b`], [Passo 0: documentos da Fase 2 e controlo C1.7],
    [`93dd800`], [Passo 1: `img_storage` envia ao S3 em fluxo],
    [`cf4b5be`], [Commit repetido do passo 0, feito fora do agente; mantido e assinalado no `ia.md`],
    [`d3546b2`], [Passo 2: `projects` envia ao `img_storage` sem segunda cópia],
    [`847e0dc`], [Passo 3: `projects` recebe em fluxo e valida o objeto guardado],
    [`0130073`], [Passo 4: `api_gateway` verifica o JWT e passa o envio em fluxo],
    [`a394a9a`], [Passo 5: nginx passa o corpo dos pedidos à API sem o guardar],
    [`78a035a`], [Passo 5b: afinação da memória dos serviços de carregamento],
    [`8529695`], [Passo 6: documentação do ADR-01 e do uso de IA],
    [`56110a8`, `78c5fce`], [Medição final, comparação A/B do C2.1 e análise],
  ),
)

#tab([Commits do RNF-F2-02 (ramo `fase2/rnf-f2-02-segundo-plano-medido`)],
  tabela(
    colunas: (2cm, 1fr),
    [Commit], [Conteúdo],
    [`f1714dc`], [Passo 0: ADR-02],
    [`2982528`], [Passo 1: estado da execução no orquestrador],
    [`df7e1dc`], [Passo 2: progresso do vídeo passa pelo orquestrador],
    [`54386cc`], [Passo 3: evento `run-status`],
    [`2abf795`], [Passo 4: interface que não bloqueia],
    [`77c9bf7`], [Passo 5: documentação, uso de IA e repetição de `GET` no instrumento],
    [#preencher[commits]], [Medição final],
  ),
)

== Mapa dos resultados

#tabela(
  colunas: (6.4cm, 1fr),
  [Pasta], [Conteúdo],
  [`medicoes/baseline/`], [Medição inicial, 17 de novembro],
  [`medicoes/passos/`, `medicoes/passos-rnf2/`], [Medições intermédias de cada passo dos dois ADR],
  [`medicoes/final/rnf-f2-01/`], [Medição final do RNF-F2-01 no seu ramo, com o complemento e a comparação A/B],
  [`medicoes/final/rnf-f2-02/`], [Medição final do RNF-F2-02 no seu ramo, com o complemento],
  [`medicoes/final/integrado/`], [Medição com os dois requisitos integrados e comparação A-B-A com a base],
  [`medicoes/ocorrencias/`], [Registos da queda do Docker com 1000 MiB na base],
  [`regressao/baseline.md`, `regressao/final/`, `regressao/final.md`], [Regressão na base, nos ramos e com os dois requisitos integrados],
  [`regressao/passos/`, `regressao/passos-rnf2/`], [Regressão em cada passo],
)
