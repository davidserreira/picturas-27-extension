# Medições da Fase 2

Scripts que medem os dois requisitos não funcionais de `../requisitos-nf.md` (RNF-F2-01 e
RNF-F2-02) e os respetivos controlos de efeitos colaterais. Os mesmos scripts servem para a medição
inicial (`baseline/`) e para a final (`final/`). Só usam a interface pública da aplicação
(`https://localhost:8080`) e a CLI do Docker, sem depender de código interno.

## Conteúdo

| Ficheiro | O que faz |
| --- | --- |
| `gerar-dados.mjs` | Gera os ficheiros de teste em `dados/` (não versionado) |
| `ambiente.mjs` | Regista máquina, sistema, versões e serviços em `<medição>/ambiente.json` |
| `rnf1/medir-memoria.mjs` | RNF-F2-01: M1.1 e controlos C1.1 a C1.7 (o C1.7 lê o filer do SeaweedFS em `localhost:9090`) |
| `rnf1/medir-limite.mjs` | RNF-F2-01: M1.2, com `rnf1/compose.limites.yaml` |
| `rnf2/medir.mjs` | RNF-F2-02: `calibrar`, `m21`, `m22`, `m23`, `controlos` (C2.1 a C2.5; com `--so c21`, só o C2.1 e o C2.2) |
| `rnf2/estado.mjs` | Verificação intermédia dos passos do ADR-02, sem browser: segue uma execução de P pela rota de estado e pelos eventos `run-status`, e verifica o C2.3 |
| `correr-tudo.sh` | Corre toda a série pela ordem certa |
| `resumo.mjs` | Junta os resultados em bruto em `<medição>/resumo.md` |
| `lib/comum.mjs` | Pedidos à API, envio de ficheiros em fluxo, amostragem de memória, estatística |
| `baseline/` | Resultados da medição inicial: JSON em bruto, `logs/`, `resumo.md` |
| `passos/` | Medições intermédias de cada passo do ADR-01 |
| `passos-rnf2/` | Verificações intermédias de cada passo do ADR-02 (`rnf2/estado.mjs` e, no passo 4, as medidas do RNF-F2-02 com uma execução) |
| `final/rnf-f2-01/` | Medição final do RNF-F2-01 no seu ramo, com o complemento e a comparação A/B do C2.1 (ver o `README.md` da pasta) |

## Pré-requisitos

- **Docker Desktop** (ou Docker Engine) com Compose v2. Na medição inicial: 12 CPUs e 7,6 GiB
  atribuídos ao Docker (os valores exatos ficam em `ambiente.json`).
- **Node.js 20 ou mais recente** no anfitrião. Testado com 24.11.
- **Bash** para `correr-tudo.sh` (no Windows, o Git Bash).
- **Playwright** para o RNF-F2-02:
  `cd rnf2 && npm install && npx playwright install chromium`.
- **ffmpeg não é preciso no anfitrião.** Os dados são gerados com o ffmpeg da imagem
  `picturas-projects`, que existe depois do primeiro `docker compose build`.
- **Cerca de 4 GB livres** para os dados e para os volumes da aplicação.

## Dados de teste

`node gerar-dados.mjs` cria, de forma determinística:

| Ficheiro | Uso | Características |
| --- | --- | --- |
| `upload-1000MiB.mp4` | M1.1, M1.2, C1.2 | 500 s, 1280×720, 30 fps, H.264 a débito constante (~16,5 Mbit/s) sobre `testsrc2` com ruído, para o codificador não o conseguir comprimir. Fica com 985 MiB, abaixo do limite premium de 1024 MiB |
| `upload-500MiB.mp4`, `upload-100MiB.mp4`, `upload-10MiB.mp4` | M1.1, M1.2, C1.1, C1.3, C1.6 | Cópias sem recodificar dos primeiros 254 s, 51 s e 5 s do anterior. O de 10 MiB fica com 10,8 MiB, por ter de cortar num fotograma-chave |
| `p-video-330s.mp4` | Projeto P do RNF-F2-02 | 330 s, 1280×720, 30 fps, `testsrc2` com som (seno de 440 Hz). Gerado com `node gerar-dados.mjs --video 330` |
| `imagem-p1.png`, `imagem-p2.png` | As duas imagens de P | 1280×720 |
| `imagem-q.png` | A imagem do projeto Q | 1280×720 |
| `imagem-nova.png` | Ações 7 e 9 da M2.1 | 1280×720 |

Para o C1.5 usam-se também os ficheiros de `samples/video/` do repositório. Os tamanhos exatos
ficam em `dados/manifesto.json`.

**Calibração do vídeo de P.** A especificação pede que uma execução de P dure entre 150 s e 300 s.
A primeira calibração (vídeo de 120 s) deu 208 s, mas na série noturna o mesmo vídeo deu só 101 s,
abaixo do intervalo. Recalibrou-se na mesma série: `calibrar --video 120` sugeriu 330 s, e
`calibrar --video 330` deu 223 s. As três execuções do C2.1 deram 267 s a 291 s. A medição final
usa o vídeo de 330 s, mesmo que a duração mude. Os resultados do RNF-F2-02 com o vídeo de 120 s
ficaram em `baseline/rnf2-primeira-tentativa/` e não contam.

## Como correr

1. **Arranque limpo da versão a medir**, na raiz do repositório:

   ```bash
   docker compose down -v --remove-orphans
   docker compose up -d --build
   ```

   Esperar até `https://localhost:8080` responder (cerca de um minuto depois de os contentores
   estarem de pé).

2. **Dados de teste**, uma vez:

   ```bash
   cd Docs/fase2/medicoes
   node gerar-dados.mjs
   node gerar-dados.mjs --video 330
   ```

3. **Série completa** (cerca de 2,5 h, sobretudo à espera do worker de vídeo):

   ```bash
   MEDICAO=baseline ./correr-tudo.sh     # ou MEDICAO=final
   ```

   Cada medida também pode correr sozinha, por exemplo
   `MEDICAO=final node rnf1/medir-memoria.mjs --reps 5 --sizes 1000`.

4. `node resumo.mjs` (já incluído no passo 3) gera `<medição>/resumo.md`.

**Ordem da série.** O envio de 1000 MiB sem limites de memória é o último passo. Na primeira
série da medição inicial, esse envio esgotou a memória atribuída ao Docker e o motor deixou de
responder, o que fez falhar todos os passos seguintes. A evidência está em
`ocorrencias/2026-11-16-queda-docker/`. Se voltar a acontecer, reinicia-se o Docker Desktop
(no Windows, também `wsl --shutdown`) antes de voltar a usar a stack.

Não usar a aplicação nem correr outras cargas pesadas na máquina durante a série.

## Como cada medida é obtida

### RNF-F2-01

- **Conta.** Premium, criada pelo registo. Na base, o serviço de utilizadores aceita o perfil no
  corpo do registo; os scripts usam esse atalho. Se a versão final o fechar, a conta passa a ser
  promovida pelo fluxo de subscrição, e isso fica documentado.
- **Envio.** `lib/comum.mjs` envia o ficheiro em `multipart/form-data` a partir do disco, em
  fluxo, para `POST /api-gateway/projects/:user/:project/video`. O script regista o instante em que
  o último byte sai do cliente e o instante em que chega a resposta. A aceitação (C1.1) é a
  diferença entre os dois; o envio completo (C1.2) vai do primeiro byte à resposta.
- **Memória (M1.1).** `docker stats` contínuo sobre `nginx`, `api_gateway`, `projects`,
  `img_storage` e `seaweedfs`, com uma amostra a cada 0,5 s por contentor. O valor em repouso é o
  mínimo dos 3 s anteriores ao envio; o pico é o máximo entre o início do envio e 1 s depois da
  resposta.
- **Antes de cada repetição** reiniciam-se `api_gateway`, `projects` e `img_storage`, depois o
  `nginx`, e esperam-se 15 s. O `nginx` é reiniciado porque guarda o endereço antigo dos serviços
  reiniciados e responderia 502.
- **Validade.** Uma repetição só conta se a resposta for 204 e nenhum dos quatro contentores do
  critério reiniciar durante o envio.
- **Limite (M1.2).** `compose.limites.yaml` limita os quatro contentores a 512 MiB, sem swap. A
  série sobe de tamanho e pára no primeiro que falhe. Um sucesso exige 204, nenhum contentor
  reiniciado ou terminado por falta de memória, o media no projeto e o mesmo SHA-256 no ficheiro
  devolvido. No fim, a stack é reposta sem os limites.
- **Integridade (C1.4).** O ficheiro guardado é descarregado pelo URL que a própria aplicação
  devolve (`GET .../imgs`) e o SHA-256 é comparado com o do original.

### RNF-F2-02

- **Browser.** Chromium do Playwright, sem interface, janela 1440×900. Cada execução é gravada em
  vídeo em `<medição>/videos/`, que não é versionado por ser grande.
- **Projetos.** P e Q são preparados pela API antes de cada execução, como a especificação define.
  A execução é iniciada pela interface (`Apply`).
- **Progresso de P.** É um elemento visível com papel `progressbar`, na página de P, ou junto ao
  nome de P noutra página. O valor lê-se de `aria-valuenow` quando o elemento o expõe. Na base,
  o componente `Progress` (`frontend/components/ui/progress.tsx`) não passa o valor ao elemento
  acessível, e por isso lê-se da posição do indicador (`translateX(-N%)`).
- **Notificação de fim (M2.2, F).** Uma região `status`, `alert` ou `aria-live` visível que
  contenha o nome de P.
- **Ações da M2.1.** São tentadas pela ordem da especificação, cada uma a partir do estado deixado
  pela anterior, com 10 s de limite. Depois de cada ação espera-se 0,5 s e verifica-se o progresso
  de P. A página da conta não tem a lista de projetos; a ação 6 usa o seu botão `Go Back`, como um
  utilizador faria.
- **Início da execução.** Ao abrir um projeto, a página faz `POST .../dirty`, que incrementa a
  versão do projeto. Um `Apply` clicado antes de a página reler o projeto leva a versão antiga e
  recebe 409, e a execução não começa. É um defeito de concorrência da base, que um utilizador
  rápido também encontra. O script espera pela resposta de `/dirty` e mais 3 s, confirma que o
  `Apply` recebeu 201 e, se receber 409, tenta mais uma vez. As tentativas e os conflitos ficam em
  `<medição>/rnf2-<comando>-apply.json`.
- **Worker livre.** Antes de cada execução, o script espera até a `video_queue` estar vazia e sem
  mensagens por confirmar (API de gestão do RabbitMQ, porta 15672). Assim, uma execução não herda
  o trabalho que uma anterior deixou no único worker de vídeo.
- **C2.3.** A base não tem rota para o estado de uma execução, por isso o controlo não se aplica.
  Na medição final passa-se a rota com `PICTURAS_STATE_PATH`. Com o ADR-02 a rota é
  `PICTURAS_STATE_PATH=/projects/{user}/{project}/process/status`.

### Se a interface mudar

Os critérios não mudam. Se a versão final mudar nomes de botões ou a estrutura, ajustam-se os
seletores na secção "UI" de `rnf2/medir.mjs`, e cada ajuste fica registado na tabela seguinte.

| Data | Seletor | Antes | Depois | Razão |
| --- | --- | --- | --- | --- |
| | | | | |

## Limitações do método

- A memória é lida pelo `docker stats` duas vezes por segundo, e um pico mais curto pode escapar.
  A M1.2 cobre esse caso.
- A M1.1 mede a memória do contentor (a que o kernel lhe atribui), o que inclui caches. É o valor
  que conta para um limite de memória, que é o que o requisito protege.
- O momento do último byte é o evento `finish` do pedido no cliente, que acontece quando o último
  byte é entregue ao sistema operativo. Os buffers de rede ficam incluídos no tempo de aceitação.
- O RNF-F2-02 é medido por um script. Mede se o controlo está disponível e em quanto tempo, e não a
  satisfação nem a facilidade de aprendizagem.
