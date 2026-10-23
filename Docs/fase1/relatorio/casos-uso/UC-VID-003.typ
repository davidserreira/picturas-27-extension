#import "../template.typ": *

== UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas

=== Cabeçalho

#tab([Caso de uso UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas],
  tabela-campos(
    [ID do Caso de Uso], [UC-VID-003],
    [Nome], [Aplicar ferramentas de imagem a todos os fotogramas de um vídeo],
    [Autores], [David Cruz, João Sousa, Miguel Páscoa, Pedro Rebelo e Tiago Barros],
    [Data], [2026-10-07 a 2026-10-21],
    [Objetivo], [Aplicar uma cadeia de 1 a 3 ferramentas de imagem a todos os fotogramas de um vídeo da biblioteca, substituindo-o pelo resultado],
    [Âmbito], [Módulo de vídeo do PictuRAS: ferramentas de vídeo, ferramentas de imagem, encadeamento, fila de processamento e biblioteca],
    [Ator Principal], [Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado)],
    [_Stakeholders_ e Interesses], [- *Utilizador*: quer transformar o vídeo inteiro com ferramentas que já conhece
- *Proprietário do Sistema*: quer limitar o custo (duração, resolução, pedidos simultâneos)
- *Equipa de Desenvolvimento*: valida a reutilização das ferramentas de imagem sobre vídeo],
    [Pré-condições], [- Sessão iniciada com perfil registado ou premium
- O vídeo está na biblioteca (UC-VID-002) e o utilizador é o proprietário],
    [_Trigger_], [O utilizador abre um vídeo da biblioteca e escolhe *Aplicar ferramentas* na barra de ferramentas],
  ),
)

=== Fluxo Principal

#tab([UC-VID-003 — Fluxo principal],
  tabela(
    colunas: (1.2cm, 1fr, 1fr),
    [Passo], [Ação do Ator], [Resposta do Sistema],
    [1], [Seleciona um vídeo e escolhe *Aplicar ferramentas* na barra de ferramentas], [Abre à esquerda o painel "Aplicar ferramentas a todos os fotogramas", com Redimensionar, Binarizar e Rodar e a cadeia vazia],
    [2], [Adiciona de 1 a 3 ferramentas à cadeia, ordena-as e define os parâmetros], [Valida os parâmetros e a resolução final e apresenta a cadeia ordenada e a resolução final],
    [3], [Clica em *Aplicar ferramentas* no painel], [Verifica formato, limites, quota e pedidos ativos; cria o pedido "Em fila" e confirma a receção],
    [4], [Acompanha o progresso (pode sair da página)], [Processa o vídeo aplicando a cadeia, por ordem, a todos os fotogramas; apresenta estado, percentagem e fotogramas processados],
    [5], [—], [Substitui o vídeo pelo resultado, com o mesmo nome, marca "Concluído" e desconta 1 operação (registado)],
    [6], [Abre o vídeo e reproduz-o], [Reproduz o vídeo já alterado e apresenta as suas faixas (UC-VID-002/FA4), onde o utilizador confirma que o áudio foi mantido],
  ),
)

=== Fluxos Alternativos

#tab([UC-VID-003 — Fluxos alternativos],
  tabela(
    colunas: (4cm, 1fr),
    [Fluxo], [Descrição (passo de origem: condição → comportamento → retorno)],
    [FA1 – Utilizador premium], [No passo 3, se o perfil é premium → aplicam-se os limites de premium (10 min, resolução 3840 × 2160 e 3 pedidos ativos) e não se verifica a quota],
    [FA2 – Cancelar], [No passo 4, o utilizador escolhe *Cancelar* → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e mantém o vídeo inalterado],
  ),
)

=== Exceções

#tab([UC-VID-003 — Exceções],
  tabela(
    colunas: (1fr, 1fr),
    [Condição], [Comportamento do Sistema],
    [E1 – Formato ou codec não suportado], [A ferramenta fica indisponível com _"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"_],
    [E2 – Duração ou tamanho excedem o limite desta ferramenta], [No passo 3, rejeita o pedido e apresenta o limite; no registado, sugere o premium],
    [E3 – Quota diária esgotada (registado)], [No passo 3, rejeita o pedido com _"Atingiu o limite de 5 operações diárias"_],
    [E4 – Parâmetro fora do intervalo permitido], [No passo 2, apresenta o intervalo permitido e mantém *Aplicar* desativado],
    [E5 – A resolução final excede o limite do perfil], [No passo 2, apresenta o limite aplicável e mantém *Aplicar* desativado],
    [E6 – O processamento falha a meio (por exemplo, um fotograma ilegível)], [Marca "Falhado", apresenta _"Não foi possível aplicar as ferramentas ao vídeo. Tente novamente."_, remove parciais, mantém o vídeo inalterado e não desconta quota],
    [E7 – Número máximo de pedidos ativos], [No passo 3, rejeita o pedido e indica que tem de aguardar ou cancelar um pedido ativo],
    [E8 – Espaço da biblioteca insuficiente], [No passo 5, se o resultado, em vez do vídeo atual, excede o espaço livre da biblioteca, marca "Falhado", apresenta o espaço livre, mantém o vídeo inalterado e não desconta quota],
    [E9 – O vídeo já tem um pedido em curso], [No passo 3, rejeita o pedido e indica que tem de aguardar que o pedido desse vídeo termine ou cancelá-lo],
  ),
)

=== Pós-condições

#tabela(
    colunas: (4cm, 1fr),
    [Tipo], [Resultado],
    [Garantia de Sucesso], [O vídeo foi substituído pelo resultado da cadeia aplicada a todos os fotogramas, com o mesmo nome, o mesmo número e taxa de fotogramas e o mesmo áudio; não foi criado outro vídeo; no registado, a quota desceu 1 operação],
    [Garantia Mínima], [O vídeo está inalterado; não existe vídeo parcial nem ficheiros temporários; a quota não mudou; o estado e o motivo são apresentados],
  )

=== Regras de Negócio e Restrições

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Regra],
    [RN1], [Formatos aceites: MP4 (H.264) e MOV; o resultado mantém o formato e o codec do original],
    [RN2], [Ferramentas aplicáveis: Redimensionar, Binarizar e Rodar (as avançadas, como OCR, não); cadeia de 1 a 3 ferramentas, aplicadas por ordem],
    [RN3], [Parâmetros: largura e altura de 16 a 3840 px; limiar de 0 a 255; rotação de 90°, 180° ou 270°],
    [RN4], [Resolução final até 1920 × 1080 px (registado) ou 3840 × 2160 px (premium)],
    [RN5], [Limites desta ferramenta: registado, vídeos até 2 min e 200 MB; premium, até 10 min e 2 GB],
    [RN6], [O resultado tem o mesmo número e taxa de fotogramas do original; o áudio é mantido inalterado],
    [RN7], [Registado: 5 operações/dia; premium: sem limite; anónimo: sem acesso. Um pedido conta 1 operação, qualquer que seja o número de ferramentas, só se "Concluído"],
    [RN8], [Pedidos ativos em simultâneo: 1 (registado) e 3 (premium), contando todas as ferramentas de vídeo],
    [RN9], [Receção do pedido confirmada em ≤ 2 s; progresso atualizado pelo menos a cada 5 s],
    [RN10], [O resultado substitui o vídeo, com o mesmo nome, só quando o pedido termina "Concluído"; até lá, e se o pedido falhar ou for cancelado, o vídeo mantém-se inalterado. Um vídeo só pode ter um pedido ativo de cada vez],
    [RN11], [O vídeo alterado passa a ocupar na biblioteca de vídeo (1 GB registado, 10 GB premium) o tamanho do resultado e mantém-se até o utilizador o remover],
  )

=== Assunções

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Assunção],
    [A1], [A importação está em UC-VID-002 e a exportação do resultado segue UC-VID-001],
    [A2], [As ferramentas de imagem existentes podem ser aplicadas fotograma a fotograma com os mesmos parâmetros],
    [A3], [O áudio não é processado, apenas copiado],
    [A4], [Um vídeo de 2 min a 1920 × 1080 px e 30 fotogramas/s é processado em ≤ 10 min (alvo MVP do REQ-VID-APPLY-035)],
    [A5], [O vídeo tem resolução constante em todos os fotogramas],
    [A6], [Os limites de duração, tamanho e resolução desta ferramenta são valores iniciais de MVP, fixados pelo custo de processamento e sem dados reais de utilização (ver DQ-007)],
  )

=== Questões em Aberto

#tabela(
    colunas: (1.6cm, 1fr, 5cm),
    [ID], [Questão], [Resolução],
    [Q1], [Um pedido deve contar 1 operação, 1 por ferramenta da cadeia ou em função dos fotogramas?], [Decidida: 1 operação por pedido, qualquer que seja a cadeia → RNG-04.],
    [Q2], [As ferramentas avançadas (por exemplo, contagem de pessoas) devem poder ser aplicadas a vídeo?], [Adiada: fora do MVP (UC-VID-003/RN2); reavaliar na Fase 3.],
    [Q3], [Deve ser possível aplicar a mesma cadeia a vários vídeos, como se faz com imagens?], [Adiada: o lote fica fora do MVP (5.3); reavaliar na Fase 3.],
    [Q4], [Os limites de resolução final devem considerar a orientação do vídeo? Hoje aplicam-se literalmente à largura e à altura, pelo que rodar um vídeo 1920 × 1080 para 1080 × 1920 excede a altura permitida ao registado.], [Adiada: mantém-se a interpretação literal (UC-VID-003/RN4).],
    [Q5], [Deve ser possível desfazer a aplicação de ferramentas, guardando a versão anterior do vídeo?], [Adiada: no MVP a substituição é definitiva (RNG-09), como no UC-VID-001/Q6; reavaliar na Fase 3.],
  )
