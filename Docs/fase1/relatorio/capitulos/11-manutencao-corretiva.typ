#import "../template.typ": *

= Manutenção Corretiva da Solução de Base

Problemas da solução de base encontrados durante o estudo e a integração do vídeo.

#tab([Tarefas de manutenção corretiva],
  tabela(
    colunas: (1.2cm, 1fr, 2.2cm, 1.6cm, 1.6cm, 2.6cm),
    tamanho: 8.5pt,
    [ID], [Descrição do problema], [Impacto], [Prioridade], [Rel. Req.], [Estado],
    [T-01], [Ao alternar entre grelha e carrossel, o botão de vista descarta o parâmetro `share` do endereço, pelo que um colaborador que abriu o projeto por link perde o contexto de partilha.], [Funcional], [Média], [RF45], [Pendente],
    [T-02], [O serviço de quota reserva operações por um pedido GET sem chave de idempotência; uma repetição do pedido pode reservar duas vezes.], [Fiabilidade], [Média], [RNF48], [Parcial (contrato de devolução com chave para vídeo; reserva de imagem por corrigir)],
    [T-03], [#preencher[outros problemas encontrados na baseline]], [#preencher[…]], [#preencher[…]], [#preencher[…]], [#preencher[…]],
  ),
)
