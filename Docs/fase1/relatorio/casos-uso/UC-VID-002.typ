#import "../template.typ": *

== UC-VID-002 — Importar um vídeo para a biblioteca

=== Cabeçalho

#tab([Caso de uso UC-VID-002 — Importar um vídeo para a biblioteca],
  tabela-campos(
    [ID do Caso de Uso], [UC-VID-002],
    [Nome], [Importar um vídeo para a biblioteca],
    [Autores], [Todos os elementos da equipa],
    [Data], [2026-10-07 a 2026-10-21],
    [Objetivo], [Enviar um vídeo do dispositivo para o PictuRAS, acompanhar o envio e a validação e ficar com o vídeo disponível na biblioteca, podendo consultar as suas faixas de vídeo e de áudio],
    [Âmbito], [Módulo de vídeo do PictuRAS: biblioteca, envio de ficheiros, validação e armazenamento],
    [Ator Principal], [Utilizador Registado (gratuito, 5 operações/dia) ou Premium (pago, ilimitado)],
    [_Stakeholders_ e Interesses], [- *Utilizador*: quer carregar o vídeo sem o perder a meio e saber depressa se serve
- *Proprietário do Sistema*: quer controlar o custo de armazenamento por perfil
- *Equipa de Desenvolvimento*: quer uma importação única e reutilizável, de que dependem todas as ferramentas de vídeo],
    [Pré-condições], [- Sessão iniciada com perfil registado ou premium
- A biblioteca mostra as ações "Adicionar imagens" e "Importar vídeo"],
    [_Trigger_], [O utilizador clica em *Importar vídeo*, ao lado de *Adicionar imagens*],
  ),
)

=== Fluxo Principal

#tab([UC-VID-002 — Fluxo principal],
  tabela(
    colunas: (1.2cm, 1fr, 1fr),
    [Passo], [Ação do Ator], [Resposta do Sistema],
    [1], [Abre a biblioteca], [Apresenta *Adicionar imagens* e *Importar vídeo* lado a lado],
    [2], [Clica em *Importar vídeo* e seleciona um ficheiro do dispositivo], [Abre o seletor de ficheiros e valida a extensão e o tamanho do ficheiro escolhido],
    [3], [Clica em *Importar*], [Verifica o espaço livre e as importações ativas, cria o pedido "A carregar" e inicia o envio],
    [4], [Acompanha o envio (pode navegar para outras páginas)], [Apresenta a percentagem de progresso],
    [5], [—], [Passa a "A validar": verifica o formato e o codec reais, a legibilidade e a duração],
    [6], [—], [Guarda o vídeo, marca "Disponível" e apresenta-o na biblioteca com nome, duração e tamanho],
  ),
)

=== Fluxos Alternativos

#tab([UC-VID-002 — Fluxos alternativos],
  tabela(
    colunas: (4cm, 1fr),
    [Fluxo], [Descrição (passo de origem: condição → comportamento → retorno)],
    [FA1 – Utilizador premium], [No passo 2, se o perfil é premium → aplicam-se os limites de premium (30 min, 2 GB, 10 GB de armazenamento e 3 importações ativas)],
    [FA2 – Cancelar], [Nos passos 4 ou 5, o utilizador escolhe *Cancelar* → o sistema interrompe, marca "Cancelado", remove os ficheiros parciais e não cria vídeo],
    [FA3 – Retomar], [O pedido está "Interrompido" há menos de 1 h → o utilizador escolhe *Retomar* e seleciona o mesmo ficheiro → o sistema continua a partir do ponto já recebido],
    [FA4 – Consultar as faixas], [Depois do passo 6, o utilizador abre o vídeo na biblioteca → o sistema reproduz o vídeo e apresenta, num painel sob o leitor, numa linha temporal com a duração do vídeo, as suas faixas de vídeo (com fotogramas distribuídos ao longo da duração) e de áudio (com a forma de onda), cada uma com o codec e as características, e a posição de reprodução → o utilizador clica numa faixa → o sistema muda a reprodução para esse instante],
    [FA5 – Importar ao criar o projeto], [Em vez dos passos 1 a 3, o utilizador cria um projeto novo e junta um vídeo às imagens na área de submissão → o sistema cria o projeto com as imagens e inicia a importação do vídeo em segundo plano, como no passo 3 (um vídeo de cada vez; no perfil anónimo, apresenta _"O perfil anónimo não tem acesso a funcionalidades de vídeo. Crie uma conta para importar vídeos."_ (RN3) e não cria o projeto) → o fluxo continua no passo 4],
  ),
)

=== Exceções

#tab([UC-VID-002 — Exceções],
  tabela(
    colunas: (1fr, 1fr),
    [Condição], [Comportamento do Sistema],
    [E1 – O ficheiro não é MP4 (H.264) nem MOV], [Rejeita (extensão no passo 2, conteúdo no passo 5), apresenta _"Formato não suportado. Formatos aceites: MP4 (H.264) e MOV"_ e remove o que recebeu],
    [E2 – Tamanho ou duração excedem o limite do perfil], [No passo 2 (tamanho) não inicia o envio; no passo 5 (duração) rejeita e remove o ficheiro; apresenta o limite e, no registado, sugere o premium],
    [E3 – O ficheiro está corrompido ou ilegível], [No passo 5, apresenta _"Não foi possível ler este vídeo"_, marca "Falhado" e remove o ficheiro],
    [E4 – O tamanho excede o espaço livre da biblioteca de vídeo], [No passo 3, não cria o pedido e apresenta o espaço livre],
    [E5 – A ligação falha a meio do envio], [Marca "Interrompido" e mantém o parcial durante 1 h; sem retoma nesse prazo, remove o parcial e marca "Falhado"],
    [E6 – Número máximo de importações ativas], [No passo 3, rejeita o pedido e indica que tem de aguardar ou cancelar uma importação ativa],
    [E7 – As faixas não podem ser lidas], [No FA4, o vídeo continua a ser reproduzido e é apresentado _"Não foi possível ler as faixas deste vídeo."_; se só a forma de onda falhar, as faixas são apresentadas com _"Não foi possível obter a forma de onda"_],
  ),
)

=== Pós-condições

#tabela(
    colunas: (4cm, 1fr),
    [Tipo], [Resultado],
    [Garantia de Sucesso], [O vídeo está na biblioteca como "Disponível", com o ficheiro idêntico ao enviado; a ocupação da biblioteca foi atualizada; a quota diária não mudou],
    [Garantia Mínima], [Não foi criado vídeo; a ocupação e a quota não mudaram; não restam parciais (exceto os de uma importação "Interrompida", até 1 h); o estado e o motivo são apresentados],
  )

=== Regras de Negócio e Restrições

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Regra],
    [RN1], [Formatos aceites: MP4 (H.264) e MOV, validados pelo conteúdo do ficheiro],
    [RN2], [Limites: registado, vídeos até 5 min e 200 MB; premium, até 30 min e 2 GB],
    [RN3], [O perfil anónimo não tem acesso a funcionalidades de vídeo],
    [RN4], [Armazenamento da biblioteca de vídeo: 1 GB (registado) e 10 GB (premium), contando o tamanho atual de cada vídeo, também depois de alterado por uma ferramenta],
    [RN5], [Importações ativas em simultâneo: 1 (registado) e 3 (premium)],
    [RN6], [O envio inicia em ≤ 2 s após a confirmação; o progresso é atualizado pelo menos a cada 5 s],
    [RN7], [A importação não conta na quota diária de operações],
    [RN8], [O ficheiro parcial de uma importação interrompida é mantido 1 h e depois removido],
    [RN9], [Um vídeo "Disponível" mantém-se na biblioteca até o utilizador o remover; remover um vídeo liberta o espaço que ocupava],
    [RN10], [Faixas apresentadas: de vídeo (codec, resolução e fotogramas/s) e de áudio (codec, canais, frequência de amostragem e idioma, quando conhecido), numeradas por tipo (V1, A1, A2, …); capas e legendas não são faixas; um vídeo sem áudio apresenta "Sem faixa de áudio"],
    [RN11], [As faixas são lidas uma vez, na primeira abertura do vídeo, e guardadas com ele; a lista de faixas é apresentada em ≤ 2 s e a forma de onda de um vídeo até 5 min em ≤ 30 s],
    [RN12], [Num projeto não há dois vídeos com o mesmo nome: se já existir um vídeo com o nome do ficheiro importado, o vídeo recebe o primeiro número livre, "praia (2).mp4", "praia (3).mp4", …; a retoma (FA3) continua a reconhecer o ficheiro pelo nome original],
  )

=== Assunções

#tabela(
    colunas: (1.6cm, 1fr),
    [ID], [Assunção],
    [A1], [A biblioteca do projeto mostra imagens e vídeos na mesma grelha],
    [A2], [Importa-se um ficheiro de cada vez],
    [A3], [Não há verificação de vírus no MVP],
    [A4], [Na retoma, o ficheiro é reconhecido pelo nome, tamanho e resumo criptográfico],
    [A5], [Os limites de armazenamento (1 GB / 10 GB) e de importações ativas são valores iniciais de MVP, sem dados reais de utilização (ver DQ-007)],
    [A6], [O alvo de validação (REQ-VID-IMPORT-030) assume vídeos até 200 MB num único processador de validação],
    [A7], [A forma de onda é uma pré-visualização (a amplitude máxima de cada intervalo de 10 ms, reduzida a 50 pontos por segundo, entre 1000 e 20 000 pontos) e os fotogramas da faixa de vídeo são obtidos pelo browser; não substituem um editor de áudio nem de vídeo],
  )

=== Questões em Aberto

#tabela(
    colunas: (1.6cm, 1fr, 5cm),
    [ID], [Questão], [Resolução],
    [Q1], [Deve ser possível importar vários vídeos de uma vez ou um .zip, como nas imagens?], [Adiada: fora do âmbito do MVP (5.3); reavaliar na Fase 3.],
    [Q2], [A miniatura do vídeo deve ser gerada automaticamente após a importação?], [Adiada: a biblioteca mostra o primeiro fotograma obtido pelo browser; uma miniatura gerada no servidor fica para a Fase 3.],
    [Q3], [O perfil anónimo deve poder importar vídeos pequenos?], [Decidida: não → RNG-02 (RN3).],
    [Q4], [Antes de produção, deve existir verificação de vírus ou de conteúdo dos ficheiros importados (ver A3)?], [Adiada para antes de produção (Fase 3); mantém-se a assunção UC-VID-002/A3.],
    [Q5], [Deve ser possível editar as faixas (por exemplo, remover, silenciar ou substituir o áudio)?], [Adiada: no MVP as faixas só são consultadas (A7); reavaliar na Fase 3.],
  )
