#import "../template.typ": *

= Conclusão

O MVP valida o ciclo completo de um vídeo no PictuRAS: importação com retoma e validação do conteúdo real, duas ferramentas de processamento assíncrono com estado, progresso, cancelamento e resultados que substituem o vídeo só quando o pedido conclui, e a integração com os perfis e com a quota diária, reinterpretada como uma operação por pedido concluído. A decisão de modelar um *pedido de processamento comum* permitiu que a segunda ferramenta reutilizasse estados, quota e cancelamento sem alterar a primeira.

*Verificação final.* Antes da entrega, todos os testes foram repetidos sobre a versão entregue, com as imagens reconstruídas: passam 147 dos 148 casos automáticos (unitários, pela API e no browser, para onde passaram os testes manuais da interface). Só falha o TST-IMPORT-M06, o defeito D-01, que a equipa decidiu não corrigir nesta fase. A verificação ainda encontrou e corrigiu três defeitos (D-02 a D-04), agora cobertos por testes, e afirmações do relatório que já não correspondiam ao código.

Ficou por fazer: desfazer a substituição de um vídeo por uma ferramenta, miniaturas geradas no servidor, edição das faixas (remover ou substituir o áudio, UC-VID-002/Q5), escolha do formato de saída, encadeamento do recorte com outras ferramentas e processamento de vários vídeos em lote (questões em aberto adiadas para a Fase 3).

*Lições aprendidas.* Especificar critérios de aceitação verificáveis desde o Exercício 1 tornou os testes quase diretos; manter a rastreabilidade gerada a partir de uma única fonte evitou requisitos órfãos e duplicados; e os agentes de IA foram úteis sobretudo quando as decisões e a validação ficaram registadas.

*Ligação à Fase 2.* Os requisitos não funcionais mais prioritários para melhoria por _refactoring_ são: (1) *Fiabilidade* — retomar um pedido a partir do ponto de falha e repetir automaticamente (REQ-VID-PROCESS-003), em vez de o reiniciar; (2) *Eficiência de desempenho e capacidade* — escalar os processadores e substituir o bloqueio em memória por um persistente, para várias instâncias (REQ-VID-PROCESS-004, DA-10); (3) *Segurança* — reduzir a validade dos endereços assinados para 15 min (REQ-VID-ACCESS-002).
