# Defeitos conhecidos (Fase 1)

Defeitos encontrados a 2026-10-21, ao executar os testes pela API (`tests/uc-vid-002` e
`tests/qualidade`). Por decisão da equipa, **não foram corrigidos na Fase 1**: ficam
documentados aqui e no relatório (secção 10.3 e tarefa T-04 do capítulo 11).

| ID | Defeito | Origem | Requisitos | Estado |
|----|---------|--------|------------|--------|
| D-01 | Um MP4 truncado com o cabeçalho intacto é aceite como "Disponível" | Importação (UC-VID-002) | REQ-VID-IMPORT-011; UC-VID-002/E3 | Corrigido (2026-10-23) |
| T-04 | O armazenamento só aceita ficheiros de cerca de 6 utilizadores | Solução de base (SeaweedFS) | LIB-001, IMPORT-013; afeta também as imagens | Não corrigido |
| D-02 | Um pedido que falha por falta de espaço não indica o espaço livre | Pedidos (UC-VID-003/E8) | REQ-VID-APPLY-028 | Corrigido (2026-10-23) |
| D-03 | Os ficheiros parciais de um processador terminado a meio ficam no contentor | Processadores de vídeo | REQ-VID-JOB-004, JOB-005; PROCESS-003 | Corrigido (2026-10-23) |
| D-04 | A mensagem de quota esgotada do painel Aplicar ferramentas não indica o limite | Interface (UC-VID-003/E3) | REQ-VID-USAB-001 | Corrigido (2026-10-23) |

D-02 a D-04 foram encontrados na verificação final (2026-10-22 e 23), ao repetir todos os
testes sobre a versão entregue e ao comparar o relatório com o código; estão descritos no fim.

---

## D-01 — MP4 truncado aceite na importação

**O que acontece.** A validação da importação (`projects/utils/videoProbe.js`) só lê os
metadados do ficheiro com o `ffprobe`. Num MP4 com o átomo `moov` no início (o caso
habitual dos telemóveis e de ficheiros com `faststart`), o cabeçalho declara a duração
completa mesmo que o resto do ficheiro falte. O vídeo fica "Disponível", com a duração
original, mas só os primeiros fotogramas se conseguem descodificar.

**Como reproduzir.**

```bash
head -c 2000000 Docs/testes/video_teste.mp4 > truncado.mp4     # 2 MB de 39 MB
# importar truncado.mp4 pela aplicação, ou correr:
python3 tests/uc-vid-002/test_import_requirements.py            # TST-IMPORT-M06 falha
```

**Evidência.**

```text
$ ffprobe -v error -show_entries format=duration -of csv=p=0 truncado.mp4
60.000000
$ ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames truncado.mp4
[h264] Invalid NAL unit size (374484 > 45346).
5
```

**Impacto.** O utilizador vê um vídeo de 60 s que não reproduz depois do segundo 0;
não foi testado o que acontece ao recortar ou aplicar ferramentas a esse vídeo.
A exceção UC-VID-002/E3 ("Não foi possível ler este vídeo") não é apresentada.

**Correção proposta (Fase 2).** Descodificar o vídeo na validação, por exemplo
`ffmpeg -v error -i <ficheiro> -f null -`, e rejeitar se houver erros ou se o número de
fotogramas lidos ficar muito abaixo do esperado. Custa tempo de CPU proporcional à
duração; o REQ-VID-IMPORT-030 (validação em ≤ 30 s para 200 MB) tem de ser medido de novo.

---

## T-04 — Capacidade do armazenamento (SeaweedFS)

**O que acontece.** A solução de base cria um _bucket_ por utilizador
(`user-<id>`), que no SeaweedFS é uma coleção. Ao receber o primeiro ficheiro, cada
coleção reserva **7 volumes** (crescimento por omissão para a replicação `000`). O número
máximo de volumes do servidor é o espaço livre em disco a dividir pelo tamanho de um
volume (`-master.volumeSizeLimitMB=1024` no `docker-compose.yaml`).

Com 45 GB livres há 45 volumes: cerca de **6 utilizadores com ficheiros**. A partir daí,
qualquer envio, de imagem ou de vídeo, falha.

**Como reproduzir.** Criar contas e importar um vídeo em cada uma até falhar
(`tests/qualidade/test_quality_requirements.py --fila` cria 20). Para ver o estado:

```bash
echo "volume.list" | docker compose exec -T seaweedfs weed shell | grep DataNode
#   DataNode ... hdd(volume:45/45 active:45 free:0 remote:0)
echo "collection.list" | docker compose exec -T seaweedfs weed shell
#   collection:"user-..."  volumeCount:7 ...
```

**Evidência (logs).**

```text
seaweedfs  | failed to find writable volumes for collection:user-6ad910f1...: No writable volumes and no free volumes left
img_storage| Erro ao enviar vídeo: We encountered an internal error, please try again.
projects   | Error validating video import 6ad910f1... Request failed with status code 500
```

A importação termina "Falhado" com "Não foi possível guardar o vídeo. Tente novamente.".

**Impacto.** Bloqueante para mais do que meia dúzia de utilizadores. Na Fase 1 impediu
o TST-JOB-M02 (20 contas premium) e o REQ-VID-PROCESS-004 ficou por verificar.

**Correções possíveis (Fase 2).**

1. Reduzir o crescimento por coleção num `master.toml` (`[master.volume_growth] copy_1 = 1`).
2. Volumes mais pequenos (`-master.volumeSizeLimitMB`), o que aumenta o número de volumes.
3. Um _bucket_ único, com um prefixo por utilizador (altera o `img_storage`).

**Limpar contas de teste** (liberta os volumes; usar só em ambiente de desenvolvimento):

```bash
printf 'lock\ncollection.delete -collection user-<id> -apply\nunlock\n' \
  | docker compose exec -T seaweedfs weed shell
```

e apagar os registos dessa conta em `users_mongoDB` (`users`) e `projects_mongoDB`
(`projects`, `videos`, `videojobs`). Os scripts de teste criam contas com projetos
chamados `Teste <10 caracteres hexadecimais>`, o que as distingue das contas reais.

---

## Defeitos encontrados e corrigidos na verificação final

**D-02 — Falta de espaço sem o espaço livre.** Quando o resultado de uma ferramenta excede o
espaço livre da biblioteca (UC-VID-003/E8), o pedido ficava "Falhado" com a mensagem genérica
"Não foi possível aplicar as ferramentas ao vídeo. Tente novamente.", e não com o espaço livre
que o REQ-VID-APPLY-028 exige. O teste da API só verificava o estado e o código `STORAGE_FULL`.
Corrigido em `projects/utils/videoJobs.js` (mensagem com o tamanho do resultado e o espaço
livre); o teste em `tests/uc-vid-003/api.test.cjs` passou a verificar a mensagem.

**D-03 — Temporários de um processador terminado a meio.** Se o contentor de um processador é
terminado a meio de um pedido (`docker compose kill` no TST-JOB-M01), o pedido é entregue de
novo e refeito, mas o diretório temporário do processamento interrompido (`/tmp/trim-…`, com o
resultado parcial) ficava no contentor até este ser recriado. Detetado porque o TST-TRIM-12
(nenhum temporário depois de cancelar) falhou quando os testes do UC-VID-001 correram depois
dos de qualidade. Corrigido: os dois processadores (`Tools/video_trim`, `Tools/video_apply`)
removem os temporários deixados por uma execução anterior ao arrancar (um pedido de cada vez
por processador, pelo que nenhum está em uso nesse momento); o TST-JOB-M01 passou a verificar
que não ficam temporários.

**D-04 — Quota esgotada sem o limite.** Com as 5 operações do dia gastas, o painel Aplicar
ferramentas mostrava "Atingiu o limite diário de operações.", sem o valor do limite
(REQ-VID-USAB-001; o UC-VID-003/E3 e o painel Recortar dizem "Atingiu o limite de 5 operações
diárias"). Corrigido em `frontend/components/project-page/video-apply-panel.tsx`; verificado
com `tests/browser/check_quota_message.py`.

**T-04 na verificação final.** Em Windows com Docker Desktop, o disco virtual do WSL 2 deixa o
SeaweedFS criar até 891 volumes, pelo que o TST-JOB-M02 (20 contas premium) correu e passou. O
defeito mantém-se: o número de utilizadores com ficheiros continua a depender do espaço livre.
