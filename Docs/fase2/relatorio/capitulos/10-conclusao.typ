#import "../template.typ": *

= Conclusão

== Resultados

#tab([Os dois requisitos: base, cada um no seu ramo e os dois integrados],
  tabela(
    colunas: (2.1cm, 3.1cm, 2.5cm, 2.2cm, 2.2cm, 1fr),
    tamanho: 8.5pt,
    [Requisito], [Medida principal], [Base], [Isolado], [Integrado], [Resultado],
    [RNF-F2-01], [M1.1, memória com 1000 MiB], [Não mensurável: o Docker cai], [56,3 MiB], [62,4 MiB], [Alvo atingido (≤ 64 MiB)],
    [RNF-F2-01], [M1.2, maior ficheiro com 512 MiB], [100 MiB], [1000 MiB], [1000 MiB], [Alvo atingido],
    [RNF-F2-02], [M2.1, ações durante uma execução], [0%], [100%], [100%], [Alvo atingido],
    [RNF-F2-02], [M2.2, repor o estado e avisar o fim], [Não recupera], [0,63 s e 0,11 s], [0,43 s e 0,12 s], [Alvo atingido (≤ 2 s)],
    [RNF-F2-02], [M2.3, cancelar depois de perder a página], [0/10], [12/12], [10/10], [Alvo atingido],
  ),
)

Os dois requisitos ficam cumpridos, com o alvo atingido em todas as medidas principais, cada um medido no seu ramo com os scripts e o procedimento da medição inicial. Os controlos dos efeitos colaterais cumprem o limite, e vários melhoraram: a aceitação de um envio de 500 MiB passou de 9 s para menos de 1 s (C1.1), o envio sem JWT deixou de ocupar memória (C1.3), o ficheiro órfão do 409 desapareceu (C1.7) e o maior intervalo sem o progresso mudar passou de 17 s para 2,2 s (C2.2). A suite de regressão deu os mesmos resultados da base em cada passo e no fim, com as mesmas impressões ponta a ponta.

Com os dois requisitos integrados (ramo `fase2/integracao`), as medidas principais dos dois mantêm o alvo atingido, os doze controlos cumprem o limite e a regressão dá os mesmos resultados da base. O C2.1, que as séries isoladas não podiam comparar com a base, cumpre na mesma sessão: 282,5 s de mediana com os dois requisitos, contra 284,5 e 287,6 s na base, nos blocos antes e depois. Nenhum dos requisitos piora o outro (capítulo 8).

== O que não foi atingido e limitações

- *Margem do RNF-F2-01.* O `img_storage` ficou 8 MiB abaixo do alvo no ramo isolado e 1,6 MiB na série conjunta, com o mesmo código: o máximo varia de repetição para repetição. A margem depende da afinação do V8 e da glibc do passo 5b. Sem ela, o valor ficaria entre o alvo e o mínimo.
- *Tempos entre sessões.* A velocidade da máquina variou até 40% entre sessões, mais do que a tolerância de 10% dos controlos de tempo. Os tempos só se compararam de forma válida com a base na mesma sessão, em blocos A-B-A. Mesmo dentro de um bloco, uma execução de B ficou 21% acima da base, no worker de vídeo, sem mudar a mediana; duas execuções assim no mesmo bloco passariam o limite.
- *O que fica fora do âmbito.* Um vídeo cancelado continua a ocupar o único worker até ao fim, e a execução seguinte espera; isso é capacidade (C3), e não operabilidade. A sala `project:<id>` do `ws_gateway` continua sem verificação de acesso (EV-15): o RNF-F2-02 contornou-a, mas não a corrigiu.
- *O que não se mediu.* Os envios em simultâneo (o mínimo do RNF-F2-01 foi escolhido para três, mas isso é deduzido) e a usabilidade com utilizadores reais (o RNF-F2-02 foi medido por script).

== Lições

Medir em cada passo, e não só no fim, permitiu atribuir cada efeito ao passo que o causou. Também apanhou uma previsão errada (o passo 2 do ADR-01) e a necessidade de uma afinação que o plano só previa como possível. Registar as ocorrências em vez de as descartar foi o que tornou as séries interpretáveis: a queda do Docker na base é, ela própria, a melhor evidência da fragilidade do RNF-F2-01, e a variação da máquina entre sessões só foi atribuída depois de medida. Por fim, os instrumentos também falham, e as falhas têm de ser visíveis nos resultados. Três exemplos desta fase: um `ECONNRESET` do Docker Desktop, um caminho convertido pelo Git Bash que fez parecer válida uma recusa, e uma comparação de impressões sensível à ordem das chaves. Em todos, a falha foi apanhada porque o resultado em bruto registava o suficiente (o URL pedido, o estado do dono, a impressão completa) para se ver que estava errado.
