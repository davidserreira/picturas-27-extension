# Checklist de testes manuais — UC-VID-001 (Recortar um vídeo)

> **Histórico.** Esta lista regista as execuções manuais das versões anteriores (v1.0 a v1.5). Na versão entregue, os testes de interface estão automatizados em `tests/browser` e os resultados estão na tabela 10.2 do relatório; a interface e o comportamento atuais (resultado que substitui o vídeo, ferramentas no painel à esquerda) estão descritos nos casos de uso.

Requisitos que dependem da interface e não são cobertos por
`test_trim_requirements.py`. Preencher com ✅/❌ e a data.

| Requisito | Passos | Resultado esperado | Resultado |
|-----------|--------|--------------------|-----------|
| REQ-001 | Como registado, clicar num vídeo do projeto e abrir a aba **Ferramentas de vídeo** (ou botão direito → Ferramentas de vídeo) | A ferramenta **Recortar** está visível || ✅ 2026-10-08 |
| REQ-002 | Definir início `0:10` e fim `0:40` (campos, slider e "Posição atual") | Valores aceites; duração do recorte "0:30" || ✅ 2026-10-08 |
| REQ-003 (UI) | Definir início `0:50` e fim `0:20` | Mensagem com o motivo; **Aplicar recorte** desativado || ✅ 2026-10-08 |
| REQ-011 / 012 | Aplicar um recorte e observar a lista "Pedidos deste vídeo" | Estado muda Em fila → Em processamento → Concluído; percentagem a subir || ✅ 2026-10-08 |
| REQ-013 | Aplicar um recorte de 0:00–1:00 e carregar em **Cancelar** durante o processamento | Estado "Cancelado"; nenhum vídeo novo na biblioteca || ✅ 2026-10-08 |
| REQ-016 | Fazer dois recortes do mesmo vídeo | Aparecem "{nome}_recorte" e "{nome}_recorte_2" || ✅ 2026-10-08 |
| REQ-018 (UI) | Ver "Operações diárias restantes" antes e depois de um recorte concluído | Desce 1; não desce num cancelado || ✅ 2026-10-08 |
| REQ-021 | No pedido concluído, carregar em **Exportar** (ou botão direito no vídeo → Exportar) | O ficheiro é descarregado com o nome do vídeo e abre num leitor externo com a duração esperada || ✅ 2026-10-08 |
| REQ-022 | Terminar sessão (perfil anónimo) e abrir um projeto | Não há vídeos nem ferramentas de vídeo; ao importar, sugere criar conta || ✅ 2026-10-08 |
| FA1 (opcional) | Com um utilizador premium, fazer 2 recortes ao mesmo tempo | Ambos aceites (até 3 ativos); sem contador de operações || ✅ 2026-10-21 — verificado pelo teste automático [7] (3 pedidos ativos, sem quota, limites premium) |
| TRIM-034 (v1.6) | Abrir um vídeo de 60 s, escolher **Recortar** na barra de ferramentas (à esquerda) e arrastar nas faixas a extremidade inicial para 0:10 e a final para 0:40 | A seleção cobre a faixa de vídeo e a de áudio; os campos do painel passam a 0:10 e 0:40; o leitor mostra cada extremidade; a seleção nunca fica com menos de 1 s; as faixas não têm botões | |
| TRIM-032 (v1.5) | Selecionar 0:10–0:20, escolher **Remover seleção** no painel, **Pré-visualizar** e **Aplicar recorte** | Seleção riscada; a pré-visualização salta o intervalo; o vídeo fica com 50 s | |
| IMPORT-032 (v1.5) | Importar outra vez um ficheiro com o mesmo nome de um vídeo do projeto | O vídeo novo fica "{nome} (2).mp4" | |
| JOB-010 (v1.6) | Aplicar um recorte ou ferramentas, sair do vídeo e voltar durante o processamento | Sem lista "Pedidos deste vídeo"; o painel reabre só com o pedido em curso (progresso e **Cancelar**); ao concluir, o vídeo é substituído e aparece um aviso | |
| TST-TRIM-M06 (v1.4) | Fazer dois recortes sucessivos do mesmo vídeo, terminar sessão e voltar a entrar | A biblioteca tem um único vídeo, com o nome original e os dois recortes aplicados | ✅ 2026-10-21 (Miguel Páscoa) |
