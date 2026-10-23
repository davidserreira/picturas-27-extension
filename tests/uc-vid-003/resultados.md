# Resultados — UC-VID-003 (testes isolados)

Testes de processamento de vídeo, do processador e da API do UC-VID-003, com os serviços
externos substituídos em memória (exceto o teste de quota, que usa um MongoDB descartável).

## Execução mais recente — 2026-10-23

Versão entregue (`main`), em Linux 6.8 (Intel, 4 núcleos), Python 3.10, PyAV 16.1.0,
Pillow 11.0.0, FFmpeg 4.4, Node 22.

| Comando | Resultado |
|---|---|
| `python3 -m unittest discover -s tests/uc-vid-003 -p 'test_*.py'` | 20/20 passaram (14 de processamento de vídeo, 6 do processador) |
| `node --test tests/uc-vid-003/api.test.cjs` | 35/35 passaram |
| `node --test tests/uc-vid-003/gateway.test.cjs` | 4/4 passaram |
| `node --test tests/uc-vid-003/quota-mongo.test.cjs` | ignorado (sem `MONGODB_TEST_URL`); passa com MongoDB 4.4 na verificação final e na integração contínua |
| `frontend: npx tsc --noEmit --incremental false` | sem erros |
| ESLint dos ficheiros de vídeo do frontend | sem avisos |

## Execuções anteriores

| Data | Ambiente | Resultado |
|---|---|---|
| 2026-10-09 | Assistente (Codex), ambiente local | 20 Python; 38 Node + 1 ignorado (antes da substituição do vídeo, v1.4) |
| 2026-10-21 | Linux, Docker Engine, Intel Core i5-11300H | 20/20 Python; 35/35 API; 4/4 gateway; 1/1 quota (MongoDB descartável) |
| 2026-10-22/23 | Windows 11, Docker Desktop, Intel Core i5-12450H (verificação final) | 20/20 Python; 35/35 API; 4/4 gateway; 1/1 quota |

Os testes do UC-VID-003 com o sistema completo (pela API e no browser: TST-APPLY-M01 a M03)
estão em `tests/qualidade/resultados.md`, `tests/browser/resultados.md` e na tabela 10.2 do
relatório.

## O que os testes cobrem

- MP4 H.264 com áudio AAC: mesmos fotogramas, cadência, tempos de apresentação e pacotes de áudio (resumos SHA-256).
- MOV PNG: comparação exata de todos os fotogramas com as funções de imagem partilhadas.
- MOV ProRes com áudio PCM: codec, contagem, cadência e pacotes de áudio preservados.
- Duas faixas de áudio, 30000/1001 fps, tempos variáveis, dimensões ímpares, ordem das ferramentas e original inalterado.
- Cancelamento a meio, erro injetado num fotograma, fonte inválida, limites de armazenamento e de duração: sem resultado parcial.
- API: parâmetros, limites por perfil, quota de uma operação por cadeia, pedidos ativos partilhados com o recorte, um pedido por vídeo, progresso monotónico, cancelamento, falha, tamanho real do resultado (com o espaço livre na mensagem, D-02), substituição do vídeo e recuperação após falha do serviço.
