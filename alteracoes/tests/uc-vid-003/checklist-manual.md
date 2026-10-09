# Checklist no ambiente completo — UC-VID-003

Estado inicial: **por executar**. Preencher data, ambiente, browser, utilizador de teste, resultado observado e evidência. Não marcar como validado sem executar.

## Preparação

```bash
git fetch origin
git switch feature/uc-vid-003-apply-tools
docker compose up -d --build
docker compose logs --tail=100 video_apply_tool projects
```

Usar contas e projetos de teste. Preparar MP4 H.264 de menos de 2 min com áudio, MOV suportado, e um vídeo de 2 min/1080p/30 fps para desempenho. Confirmar operações livres. Não apagar volumes para adicionar a fila: o publicador e o worker declaram-na e criam a ligação ao exchange.

## Fluxo e limites

- [ ] Registado: abrir um vídeo → Ferramentas de vídeo → Aplicar ferramentas; só existem Redimensionar, Binarizar e Rodar.
- [ ] Adicionar três ferramentas; não aceitar uma quarta; mover e remover ferramentas mantém os parâmetros corretos.
- [ ] Largura/altura 16–3840, limiar 0–255 e ângulos 90/180/270. Valor inválido mostra o intervalo e desativa Aplicar.
- [ ] Gratuito: 2560 × 1440 final é rejeitado; 1920 × 1080 é aceite. Confirmar resolução após rotação e mudança de ordem.
- [ ] Premium: 3840 × 2160 final é aceite; excesso é rejeitado.
- [ ] Gratuito: vídeo de 120 s aceite, acima disso rejeitado; Premium: 600 s aceite, acima disso rejeitado.
- [ ] Confirmar tamanhos de 200 MiB/2 GiB e mensagem de excesso. Usar os valores binários definidos na API.
- [ ] Anónimo: ausência da biblioteca/ferramenta e sugestão para Criar conta na importação de vídeo.
- [ ] JWT ausente/expirado/de outro dono não permite usar a rota; o dono pode enviar a cadeia.

## Sucesso e quota

- [ ] Cadeia Redimensionar → Binarizar → Rodar cria pedido Em fila e confirma receção em ≤ 2 s. Medir também para um vídeo Premium longo.
- [ ] Estado muda para Em processamento. Medir atualizações de percentagem e fotogramas em intervalos ≤ 5 s.
- [ ] Repetir com WebSocket desligado: a consulta periódica acompanha o pedido e atualiza biblioteca/quota ao terminar.
- [ ] Resultado `_editado` aparece como novo vídeo e reproduz do início ao fim no browser alvo; Exportar descarrega-o.
- [ ] Aplicar outra vez mantém ambos os resultados com nomes distintos, incluindo colisões com pedidos ativos.
- [ ] Comparar `ffprobe -count_frames -show_streams -show_format` e os tempos dos fotogramas: formato/codec, número e taxa iguais.
- [ ] Comparar SHA-256 dos pacotes de áudio e tempos; verificar áudio presente e sincronizado, incluindo ficheiro com duas faixas.
- [ ] SHA-256 do ficheiro original igual antes/depois.
- [ ] Três ferramentas consomem uma operação concluída; cinco operações esgotadas impedem um novo pedido; Premium sem limite diário.
- [ ] Um TRIM ativo impede APPLY gratuito; três pedidos de vídeo ativos são o máximo Premium, em todos os projetos.

## Cancelamento e falha

- [ ] Cancelar em fila e durante processamento: estado Cancelado, reserva devolvida, sem vídeo novo ou objeto parcial em SeaweedFS.
- [ ] Cancelar perto do fim/upload: resultado tardio removido e não apresentado na biblioteca.
- [ ] Em fixture isolada, usar entrada corrompida ou injetar falha de fotograma: estado Falhado, mensagem “Não foi possível aplicar as ferramentas ao vídeo. Tente novamente.”, sem resultado/quota gasta.
- [ ] Interromper temporariamente `users` durante compensação e repor: a manutenção devolve a reserva uma única vez. Confirmar também uma reserva feita no dia anterior.
- [ ] Reentregar uma resposta de sucesso no ambiente de teste: resultado concluído não é duplicado nem apagado.
- [ ] Se a recodificação preencher o espaço, verificar falha, remoção do resultado e devolução da reserva.
- [ ] Confirmar que o recorte TRIM e as três ferramentas de imagem mantêm o comportamento anterior.

## Desempenho e registo

- [ ] Executar cenário A4: 2 min/1080p/30 fps com três ferramentas; medir tempo total e confirmar ≤ 10 min no equipamento declarado.
- [ ] Preencher esta checklist e acrescentar evidência real em `resultados.md` e a revisão do aluno em `Docs/registo-ia-apply.md`.
