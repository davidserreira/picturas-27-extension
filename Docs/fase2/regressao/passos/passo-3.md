# Regressão — passos/passo-3

Corrida a 2026-11-17 14:29 UTC sobre o commit `ad6b5c4`, com alterações por versionar: M projects/routes/projects.js;  M projects/utils/imageStorage.js;  M projects/utils/video.js; ?? projects/tests/media-upload.test.js; ?? projects/utils/mediaUpload.js.
Máquina: 12th Gen Intel(R) Core(TM) i5-12450H, Docker 29.9.3 com 12 CPUs e 7.59 GiB (a mesma das medições).

## Resumo

| Suite | O que cobre | Resultado |
| --- | --- | --- |
| Worker de vídeo (pytest, existente) | `Tools/video/tests`: processamento, corte, velocidade, legendas e extração, com FFmpeg real e reconhecimento de fala simulado | 74/74 (74 passed in 44.46s) |
| Orquestrador (node --test, existente) | `projects/tests`: lote, cancelamento, pipeline de vídeo e extração | 13/13 |
| Ponta a ponta (nova) | `e2e.mjs`: a stack completa através do nginx, da API e do WebSocket | 18/18 |
| Interface (nova) | `ui.mjs`: importar, aplicar e cancelar no browser | 3/3 |

## Ponta a ponta

| ID | Área | Teste | Resultado | Tempo |
| --- | --- | --- | --- | --- |
| T01 | Contas | Registo e início de sessão devolvem um JWT válido | passou | 0.2 s |
| T02 | Carregamento | Carregar imagem PNG: aceite, listada e guardada sem alteração | passou | 0.2 s |
| T03 | Carregamento | Carregar vídeos MP4 e MOV: aceites, com metadados lidos por ffprobe | passou | 0.5 s |
| T04 | Carregamento | Recusas: vídeo no endpoint de imagem, imagem no de vídeo, ficheiro corrompido, nome repetido, limites do perfil gratuito, anónimo | passou | 1 s |
| T05 | Pipeline de imagem | Cada ferramenta de imagem (8 + watermark) aplicada sozinha produz o resultado de referência | passou | 21.6 s |
| T06 | Pipeline de imagem | Pipeline encadeado em lote (brilho, contraste, rotação, redimensionamento) em duas imagens | passou | 2.6 s |
| T07 | Pipeline de imagem | Transferência dos resultados em ZIP | passou | 0 s |
| T08 | Pré-visualização | Pré-visualização de imagem e de vídeo chega pelo WebSocket | passou | 3 s |
| T09 | Vídeo | Efeitos de fotograma em vídeo: cor (brilho, contraste, saturação, binarização) e geometria (rotação, recorte, redimensionamento, moldura) | passou | 26.9 s |
| T10 | Vídeo | Corte no tempo e velocidade: duração e som do resultado | passou | 4.5 s |
| T11 | Vídeo | Legendagem automática: vídeo com fala legendado; vídeo sem som inalterado na duração | passou | 20.2 s |
| T12 | Vídeo | Extração de fotogramas: por número (PNG) e por intervalo (JPEG), cada fotograma como resultado | passou | 19.1 s |
| T13 | Vídeo | Regras do pipeline: extração só no fim e uma vez; acrescentar efeito vai para antes da extração | passou | 0.4 s |
| T14 | Projetos mistos | Projeto com imagem e vídeo: o mesmo efeito aplica-se aos dois; o corte de vídeo não toca na imagem | passou | 12.1 s |
| T15 | Projetos mistos | Ferramentas incompatíveis: só-imagem num projeto com vídeo e só-vídeo num projeto só com imagens são recusadas | passou | 0.7 s |
| T16 | Cancelamento | Cancelar uma execução: sem resultados, operações não ficam comprometidas e o projeto volta a processar | passou | 66.6 s |
| T17 | Quotas | Perfil gratuito: cada efeito em cada vídeo conta uma operação e o limite diário de 5 recusa a execução seguinte | passou | 8.3 s |
| T18 | Acesso | Um utilizador não acede aos projetos nem aos media de outro | passou | 0.2 s |

## Interface

| ID | Teste | Resultado | Tempo |
| --- | --- | --- | --- |
| U01 | Importar uma imagem pela interface | passou | 5.6 s |
| U02 | Aplicar um pipeline pela interface e ver os resultados | passou | 6.4 s |
| U03 | Cancelar pela interface uma execução em curso | passou | 37.6 s |

## Testes unitários existentes

### Orquestrador

- passou: extraction is project-wide and terminal, with ordinary effects inserted before it
- passou: extraction validates active mode parameters and disallows targeted/potentially unbounded inputs
- passou: manifest validation rejects escaped, duplicate and oversized frame output before upload
- passou: all extracted images retain the source ID and run token; upload failure rolls back only this batch
- passou: the file is passed on to img_storage whole, with the same size and SHA-256 as the bytes sent
- passou: a file the route will refuse by type is read and dropped, not stored
- passou: a storage failure is marked so the route keeps its 501 answer
- passou: a client that goes away midway cancels the request to img_storage
- passou: multer cleanup removes the stored file by its key
- passou: a fast first worker cannot commit while later sources are still being scheduled
- passou: registration failure starts no workers and rolls back only newly registered jobs
- passou: a cancelled run cannot overwrite the committed results with a delayed commit
- passou: captions apply to all videos, while images skip them and trim stays targeted

### Worker de vídeo

- `tests/test_frame_extraction.py`: 33/33 passaram
- `tests/test_subtitles.py`: 12/12 passaram
- `tests/test_video_processor.py`: 29/29 passaram
