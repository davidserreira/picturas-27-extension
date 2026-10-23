#import "../template.typ": *

== UC-VID-001 — Recortar um vídeo e exportar o resultado

=== Cabeçalho

#tab([Caso de uso UC-VID-001 — Recortar um vídeo e exportar o resultado],
  tabela-campos(
    [ID do Caso de Uso], [UC-VID-001],
    [Nome], [Recortar um vídeo e exportar o resultado],
    [Autores], [David Cruz, João Sousa, Miguel Páscoa, Pedro Rebelo e Tiago Barros],
    [Data], [2026-10-07 a 2026-10-21],
    [Objetivo], [Recortar um vídeo da biblioteca, mantendo ou removendo o intervalo selecionado, substituí-lo pelo resultado, acompanhar o processamento e exportá-lo],
    [Âmbito], [Módulo de vídeo do PictuRAS: ferramentas de vídeo, fila de processamento, biblioteca e exportação],
    [Ator Principal], [Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado)],
    [_Stakeholders_ e Interesses], [- *Utilizador*: quer o trecho certo sem esperar ao ecrã, sem acumular cópias na biblioteca e sem perder o vídeo se o recorte falhar
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
    [2], [Escolhe *Recortar* na barra de ferramentas], [Abre à esquerda o painel Recortar, com os campos de início e fim, *Manter seleção* / *Remover seleção*, a duração total e *Aplicar recorte*, e apresenta sobre as faixas de vídeo e de áudio uma seleção do vídeo todo, com as duas extremidades arrastáveis; as faixas não têm outros controlos],
    [3], [Arrasta as extremidades da seleção nas faixas ou escreve o início e o fim], [Atualiza a seleção nas faixas e nos campos, mostra no leitor o fotograma da extremidade, valida o intervalo e apresenta a duração do resultado],
    [4], [Clica em *Aplicar recorte* no painel], [Verifica formato, limites, espaço da biblioteca, quota e pedidos ativos; cria o pedido "Em fila" e confirma a receção],
    [5], [Acompanha o progresso no painel (pode sair da página; ao voltar ao vídeo, o painel reabre com o pedido em curso)], [Passa a "Em processamento" e apresenta estado e percentagem de progresso],
    [6], [—], [Substitui o vídeo pelo resultado, com o mesmo nome, marca "Concluído" e desconta 1 operação (registado)],
    [7], [Escolhe *Exportar* e confirma o descarregamento], [Entrega o ficheiro do vídeo recortado],
  ),
)

=== Fluxos Alternativos

#tab([UC-VID-001 — Fluxos alternativos],
  tabela(
    colunas: (4cm, 1fr),
    [Fluxo], [Descrição (passo de origem: condição → comportamento → retorno)],
    [FA1 – Utilizador premium], [No passo 4, se o perfil é premium → aplicam-se os limites de premium e até 3 pedidos ativos, não se verifica a quota e o fluxo continua no passo 5],
    [FA2 – Cancelar], [Nos passos 5 ou 6, o utilizador escolhe *Cancelar* → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e mantém o vídeo inalterado],
    [FA3 – Pré-visualizar], [No passo 3, o utilizador escolhe *Pré-visualizar* → o sistema reproduz só o intervalo escolhido (no FA4, os segundos antes do intervalo, saltando-o), sem criar pedido nem gastar quota, e o fluxo regressa ao passo 3],
    [FA4 – Remover a seleção], [No passo 3, o utilizador escolhe *Remover seleção* no painel → a seleção aparece riscada nas faixas e o resultado passa a ser o vídeo sem esse intervalo, com o que está antes e depois dele juntos; o fluxo continua no passo 4],
  ),
)

=== Exceções

#tab([UC-VID-001 — Exceções],
  tabela(
    colunas: (1fr, 1fr),
    [Condição], [Comportamento do Sistema],
    [E1 – Formato ou codec não suportado], [No passo 4, rejeita o pedido com _"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"_ (a importação já rejeita estes vídeos, UC-VID-002/E1, pelo que só chegam à biblioteca por outra via); no FA4, num vídeo que não é H.264, apresenta _"Remover um intervalo só está disponível para vídeos H.264."_ e mantém *Aplicar recorte* desativado],
    [E2 – Duração ou tamanho excedem o limite do perfil], [No passo 4, rejeita o pedido e apresenta o limite; no registado, sugere o premium],
    [E3 – Quota diária esgotada (registado)], [No passo 4, rejeita o pedido com _"Atingiu o limite de 5 operações diárias"_ e sugere o premium],
    [E4 – Intervalo inválido (início ≥ fim, fim acima da duração ou \< 1 s; no FA4, o vídeo ficaria com \< 1 s)], [Apresenta o motivo e mantém *Aplicar recorte* desativado],
    [E5 – O processamento falha a meio], [Marca "Falhado", apresenta _"Não foi possível recortar o vídeo. Tente novamente."_, remove parciais, mantém o vídeo inalterado e não desconta quota],
    [E6 – Número máximo de pedidos ativos], [No passo 4, rejeita o pedido e indica que tem de aguardar ou cancelar um pedido ativo],
    [E7 – Biblioteca de vídeo cheia], [No passo 4, se a ocupação da biblioteca atingiu o limite do perfil, rejeita o pedido e apresenta a ocupação e o limite],
    [E8 – O vídeo já tem um pedido em curso], [No passo 4, rejeita o pedido e indica que tem de aguardar que o pedido desse vídeo termine ou cancelá-lo],
  ),
)

=== Pós-condições

#tabela(
    colunas: (4cm, 1fr),
    [Tipo], [Resultado],
    [Garantia de Sucesso], [O vídeo foi substituído pelo resultado (intervalo mantido ou vídeo sem o intervalo removido) e mantém o nome; não foi criado outro vídeo; o pedido está "Concluído"; no registado, a quota desceu 1 operação],
    [Garantia Mínima], [O vídeo está inalterado; não existe vídeo parcial nem ficheiros temporários; a quota não mudou; o estado e o motivo são apresentados],
  )

=== Regras de Negócio e Restrições

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Regra],
    [RN1], [Formatos aceites: MP4 (H.264) e MOV; o resultado mantém o formato e o codec do original. Remover um intervalo (FA4) só é possível em vídeos H.264, porque juntar as duas partes obriga a recodificar],
    [RN2], [Início \< fim, fim ≤ duração do vídeo, intervalo mínimo de 1 s, com resolução de 1 s (também ao arrastar nas faixas); ao remover um intervalo, o vídeo tem de ficar com pelo menos 1 s],
    [RN3], [Limites: registado, vídeos até 5 min e 200 MB; premium, até 30 min e 2 GB],
    [RN4], [Registado: 5 operações/dia; premium: sem limite; anónimo: sem acesso. Um recorte conta 1 operação, só se "Concluído"],
    [RN5], [Pedidos ativos em simultâneo: 1 (registado) e 3 (premium), contando todas as ferramentas de vídeo],
    [RN6], [Receção do pedido confirmada em ≤ 2 s; progresso atualizado pelo menos a cada 5 s],
    [RN7], [O resultado substitui o vídeo recortado, com o mesmo nome, só quando o pedido termina "Concluído"; até lá, e se o pedido falhar ou for cancelado, o vídeo mantém-se inalterado. Um vídeo só pode ter um pedido ativo de cada vez.],
    [RN8], [O vídeo recortado passa a ocupar na biblioteca de vídeo (1 GB registado, 10 GB premium) o tamanho do resultado e mantém-se até o utilizador o remover],
  )

=== Assunções

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Assunção],
    [A1], [A importação do vídeo está especificada em UC-VID-002],
    [A2], [A quota de 5 operações/dia já existe e é partilhada entre imagens e vídeo],
    [A3], [O estado do pedido é consultado dentro da aplicação, sem notificações por e-mail],
    [A4], [Os limites de duração, tamanho, armazenamento e pedidos são valores iniciais de MVP, fixados pela equipa sem dados reais de utilização, e ajustáveis (ver DQ-007)],
    [A5], [No MVP basta um processador de recorte; a carga esperada não excede 20 pedidos em fila em simultâneo],
    [A6], [Os browsers suportados reproduzem MP4 (H.264) sem extensões; a reprodução de outros codecs MOV no browser não é garantida (ver DQ-008)],
  )

=== Questões em Aberto

#tabela(
    colunas: (1.6cm, 1fr, 5cm),
    [ID], [Questão], [Resolução],
    [Q1], [O perfil anónimo deve poder usar alguma ferramenta de vídeo?], [Decidida: não no MVP → RNG-02 (UC-VID-001/RN4).],
    [Q2], [O recorte deve poder entrar no encadeamento de ferramentas e no lote?], [Adiada: fora do âmbito do MVP (5.3); reavaliar na Fase 3.],
    [Q3], [O utilizador deve poder escolher o formato de saída na exportação?], [Decidida no MVP: o resultado mantém o formato do original (RNG-01); a escolha do formato fica para a Fase 3.],
    [Q4], [Um pedido que falha a meio deve ser repetido automaticamente, em vez de o utilizador o voltar a submeter? (alvo de produção do REQ-VID-PROCESS-003)], [Adiada para a Fase 2: alvo de produção do REQ-VID-PROCESS-003.],
    [Q5], [Os vídeos resultantes devem expirar ao fim de algum tempo, para libertar armazenamento?], [Decidida no MVP: não expiram (RNG-08); reavaliar com dados de utilização na Fase 2.],
    [Q6], [Deve ser possível desfazer um recorte, guardando a versão anterior do vídeo?], [Adiada: no MVP a substituição é definitiva (RNG-09); a exportação antes do recorte permite guardar uma cópia; reavaliar na Fase 3. A opção de manter o original chegou a ser implementada e foi retirada por decisão da equipa (3.1).],
    [Q7], [Deve ser possível fazer vários cortes de uma vez e mover ou reordenar os excertos nas faixas, como num editor de vídeo?], [Adiada para a Fase 3: exige guardar o vídeo como uma lista de excertos (projeto de edição). No MVP, um pedido mantém ou remove um único intervalo.],
  )
