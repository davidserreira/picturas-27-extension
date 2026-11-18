# Regressão — final/rnf-f2-01

Corrida a 2026-11-17 17:32 UTC sobre o commit `?`, sem alterações ao código.
Máquina: 12th Gen Intel(R) Core(TM) i5-12450H, Docker 29.9.3 com 12 CPUs e 7.59 GiB (a mesma das medições).

## Resumo

| Suite | O que cobre | Resultado |
| --- | --- | --- |
| Worker de vídeo (pytest, existente) | `Tools/video/tests`: processamento, corte, velocidade, legendas e extração, com FFmpeg real e reconhecimento de fala simulado | 74/74 (74 passed in 42.29s) |
| Orquestrador (node --test, existente) | `projects/tests`: lote, cancelamento, pipeline de vídeo e extração | 13/13 |
| Interface (nova) | `ui.mjs`: importar, aplicar e cancelar no browser | 3/3 |

## Interface

| ID | Teste | Resultado | Tempo |
| --- | --- | --- | --- |
| U01 | Importar uma imagem pela interface | passou | 5.9 s |
| U02 | Aplicar um pipeline pela interface e ver os resultados | passou | 6.4 s |
| U03 | Cancelar pela interface uma execução em curso | passou | 37.7 s |

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
