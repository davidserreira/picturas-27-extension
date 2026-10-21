"use client";

// UC-VID-001 — submitting a trim, shared by the tracks and the trim panel.
// FA4 (v1.5): before the request is sent, the user chooses whether the
// original is kept (the result is saved as a copy, "nome (2).mp4") or replaced.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useProjectInfo } from "@/providers/project-provider";
import { TrimSelection } from "@/providers/current-video-provider";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/hooks/use-toast";
import { videoJobsKey } from "@/lib/queries/video-jobs";
import { getVideoErrorMessage, ProjectVideo } from "@/lib/videos";
import { formatTimecode, TrimMode, trimVideo, VideoJob } from "@/lib/video-jobs";

export function useTrimSubmit(video: ProjectVideo) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<TrimSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(selection: TrimSelection, keepOriginal: boolean) {
    setPending(null);
    setSubmitting(true);
    try {
      const job = await trimVideo({
        uid: session.user._id,
        pid,
        token: session.token,
        videoId: video._id,
        start: selection.start,
        end: selection.end,
        mode: selection.mode,
        keepOriginal,
      });
      // REQ-009: confirm the request was received
      toast({
        title: "Pedido de recorte recebido",
        description: keepOriginal
          ? `Quando terminar, o resultado fica na biblioteca como "${job.result_name}" e o original não é alterado.`
          : "Quando terminar, o vídeo é substituído pelo recorte. Pode acompanhar o progresso no painel Recortar ou sair desta página.",
      });
      qc.setQueryData<VideoJob[]>(
        videoJobsKey(session.user._id, pid, session.token),
        (jobs) => [job, ...(jobs ?? []).filter((j) => j._id !== job._id)],
      );
    } catch (error) {
      // E1, E2, E3, E6, E8: the backend explains why
      toast({
        title: "Não foi possível recortar o vídeo",
        description: getVideoErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const interval = pending
    ? `${formatTimecode(pending.start)} – ${formatTimecode(pending.end)}`
    : "";

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Manter também o original?</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.mode === "remove"
              ? `O intervalo ${interval} vai ser removido de "${video.name}".`
              : `Vai ficar só o intervalo ${interval} de "${video.name}".`}{" "}
            Se mantiver o original, o resultado é guardado como um vídeo novo
            (por exemplo &quot;nome (2).mp4&quot;) e ocupa espaço na biblioteca. Se não,
            o vídeo é substituído pelo resultado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={() => pending && submit(pending, false)}>
            Não, substituir
          </Button>
          <Button onClick={() => pending && submit(pending, true)}>
            Sim, manter o original
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // asks first whether the original is kept; the request is sent on the answer
  return { requestTrim: setPending, submitting, dialog };
}

// FA5: keep the selected interval or remove it
export function TrimModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: TrimMode;
  onChange: (mode: TrimMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="O que fazer com a seleção"
      className="inline-flex rounded-md border p-0.5"
    >
      {(
        [
          ["keep", "Manter seleção"],
          ["remove", "Remover seleção"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          size="sm"
          variant={mode === value ? (value === "remove" ? "destructive" : "default") : "ghost"}
          className={compact ? "h-7 px-2 text-xs" : "h-8 flex-1"}
          onClick={() => onChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
