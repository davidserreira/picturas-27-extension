#import "../template.typ": *

#heading(numbering: none, outlined: false)[Histórico de versões]

#tabela(
    colunas: (1.5cm, 2.3cm, 1fr, 3.5cm),
    [Versão], [Data], [Alterações], [Autores],
    [v1.0], [2026-10-07], [Casos de uso UC-VID-001, UC-VID-002 e UC-VID-003 e esboço dos requisitos derivados (Exercício 1)], [MP, DC, GB, JS],
    [v1.1], [2026-10-14], [Especificação de requisitos (Exercício 2): requisitos não funcionais ISO/IEC 25010 com alvos MVP e produção, decisões de qualidade, completude, impacto e matriz; casos de uso refinados], [DC #preencher[…]],
    [v1.2], [2026-10-19], [Relatório no template da Fase 1: catálogo único sem requisitos duplicados (REQ-VID-JOB, LIB, ACCESS), regras transversais RNG, prioridades MoSCoW, realização e verificação, arquitetura, IA e testes], [DC #preencher[…]],
    [v1.3], [2026-10-21], [Faixas de vídeo e de áudio ao abrir um vídeo da biblioteca: UC-VID-002 (FA4, E7, RN10, RN11, A7, Q5) e UC-VID-003 (passo 6); requisitos REQ-VID-LIB-003 a 009; conceito Faixa no modelo de domínio; DA-13; testes TST-LIB-01 e TST-LIB-M01 a M04], [DC],
    [v1.4], [2026-10-21], [O resultado de Recortar e de Aplicar ferramentas passa a substituir o vídeo em vez de criar um novo (RNG-09, UC-VID-001 e UC-VID-003, TRIM-016, APPLY-020, JOB-014, LIB-002; novo JOB-015: um pedido ativo por vídeo; DA-14); faixas com escala ajustável e marcador mais fácil de arrastar], [DC],
    [v1.5], [2026-10-21], [Melhorias do recorte: seleção do intervalo arrastável sobre as faixas de vídeo e áudio (TRIM-034), remover a seleção (FA5, TRIM-032), manter o original com o resultado como vídeo novo (FA4, TRIM-033) e nomes únicos numerados (UC-VID-001/RN9, UC-VID-002/RN12, IMPORT-032); UC-VID-001/Q7; DA-15; testes TST-TRIM-25 a 28 e TST-TRIM-M15 a M17], [MP],
    [v2.0], [2026-10-23], [Versão entregue da Fase 1: testes do UC-VID-001 completos (31 automáticos, repetidos na v1.4), correção do login por email (T-03) e resultados dos testes manuais], [DC, JS, MP, PR, TB],
  )
