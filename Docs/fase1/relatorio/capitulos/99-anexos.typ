#import "../template.typ": *

#set heading(numbering: "A.1.")
#counter(heading).update(0)

= Instruções de execução

*Pré-requisitos:* Docker Desktop (ou Docker Engine 24+) com Docker Compose v2, cerca de 8 GB de RAM livres e pelo menos 45 GB de disco (as imagens dos contentores ocupam cerca de 40 GB, dos quais cerca de 9 GB são da `cut_ai_tool`, que instala o PyTorch com as bibliotecas CUDA).

*Lançar a solução:*
- Clonar o repositório (https:/\/github.com/davidserreira/picturas-27-extension) e, na pasta raiz, executar `docker compose up -d --build` (a primeira vez demora 15 a 30 min, mais com uma ligação lenta). Se já tiver corrido outra versão do PictuRAS, é obrigatório usar `--build`: o nome do projeto é fixo (`picturas`), pelo que `docker compose up` sem `--build` reutilizaria as imagens da versão anterior, sem suporte a vídeo.
- Abrir https:/\/localhost:8080 (aceitar o certificado autoassinado).
- Registar uma conta (perfil registado) e criar um projeto; usar *Importar vídeo* com `Docs/testes/video_teste.mp4`. Não existe uma conta premium de teste: os casos do perfil premium são verificados pelos testes automáticos, que alteram temporariamente o tipo do utilizador e o repõem no fim.

*Correr os testes:*
- UC-VID-001 (com o sistema a correr e um utilizador registado com um vídeo MP4 de pelo menos 40 s importado, e.g. `video_teste.mp4`): `python3 tests/uc-vid-001/test_trim_requirements.py --reset-quota`. O script encontra o vídeo sozinho (ou `--user`, `--project` e `--video` para escolher outro), trabalha sobre cópias dele, repõe as operações diárias desse dia (`--reset-quota`, só para ambiente de testes), remove o que cria e escreve o resultado em `tests/uc-vid-001/resultados.md` (cerca de 6 min).
- UC-VID-003: `python -m unittest discover -s tests/uc-vid-003 -p "test_*.py" -v` e `node --test tests/uc-vid-003/*.test.cjs` (requer FFmpeg e as dependências de `Tools/video_apply/requirements.txt` para os testes Python, e `npm install` nas pastas `projects`, `apiGateway`, `users` e `frontend` para os testes Node; o teste de quota só corre com `MONGODB_TEST_URL` a apontar para um MongoDB descartável).
- Faixas de um vídeo (UC-VID-002/FA4): `node --test tests/video-tracks/*.test.cjs` (requer `npm install` na pasta `projects`).
- Testes manuais: seguir `tests/uc-vid-001/checklist-manual.md`, `tests/uc-vid-003/checklist-manual.md` e a tabela de testes e resultados da secção 10.2 (incluindo TST-IMPORT-M01 a M12 e TST-LIB-M01 a M04).

= Glossário

#tabela(
    colunas: (4cm, 1fr),
    [Termo], [Definição],
    [Biblioteca de vídeo], [Conjunto dos vídeos importados de um utilizador, incluindo os alterados por ferramentas, com limite de armazenamento por perfil.],
    [Pedido de processamento], [Pedido para aplicar uma ferramenta de vídeo a um vídeo; tem estado (Em fila, Em processamento, Concluído, Falhado, Cancelado), progresso e, quando conclui, substitui o vídeo pelo resultante.],
    [Importação], [Envio de um ficheiro de vídeo do dispositivo para a biblioteca, com estados próprios (A carregar, A validar, Interrompido, Disponível, Falhado, Cancelado).],
    [Ferramenta de vídeo], [Operação aplicada a um vídeo inteiro: Recortar ou Aplicar ferramentas a todos os fotogramas.],
    [Fotograma], [Cada uma das imagens que compõem um vídeo.],
    [Cadeia de ferramentas], [Sequência ordenada de 1 a 3 ferramentas básicas de imagem aplicadas a cada fotograma.],
    [Ficheiro parcial], [Ficheiro incompleto de uma importação ou de um processamento ainda não concluído; nunca é visível ao utilizador.],
    [Endereço assinado], [Endereço de acesso a um ficheiro, não adivinhável e com validade limitada.],
    [Operação], [Unidade da quota diária do perfil registado (5/dia); um pedido de processamento concluído conta 1 operação.],
    [Codec], [Forma de codificação do vídeo ou do áudio (e.g., H.264, AAC).],
    [Faixa], [Sequência de vídeo ou de áudio contida num ficheiro de vídeo, com codec e características próprias (e.g., V1: H.264, 1280 × 720, 30 fps; A1: AAC, estéreo, 48 kHz).],
    [Forma de onda], [Representação da amplitude do som de uma faixa de áudio ao longo do tempo.],
  )
