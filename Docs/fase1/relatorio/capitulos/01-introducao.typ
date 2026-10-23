#import "../template.typ": *

= Introdução

== Propósito do incremento

O PictuRAS processava apenas imagens. Este incremento acrescenta suporte a vídeo numa lógica de MVP: o objetivo é validar funcionalmente o ciclo completo de um vídeo no sistema — importar, processar de forma assíncrona com estado e progresso, guardar o resultado e exportá-lo — articulado com os perfis de utilização e com a quota diária de operações já existentes. Os requisitos não funcionais são especificados com um alvo de produção, mas no MVP só se exige o alvo indicado entre parênteses, que é a linha de base para a Fase 2.

Foram especificadas e implementadas três funcionalidades (Tabela 3): *importar um vídeo* para a biblioteca e consultar as suas faixas de vídeo e de áudio (UC-VID-002), *recortar um intervalo* e exportar o resultado (UC-VID-001) e *aplicar ferramentas de imagem a todos os fotogramas* (UC-VID-003). As duas últimas partilham o mesmo modelo de pedido de processamento.

== _Baseline_ e repositório

#tabela(
    colunas: (5cm, 1fr),
    [Artefacto], [Versão / referência],
    [Documento de requisitos de base], [doc-ext-requisitos.pdf (equipa de 2025/26, novembro de 2025)],
    [Documento de solução arquitetural de base], [doc-sol-arquitetural.pdf (equipa de 2025/26)],
    [Repositório de partida], [https:/\/github.com/picturas-um/picturas-27, commit `781a63e` (inclui a migração do armazenamento de MinIO para SeaweedFS)],
    [Solução entregue], [solucao-ext-mvp.zip; repositório https:/\/github.com/davidserreira/picturas-27-extension, ramo `main` (versão de 23 de outubro de 2026)],
  )

== Organização do documento

A *Parte I* (capítulos 1 a 3) enquadra o incremento: perfis e _stakeholders_ revistos, funcionalidades do MVP, diagrama de casos de uso, modelo de domínio e regras de negócio transversais. A *Parte II* (capítulos 4 a 7) especifica as funcionalidades por artefacto: casos de uso, ERS, impacto no sistema existente e rastreabilidade até aos componentes e testes. A *Parte III* (capítulos 8 a 12) descreve as alterações arquiteturais, o uso de agentes de IA, os testes, a manutenção corretiva da solução de base e as conclusões. Os anexos têm as instruções de execução e o glossário.
