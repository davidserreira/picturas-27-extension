#import "../template.typ": *

= Impacto no Sistema Existente

A tabela lista os elementos do PictuRAS e do documento de requisitos de base afetados. Os requisitos de base RF1–RF38 não constam do documento de 2025/26 (que só traz RF39 em diante); por isso, quando o elemento afetado não tem ID nesse documento, é identificado pelo nome.

#tab([Impacto no sistema existente],
  tabela(
    colunas: (3.4cm, 1.8cm, 1fr, 2.2cm, 3.2cm),
    tamanho: 8.5pt,
    [Elemento existente afetado], [Impacto], [Descrição do impacto], [Caso(s) de uso], [Requisitos],
    [Limite diário de operações (RNF48)], [Alterar], [Passa a contar pedidos de vídeo: 1 operação por pedido concluído, qualquer que seja a cadeia; importar não conta; a operação é reservada ao submeter e devolvida se o pedido não concluir.], [UC-VID-001, 002, 003], [JOB-008, JOB-009, IMPORT-021],
    [Perfis de utilização (anónimo, registado, premium)], [Estender], [Passam a ter limites de vídeo (duração, tamanho, resolução, armazenamento, pedidos e importações ativos); o anónimo não tem acesso.], [UC-VID-001, 002, 003], [ACCESS-004, 005; TRIM-005, 006; IMPORT-004, 012; APPLY-005, 007, 008; JOB-007],
    [Processamento de operações (fila e ferramentas)], [Estender], [Passa a suportar operações demoradas e assíncronas, com estados, progresso, cancelamento e deteção de pedidos parados.], [UC-VID-001, 003], [JOB-001, 002, 003, 010, 012, 013; PROCESS-001 a 004],
    [Ferramentas básicas de imagem], [Estender], [Redimensionar, binarizar e rodar passam a ser aplicadas a todos os fotogramas, com a mesma implementação.], [UC-VID-003], [APPLY-002, 013, 036],
    [Ferramentas avançadas (OCR, contagem, objetos)], [Manter], [Não são aplicáveis a vídeo no MVP.], [UC-VID-003], [APPLY-002],
    [Encadeamento de ferramentas], [Estender], [A cadeia passa a poder ser aplicada a vídeo, com no máximo 3 ferramentas, ordenáveis. O recorte não entra na cadeia.], [UC-VID-003, 001], [APPLY-003, 013, 029, 030],
    [Processamento em lote (.zip ou diretoria)], [Manter], [Fora do MVP para vídeo.], [UC-VID-001, 002, 003], [—],
    [Adicionar imagens e biblioteca do projeto], [Estender], ["Importar vídeo" ao lado de "Adicionar imagens"; imagens e vídeos na mesma grelha; vídeos removíveis.], [UC-VID-002], [IMPORT-001, 015, 025],
    [Visualizador do projeto (grelha e carrossel) e barra de ferramentas], [Estender], [O vídeo abre no visualizador, como as imagens; a barra mostra as ferramentas de vídeo quando um vídeo está aberto. Ao abrir um vídeo, são apresentadas as suas faixas de vídeo e de áudio numa linha temporal sincronizada com o leitor (v1.3). Na v1.5, o intervalo do recorte é selecionado sobre essas faixas.], [UC-VID-001, 002, 003], [TRIM-001, APPLY-001; LIB-003 a 008; TRIM-034],
    [Armazenamento de objetos], [Estender], [Guarda vídeos grandes com limite por perfil, conta os resultados na ocupação e nunca expõe parciais.], [UC-VID-001, 002, 003], [IMPORT-005, 026; LIB-001, 002; JOB-004, 005],
    [Exportação (descarregar)], [Estender], [Passa a descarregar vídeo, por endereço com validade limitada.], [UC-VID-001, 003], [TRIM-021; ACCESS-002],
    [Segurança e privacidade dos dados (RNF44)], [Manter], [Acesso só do dono, endereços assinados e cifra em repouso aplicam-se também ao vídeo.], [UC-VID-001, 002, 003], [ACCESS-001, 002, 003],
    [Partilha de projetos por link (RF45)], [Manter], [Os vídeos não são mostrados nem editados por quem abre o projeto por link; a biblioteca de vídeo é só do dono.], [UC-VID-001, 002, 003], [ACCESS-001, ACCESS-004],
    [Mensagens de erro uniformes (correção T-02 da equipa 2025/26)], [Manter], [Reutilizadas nas mensagens de vídeo.], [UC-VID-001, 002, 003], [USAB-001],
  ),
)

_Conflitos resolvidos entre funcionalidades._ (1) O recorte e a aplicação de ferramentas tinham limites de pedidos ativos e regras de quota escritos em separado; foram unificados em JOB-007 a JOB-009 (RNG-04, RNG-05), contando todas as ferramentas em conjunto. (2) A importação aceita vídeos até 5 min, mas a aplicação de ferramentas só até 2 min (registado): importar não garante poder aplicar ferramentas; o limite é apresentado na rejeição (APPLY-007). (3) A partilha por link (RF45) daria acesso a vídeos a terceiros; decidiu-se manter a biblioteca de vídeo só do dono no MVP. (4) Na v1.4, o resultado de uma ferramenta passa a substituir o vídeo; um recorte e uma aplicação de ferramentas em curso sobre o mesmo vídeo substituir-se-iam um ao outro, por isso só é permitido um pedido ativo por vídeo, e o vídeo não pode ser removido durante o pedido (JOB-015).
