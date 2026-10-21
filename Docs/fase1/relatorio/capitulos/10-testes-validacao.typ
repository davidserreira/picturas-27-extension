#import "../template.typ": *

= Testes e Validação do MVP

== Estratégia e ambiente de testes

- *Automáticos de aceitação (caixa negra)* contra o sistema completo em Docker, um por critério de aceitação: `tests/uc-vid-001/test_trim_requirements.py` (Python, 23 casos agrupados em TST-TRIM-01 a 17).
- *Automáticos de média, processador e API*: `tests/uc-vid-003` (14 testes de média e 6 do processador em Python; 38 testes Node da API, ciclo de vida e gateway, com serviços substituídos em memória; teste de quota com MongoDB na integração contínua).
- *Manuais e de inspeção* no browser e no ambiente Docker, a partir das _checklists_ em `tests/uc-vid-001/checklist-manual.md` e `tests/uc-vid-003/checklist-manual.md`, e da lista TST-IMPORT-M01 a M12 para a importação.
- *Ambiente*: `docker compose` com todos os serviços; #preencher[sistema operativo, CPU e memória do equipamento usado nas medições].
- *Vídeos de teste*: `video_teste.mp4` (MP4 H.264, 60 s, 1080p) em `Docs/videosTestes`; vídeos sintéticos gerados pelos testes do UC-VID-003 (MP4 H.264 com AAC, MOV PNG, MOV ProRes com PCM); cópias com formato, duração ou tamanho alterados para os limites (decisão D30).

== Testes realizados

#tab([Testes e resultados],
  tabela(
    colunas: (2.3cm, 1.6cm, 1fr, 3cm, 2.6cm),
    tamanho: 8pt,
    [ID], [Tipo], [Descrição (Dado… Quando… Então…)], [Requisito(s)], [Resultado],
    [TST-TRIM-01], [Automático], [Dado um vídeo de 60 s, quando se pedem os intervalos 50–70 s, 20–10 s, 5–5 s, -1–5 s e 10–10,5 s, então todos são rejeitados com o motivo.], [TRIM-003], [Passa (2026-10-08)],
    [TST-TRIM-02], [Automático], [Dado um recorte válido, quando é submetido, então o pedido é criado "Em fila".], [JOB-001], [Passa (2026-10-08)],
    [TST-TRIM-03], [Automático], [Dado um recorte válido, quando é submetido, então a confirmação chega em ≤ 2 s.], [JOB-012], [Passa (2026-10-08); medido 0,04 s],
    [TST-TRIM-04], [Automático], [Dado um recorte, quando é seguido até ao fim, então os estados são Em fila → Em processamento → Concluído.], [JOB-002], [Passa (2026-10-08)],
    [TST-TRIM-05], [Automático], [Dado um recorte em curso, quando se registam as atualizações, então nenhum intervalo excede 5 s.], [JOB-013], [Passa (2026-10-08); maior intervalo 2,1 s],
    [TST-TRIM-06], [Automático], [Dado o intervalo 10–40 s, quando o pedido conclui, então o resultado tem 30 s ± 1 s e o formato e codec do original.], [JOB-006; TRIM-015], [Passa (2026-10-08); 30,00 s, mp4/h264],
    [TST-TRIM-07], [Automático], [Dado um vídeo já recortado, quando se recorta outra vez, então o novo vídeo chama-se "{nome}\_recorte\_2".], [TRIM-016], [Passa (2026-10-08)],
    [TST-TRIM-08], [Automático], [Dado um vídeo, quando é recortado, então o SHA-256 do original é igual antes e depois.], [JOB-014], [Passa (2026-10-08)],
    [TST-TRIM-09], [Automático], [Dado um registado, quando um recorte conclui, então a quota desce 1; quando um recorte é cancelado ou falha, então não muda.], [JOB-009], [Passa (2026-10-08); 5 → 4, 4 → 4],
    [TST-TRIM-10], [Automático], [Dado um registado com 1 pedido ativo, quando submete outro, então é rejeitado.], [JOB-007], [Passa (2026-10-08)],
    [TST-TRIM-11], [Automático], [Dado um recorte em curso, quando é cancelado, então fica "Cancelado".], [JOB-003], [Passa (2026-10-08)],
    [TST-TRIM-12], [Automático], [Dado um recorte cancelado, então não há vídeo novo nem ficheiros temporários no processador.], [JOB-004, 006], [Passa (2026-10-08); 0 temporários],
    [TST-TRIM-13], [Automático], [Dado um registado com 5 operações usadas, quando pede um recorte, então é rejeitado e é sugerido o premium.], [JOB-008], [Passa (2026-10-08)],
    [TST-TRIM-14], [Automático], [Dado uma falha no processamento, então o pedido fica "Falhado" com a mensagem prevista, sem vídeo novo.], [JOB-006; TRIM-019], [Passa (2026-10-08)],
    [TST-TRIM-15], [Automático], [Dado um vídeo AVI, quando se pede o recorte, então é rejeitado com "Formato não suportado".], [JOB-011], [Passa (2026-10-08)],
    [TST-TRIM-16], [Automático], [Dado um registado e um vídeo de 6 min, quando pede o recorte, então é rejeitado com o limite de 5 min.], [TRIM-005], [Passa (2026-10-08)],
    [TST-TRIM-17], [Automático], [Dado um registado e um vídeo de 250 MB, quando pede o recorte, então é rejeitado com o limite de 200 MB.], [TRIM-006], [Passa (2026-10-08)],
    [TST-TRIM-M01], [Manual], [Dado um registado com um vídeo, quando o abre, então a ferramenta Recortar está disponível.], [TRIM-001], [Passa (2026-10-08, interface anterior); #preencher[repetir na interface com barra de ferramentas]],
    [TST-TRIM-M02], [Manual], [Dado um vídeo de 60 s, quando define 0:10–0:40 (campos, slider e "Posição atual"), então os valores são aceites e a duração apresentada é 0:30.], [TRIM-002, 025], [Passa (2026-10-08)],
    [TST-TRIM-M03], [Manual], [Dado o intervalo 0:50–0:20, então aparece o motivo e Aplicar recorte fica desativado.], [TRIM-003], [Passa (2026-10-08)],
    [TST-TRIM-M04], [Manual], [Dado um recorte aplicado, quando se observa a lista de pedidos do vídeo (saindo e voltando), então o estado e a percentagem avançam.], [JOB-002, 010, 013], [Passa (2026-10-08)],
    [TST-TRIM-M05], [Manual], [Dado um recorte de 0:00–1:00 em processamento, quando carrega em Cancelar, então fica "Cancelado" e não aparece vídeo novo.], [JOB-003, 006], [Passa (2026-10-08)],
    [TST-TRIM-M06], [Manual], [Dado dois recortes do mesmo vídeo, então aparecem "{nome}\_recorte" e "{nome}\_recorte\_2" na biblioteca, que continuam lá noutra sessão.], [LIB-001; TRIM-016], [Passa (2026-10-08)],
    [TST-TRIM-M07], [Manual], [Dado "Operações diárias restantes", quando um recorte conclui, então desce 1; num cancelado, não desce.], [JOB-009], [Passa (2026-10-08)],
    [TST-TRIM-M08], [Manual], [Dado um recorte concluído, quando escolhe Exportar, então o ficheiro é descarregado com o nome do vídeo e abre num leitor externo.], [TRIM-021], [Passa (2026-10-08)],
    [TST-TRIM-M09], [Manual], [Dado um utilizador anónimo, quando abre um projeto, então não há vídeos nem ferramentas de vídeo; ao importar, é sugerido criar conta.], [ACCESS-004, 005], [Passa (2026-10-08)],
    [TST-TRIM-M10], [Manual], [Dado um premium, quando faz 2 recortes em simultâneo, então ambos são aceites (até 3 ativos).], [JOB-007], [#preencher[Por executar: falta conta premium]],
    [TST-TRIM-M11], [Manual], [Dado o intervalo 0:10–0:40, quando escolhe Pré-visualizar, então o vídeo é reproduzido de 0:10 a 0:40 e não é criado pedido.], [TRIM-026], [#preencher[Por executar]],
    [TST-TRIM-M12], [Manual], [Dado um registado com a biblioteca de vídeo cheia (1 GB), quando pede um recorte, então é rejeitado com a ocupação e o limite.], [TRIM-027], [#preencher[Por executar]],
    [TST-TRIM-M14], [Manual], [Dado a ocupação da biblioteca de vídeo antes de um recorte, quando o recorte conclui, então a ocupação aumenta o tamanho do vídeo resultante.], [LIB-002], [#preencher[Por executar]],
    [TST-TRIM-M13], [Manual], [Dado um vídeo de 5 min a 1080p, quando se recorta 0:00–5:00, então o pedido conclui em ≤ 5 min (medir o tempo).], [TRIM-031], [#preencher[Por executar; registar tempo medido]],
    [TST-IMPORT-M01], [Manual], [Dado um registado, quando importa um MP4 (H.264) válido de 60 s (video\_teste.mp4), então vê "Importar vídeo" junto de "Adicionar imagens", o progresso, os estados A carregar → A validar → Disponível e o vídeo com nome, duração e tamanho; o SHA-256 do ficheiro guardado é igual ao do enviado.], [IMPORT-001, 002, 007, 013, 014, 015, 029], [#preencher[Por executar]],
    [TST-IMPORT-M02], [Manual], [Dado um ficheiro .avi, quando é selecionado, então aparece "Formato não suportado" e o envio não começa.], [IMPORT-003], [#preencher[Por executar]],
    [TST-IMPORT-M03], [Manual], [Dado um registado e um ficheiro de 250 MB, quando é selecionado, então o envio é bloqueado com o limite de 200 MB.], [IMPORT-004], [#preencher[Por executar]],
    [TST-IMPORT-M04], [Manual], [Dado um registado com 900 MB ocupados, quando abre a importação e escolhe 150 MB, então vê o espaço livre e a importação não começa.], [IMPORT-005, 027], [#preencher[Por executar]],
    [TST-IMPORT-M05], [Manual], [Dado um registado com uma importação "A carregar", quando inicia outra, então é rejeitada.], [IMPORT-006], [#preencher[Por executar]],
    [TST-IMPORT-M06], [Manual], [Dado um AVI renomeado para .mp4 e um MP4 truncado, quando termina o envio, então o primeiro é rejeitado como formato não suportado e o segundo fica "Falhado" com "Não foi possível ler este vídeo"; nenhum aparece na biblioteca.], [IMPORT-010, 011, 023], [#preencher[Por executar]],
    [TST-IMPORT-M07], [Manual], [Dado um registado e um vídeo de 6 min com menos de 200 MB, quando termina o envio, então é rejeitado e removido.], [IMPORT-012], [#preencher[Por executar]],
    [TST-IMPORT-M08], [Manual], [Dado uma importação a 50 %, quando escolhe Cancelar, então o envio pára, o pedido fica "Cancelado" e não há parcial nem vídeo.], [IMPORT-016, 017, 023], [#preencher[Por executar]],
    [TST-IMPORT-M09], [Manual], [Dado um envio em curso, quando a rede é desligada, então fica "Interrompido"; ao retomar com o mesmo ficheiro, só o restante é enviado; sem retoma, ao fim de 1 h fica "Falhado" e o parcial é removido (prazo reduzível por configuração para o teste).], [IMPORT-018, 019, 020], [#preencher[Por executar]],
    [TST-IMPORT-M10], [Manual], [Dado um vídeo de 50 MB na biblioteca, quando é removido, então desaparece e a ocupação desce 50 MB.], [IMPORT-025, 026], [#preencher[Por executar]],
    [TST-IMPORT-M11], [Manual], [Dado um registado com 0 operações usadas, quando importa um vídeo, então continua com 0.], [IMPORT-021], [#preencher[Por executar]],
    [TST-IMPORT-M12], [Manual], [Dado uma importação de 200 MB, quando se confirma e se navega para outras páginas, então o envio começa em ≤ 2 s, o progresso continua visível e muda a cada ≤ 5 s, e a validação termina em ≤ 30 s.], [IMPORT-008, 009, 030, 031], [#preencher[Por executar; registar tempos medidos]],
    [TST-APPLY-01], [Automático], [Dado vídeos sintéticos (MP4 H.264 com AAC, MOV PNG, MOV ProRes com PCM, 2 faixas de áudio, 30000/1001 fps, tempos variáveis, dimensões ímpares), quando se aplica uma cadeia, então todos os fotogramas, a cadência, os tempos e o áudio coincidem com o esperado e o original fica inalterado; com erro injetado ou cancelamento, não fica resultado parcial.], [APPLY-013, 014, 015, 036; JOB-005, 014], [Passa (2026-10-09, 14 testes, executados pelo assistente)],
    [TST-APPLY-02], [Automático], [Dado o processador com um servidor HTTP de teste, quando se transfere, transforma e envia, cancela em fila, durante a transferência ou depois do envio, então os diretórios temporários são removidos e uma resposta repetida preserva o resultado.], [JOB-003, 004, 005, 006; PROCESS-003], [Passa (2026-10-09, 6 testes, executados pelo assistente)],
    [TST-APPLY-03], [Automático], [Dado a API com serviços substituídos em memória, quando se submetem cadeias, então são verificados parâmetros, limites exatos, resolução final, perfis, quota de 1 operação por cadeia, limite conjunto com o recorte, nomes repetidos, progresso, cancelamento, falha e limite real do resultado.], [ACCESS-004; APPLY-002, 003, 004, 005, 007, 008, 020, 024, 028; JOB-001, 002, 007, 008, 009, 011], [Passa (2026-10-09, 38 testes, executados pelo assistente)],
    [TST-APPLY-04], [Automático], [Dado a rota de aplicação no gateway, quando o JWT é válido, ausente, expirado ou de outro utilizador, então só o dono é aceite.], [ACCESS-001], [Passa (2026-10-09, executado pelo assistente)],
    [TST-APPLY-05], [Automático (CI)], [Dado um MongoDB descartável, quando um pedido falha ou é cancelado, então a operação é devolvida uma única vez, mesmo depois da meia-noite.], [JOB-009], [#preencher[Confirmar o resultado na CI (workflow uc-vid-003.yml)]],
    [TST-APPLY-M01], [Manual], [Dado um registado, quando abre um vídeo e escolhe Aplicar ferramentas, então só existem Redimensionar, Binarizar e Rodar; consegue adicionar até 3, reordenar e retirar, e vê a resolução final.], [APPLY-001, 002, 029, 030, 031], [#preencher[Por executar]],
    [TST-APPLY-M02], [Manual], [Dado a cadeia Redimensionar → Binarizar → Rodar, quando é aplicada, então a confirmação chega em ≤ 2 s, a percentagem e os fotogramas mudam a cada ≤ 5 s e o resultado "\_editado" é reproduzido no browser.], [APPLY-017, 023; JOB-012], [#preencher[Por executar; registar tempos medidos]],
    [TST-APPLY-M03], [Manual], [Dado um vídeo de 2 min, 1080p, 30 fps, quando se aplica a cadeia de 3 ferramentas, então o pedido conclui em ≤ 10 min (cenário A4).], [APPLY-035], [#preencher[Por executar; registar tempo e equipamento]],
    [TST-JOB-M01], [Manual], [Dado um pedido em processamento, quando o contentor do processador é terminado e reiniciado, então o pedido volta a ser processado e termina num estado final; dado um processador parado sem progresso, então o pedido fica "Falhado" ao fim de 20 min (prazo reduzível por configuração para o teste).], [PROCESS-002, 003], [#preencher[Por executar]],
    [TST-JOB-M02], [Manual], [Dado 20 pedidos submetidos em simultâneo por contas premium distintas, então todos ficam "Em fila" e todos terminam.], [PROCESS-004], [#preencher[Por executar]],
    [TST-JOB-M03], [Manual], [Dado um pedido em processamento, quando o utilizador navega para outra página e regressa, então o pedido continuou e o estado é o atual.], [PROCESS-001], [#preencher[Por executar]],
    [TST-SEC-M01], [Manual], [Dado o vídeo do utilizador A, quando B pede o vídeo, um resultado ou um pedido com a sua sessão, então o acesso é recusado.], [ACCESS-001], [#preencher[Por executar]],
    [TST-SEC-M02], [Manual], [Dado um endereço de vídeo gerado há mais de 1 h, quando é aberto, então o acesso é recusado.], [ACCESS-002], [#preencher[Por executar]],
    [TST-SEC-M03], [Inspeção], [Dado um vídeo importado, quando se inspecionam os volumes do armazenamento, então o conteúdo não é legível sem a chave.], [ACCESS-003], [#preencher[Por executar]],
    [TST-QUAL-M01], [Manual], [Dado um resultado MP4 (H.264) de cada ferramenta, quando é aberto em Chrome, Edge e Firefox atuais, então é reproduzido do início ao fim.], [COMPAT-001], [#preencher[Por executar]],
    [TST-QUAL-M02], [Inspeção], [Dado cada exceção dos três casos de uso provocada, então a mensagem indica o motivo e, nas de limite, o valor do limite.], [USAB-001], [#preencher[Por executar]],
    [TST-QUAL-M03], [Inspeção], [Dado o código de Recortar e de Aplicar ferramentas, quando se compara o que cada ferramenta acrescentou, então a segunda não alterou ficheiros da primeira.], [TOOLS-001], [#preencher[Rever o diff do ramo feature/uc-vid-003-apply-tools]],
    [TST-QUAL-M04], [Manual], [Dado um anfitrião só com o motor de contentores, quando se executa `docker compose up --build`, então os processadores de vídeo concluem um pedido de teste.], [PORT-001], [#preencher[Por executar (indicar sistema operativo)]],
  ),
)

== Limitações e defeitos conhecidos

- A importação (UC-VID-002) não tem testes automáticos; a verificação depende de TST-IMPORT-M01 a M12.
- A validação manual do UC-VID-003 no ambiente completo ainda não foi registada pelo aluno (TST-APPLY-M01 a M03).
- Sem conta premium de teste, os limites e o FA1 premium só estão cobertos pelos testes automáticos (TST-TRIM-M10).
- O bloqueio por utilizador (DA-10) só é correto com uma instância do serviço `projects`.
- Resultados H.264 com dimensões ímpares usam um formato de cor que nem todos os browsers reproduzem; preferir dimensões pares.
- O limite de resolução final é literal (largura e altura), pelo que rodar um vídeo 1920 × 1080 excede a altura permitida ao registado (UC-VID-003/Q4).
- A interface com o vídeo no visualizador e as ferramentas na barra de ferramentas está no ramo `feature/video-carousel-view`. #preencher[confirmar se foi integrada antes da entrega]
- Os alvos de produção dos requisitos não funcionais não foram medidos; são a linha de base da Fase 2.
