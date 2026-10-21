#import "../template.typ": *

#set heading(numbering: "A.1.")
#counter(heading).update(0)

= Instruções de execução

*Pré-requisitos:* Docker Desktop (ou Docker Engine 24+) com Docker Compose v2, cerca de 8 GB de RAM livres e 15 GB de disco.

*Lançar a solução:*
- Descompactar `solucao-ext-mvp.zip` e, na pasta raiz, executar `docker compose up -d --build` (a primeira vez demora 15 a 30 min).
- Abrir https:/\/localhost:8080 (aceitar o certificado autoassinado).
- Registar uma conta (perfil registado) e criar um projeto; usar *Importar vídeo* com `Docs/videosTestes/video_teste.mp4`. #preencher[credenciais de uma conta premium de teste, se existir]

*Correr os testes:*
- UC-VID-001 (com o sistema a correr): `python tests/uc-vid-001/test_trim_requirements.py` #preencher[confirmar argumentos e variáveis necessárias]
- UC-VID-003: `python -m unittest discover -s tests/uc-vid-003 -p "test_*.py" -v` e `node --test tests/uc-vid-003/*.test.cjs`.
- Testes manuais: seguir `tests/uc-vid-001/checklist-manual.md`, `tests/uc-vid-003/checklist-manual.md` e a Tabela 19.

= Glossário

#tabela(
    colunas: (4cm, 1fr),
    [Termo], [Definição],
    [Biblioteca de vídeo], [Conjunto dos vídeos (importados e resultantes) de um utilizador, com limite de armazenamento por perfil.],
    [Pedido de processamento], [Pedido para aplicar uma ferramenta de vídeo a um vídeo; tem estado (Em fila, Em processamento, Concluído, Falhado, Cancelado), progresso e, quando conclui, um vídeo resultante.],
    [Importação], [Envio de um ficheiro de vídeo do dispositivo para a biblioteca, com estados próprios (A carregar, A validar, Interrompido, Disponível, Falhado, Cancelado).],
    [Ferramenta de vídeo], [Operação aplicada a um vídeo inteiro: Recortar ou Aplicar ferramentas a todos os fotogramas.],
    [Fotograma], [Cada uma das imagens que compõem um vídeo.],
    [Cadeia de ferramentas], [Sequência ordenada de 1 a 3 ferramentas básicas de imagem aplicadas a cada fotograma.],
    [Ficheiro parcial], [Ficheiro incompleto de uma importação ou de um processamento ainda não concluído; nunca é visível ao utilizador.],
    [Endereço assinado], [Endereço de acesso a um ficheiro, não adivinhável e com validade limitada.],
    [Operação], [Unidade da quota diária do perfil registado (5/dia); um pedido de processamento concluído conta 1 operação.],
    [Codec], [Forma de codificação do vídeo (e.g., H.264).],
  )
