#import "../template.typ": *

== UC-VID-001 — Recortar um vídeo e exportar o resultado

=== Cabeçalho

#tab([Caso de uso UC-VID-001 — Recortar um vídeo e exportar o resultado],
  tabela-campos(
    [ID do Caso de Uso], [UC-VID-001],
    [Nome], [Recortar um vídeo e exportar o resultado],
    [Versão], [v1.2],
    [Autor], [Miguel Páscoa],
    [Data], [2026-10-07 (v1.0); 2026-10-14 (v1.1); 2026-10-19 (v1.2)],
    [Objetivo], [Obter um novo vídeo só com o intervalo escolhido de um vídeo da biblioteca, acompanhar o processamento e exportá-lo],
    [Âmbito], [Módulo de vídeo do PictuRAS: ferramentas de vídeo, fila de processamento, biblioteca e exportação],
    [Ator Principal], [Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado)],
    [_Stakeholders_ e Interesses], [- *Utilizador*: quer o trecho certo sem esperar ao ecrã e sem perder o original
- *Proprietário do Sistema*: quer controlar o custo de processamento por perfil
- *Equipa de Operações*: não quer ficheiros parciais em armazenamento],
    [Pré-condições], [- Sessão iniciada com perfil registado ou premium
- O vídeo está na biblioteca (UC-VID-002) e o utilizador é o proprietário],
    [_Trigger_], [O utilizador abre um vídeo da biblioteca e escolhe a ferramenta *Recortar*],
  ),
)

=== Fluxo Principal

#tab([UC-VID-001 — Fluxo principal],
  tabela(
    colunas: (1.2cm, 1fr, 1fr),
    [Passo], [Ação do Ator], [Resposta do Sistema],
    [1], [Seleciona um vídeo da biblioteca], [Apresenta o vídeo e as ferramentas de vídeo e, no registado, as operações restantes no dia],
    [2], [Escolhe *Recortar*], [Apresenta os controlos de início e fim e a duração total],
    [3], [Define o início e o fim], [Valida o intervalo e apresenta a duração do resultado],
    [4], [Clica em *Aplicar recorte*], [Verifica formato, limites, espaço da biblioteca, quota e pedidos ativos; cria o pedido "Em fila" e confirma a receção],
    [5], [Acompanha o progresso (pode sair da página)], [Passa a "Em processamento" e apresenta estado e percentagem de progresso],
    [6], [—], [Guarda o resultado como novo vídeo, marca "Concluído" e desconta 1 operação (registado)],
    [7], [Escolhe *Exportar* e confirma o descarregamento], [Entrega o ficheiro; o original mantém-se inalterado],
  ),
)

=== Fluxos Alternativos

#tab([UC-VID-001 — Fluxos alternativos],
  tabela(
    colunas: (4cm, 1fr),
    [Fluxo], [Descrição (passo de origem: condição → comportamento → retorno)],
    [FA1 – Utilizador premium], [No passo 4, se o perfil é premium → aplicam-se os limites de premium e até 3 pedidos ativos, não se verifica a quota e o fluxo continua no passo 5],
    [FA2 – Cancelar], [Nos passos 5 ou 6, o utilizador escolhe *Cancelar* → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e não cria vídeo],
    [FA3 – Pré-visualizar (v1.1)], [No passo 3, o utilizador escolhe *Pré-visualizar* → o sistema reproduz só o intervalo escolhido, sem criar pedido nem gastar quota, e o fluxo regressa ao passo 3],
  ),
)

=== Exceções

#tab([UC-VID-001 — Exceções],
  tabela(
    colunas: (1fr, 1fr),
    [Condição], [Comportamento do Sistema],
    [E1 – Formato ou codec não suportado], [*Recortar* fica indisponível com _"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"_],
    [E2 – Duração ou tamanho excedem o limite do perfil], [No passo 4, rejeita o pedido e apresenta o limite; no registado, sugere o premium],
    [E3 – Quota diária esgotada (registado)], [No passo 4, rejeita o pedido com _"Atingiu o limite de 5 operações diárias"_ e sugere o premium],
    [E4 – Intervalo inválido (início ≥ fim, fim acima da duração ou \< 1 s)], [Apresenta o motivo e mantém *Aplicar recorte* desativado],
    [E5 – O processamento falha a meio], [Marca "Falhado", apresenta _"Não foi possível recortar o vídeo. Tente novamente."_, remove parciais, não cria vídeo e não desconta quota],
    [E6 – Número máximo de pedidos ativos], [No passo 4, rejeita o pedido e indica que tem de aguardar ou cancelar um pedido ativo],
    [E7 – Biblioteca de vídeo cheia (v1.1)], [No passo 4, se a ocupação da biblioteca atingiu o limite do perfil, rejeita o pedido e apresenta a ocupação e o limite],
  ),
)

=== Pós-condições

#tabela(
    colunas: (4cm, 1fr),
    [Tipo], [Resultado],
    [Garantia de Sucesso], [Existe na biblioteca um novo vídeo só com o intervalo escolhido; o original está inalterado; o pedido está "Concluído"; no registado, a quota desceu 1 operação],
    [Garantia Mínima], [O original está inalterado; não existe vídeo parcial nem ficheiros temporários; a quota não mudou; o estado e o motivo são apresentados],
  )

=== Regras de Negócio e Restrições

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Regra],
    [RN1], [Formatos aceites: MP4 (H.264) e MOV; o resultado mantém o formato e o codec do original],
    [RN2], [Início \< fim, fim ≤ duração do vídeo, intervalo mínimo de 1 s, com resolução de 1 s],
    [RN3], [Limites: registado, vídeos até 5 min e 200 MB; premium, até 30 min e 2 GB],
    [RN4], [Registado: 5 operações/dia; premium: sem limite; anónimo: sem acesso. Um recorte conta 1 operação, só se "Concluído"],
    [RN5], [Pedidos ativos em simultâneo: 1 (registado) e 3 (premium), contando todas as ferramentas de vídeo],
    [RN6], [Receção do pedido confirmada em ≤ 2 s; progresso atualizado pelo menos a cada 5 s],
    [RN7], [O resultado é guardado como novo vídeo "{nome}\_recorte"; se esse nome já existir no projeto, acrescenta-se um número ("{nome}\_recorte\_2", "\_3", …); o original nunca é alterado],
    [RN8 (v1.1)], [O resultado ocupa espaço da biblioteca de vídeo (1 GB registado, 10 GB premium) e mantém-se até o utilizador o remover],
  )

=== Assunções

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Assunção],
    [A1], [A importação do vídeo está especificada em UC-VID-002],
    [A2], [A quota de 5 operações/dia já existe e é partilhada entre imagens e vídeo],
    [A3], [O estado do pedido é consultado dentro da aplicação, sem notificações por e-mail],
    [A4], [Os limites de duração, tamanho, armazenamento e pedidos são valores iniciais de MVP, fixados pela equipa sem dados reais de utilização, e ajustáveis (v1.1: ver DQ-007)],
    [A5 (v1.1)], [No MVP basta um processador de recorte; a carga esperada não excede 20 pedidos em fila em simultâneo],
    [A6 (v1.1)], [Os browsers suportados reproduzem MP4 (H.264) sem extensões; a reprodução de outros codecs MOV no browser não é garantida (ver DQ-008)],
  )

=== Questões em Aberto

#tabela(
    colunas: (1.6cm, 1fr, 5cm),
    [ID], [Questão], [Resolução],
    [Q1], [O perfil anónimo deve poder usar alguma ferramenta de vídeo?], [Decidida: não no MVP → RNG-02 (UC-VID-001/RN4).],
    [Q2], [O recorte deve poder entrar no encadeamento de ferramentas e no lote?], [Adiada: fora do âmbito do MVP (5.3); reavaliar na Fase 3.],
    [Q3], [O utilizador deve poder escolher o formato de saída na exportação?], [Decidida no MVP: o resultado mantém o formato do original (RNG-01); a escolha do formato fica para a Fase 3.],
    [Q4 (v1.1)], [Um pedido que falha a meio deve ser repetido automaticamente, em vez de o utilizador o voltar a submeter? (alvo de produção do REQ-VID-PROCESS-003)], [Adiada para a Fase 2: alvo de produção do REQ-VID-PROCESS-003.],
    [Q5 (v1.1)], [Os vídeos resultantes devem expirar ao fim de algum tempo, para libertar armazenamento?], [Decidida no MVP: não expiram (RNG-08); reavaliar com dados de utilização na Fase 2.],
  )
