"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, LoaderCircle, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProjectInfo } from "@/providers/project-provider";
import { useSession } from "@/providers/session-provider";
import { getVideoErrorMessage, ProjectVideo } from "@/lib/videos";
import { applyVideoTools, VideoJob } from "@/lib/video-jobs";
import { APPLY_TOOL_LABELS, applyDimensions, applyLimitsFor, applyToolsError, VideoApplyTool } from "@/lib/video-apply";
import { videoJobsKey } from "@/lib/queries/video-jobs";
import { useUpdateSession } from "@/lib/mutations/session";

export function VideoApplyPanel({ video }: { video: ProjectVideo }) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateSession = useUpdateSession();
  const sequence = useRef(0);
  const [items, setItems] = useState<{ id: number; tool: VideoApplyTool }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const tools = items.map((item) => item.tool);
  const limits = applyLimitsFor(session.user.type);
  const invalid = applyToolsError(video, tools, session.user.type);
  const dimensions = applyDimensions(video, tools);
  const isFree = session.user.type === "free";
  const remaining = session.user.remaining_operations;
  const noOperations = isFree && remaining != null && remaining <= 0;

  function add(type: VideoApplyTool["type"]) {
    const tool: VideoApplyTool = type === "resize"
      ? { type, width: Math.min(video.width || 1280, limits.maxWidth), height: Math.min(video.height || 720, limits.maxHeight) }
      : type === "binarization" ? { type, threshold: 128 } : { type, degrees: 90 };
    setItems((current) => current.length < 3 ? [...current, { id: sequence.current++, tool }] : current);
  }

  function edit(index: number, tool: VideoApplyTool) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, tool } : item));
  }

  function move(index: number, step: number) {
    setItems((current) => {
      const copy = [...current];
      [copy[index], copy[index + step]] = [copy[index + step], copy[index]];
      return copy;
    });
  }

  async function apply() {
    if (invalid || noOperations || submitting) return;
    setSubmitting(true);
    try {
      const job = await applyVideoTools({ uid: session.user._id, pid, token: session.token, videoId: video._id, tools });
      qc.setQueryData<VideoJob[]>(videoJobsKey(session.user._id, pid, session.token),
        (jobs) => [job, ...(jobs ?? []).filter((other) => other._id !== job._id)]);
      updateSession.mutate({ userId: session.user._id, token: session.token });
      toast({ title: "Pedido em fila", description: "Pode acompanhar o progresso nos pedidos deste vídeo." });
    } catch (error) {
      toast({ title: "Não foi possível aplicar as ferramentas", description: getVideoErrorMessage(error), variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Aplicar ferramentas a todos os fotogramas">
      <div>
        <h3 className="text-sm font-semibold">Aplicar ferramentas a todos os fotogramas</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha até 3 ferramentas e a ordem de aplicação. O áudio é preservado e o resultado é guardado como um novo vídeo.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isFree ? "Conta gratuita: até 2 min, 200 MB e 1920 × 1080 px." : "Premium: até 10 min, 2 GB e 3840 × 2160 px."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["resize", "binarization", "rotate"] as const).map((type) => (
          <Button key={type} type="button" size="sm" variant="outline" disabled={items.length >= 3 || submitting} onClick={() => add(type)}>
            + {APPLY_TOOL_LABELS[type]}
          </Button>
        ))}
      </div>
      <ol className="flex flex-col gap-3" aria-label="Cadeia de ferramentas">
        {items.map(({ id, tool }, index) => (
          <li key={id} className="rounded-md border p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">{index + 1}. {APPLY_TOOL_LABELS[tool.type]}</h4>
              <div className="flex gap-1">
                <Button size="icon" className="size-8" variant="ghost" disabled={index === 0 || submitting} aria-label={`Mover ferramenta ${index + 1} para cima`} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                <Button size="icon" className="size-8" variant="ghost" disabled={index === items.length - 1 || submitting} aria-label={`Mover ferramenta ${index + 1} para baixo`} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                <Button size="icon" className="size-8" variant="ghost" disabled={submitting} aria-label={`Remover ferramenta ${index + 1}`} onClick={() => setItems((current) => current.filter((item) => item.id !== id))}><Trash2 className="size-4" /></Button>
              </div>
            </div>
            {tool.type === "resize" && (
              <div className="grid grid-cols-2 gap-3">
                {(["width", "height"] as const).map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <Label htmlFor={`apply-${video._id}-${id}-${key}`}>{key === "width" ? "Largura" : "Altura"} (16–3840 px)</Label>
                    <Input id={`apply-${video._id}-${id}-${key}`} type="number" min={16} max={3840} step={1} disabled={submitting}
                      value={Number.isNaN(tool[key]) ? "" : tool[key]}
                      onChange={(event) => edit(index, { ...tool, [key]: event.target.valueAsNumber })} />
                  </div>
                ))}
              </div>
            )}
            {tool.type === "binarization" && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`apply-${video._id}-${id}-threshold`}>Limiar (0–255)</Label>
                <Input id={`apply-${video._id}-${id}-threshold`} type="number" min={0} max={255} step={1} disabled={submitting}
                  value={Number.isNaN(tool.threshold) ? "" : tool.threshold} onChange={(event) => edit(index, { ...tool, threshold: event.target.valueAsNumber })} />
              </div>
            )}
            {tool.type === "rotate" && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`apply-${video._id}-${id}-degrees`}>Ângulo (sentido contrário ao dos ponteiros do relógio)</Label>
                <Select value={String(tool.degrees)} disabled={submitting} onValueChange={(value) => edit(index, { ...tool, degrees: Number(value) as 90 | 180 | 270 })}>
                  <SelectTrigger id={`apply-${video._id}-${id}-degrees`}><SelectValue /></SelectTrigger>
                  <SelectContent>{[90, 180, 270].map((degrees) => <SelectItem key={degrees} value={String(degrees)}>{degrees}°</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div aria-live="polite">
        {items.length > 0 && <p className="text-sm">Resolução final: {Number.isFinite(dimensions.width) ? dimensions.width : "—"} × {Number.isFinite(dimensions.height) ? dimensions.height : "—"} px</p>}
        {invalid && <p className="mt-1 text-sm text-destructive">{invalid}</p>}
        {noOperations && <p className="text-sm text-destructive">Atingiu o limite diário de operações. Com o plano Premium não tem limite diário.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {isFree ? `Operações diárias restantes: ${remaining ?? "—"}. A cadeia completa conta 1 operação, só se for concluída.` : "Plano Premium: sem limite diário de operações."}
        </p>
        <Button disabled={!!invalid || noOperations || submitting} onClick={apply}>
          {submitting ? <LoaderCircle className="animate-spin" /> : <SlidersHorizontal />}
          Aplicar ferramentas
        </Button>
      </div>
    </section>
  );
}
