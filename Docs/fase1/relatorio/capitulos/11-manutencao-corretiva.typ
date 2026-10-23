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
    [T-03], [O login por email falhava sempre (erro 701): `getOneEmail()` devolvia o utilizador em formato JSON, que remove o `password_hash`, e a comparação da password com `bcrypt` falhava. Só funcionava a sessão iniciada automaticamente após o registo. Corrigido devolvendo o _hash_ apenas para a autenticação; um email inexistente passa a dar 401.], [Funcional (bloqueante)], [Alta], [Login (baseline)], [Corrigido (PR \#3)],
    [T-04], [O armazenamento só aceita ficheiros de poucos utilizadores. Cada utilizador tem um _bucket_ próprio, o SeaweedFS reserva 7 volumes por coleção e o número de volumes é o espaço livre a dividir por 1 GB (`-master.volumeSizeLimitMB=1024`). Com 45 GB livres há 45 volumes, ou seja, cerca de 6 utilizadores com ficheiros; a partir daí, qualquer envio, de imagem ou de vídeo, falha com "No writable volumes and no free volumes left" e a importação termina "Não foi possível guardar o vídeo". Detetado ao correr os testes com várias contas. Correções possíveis: menos volumes por coleção (`master.toml`, `volume_growth`), volumes mais pequenos, ou um _bucket_ único com prefixos por utilizador. Por decisão da equipa não foi corrigido na Fase 1; reprodução, evidência e limpeza de contas de teste em `Docs/defeitos-conhecidos.md`. Na verificação final, com o disco virtual do Docker Desktop (até 891 volumes), não limitou os testes.], [Funcional (bloqueante em produção)], [Alta], [LIB-001; IMPORT-013], [Pendente],
  ),
)
