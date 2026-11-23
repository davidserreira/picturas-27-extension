#import "../template.typ": *

= Alternativas e Matriz de Comparação

== Alternativas consideradas

#tab([Alternativas consideradas],
  tabela(
    colunas: (1.6cm, 3.4cm, 1fr, 3cm, 2.8cm),
    tamanho: 8.5pt,
    [ID], [Nome / padrão], [Descrição breve], [Mantém ou altera o padrão global?], [Fonte],
    [ALT-1], [_Competing Consumers_], [Várias réplicas do `video_tool` a consumir a mesma `video_queue`, com uma fila própria para a legendagem], [Mantém: as réplicas são o mecanismo de escala do padrão global], [Hohpe e Woolf, _Enterprise Integration Patterns_],
    [ALT-2], [_Pipes and filters_ distribuído para o vídeo], [Um microsserviço por efeito de vídeo, encadeados pelo orquestrador, como as imagens], [Mantém: é o padrão global aplicado ao vídeo], [Buschmann et al., _POSA_, vol. 1],
    [ALT-3], [Tarefas efémeras coordenadas por um orquestrador de _workflow_ (_Process Manager_)], [Uma tarefa (contentor) por vídeo, lançada e acompanhada por um orquestrador de _workflow_ externo], [Altera em parte: a coordenação do vídeo sai do `projects`], [Hohpe e Woolf, _Enterprise Integration Patterns_],
    [Referência], [Monólito modular], [Um só processo com módulos internos para imagem e vídeo], [Altera: é o termo de comparação ao próprio padrão global], [_Template_ do Exercício 6 (termo de comparação)],
  ),
)

== Análise de cada alternativa

*ALT-1 — _Competing Consumers_*

#tabela-campos(
  [Coerência com o padrão global], [Total: o worker já não guarda estado entre mensagens, e a fila distribui o trabalho pelas réplicas sem mudar o orquestrador],
  [Efeito nos atributos de qualidade], [Capacidade ↑ (vários vídeos em paralelo); recuperabilidade ↑ (uma réplica que cai não para as outras); utilização de recursos ↓ (cada réplica carrega o seu modelo Faster-Whisper); operabilidade = (o estado da execução continua só no browser)],
  [Vantagens potenciais], [Resolve a espera atrás de uma legendagem longa (EV-12) com uma alteração sobretudo de configuração: réplicas e uma fila nova],
  [Desvantagens ou riscos], [*H-01*: os ganhos de capacidade são proporcionais aos núcleos disponíveis e a memória do Whisper multiplica-se pelas réplicas; não medido. Os resultados dependem muito da máquina],
  [Custo e risco de migração (a funcionalidade existente tem de ser preservada)], [Baixo a médio: o worker e as mensagens ficam iguais; o risco está no cancelamento e na ordem dos resultados com várias réplicas],
)

*ALT-2 — _Pipes and filters_ distribuído para o vídeo*

#tabela-campos(
  [Coerência com o padrão global], [Total: o vídeo passaria a seguir exatamente o caminho das imagens (EV-11)],
  [Efeito nos atributos de qualidade], [Modularidade ↑ (reutiliza as ferramentas e elimina a duplicação, EV-05); comportamento temporal ↓ e utilização de recursos ↓ (codificar e guardar o vídeo entre efeitos); fiabilidade \~ (mais pontos de falha, mas isolados)],
  [Vantagens potenciais], [Um efeito novo serve imagem e vídeo; cada efeito escala sozinho],
  [Desvantagens ou riscos], [*H-02*: codificar o vídeo entre efeitos aumenta o tempo total e pode degradar a qualidade; não medido],
  [Custo e risco de migração], [Alto: reescreve o processamento de vídeo e a orquestração; risco alto de mudar os resultados (duração, codec, som, SHA-256)],
)

*ALT-3 — Tarefas efémeras coordenadas por um orquestrador de _workflow_*

#tabela-campos(
  [Coerência com o padrão global], [Parcial: a coordenação do vídeo passa para um componente externo ao `projects`],
  [Efeito nos atributos de qualidade], [Elasticidade ↑ (uma tarefa por vídeo); recuperabilidade ↑ (repetição por tarefa); operabilidade ↑ (o _workflow_ guarda o estado); segurança ↓ (acesso ao motor de contentores)],
  [Vantagens potenciais], [Elasticidade real e estado de cada tarefa num só sítio],
  [Desvantagens ou riscos], [*H-03*: exige acesso ao motor de contentores ou a um orquestrador externo, o que alarga a superfície de ataque; não medido. Arranque de um contentor por vídeo],
  [Custo e risco de migração], [Alto: infraestrutura nova e dois donos da orquestração durante a migração],
)

O monólito modular serve só de termo de comparação: perderia o isolamento de falhas e a escala por serviço que o padrão global oferece, e não resolve nenhuma das fragilidades medidas.

== Matriz de comparação de padrões

Escala: ↑ Alto, \~ Médio, ↓ Baixo, do ponto de vista da qualidade (↑ é melhor). As avaliações das colunas da base assentam em evidências; as das alternativas são hipóteses, porque nenhuma foi implementada nem medida.

#paisagem[
#tab([Matriz de comparação de padrões],
  tabela(
    colunas: (3.4cm, 3.5cm, 3.5cm, 3.5cm, 3.5cm, 3.5cm, 1fr),
    tamanho: 7.5pt,
    [Atributo de qualidade (ISO/IEC 25010)], [Padrão global atual (referência)], [Padrão atual do vídeo], [ALT-1], [ALT-2], [ALT-3], [Monólito modular],
    [Relação com o padrão global], [—], [Afasta-se em parte], [Mantém], [Mantém], [Altera em parte], [Altera],
    [Eficiência: comportamento temporal], [\~ Médio — a latência das filas é desprezável face a minutos de processamento, mas o carregamento é lento: cada serviço espera pelo ficheiro inteiro (EV-13)], [↑ Alto — uma codificação por vídeo (EV-02, EV-05)], [↑ Alto — igual por vídeo (H-01)], [↓ Baixo — codifica entre efeitos (H-02)], [\~ Médio — arranque de cada tarefa (H-03)], [↑ Alto — sem rede interna],
    [Eficiência: capacidade / elasticidade], [↑ Alto — escala por serviço (EV-11)], [↓ Baixo — um vídeo de cada vez (EV-12)], [↑ Alto — vários vídeos em paralelo (H-01)], [\~ Médio — escala por efeito (H-02)], [↑ Alto — uma tarefa por vídeo (H-03)], [↓ Baixo — escala em bloco],
    [Eficiência: utilização de recursos], [↓ Baixo — o ficheiro inteiro em memória em cada serviço; +2001 MiB com 500 MiB (EV-13)], [\~ Médio — um processo, sem disco intermédio (EV-05)], [↓ Baixo — uma cópia do modelo Whisper por réplica (H-01)], [↓ Baixo — disco intermédio por efeito (H-02)], [\~ Médio — recursos por tarefa (H-03)], [↑ Alto — um processo],
    [Fiabilidade: tolerância a falhas / recuperabilidade], [↑ Alto — falhas isoladas por ferramenta (EV-11)], [\~ Médio — sem saída parcial (EV-20), mas o progresso perde-se (EV-04)], [↑ Alto — uma réplica cai, as outras continuam (H-01)], [\~ Médio — mais pontos de falha (H-02)], [↑ Alto — repetição por tarefa (H-03)], [↓ Baixo — uma falha derruba tudo],
    [Manutenibilidade: modularidade / modificabilidade], [↑ Alto — uma ferramenta por contentor (EV-11)], [↓ Baixo — efeitos reimplementados (EV-05)], [\~ Médio — igual ao vídeo atual], [↑ Alto — reutiliza as ferramentas (H-02)], [\~ Médio — mais infraestrutura (H-03)], [\~ Médio — módulos sem fronteiras de serviço],
    [Segurança], [\~ Médio — JWT só no gateway; confiança no cabeçalho do gateway; sala do projeto sem verificação (EV-07, EV-15)], [\~ Médio — igual ao global], [\~ Médio — igual], [\~ Médio — mais superfície entre serviços], [↓ Baixo — acesso ao motor de contentores (H-03)], [↑ Alto — menos superfície],
    [Usabilidade: operabilidade], [↓ Baixo — o estado da execução só existe no browser (EV-03)], [↓ Baixo — o progresso não passa pelo orquestrador (EV-04)], [\~ Médio — menos espera; não resolve o estado], [\~ Médio — igual ao global], [↑ Alto — o _workflow_ guarda o estado (H-03)], [\~ Médio — estado num só processo, mas ainda só no browser],
  ),
)
]

== Adequação do padrão atual

O padrão global serve o PictuRAS: isola as falhas de cada ferramenta, escala por serviço e não faz esperar o cliente pelo processamento. O padrão do vídeo justifica-se pelo custo de codificar: nenhuma alternativa melhora o comportamento temporal, e a ALT-2, que o alinharia com o global, piora-o. Mas o padrão atual é menos adequado em dois pontos, que nenhuma alternativa resolve sozinha. O primeiro é o carregamento: o padrão global foi mal aplicado, porque cada serviço guarda o ficheiro inteiro antes de o passar ao seguinte (EV-13), e isso corrige-se dentro do padrão, sem trocar de padrão. O segundo é a operabilidade: o progresso do vídeo não passa pelo orquestrador (EV-04), e só a ALT-3 o resolveria, com um custo e um risco que esta fase não justifica. A conclusão é manter os dois padrões e corrigir as duas fragilidades por _refactoring_ dentro deles: são os candidatos do capítulo 6. A capacidade (ALT-1) fica como melhoria seguinte (capítulo 11).
