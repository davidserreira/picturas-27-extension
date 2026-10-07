"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppDropzone from "../app-dropzone";
import { Film, LoaderCircle, Video, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectInfo } from "@/providers/project-provider";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/hooks/use-toast";
import { projectVideosKey, useGetProjectVideos } from "@/lib/queries/videos";
import { startVideoImport } from "@/lib/video-imports";
import { formatBytes, getVideoErrorMessage } from "@/lib/videos";

export function ImportVideoDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { _id: pid } = useProjectInfo();
  const session = useSession();
  const anonymous = session.user.type === "anonymous";

  const library = useGetProjectVideos(
    session.user._id,
    pid,
    session.token,
    !anonymous,
  );
  const limits = library.data?.limits;
  const usage = library.data?.usage;

  // The dropzone only lets .mp4 and .mov through; the size is checked as soon
  // as the file is picked. The server checks everything again.
  const maxSize = limits?.maxSize ?? Infinity;
  const tooLarge = !!file && file.size > maxSize;

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    setOpen(next);
    if (!next) {
      setFile(null);
      setError(null);
    }
  }

  function handleDrop(files: File[]) {
    if (files.length === 0) return;
    setFile(files[0]);
    setError(null);
  }

  async function handleImport() {
    if (!file || tooLarge) return;

    setSubmitting(true);
    setError(null);
    try {
      await startVideoImport({
        uid: session.user._id,
        pid,
        token: session.token,
        file,
      });
      qc.invalidateQueries({
        queryKey: projectVideosKey(session.user._id, pid, session.token),
      });
      toast({
        title: "Importação iniciada",
        description: `"${file.name}" está a ser carregado. Pode continuar a usar a aplicação.`,
      });
      setOpen(false);
      setFile(null);
    } catch (err) {
      setError(getVideoErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="inline-flex" variant="outline">
          <Video /> Add Video
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Video</DialogTitle>
          <DialogDescription>
            {anonymous
              ? "A importação de vídeo não está disponível no perfil anónimo."
              : `Add a video to your project. MP4 (H.264) or MOV${
                  limits
                    ? `, up to ${formatBytes(limits.maxSize)} and ${Math.round(limits.maxDuration / 60)} min.`
                    : "."
                }`}
          </DialogDescription>
        </DialogHeader>

        {anonymous ? (
          <>
            <p className="text-sm">
              Crie uma conta para importar vídeos para a sua biblioteca.
            </p>
            <DialogFooter>
              <Button asChild>
                <Link href="/register">Criar conta</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {!file ? (
              <div className="h-64">
                <AppDropzone onDrop={handleDrop} videosOnly>
                  <div className="flex flex-col gap-4 items-center justify-center max-w-[20rem]">
                    <Film size={64} />
                    <p className="font-medium text-lg">
                      Drag and drop a video
                    </p>
                  </div>
                </AppDropzone>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <Film className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setError(null);
                  }}
                  disabled={submitting}
                  title="Remover"
                  className="text-foreground/50 hover:text-foreground p-1"
                >
                  <X className="size-[1em]" />
                </button>
              </div>
            )}

            {tooLarge && (
              <p className="text-sm text-destructive">
                O ficheiro excede o tamanho máximo de {formatBytes(maxSize)} do
                seu perfil.
                {library.data?.profile === "free" && (
                  <>
                    {" "}
                    <Link
                      href="/dashboard/account/upgrade"
                      className="underline"
                    >
                      Com o plano Premium pode importar vídeos maiores.
                    </Link>
                  </>
                )}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {usage && (
              <p className="text-xs text-muted-foreground">
                Espaço livre na biblioteca de vídeo:{" "}
                {formatBytes(usage.limit - usage.used)} de{" "}
                {formatBytes(usage.limit)}
              </p>
            )}

            <DialogFooter>
              <Button
                onClick={handleImport}
                disabled={!file || tooLarge || submitting}
                className="inline-flex items-center gap-1"
              >
                <span>Add</span>
                {submitting && (
                  <LoaderCircle className="size-[1em] animate-spin" />
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
