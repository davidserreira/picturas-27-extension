# Suite de regressão da Fase 2

Demonstra que a funcionalidade existente, de imagem e de vídeo, se mantém depois do refactoring
(requisito 6 das diretrizes da Fase 2; secção 4.4 de `../requisitos-nf.md`). Corre na solução de
base, antes de qualquer alteração (`baseline.md`), e outra vez no fim (`final.md`).

## Composição

| Suite | Origem | Onde corre | O que cobre |
| --- | --- | --- | --- |
| Worker de vídeo | Existente: `Tools/video/tests` (pytest) | Na imagem `video_tool` | Leitura do vídeo, efeitos por fotograma, corte, velocidade, som, pré-visualização, falhas sem saída parcial, legendas (com o reconhecimento de fala simulado) e extração de fotogramas |
| Orquestrador | Existente: `projects/tests` (`node --test`) | Na imagem `projects` | Registo do lote antes do envio, cancelamento contra um commit atrasado, pipeline de vídeo por media, regras e manifesto da extração |
| Ponta a ponta | Nova: `e2e.mjs` | No anfitrião, contra a stack a correr | O sistema completo pelo nginx, a API e o WebSocket (tabela seguinte) |
| Interface | Nova: `ui.mjs` (Playwright) | No anfitrião, contra a stack a correr | Importar, aplicar e cancelar no browser |

Os testes existentes são unitários: não passam pelo gateway, pelo armazenamento, pelas ferramentas
de imagem nem pela interface, que são precisamente as partes que os dois requisitos alteram. É
por isso que se acrescentam as suites ponta a ponta e de interface.

### Testes ponta a ponta

| ID | Área | Verifica |
| --- | --- | --- |
| T01 | Contas | Registo, início de sessão e validação do JWT |
| T02 | Carregamento | Imagem aceite, listada e guardada sem alteração (SHA-256) |
| T03 | Carregamento | MP4 e MOV aceites, metadados lidos, ficheiros guardados sem alteração |
| T04 | Carregamento | Recusas: vídeo no endpoint de imagem, imagem no de vídeo, ficheiro corrompido, nome repetido, vídeo acima do limite gratuito, anónimo |
| T05 | Pipeline de imagem | As 8 ferramentas de imagem e o watermark, uma a uma; SHA-256 de cada resultado |
| T06 | Pipeline de imagem | Quatro ferramentas encadeadas em lote sobre duas imagens |
| T07 | Pipeline de imagem | Transferência dos resultados em ZIP |
| T08 | Pré-visualização | Pré-visualização de imagem e de vídeo entregue pelo WebSocket |
| T09 | Vídeo | Efeitos de cor e de geometria em vídeo; resolução final calculada |
| T10 | Vídeo | Corte e velocidade: duração (3 s) e som do resultado |
| T11 | Vídeo | Legendagem real (Faster-Whisper) num vídeo com fala; vídeo sem som processado sem erro |
| T12 | Vídeo | Extração por número (PNG) e por intervalo (JPEG), um resultado por fotograma |
| T13 | Vídeo | Extração sempre no fim e uma só vez |
| T14 | Projetos mistos | O mesmo efeito em imagem e vídeo; o corte do vídeo não toca na imagem |
| T15 | Projetos mistos | Ferramentas incompatíveis com o tipo de media recusadas |
| T16 | Cancelamento | Cancelar a meio: sem resultados, e o projeto volta a processar |
| T17 | Quotas | Perfil gratuito: uma operação por efeito e por vídeo; o limite diário recusa a execução seguinte |
| T18 | Acesso | Projetos e media de outro utilizador inacessíveis |

### Comparação com a base

Cada teste ponta a ponta regista uma impressão do que produziu: SHA-256 das imagens; duração,
resolução, codec e som dos vídeos; número, tipo e formato dos fotogramas; códigos e mensagens de
recusa. A corrida da base grava essas impressões em `referencia.json`. A corrida final compara-as,
e um teste que passe com uma impressão diferente fica marcado como "diferente da referência". Não
conta como falha automática, porque uma diferença pode ser intencional, mas tem de ser explicada
no relatório.

## Como correr

Pré-requisitos: os mesmos de `../medicoes/README.md`, com a stack a correr e os dados de
`../medicoes/dados/` gerados. A suite gera os seus próprios vídeos em `dados/` (um excerto de 25 s
de `samples/video/speech_mandela_177s_1080p.webm`, um vídeo sem som e um de 60 s).

```bash
cd Docs/fase2/regressao
npm install && npx playwright install chromium   # uma vez
REGRESSAO=baseline ./correr.sh                   # ou REGRESSAO=final
```

O resultado fica em `<modo>.md`, e os dados em bruto em `resultados/`. A primeira legendagem
descarrega o modelo de fala para o volume `whisper_models`, o que precisa de rede e demora alguns
minutos.

## Limitações

- O resultado do `watermark` compara-se pelo formato e pelas dimensões: a ferramenta é uma imagem
  pública de terceiros e os bytes de saída variam entre execuções.
- Os resultados de vídeo comparam-se pelos metadados (duração, resolução, codec, som), e não byte
  a byte, porque a codificação H.264 não garante bytes iguais entre execuções.
- Nos testes ponta a ponta, as ferramentas de IA só entram pelo watermark. As outras não são
  tocadas pelos dois requisitos e carregam modelos pesados.
- A legendagem verifica que o vídeo com fala sai diferente do original e com a mesma duração, mas
  não lê o texto das legendas.
