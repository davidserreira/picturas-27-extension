#import "../template.typ": *

= Método de medição e preservação funcional

As regras deste capítulo valem para os dois requisitos. O pormenor está em `requisitos-nf.md` (secção 1), `medicoes/README.md` e `regressao/README.md`.

== Regras comuns

1. *Mesma máquina e mesmas condições.* A medição inicial e a final correm na mesma máquina, com a mesma versão do Docker e a mesma memória atribuída, ligada à corrente e sem outras cargas.
2. *Versão registada.* Cada resultado guarda o _hash_ do commit medido e as alterações por versionar.
3. *Arranque limpo.* Antes de cada série: `docker compose down -v --remove-orphans` e `docker compose up -d --build`, à espera de todos os serviços.
4. *Só se mede por fora.* Os scripts usam a interface pública (`https://localhost:8080`) e comandos do Docker, para servirem às duas versões sem depender do código interno.
5. *Dados gerados por script.* Os ficheiros de teste são produzidos de forma determinística (`gerar-dados.mjs`) e não são versionados.
6. *Conta premium de teste*, criada por script, porque o perfil gratuito limita os vídeos a 100 MB e a 5 operações por dia.

*Como se decide o resultado.* Um requisito fica _cumprido_ se todas as medidas principais atingirem o valor mínimo aceitável, e _com o alvo atingido_ se atingirem o valor-alvo. As medidas de controlo não decidem o cumprimento: um controlo que falhe é um efeito colateral negativo, reportado e analisado.

== Ambiente

#tab([Ambiente de medição, igual em todas as séries],
  tabela-campos(
    [Máquina], [HP Victus 15; Intel Core i5-12450H (8 núcleos, 12 processadores lógicos); 15,7 GiB de RAM],
    [Sistema], [Windows 11 Home 10.0.26300; Docker em WSL 2],
    [Docker], [Docker Desktop, Engine 29.9.3, Compose 5.7.0; 12 CPUs e 7,59 GiB atribuídos],
    [Browser dos scripts], [Chromium do Playwright 1.55.0, sem interface, janela de 1440×900; Node.js 24.11.1],
    [Serviços], [Os 32 serviços do `docker-compose.yaml`],
    [Medição inicial], [`43a2e08` (código igual a `0523102`), 17 de novembro de 2026, 01:34–04:23],
  ),
)

Cada série guarda o seu ambiente em `ambiente.json`, para verificar que a máquina é a mesma.

== Instrumentos

#tab([Scripts de medição (`Docs/fase2/medicoes/`)],
  tabela(
    colunas: (4.4cm, 1fr),
    [Script], [O que faz],
    [`gerar-dados.mjs`], [Vídeos de 10, 100, 500 e 1000 MiB (H.264, 1280×720, débito constante), o vídeo de 330 s do projeto P e as imagens de teste, com o ffmpeg da imagem `projects`],
    [`rnf1/medir-memoria.mjs`], [M1.1 e os controlos C1.1 a C1.7: envia cada ficheiro pela API e lê a memória dos contentores com `docker stats` a cada segundo],
    [`rnf1/medir-limite.mjs`], [M1.2: aplica um _override_ do Compose com 512 MiB por contentor e envia por ordem crescente de tamanho],
    [`rnf2/medir.mjs`], [M2.1, M2.2, M2.3 e os controlos C2.1 a C2.5, com o Playwright: executa os passos no browser, cronometra e grava um vídeo de cada execução],
    [`rnf2/estado.mjs`], [Verificação intermédia do ADR-02, só pela API e pelo WebSocket],
    [`correr-tudo.sh`], [Corre a série completa pela ordem da medição inicial],
    [`resumo.mjs`], [Junta os resultados em bruto num `resumo.md` por série],
  ),
)

As medições guardam os resultados em bruto (JSON, um por medida), os registos de cada passo e o resumo. Os tempos são reportados com média, desvio-padrão e mediana. Os ficheiros de 1000 MiB vão no fim da série de propósito: na base, esse envio pode deitar abaixo o motor do Docker.

== Medições intermédias

Além das medições inicial e final, cada passo do _refactoring_ teve uma medição curta, para atribuir a cada passo o seu efeito e para parar cedo se um passo piorasse alguma coisa. No RNF-F2-01 foi a M1.1 com 100 e 500 MiB, com duas repetições (`medicoes/passos/`). No RNF-F2-02 foram o `estado.mjs` pelo servidor (passos 1 a 3) e as medidas do browser com uma execução (passo 4) (`medicoes/passos-rnf2/`).

== Suite de regressão

A preservação funcional verifica-se com uma suite que corre na base antes de qualquer alteração e outra vez em cada passo e no fim, e que tem de dar os mesmos resultados. Os testes que o repositório já tinha são unitários e não passam pelo gateway, pelo armazenamento nem pela interface, que são precisamente as partes alteradas. Por isso a equipa acrescentou duas suites que exercitam o sistema completo.

#tab([Composição da suite de regressão (`Docs/fase2/regressao/`)],
  tabela(
    colunas: (3cm, 2.6cm, 1fr, 1.6cm),
    [Suite], [Origem], [O que cobre], [Base],
    [Worker de vídeo], [Existente (pytest)], [Leitura do vídeo, efeitos, corte, velocidade, som, pré-visualização, falhas sem saída parcial, legendas e extração de fotogramas], [74/74],
    [Orquestrador], [Existente (`node --test`)], [Registo do lote, cancelamento contra um _commit_ atrasado, pipeline de vídeo, regras da extração], [8/8],
    [Ponta a ponta], [Nova (`e2e.mjs`)], [18 testes (T01–T18) pelo nginx, pela API e pelo WebSocket: contas, carregamento, as 9 ferramentas de imagem, lote, ZIP, pré-visualização, efeitos de vídeo, corte e velocidade, legendagem real, extração, projetos mistos, cancelamento, quotas e acesso], [18/18],
    [Interface], [Nova (`ui.mjs`, Playwright)], [Importar, aplicar e cancelar no browser (U01–U03)], [3/3],
  ),
)

Cada teste ponta a ponta guarda uma impressão do resultado: o SHA-256 dos ficheiros produzidos, as durações, as resoluções e as mensagens. As impressões da base estão em `referencia.json`. Uma versão só preserva a funcionalidade se der as mesmas impressões, e não só os mesmos testes passados. Duas corridas na base deram impressões iguais, o que mostra que a comparação é estável.
