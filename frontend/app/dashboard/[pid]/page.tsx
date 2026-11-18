"use client";

import { Download, LoaderCircle, OctagonAlert, Play } from "lucide-react";
import { fetchSharedProject, resolveShareLink } from "@/lib/projects";
import { ProjectImageList } from "@/components/project-page/project-image-list";
import { ViewToggle } from "@/components/project-page/view-toggle";
import { AddImagesDialog } from "@/components/project-page/add-images-dialog";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/toolbar/toolbar";
import { ShareProjectDialog } from "@/components/projects/share-dialog";
import {
  useGetProject,
  useGetProjectResults,
  useGetSocket,
} from "@/lib/queries/projects";
import Loading from "@/components/loading";
import { ProjectProvider } from "@/providers/project-provider";
import { use, useEffect, useLayoutEffect, useState, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSession } from "@/providers/session-provider";
import {
  useDownloadProject,
  useDownloadProjectResults,
  useProcessProject,
  useCancelProjectProcess,
  useDownloadProjectPdf,         
} from "@/lib/mutations/projects";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"; // shadcn / radix menu
import { useToast } from "@/hooks/use-toast";
import { ProjectImage, isVideo } from "@/lib/projects";
import { Progress } from "@/components/ui/progress";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ModeToggle } from "@/components/project-page/mode-toggle";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUpdateSession } from "@/lib/mutations/session";
import { getErrorMessage } from "@/lib/error-messages";
import { PresetsDialog } from "@/components/presets/presets-dialog";
import { AiAssistantDialog } from "@/components/assistant/ai-assistant-dialog";
import { useRuns } from "@/providers/runs-provider";

const AI_PROCEDURES = [
  "bg_remove_ai",
  "cut_ai",
  "obj_ai",
  "people_ai",
  "text_ai",
  "upgrade_ai",
  "expand_ai",
  "subtitles",
];

export default function Project({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const resolvedParams = use(params);
  const session = useSession();
  const { pid } = resolvedParams;
  const { toast } = useToast();
  const socket = useGetSocket(session.token);
  const updateSession = useUpdateSession();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "grid";
  const mode = searchParams.get("mode") ?? "edit";
  // se vier ?owner=... usamos esse userId, senão usamos o próprio utilizador (owner normal)
  const ownerId = searchParams.get("owner") ?? session.user._id;
  const shareId = searchParams.get("share") ?? undefined;
  const project = useGetProject(session.user._id, pid, session.token, ownerId, shareId);
  const downloadProjectImages = useDownloadProject();
  const processProject = useProcessProject(
    session.user._id,
    pid,
    session.token,
    ownerId,
    shareId,
  );
  const cancelProcess = useCancelProjectProcess(
    session.user._id,
    pid,
    session.token,
    ownerId,
    shareId,
  );
  const downloadProjectResults = useDownloadProjectResults();
  const downloadProjectPdf = useDownloadProjectPdf();
  const router = useRouter();
  const path = usePathname();
  const sidebar = useSidebar();
  const isMobile = useIsMobile();
  const [currentImage, setCurrentImage] = useState<ProjectImage | null>(null);
  const [waitingForPreview, setWaitingForPreview] = useState<string>("");
  const [canEdit, setCanEdit] = useState(true);

  // estado para saber se o link de partilha foi revogado
  const [shareRevoked, setShareRevoked] = useState(false);

  // ADR-02: the run of this project comes from the server (RunsProvider), so
  // it survives a reload, another session and leaving this page. The page
  // does not block while it runs; only editing this project's pipeline is locked.
  const runs = useRuns();
  const run = runs.runs[pid];
  const running = run?.status === "running";
  // Lowest run token whose end this page reacts to (set by Apply, or when the
  // page sees a run in progress); a run that ended before is not announced here.
  const followRef = useRef<number | null>(null);

  const projectImgs = project.data?.imgs ?? [];
  const projectVideos = projectImgs.filter((i) => isVideo(i));
  const hasVideos = projectVideos.length > 0;
  const projectResults = useGetProjectResults(
    session.user._id,
    pid,
    session.token,
    ownerId,
    shareId,
  );
  const qc = useQueryClient();

  useLayoutEffect(() => {
    if (
      !["edit", "results"].includes(mode) ||
      !["grid", "carousel"].includes(view)
    ) {
      router.replace(path);
    }
  }, [mode, view, path, router, projectResults.data]);

  useEffect(() => {
  let cancelled = false;

  async function loadSharePermission() {
    if (!shareId) {
      setCanEdit(true);
      return;
    }

    try {
      const info = await resolveShareLink(shareId);
      // ajusta o campo conforme o teu backend devolve
      // exemplos comuns: info.permission === "edit" | "read"
      const perm = (info as any)?.permission ?? (info as any)?.access ?? (info as any)?.mode;

      const editable = perm === "edit" || perm === "write";
      if (!cancelled) setCanEdit(editable);
    } catch (err: any) {
      // se falhar, joga pelo seguro: read-only
      if (!cancelled) setCanEdit(false);
    }
  }

  loadSharePermission();

  return () => {
    cancelled = true;
  };
}, [shareId]);

  // link de partilha enquanto o editor está aberto em modo "edit"
  useEffect(() => {
    if (mode !== "edit") return;
    if (!shareId) return;
    if (!session.token) return;

    const sid = shareId;          // ← narrowing definitivo
    const token = session.token;

    let cancelled = false;

    async function pingShare() {
      try {
        await resolveShareLink(shareId!);
        setShareRevoked(false);
      } catch (err: any) {
        const status = err?.response?.status;
        // 410 = revogado → true
        if (status === 410) setShareRevoked(true);
        // outros erros: podes decidir
        else setShareRevoked(true); // ou false se preferires "falha de rede não revoga"
      }
    }

    pingShare();

    const interval = setInterval(pingShare, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode, shareId, session.token]);

  // heartbeat de presença (editores ativos) enquanto estiver em mode=edit
  useEffect(() => {
    if (mode !== "edit") return;
    if (!canEdit) return;

    let cancelled = false;

    const qs = new URLSearchParams();
    if (ownerId) qs.set("owner", ownerId);
    if (shareId) qs.set("share", shareId);

  const baseUrl = `/api-gateway/projects/${session.user._id}/${pid}/presence?${qs.toString()}`;

    async function pingPresence() {
      try {
        await fetch(baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });
      } catch {
        // ignora (o erro “a sério” aparece quando se tenta carregar o projeto)
      }
    }

    // ping inicial
    pingPresence();

    // ping periódico
    const interval = setInterval(() => {
      if (!cancelled) pingPresence();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);

      // libertar slot (best-effort)
      fetch(baseUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    };
  }, [mode, pid, ownerId, shareId, session.token, session.user._id, canEdit]);

useEffect(() => {
  if (!socket.data) return;

  // entrar na room do projeto
  socket.data.emit("join-project", pid);

  const onProjectUpdated = (evt: { projectId: string; version?: number }) => {
    if (!evt || evt.projectId !== pid) return;

    // 1) refetch do projeto
    qc.invalidateQueries({
      queryKey: ["project", session.user._id, pid, session.token, ownerId, shareId],
      refetchType: "all",
    });

    // 2) imagens e results (se a alteração pode impactar)
    qc.invalidateQueries({
      queryKey: ["projectImages", session.user._id, pid, session.token, ownerId, shareId],
      refetchType: "all",
    });
    qc.invalidateQueries({
      queryKey: ["projectResults", session.user._id, pid, session.token, ownerId, shareId],
      refetchType: "all",
    });

    toast({
      title: "Projeto atualizado",
      description: "O projeto foi alterado por outro utilizador. Atualizámos a versão mais recente.",
    });
  };

  socket.data.on("project-updated", onProjectUpdated);

  return () => {
    socket.data.off("project-updated", onProjectUpdated);
    socket.data.emit("leave-project", pid);
  };
}, [socket.data, pid, qc, session.user._id, session.token, ownerId, shareId, toast]);

// Errors of a run of this project, as in the base (the run state also turns to
// "failed", which only stops the progress shown).
useEffect(() => {
  const s = socket.data;
  if (!s) return;
  function onProcessError(payload: { error_code: string; error_msg: string }) {
    console.error("process-error", payload);
    toast({
      title: "Falha no processamento",
      description:
        payload?.error_msg ||
        "Ocorreu um erro ao processar o projeto. Tenta novamente.",
      variant: "destructive",
    });
  }
  s.on("process-error", onProcessError);
  return () => {
    s.off("process-error", onProcessError);
  };
}, [socket.data, toast]);

// The page asks for this project's run when it opens (ADR-02)
useEffect(() => {
  runs.refreshProject(pid, ownerId, shareId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pid, ownerId, shareId, runs.refreshProject]);

// End of a run followed by this page: the same as the base did when the last
// step arrived (results refreshed, results mode), now driven by the run state.
useEffect(() => {
  if (!run) return;
  if (run.status === "running") {
    if (followRef.current === null || followRef.current > run.token) followRef.current = run.token;
    return;
  }
  if (followRef.current === null || run.token < followRef.current) {
    // a run that ended before this page followed it: its notice is now seen
    runs.dismiss(pid);
    return;
  }
  followRef.current = null;
  runs.dismiss(pid);
  if (run.status !== "done") return; // failed: toast from process-error; cancelled: handleCancel

  const isAiProcess = (project.data?.tools ?? []).some((t) => AI_PROCEDURES.includes(t.procedure));
  const durationMs =
    run.startedAt && run.finishedAt
      ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  projectResults.refetch().then(() => {
    if (!isMobile) sidebar.setOpen(true);
    // avisar o ProjectProvider que o Apply terminou
    setWaitingForPreview("__APPLY_DONE__");

    const params = new URLSearchParams();
    params.set("mode", "results");
    params.set("view", "grid");
    const ownerFromQuery = searchParams.get("owner");
    const shareFromQuery = searchParams.get("share");
    if (ownerFromQuery) params.set("owner", ownerFromQuery);
    if (shareFromQuery) params.set("share", shareFromQuery);
    router.push(`?${params.toString()}`);

    // limiares diferentes: 5s filtros normais, 60s IA
    const threshold = isAiProcess ? 60000 : 5000;
    if (durationMs !== null && durationMs > threshold && !hasVideos) {
      const seconds = (durationMs / 1000).toFixed(1);
      toast({
        title: isAiProcess ? "Processamento de IA demorado" : "Processamento demorado",
        description: isAiProcess
          ? `Este processamento com ferramentas de IA demorou ${seconds} segundos. Isto ainda está dentro do limite aceitável para IA (até 1 minuto), mas foi mais lento do que o esperado.`
          : `Este processamento demorou ${seconds} segundos, acima do objetivo de 5 segundos para filtros normais.`,
      });
    }
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [run]);

if (project.isError) {
  // caso especial: projeto aberto via link de partilha
  if (shareId) {
    // tenta extrair o status do erro (React Query + Axios)
    const status =
      (project.error as any)?.response?.status ??
      (project.error as any)?.status;

    const data = (project.error as any)?.response?.data;

    // 429 = limite de editores ativos
    if (status === 429) {
      const active = data?.active;
      const limit = data?.limit;

      return (
        <div className="flex size-full justify-center items-center h-screen p-8">
          <Alert variant="destructive" className="w-fit max-w-[40rem] text-wrap truncate">
            <OctagonAlert className="size-4" />
            <AlertTitle>Limite de colaboradores atingido</AlertTitle>
            <AlertDescription>
              {typeof active === "number" && typeof limit === "number"
                ? `Este projeto já tem ${active}/${limit} editores ativos. Fecha uma sessão ou tenta novamente daqui a pouco.`
                : "Este projeto já tem o número máximo de editores ativos. Fecha uma sessão ou tenta novamente daqui a pouco."}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // 410 = revogado
    if (status === 410) {
      return (
        <div className="flex size-full justify-center items-center h-screen p-8">
          <Alert variant="destructive" className="w-fit max-w-[40rem] text-wrap truncate">
            <OctagonAlert className="size-4" />
            <AlertTitle>Link de partilha revogado</AlertTitle>
            <AlertDescription>
              Este link de partilha já não é válido. O proprietário revogou o acesso a este projeto.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // 404 = link inválido / não existe
    if (status === 404) {
      return (
        <div className="flex size-full justify-center items-center h-screen p-8">
          <Alert variant="destructive" className="w-fit max-w-[40rem] text-wrap truncate">
            <OctagonAlert className="size-4" />
            <AlertTitle>Link de partilha inválido</AlertTitle>
            <AlertDescription>
              Este link não existe ou o projeto já não está disponível.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // fallback para outros erros quando há shareId
    return (
      <div className="flex size-full justify-center items-center h-screen p-8">
        <Alert variant="destructive" className="w-fit max-w-[40rem] text-wrap truncate">
          <OctagonAlert className="size-4" />
          <AlertTitle>Erro ao abrir projeto</AlertTitle>
          <AlertDescription>
            Ocorreu um erro ao abrir este projeto partilhado. Tenta novamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // comportamento normal para projetos do próprio utilizador
  const { title, description } = getErrorMessage("project-load", project.error);

  return (
    <div className="flex size-full justify-center items-center h-screen p-8">
      <Alert variant="destructive" className="w-fit max-w-[40rem] text-wrap truncate">
        <OctagonAlert className="size-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}

  if (
    project.isLoading ||
    !project.data ||
    projectResults.isLoading ||
    !projectResults.data
  )
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );

const handleCancel = () => {
  if (!run || run.status !== "running") return;

  // parar tudo no UI (ADR-02: the run is shown as cancelled right away, as the
  // base closed its panel; the server state follows)
  runs.setRun({ ...run, status: "cancelled", finishedAt: new Date().toISOString() });

  // reabrir a sidebar em desktop 
  if (!isMobile) {
    sidebar.setOpen(true);
  }

  // limpar estado de preview (se alguma tool estava a fazer preview)
  setWaitingForPreview("");

  // cancelar no backend
  cancelProcess.mutate(
    {
      projectVersion: project.data.version
    },
    {
      onSuccess: () => {

      qc.invalidateQueries({
        queryKey: ["projectImages", session.user._id, pid, session.token, ownerId, shareId],
        refetchType: "all",
      });

        // voltar a ir buscar a sessão para atualizar remaining_operations
        updateSession.mutate({
          userId: session.user._id,
          token: session.token,
        });

        toast({
          title: "Processamento cancelado",
          description:
            "O processamento deste projeto foi cancelado. Podes ajustar as ferramentas e voltar a tentar.",
        });
      },
      
      onError: (error) => {
        // the run may still be going on: show what the server says
        runs.refreshProject(pid, ownerId, shareId);
        const { title, description } = getErrorMessage(
          "project-cancel-process",
          error,
        );
        toast({
          title,
          description,
          variant: "destructive",
        });
      },
    },
  );
};
  
  return (
    <ProjectProvider
      project={project.data}
      currentImage={currentImage}
      preview={{ waiting: waitingForPreview, setWaiting: setWaitingForPreview }}
      ownerId={ownerId}
      shareId={shareId}
      canEdit={canEdit && !running}
    >
      <div className="flex flex-col h-screen relative">
        {/* Barra de aviso quando o link partilhado é revogado */}
        {shareId && shareRevoked && (
          <div className="w-full border-b border-destructive bg-destructive/10 text-destructive text-sm px-4 py-2 text-center">
            O proprietário revogou o link. Já não podes editar este projeto.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-center items-start xl:items-center xl:justify-between border-b border-sidebar-border py-2 px-2 md:px-3 xl:px-4 h-fit gap-2">
          <div className="flex items-center justify-between w-full xl:w-auto gap-2">
            <h1 className="text-lg font-semibold truncate">
              {project.data.name}
            </h1>
            <div className="flex items-center gap-2 xl:hidden">
              <ViewToggle />
              <ModeToggle />
            </div>
          </div>
          <div className="flex items-center justify-between w-full xl:w-auto gap-2">
            <SidebarTrigger variant="outline" className="h-9 w-10 lg:hidden" />
                      <div className="flex items-center gap-2 flex-wrap justify-end xl:justify-normal w-full xl:w-auto">
              {mode !== "results" && (
                <>
                  <Button
                    disabled={
                      !canEdit ||
                      project.data.tools.length <= 0 ||
                      waitingForPreview !== "" ||
                      running ||
                      processProject.isPending
                    }
                    className="inline-flex"
                    onClick={() => {
                      // this page follows the run that starts now (ADR-02)
                      followRef.current = (run?.token ?? 0) + 1;

                      processProject.mutate(
                        {
                          projectVersion: project.data.version
                        },
                        {
                          onSuccess: async (result) => {
                            if (result.completed) {
                              // nothing changed since the last run: no run is opened
                              followRef.current = null;
                              await projectResults.refetch();
                              setWaitingForPreview("__APPLY_DONE__");
                              if (!isMobile) sidebar.setOpen(true);
                              const params = new URLSearchParams(searchParams.toString());
                              params.set("mode", "results");
                              params.set("view", "grid");
                              router.push(`?${params.toString()}`);
                            } else {
                              // the run-status event normally arrives first; ask in case it did not
                              runs.refreshProject(pid, ownerId, shareId);
                            }

                            updateSession.mutate({
                              userId: session.user._id,
                              token: session.token,
                            });
                          },
                          onError: (error: unknown) => {
                            followRef.current = null;
                            const { title, description } = getErrorMessage(
                              "project-process",
                              error,
                            );
                            toast({
                              title,
                              description,
                              variant: "destructive",
                            });
                          },
                        },
                      );
                    }}
                  >
                    <Play /> Apply
                  </Button>

          {canEdit && !running && (
            <>
                  <AiAssistantDialog
                    uid={session.user._id}
                    pid={pid}
                    token={session.token}
                    ownerId={ownerId}
                    shareId={shareId}
                    projectVersion={project.data.version}
                    currentTools={project.data.tools}
                    currentImgId={currentImage?._id}   
                  />

                  <PresetsDialog />
                  <AddImagesDialog />
          </>
          )}
                {/* botão Share só para o owner */}
                {session.user._id === ownerId && (
                  <ShareProjectDialog 
                  projectId={project.data._id} 
                  projectVersion={project.data.version}
                />
                )}
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="px-3"
                    title="Download project"
                    disabled={
                      downloadProjectImages.isPending ||
                      downloadProjectResults.isPending ||
                      downloadProjectPdf.isPending
                    }
                  >
                    {downloadProjectImages.isPending ||
                    downloadProjectResults.isPending ||
                    downloadProjectPdf.isPending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            (mode === "edit"
                              ? downloadProjectImages
                              : downloadProjectResults
                            ).mutate(
                              {
                                uid: session.user._id,
                                pid: project.data._id,
                                token: session.token,
                                projectName: project.data.name,
                                ownerId,
                                shareId,
                              },
                              {
                                onSuccess: () => {
                                  toast({
                                    title:
                                      mode === "edit"
                                        ? `Project ${project.data.name} downloaded as ZIP.`
                                        : `Results for ${project.data.name} downloaded as ZIP.`,
                                  });
                                },
                              },
                            );
                          }}
                          disabled={
                            downloadProjectImages.isPending || downloadProjectResults.isPending
                          }
                        >
                          {mode === "edit"
                            ? "Download media (ZIP)"
                            : "Download results (ZIP)"}
                        </DropdownMenuItem>

                          {/* A PDF only makes sense for images, so it is hidden for projects with videos */}
                          {!hasVideos && (
                          <DropdownMenuItem
                            onClick={() => {
                              downloadProjectPdf.mutate(
                                {
                                  uid: session.user._id,
                                  pid: project.data._id,
                                  token: session.token,
                                  ownerId,
                                  shareId,
                                  // em results queremos as EDITADAS, em edit queremos as originais
                                  useResults: mode === "results",
                                },
                                {
                                  onSuccess: () => {
                                    toast({
                                      title:
                                        mode === "results"
                                          ? `Results for ${project.data.name} downloaded as PDF.`
                                          : `Project ${project.data.name} downloaded as PDF.`,
                                    });
                                  },
                                },
                              );
                            }}
                            disabled={downloadProjectPdf.isPending}
                          >
                            {mode === "results"
                              ? "Download results (PDF)"
                              : "Download images (PDF)"}
                        </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>

              <div className="hidden xl:flex items-center gap-2">
                <ViewToggle />
                <ModeToggle />
              </div>
            </div>
          </div>
        </div>
        {/* Run of this project (ADR-02): a strip that does not block the page */}
        {(running || processProject.isPending) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-sidebar-border px-2 md:px-3 xl:px-4 py-2 text-sm">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            <span className="font-medium">Processing</span>
            <Progress value={running ? (run?.progress ?? 0) : 0} className="w-40 sm:w-64" />
            <span className="tabular-nums text-muted-foreground">
              {Math.floor(running ? (run?.progress ?? 0) : 0)}%
            </span>
            <span className="hidden lg:inline text-xs text-muted-foreground">
              You can keep using the app. We will let you know when it is done.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!running || cancelProcess.isPending}
              onClick={handleCancel}
            >
              {cancelProcess.isPending ? (
                <LoaderCircle className="size-[1em] animate-spin" />
              ) : (
                "Cancel"
              )}
            </Button>
          </div>
        )}

        {/* Main Content */}

        <div className="h-full overflow-x-hidden flex">
        <Toolbar />
        <ProjectImageList
          setCurrentImageId={setCurrentImage}
          results={projectResults.data}
        />
      </div>
      </div>
    </ProjectProvider>
  );
}