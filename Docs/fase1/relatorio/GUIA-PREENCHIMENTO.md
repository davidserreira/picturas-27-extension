# Guia de preenchimento do relatório da Fase 1

Esta pasta é o template Typst já preenchido com o conteúdo do dossiê v1.1, do código, dos testes e dos registos de IA.
O que falta está **a vermelho** no PDF (marcadores `#preencher[...]`).

## 1. Carregar no typst.app

**Não substituir** o `main.typ` (já tem a capa do grupo). Substituir ou carregar:

| Ficheiro | Ação |
|---|---|
| `capitulos/00-historico-versoes.typ` … `capitulos/12-conclusao.typ`, `capitulos/99-anexos.typ` (14 ficheiros) | Replace |
| `casos-uso/UC-VID-001.typ` | Replace |
| `casos-uso/UC-VID-002.typ`, `casos-uso/UC-VID-003.typ` | Carregar (novos) para `casos-uso/` |
| `images/diagrama_casos_uso.svg`, `images/modelo_dominio.svg`, `images/sequencia_processamento.svg` | Carregar (novos) para `images/` |

## 2. O que preencher em cada ficheiro

| Ficheiro | Marcadores | O que pôr |
|---|---|---|
| `main.typ` | — | Capa: grupo, 5 nomes e números `pg`. Antes de entregar: `#mostrar-orientacoes.update(false)` |
| `00-historico-versoes.typ` | 3 | Iniciais dos autores das v1.1 e v1.2; descrição e autores da v2.0 |
| `01-introducao.typ` | 1 | Commit da entrega no repositório |
| `02-contexto-stakeholders.typ` | 1 | Outras fontes de elicitação (conversas com colegas, docentes), se houve |
| `03-visao-geral-video.typ` | 1 | Estado de implementação do UC-VID-003 depois da validação manual |
| `UC-VID-003.typ` | 1 | Decisão do grupo sobre a Q4 (limite de resolução em vídeos verticais) |
| `09-agentes-ia.typ` | 10 | Configuração dos agentes (skills, instruções), ferramenta usada no UC-VID-002, validação feita por cada pessoa, commits |
| `10-testes-validacao.typ` | 34 | Executar os testes "Por executar" (TST-IMPORT-M01…M12, TST-APPLY-M01…M03, TST-JOB, TST-SEC, TST-QUAL, TST-TRIM-M10…M14) e registar resultado e tempos; equipamento usado |
| `07-rastreabilidade.typ` | 54 | **Não editar à mão**: a coluna de resultado é gerada a partir do cap. 10 (ver ponto 3) |
| `11-manutencao-corretiva.typ` | 1 | Outros problemas encontrados na baseline (ou apagar a linha T-03) |
| `12-conclusao.typ` | 2 | O que não ficou concluído; lições da equipa |
| `99-anexos.typ` | 2 | Conta premium de teste (se houver); argumentos para correr o teste do UC-VID-001 |

## 3. Depois de executar os testes

As tabelas 5.1, 5.2, 7.1, 7.2, 7.3 e 10.2 são geradas a partir dos mesmos dados, com verificação
automática (nenhum requisito órfão, nenhum elemento do caso de uso por cobrir, todos os requisitos com teste).
Para não as desalinhar, enviar os resultados dos testes e as correções ao requisito ao gerador,
em vez de editar as tabelas uma a uma.

## 4. A rever pelo grupo

- Os requisitos repetidos entre recorte e aplicação de ferramentas foram unidos (REQ-VID-JOB-001 a 014,
  LIB-001/002, ACCESS-004/005). Os IDs antigos estão na tabela 5.4; os testes de `tests/uc-vid-001` ainda usam os antigos.
- ALT cita o RNF48 (limite diário de operações), o único ID do documento de base de 2025/26 para a quota.
  Os RF1–RF38 da baseline não estão nesse documento: se o grupo tiver o documento original, substituir
  "ALT (exportação)", "ALT (encadeamento)", etc. pelos RFnn corretos.
- Alvos de produção dos RNF, prioridades MoSCoW e regras RNG-01 a RNG-09.
- Diagramas: o ator "Registado" é novo no diagrama de casos de uso; "Fotograma" é especialização de "Imagem"
  no modelo de domínio.
