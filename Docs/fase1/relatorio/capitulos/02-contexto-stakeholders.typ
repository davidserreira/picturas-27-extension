#import "../template.typ": *

= Contexto, Perfis e _Stakeholders_ (revisão)

== Perfis de utilização e vídeo

#tab([Perfis de utilização e respetivo acesso a vídeo],
  tabela(
    colunas: (2.4cm, 3.6cm, 1fr, 2.6cm),
    [Perfil], [Situação na _baseline_], [Alteração introduzida para vídeo], [Regras / requisitos],
    [Anónimo], [Operações limitadas, imagens pequenas], [Sem acesso a vídeo; é informado de que precisa de uma conta.], [RNG-02; ACCESS-004, ACCESS-005],
    [Registado], [Gratuito, até 5 operações/dia], [Vídeos até 5 min e 200 MB (aplicar ferramentas: 2 min, resolução final 1920 × 1080); biblioteca de vídeo de 1 GB; 1 pedido e 1 importação ativos; cada pedido concluído conta 1 operação.], [RNG-03 a RNG-06; JOB-007, JOB-008, JOB-009],
    [Premium], [Pago, uso ilimitado], [Vídeos até 30 min e 2 GB (aplicar ferramentas: 10 min, 3840 × 2160); biblioteca de 10 GB; 3 pedidos e 3 importações ativos; sem quota diária.], [RNG-03, RNG-05, RNG-06],
  ),
)

== _Stakeholders_ e interesses

#tab([_Stakeholders_ e interesses (novos ou revistos)],
  tabela(
    colunas: (3cm, 1.6cm, 1fr, 1.8cm, 2.6cm),
    [_Stakeholder_], [Estado], [Interesse(s) relativamente ao vídeo], [Influência], [UC / requisitos],
    [Utilizador (registado ou premium)], [Revisto], [Carregar vídeos sem os perder a meio, obter o trecho ou a transformação certos sem esperar ao ecrã, editar o próprio vídeo sem acumular cópias e nunca o perder por uma falha do processamento.], [Alta], [UC-VID-001, 002, 003],
    [Proprietário do Sistema], [Revisto], [Controlar o custo de processamento e de armazenamento por perfil; incentivar a subscrição premium.], [Alta], [RNG-03 a RNG-06; JOB-007, JOB-008],
    [Equipa de Operações], [Novo], [Não ter ficheiros parciais em armazenamento; pedidos nunca presos em processamento.], [Média], [UC-VID-001; JOB-004, JOB-005, PROCESS-002],
    [Equipa de Desenvolvimento], [Novo], [Reutilizar as ferramentas de imagem e o encadeamento existentes; acrescentar ferramentas de vídeo sem alterar as que existem.], [Média], [UC-VID-002, UC-VID-003; TOOLS-001, APPLY-036],
  ),
)

== Elicitação de requisitos

As funcionalidades e as regras resultaram da *análise da solução existente* (documento de requisitos e de arquitetura de 2025/26 e código do repositório de partida), do enunciado e dos exemplos de casos de uso fornecidos nas aulas, e de *introspeção* da equipa sobre o que um utilizador espera de um editor de vídeo simples. Não houve entrevistas com utilizadores externos. Os valores numéricos têm três origens identificáveis: (1) a _baseline_, como a quota de 5 operações/dia (RNF48); (2) o guia da secção 4, como a confirmação em ≤ 2 s e o progresso a cada ≤ 5 s (RNG-07); (3) decisões da equipa registadas como assunções e decisões de qualidade, como os limites de duração, tamanho e armazenamento (UC-VID-001/A4, UC-VID-002/A5, UC-VID-003/A6, DQ-007). A implementação foi usada para validar esses valores: por exemplo, a confirmação mediu 0,04 s e o progresso 2,1 s (TST-TRIM-03 e TST-TRIM-05). #preencher[acrescentar, se houve, conversas com colegas, docentes ou outros utilizadores]
