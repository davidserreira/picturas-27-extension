# Checklist de testes manuais — UC-VID-001 (Recortar um vídeo)

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
| FA1 (opcional) | Com um utilizador premium, fazer 2 recortes ao mesmo tempo | Ambos aceites (até 3 ativos); sem contador de operações || ⏳ Por testar (sem conta premium); limites premium cobertos em `videoLimits.js` |
