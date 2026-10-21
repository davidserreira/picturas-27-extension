#import "../template.typ": *

= Visão Geral da Extensão de Vídeo

== Funcionalidades de vídeo do MVP

#tab([Funcionalidades de vídeo do MVP],
  tabela(
    colunas: (1fr, 2.1cm, 2.6cm, 1.8cm, 2.4cm, 2.6cm),
    [Funcionalidade], [Caso de uso], [Prefixo(s) REQ], [Perfis], [Dependências], [Estado de implementação],
    [Importar um vídeo para a biblioteca e consultar as suas faixas], [UC-VID-002], [IMPORT, LIB, ACCESS], [Reg., Prem.], [—], [Implementada (faixas num painel sob o vídeo no visualizador)],
    [Recortar um vídeo e exportar o resultado], [UC-VID-001], [TRIM, JOB, LIB, ACCESS], [Reg., Prem.], [UC-VID-002], [Implementada],
    [Aplicar ferramentas de imagem a todos os fotogramas], [UC-VID-003], [APPLY, JOB, LIB, ACCESS], [Reg., Prem.], [UC-VID-002; JOB (com UC-VID-001)], [Implementada],
  ),
)

Os requisitos comuns (PROCESS, ACCESS-001 a 003, COMPAT, USAB, TOOLS e PORT) aplicam-se às três funcionalidades.

*Justificação no contexto do MVP.*

- *UC-VID-002 — Importar um vídeo para a biblioteca*: sem importação não há vídeo no sistema; todas as outras funcionalidades dependem dela. Valida o envio de ficheiros grandes com retoma, a validação de formato e de limites por perfil e o armazenamento. Além disso, abrir um vídeo da biblioteca apresenta as suas faixas de vídeo e de áudio (FA4), o que mostra ao utilizador o conteúdo real do ficheiro e permite confirmar, num resultado, que o áudio foi mantido (UC-VID-003/RN6).
- *UC-VID-001 — Recortar um vídeo e exportar o resultado*: a edição de vídeo mais básica; valida parâmetros do utilizador, processamento demorado com estados, impacto na quota e exportação.
- *UC-VID-003 — Aplicar ferramentas de imagem a todos os fotogramas*: responde à pergunta central do enunciado — o que significa uma ferramenta aplicada a um vídeo — e valida a reutilização das ferramentas de imagem e do encadeamento existentes.

*Evolução do âmbito durante a implementação.* O que acontece ao vídeo quando uma ferramenta conclui mudou três vezes, à medida que a equipa usou a aplicação; cada mudança está no registo de decisões (`Docs/registo-ia-trim.md`, D28 e D34 a D40).

#tabela(
    colunas: (1.4cm, 1fr, 1fr),
    tamanho: 8.5pt,
    [Fase], [Comportamento], [Motivo],
    [Inicial], [O resultado é um vídeo novo, "{nome}\_recorte" ou "{nome}\_editado"; o original nunca muda.], [Evitar perda de dados e permitir comparar o antes e o depois.],
    [1.ª alteração], [O resultado substitui o vídeo, com o mesmo nome, só quando o pedido conclui; um pedido ativo por vídeo (JOB-015).], [Ao usar a aplicação, a biblioteca enchia-se de cópias que contam para o limite de armazenamento (RNG-06); editar um vídeo deve funcionar como num editor. A garantia mínima mantém-se: falhas e cancelamentos não tocam no vídeo (DQ-002).],
    [2.ª alteração], [No recorte, o utilizador escolhe "manter o original" (cópia com nome numerado) ou substituir; recorte arrastando a seleção sobre as faixas e remoção de um intervalo do meio.], [Recuperar a segurança do comportamento inicial sem perder a substituição; escolher o intervalo onde se vê a imagem e o som.],
    [Versão final], [O resultado volta a substituir sempre; os controlos ficam só no painel da ferramenta; o painel mostra só o pedido em curso.], [Um único comportamento, sem "original" e "modificado", como num editor; menos código e menos casos de teste; um só caminho para cada ferramenta, como nas imagens. Desfazer uma substituição fica para a Fase 3 (UC-VID-001/Q6); até lá, exportar antes de editar guarda uma cópia.],
  )

Os nomes numerados ("praia (2).mp4") da 2.ª alteração mantêm-se na importação (IMPORT-032). Os IDs retirados pelo caminho (REQ-VID-TRIM-033) não são reutilizados (5.4).

== Diagrama de casos de uso (atualizado)

#figure(
  image("../images/diagrama_casos_uso.svg", width: 100%),
  caption: [Diagrama de casos de uso atualizado (Fase 1 — vídeo)],
)

Os casos de uso de imagem da _baseline_ mantêm-se, a cinzento. Os três casos de uso de vídeo, a laranja, são acessíveis aos atores *Registado* e *Premium*; para tornar isto explícito, o diagrama passa a distinguir o utilizador *Registado* (gratuito), que na _baseline_ estava implícito em *Utilizador*. O *Anónimo* não tem qualquer associação aos casos de uso de vídeo (RNG-02). A importação é pré-condição do recorte e da aplicação de ferramentas; não é um `include`, porque o vídeo pode ter sido importado noutra sessão.

== Modelo de domínio (atualizado)

#figure(
  image("../images/modelo_dominio.svg", width: 100%),
  caption: [Modelo de domínio atualizado (Fase 1 — vídeo); a cinzento, conceitos da _baseline_ (Preset, Sugestão IA e Assistente IA mantêm-se e foram omitidos)],
)

*Vídeo* é um conceito independente de *Imagem*, e não uma especialização: tem atributos próprios (duração, resolução, formato, codec, tamanho) e um ciclo de vida diferente (é importado e validado antes de ficar disponível). Um *Projeto* pode conter imagens e vídeos, apresentados na mesma biblioteca. Um vídeo é composto por *Fotogramas*; cada fotograma é tratado como uma *Imagem* (especialização), o que explica que as *Ferramentas Básicas* de imagem se lhe apliquem sem alteração. Um vídeo tem também uma ou mais *Faixas*, de vídeo ou de áudio, cada uma com codec e características próprias; as de áudio têm uma forma de onda, calculada uma vez e guardada com o vídeo (UC-VID-002/RN11). Como o processamento é demorado, introduz-se o *Pedido de processamento*, com estado e progresso, que usa uma *Ferramenta de vídeo* (Recortar ou Aplicar ferramentas) sobre um vídeo e, quando conclui, substitui o ficheiro desse vídeo pelo resultado (um pedido ativo por vídeo); a aplicação de ferramentas usa uma cadeia ordenada de 1 a 3 ferramentas básicas. A *Importação* representa o envio de um ficheiro e produz o vídeo quando termina. Os *Limites de vídeo* de cada perfil e a *Quota diária* do utilizador registado tornam explícitas as regras RNG-03 a RNG-06.

== Regras de negócio transversais

#tab([Regras de negócio transversais],
  tabela(
    colunas: (1.6cm, 1fr, 4cm, 3cm),
    tamanho: 8.5pt,
    [ID], [Regra], [Origem / justificação], [Requisitos],
    [RNG-01], [São aceites vídeos MP4 (H.264) e MOV; o resultado de uma ferramenta mantém o formato e o codec do original.], [Formatos mais comuns em câmaras e telemóveis e reproduzíveis no browser; evita conversões não pedidas (DQ-008).], [JOB-011],
    [RNG-02], [O perfil anónimo não tem acesso a funcionalidades de vídeo; os perfis registado e premium têm.], [Ficheiros grandes e processamento caro exigem uma conta associada (custo por perfil).], [ACCESS-004, 005],
    [RNG-03], [Limites gerais de vídeo: registado, até 5 min e 200 MB; premium, até 30 min e 2 GB. A aplicação de ferramentas tem limites próprios (UC-VID-003/RN5).], [Valores iniciais de MVP fixados pela equipa, sem dados reais de utilização (UC-VID-001/A4; DQ-007).], [IMPORT-012; TRIM-005],
    [RNG-04], [Um pedido de processamento conta 1 operação da quota diária (5/dia no registado, partilhada com imagens), qualquer que seja a duração ou o número de ferramentas, e só se terminar "Concluído". Importar não conta.], [Reinterpretação para vídeo da regra "até 5 operações por dia" da baseline (RNF48): simples de explicar ao utilizador e não penaliza falhas do sistema.], [IMPORT-021; JOB-008, 009],
    [RNG-05], [Pedidos de processamento ativos em simultâneo: 1 (registado) e 3 (premium), em conjunto para todas as ferramentas. Importações ativas: 1 e 3, contadas à parte.], [Arbitragem de recursos de processamento por utilizador (DQ-007).], [JOB-007],
    [RNG-06], [Armazenamento da biblioteca de vídeo: 1 GB (registado) e 10 GB (premium), contando o tamanho atual de cada vídeo, também depois de alterado por uma ferramenta.], [Controla o custo de armazenamento por perfil (interesse do Proprietário do Sistema).], [IMPORT-026; LIB-002],
    [RNG-07], [A receção de um pedido é confirmada em ≤ 2 s e o progresso é atualizado pelo menos a cada 5 s.], [Valores do guia da secção 4; confirmados por medição na implementação (0,04 s e 2,1 s no recorte).], [JOB-012, 013],
    [RNG-08], [Vídeos importados e resultados mantêm-se até o utilizador os remover; o parcial de uma importação interrompida é mantido 1 h; os ficheiros temporários do processamento são removidos no fim do pedido.], [Persistência e expiração dos ficheiros (tópico do Exercício 2).], [IMPORT-019; LIB-001],
    [RNG-09], [O resultado de uma ferramenta substitui o vídeo a que foi aplicada, com o mesmo nome, só quando o pedido termina "Concluído"; até lá, e se o pedido falhar ou for cancelado, o vídeo mantém-se inalterado. Um vídeo só pode ter um pedido ativo de cada vez.], [Decisão da equipa, confirmada no fim da implementação: editar o vídeo em vez de acumular cópias na biblioteca (ver 3.1, evolução do âmbito). Substituir só no fim mantém a garantia mínima (DQ-002); um pedido por vídeo impede que dois resultados se substituam. Inicialmente, o resultado era um novo vídeo "{nome}\_{sufixo}".], [APPLY-020; JOB-014, 015; TRIM-016],
  ),
)

== Convenções de identificação

#tabela(
    colunas: (4.2cm, 1fr),
    [Identificador], [Utilização],
    [UC-VID-nnn], [Caso de uso de vídeo (numeração única no relatório, a partir de UC-VID-001)],
    [REQ-VID-{FUNC}-nnn], [Requisito (funcional ou não funcional). {FUNC}: TRIM, IMPORT e APPLY (uma funcionalidade); JOB (pedidos de processamento comuns), LIB (biblioteca), ACCESS, PROCESS, COMPAT, USAB, TOOLS e PORT (áreas do serviço). IDs nunca se reutilizam (ver 5.4)],
    [{FUNC}-nnn], [Forma abreviada de REQ-VID-{FUNC}-nnn em tabelas estreitas (e.g., JOB-007)],
    [RNk, Ak, Qk, FAk, Ek], [Regra, assunção, questão em aberto, fluxo alternativo e exceção de um caso de uso (locais; qualificados nas tabelas partilhadas, e.g. UC-VID-001/RN2)],
    [RNG-nn / DQ-nnn], [Regra de negócio transversal / decisão de qualidade (globais)],
    [DA-nn], [Decisão arquitetural (capítulo 8)],
    [TST-{FUNC}-nn], [Teste automático; TST-{FUNC}-Mnn: teste manual ou de inspeção],
    [T-nn], [Tarefa de manutenção corretiva da solução de base],
    [UCnn, RFnn, RNFnn], [Elementos do documento de requisitos de base (referidos quando são alterados — ALT)],
  )
