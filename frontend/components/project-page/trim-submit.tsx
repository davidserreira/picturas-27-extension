"use client";

// UC-VID-001 — submitting a trim from the Recortar panel. The result always
// replaces the video when the request ends "Concluído" (RN7).

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useProjectInfo } from "@/providers/project-provider";
import { TrimSelection } from "@/providers/current-video-provider";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/hooks/use-toast";
import { videoJobsKey } from "@/lib/queries/video-jobs";
import { getVideoErrorMessage, ProjectVideo } from "@/lib/videos";
import { TrimMode, trimVideo, VideoJob } from "@/lib/video-jobs";

export function useTrimSubmit(video: ProjectVideo) {
  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function submitTrim(selection: TrimSelection) {
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
      });
      // REQ-009: confirm the request was received
      toast({
        title: "Pedido de recorte recebido",
        description:
          "Quando terminar, o vídeo é substituído pelo recorte. Pode acompanhar o progresso neste painel ou sair desta página.",
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

  return { submitTrim, submitting };
}

// FA4: keep the selected interval or remove it
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
