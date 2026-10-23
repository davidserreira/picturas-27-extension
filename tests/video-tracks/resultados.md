# Resultados — faixas de um vídeo (UC-VID-002/FA4)

| Data | Ambiente | Comando | Resultado |
|---|---|---|---|
| 2026-10-21 | Linux, Docker Engine, Intel Core i5-11300H | `node --test tests/video-tracks/*.test.cjs` | 8/8 |
| 2026-10-22/23 | Windows 11, Docker Desktop (verificação final) | `node --test tests/video-tracks/*.test.cjs` | 8/8 |
| 2026-10-23 | Linux 6.8, Node 22 (versão entregue) | `node --test tests/video-tracks/*.test.cjs` | 8/8 |

Os testes cobrem a rota `GET …/videos/:video/tracks` e o cálculo da forma de onda, com o
ffprobe, o FFmpeg, o armazenamento e a base de dados substituídos em memória. Os testes da
interface das faixas (TST-LIB-M01 a M04) estão em `tests/browser/resultados.md`.
