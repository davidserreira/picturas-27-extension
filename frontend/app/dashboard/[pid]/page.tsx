"use client";

import { Download, LoaderCircle, OctagonAlert, Play } from "lucide-react";
import { fetchProjectRun, resolveShareLink } from "@/lib/projects";
import { useRuns } from "@/providers/runs-provider";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUpdateSession } from "@/lib/mutations/session";
import { getErrorMessage } from "@/lib/error-messages";
import { PresetsDialog } from "@/components/presets/presets-dialog";
import { AiAssistantDialog } from "@/components/assistant/ai-assistant-dialog";

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
  const [currentImage, setCurrentImage] = useState<ProjectImage | null>(null);
  // True while a run of this project is in progress (set optimistically on
  // Apply, then kept in sync with the run state of the projects service).
  const [processing, setProcessing] = useState<boolean>(false);
  const [waitingForPreview, setWaitingForPreview] = useState<string>("");
  const [canEdit, setCanEdit] = useState(true);

  // estado para saber se o link de partilha foi revogado
  const [shareRevoked, setShareRevoked] = useState(false);

  // início do processamento
  const processStartTimeRef = useRef<number | null>(null);

  // se um processamento envolve ferramentas de IA ou não
  const processIsAiRef = useRef<boolean>(false);

  // RNF-F2-02: the run state (and its progress) is owned by the projects
  // service, so it survives reloads, page changes and new sessions.
  const { getRun, upsertRun } = useRuns();
  const run = getRun(pid);
  const runPercent = run?.state === "running" ? run.percent : 0;
  // Latest run token known when Apply was pressed (older runs are ignored)
  const applyBaseTokenRef = useRef<number | null>(null);
  // Token of the run this page has seen running
  const runningTokenRef = useRef<number | null>(null);
  // Called when the run followed by this page completes (set further below)
  const onRunCompletedRef = useRef<() => void>(() => {});

  const projectImgs = project.data?.imgs ?? [];
  const hasVideos = projectImgs.some((i) => isVideo(i));
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

// RNF-F2-02: state of the latest run when the page opens (after a reload,
// a page change or in a new session).
useEffect(() => {
  if (!session.token) return;
  let cancelled = false;
  fetchProjectRun(session.user._id, pid, session.token, ownerId, shareId)
    .then((r) => {
      if (!cancelled && r) upsertRun(r);
    })
    .catch(() => {
      /* without a run state the page simply shows no progress */
    });
  return () => {
    cancelled = true;
  };
}, [pid, session.user._id, session.token, ownerId, shareId, upsertRun]);

// Users of a share link who did not start the run do not receive its socket
// events, so the page refreshes the run state while it is processing.
useEffect(() => {
  if (!processing || !shareId || !session.token) return;
  const id = setInterval(() => {
    fetchProjectRun(session.user._id, pid, session.token, ownerId, shareId)
      .then((r) => r && upsertRun(r))
      .catch(() => {});
  }, 5000);
  return () => clearInterval(id);
}, [processing, pid, session.user._id, session.token, ownerId, shareId, upsertRun]);

// Follow the run state pushed by the projects service.
useEffect(() => {
  if (!run) return;

  if (run.state === "running") {
    const base = applyBaseTokenRef.current;
    if (base !== null && run.token <= base) return; // an older run
    applyBaseTokenRef.current = null;
    runningTokenRef.current = run.token;
    setProcessing(true);
    return;
  }

  // The run ended: only react if it is the run this page is following.
  const base = applyBaseTokenRef.current;
  const followed =
    runningTokenRef.current === run.token || (base !== null && run.token > base);
  if (!processing || !followed) return;

  runningTokenRef.current = null;
  applyBaseTokenRef.current = null;

  if (run.state === "completed") {
    onRunCompletedRef.current();
  } else {
    // cancelled or failed: the RunsProvider already shows the toast
    processStartTimeRef.current = null;
    processIsAiRef.current = false;
    setProcessing(false);
  }
}, [run, processing]);

onRunCompletedRef.current = () => {
  const startedAt = processStartTimeRef.current;
  const isAiProcess = processIsAiRef.current;
  processStartTimeRef.current = null;
  processIsAiRef.current = false;

  projectResults.refetch().then(() => {
    setProcessing(false);

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

    if (startedAt != null) {
      const durationMs = performance.now() - startedAt;
      const seconds = durationMs / 1000;
      console.log(
        `[Perf] Processamento ${isAiProcess ? "IA" : "normal"} concluído em ${seconds.toFixed(2)}s`,
      );

      // limiares diferentes: 5s filtros normais, 60s IA
      const threshold = isAiProcess ? 60000 : 5000;
      if (durationMs > threshold && !hasVideos) {
        toast({
          title: isAiProcess
            ? "Processamento de IA demorado"
            : "Processamento demorado",
          description: isAiProcess
            ? `Este processamento com ferramentas de IA demorou ${seconds.toFixed(
                1,
              )} segundos. Isto ainda está dentro do limite aceitável para IA (até 1 minuto), mas foi mais lento do que o esperado.`
            : `Este processamento demorou ${seconds.toFixed(
                1,
              )} segundos, acima do objetivo de 5 segundos para filtros normais.`,
        });
      }
    }
  });
};

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
  // cancelar medição de tempo e tipo
  processStartTimeRef.current = null;
  processIsAiRef.current = false;

  // parar tudo no UI (the run itself is finished by the projects service)
  setProcessing(false);
  runningTokenRef.current = null;
  applyBaseTokenRef.current = null;

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

        // the "cancelled" toast comes from the RunsProvider (run-update)
      },
      
      onError: (error) => {
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
      canEdit={canEdit}
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
                      processing ||
                      project.data.tools.length <= 0 ||
                      waitingForPreview !== ""
                    }
                    className="inline-flex"
                    onClick={() => {
                      // começa a contar o tempo
                      processStartTimeRef.current = performance.now();
                      // runs up to this token are older than this Apply
                      applyBaseTokenRef.current = run?.token ?? -1;
                      setProcessing(true);
                      
                      const aiProcedures = [
                        "bg_remove_ai",
                        "cut_ai",
                        "obj_ai",
                        "people_ai",
                        "text_ai",
                        "upgrade_ai",
                        "expand_ai",
                        "subtitles",
                      ];

                      processIsAiRef.current = project.data.tools.some((t) =>
                        aiProcedures.includes(t.procedure),
                      );

                      processProject.mutate(
                        {
                          projectVersion: project.data.version
                        },
                        {
                          onSuccess: async (result) => {
                            if (result.completed) {
                              await projectResults.refetch();
                              setProcessing(false);
                              applyBaseTokenRef.current = null;
                              processStartTimeRef.current = null;
                              processIsAiRef.current = false;
                              setWaitingForPreview("__APPLY_DONE__");
                              const params = new URLSearchParams(searchParams.toString());
                              params.set("mode", "results");
                              params.set("view", "grid");
                              router.push(`?${params.toString()}`);
                            } else {
                              setProcessing(true);
                            }

                            updateSession.mutate({
                              userId: session.user._id,
                              token: session.token,
                            });
                          },
                          onError: (error: unknown) => {
                            setProcessing(false);
                            applyBaseTokenRef.current = null;
                            if (processStartTimeRef.current !== null) {
                              const durationMs =
                                performance.now() - processStartTimeRef.current;
                              console.error(
                                `[Perf] Processamento ${
                                  processIsAiRef.current ? "IA" : "normal"
                                } falhou logo no arranque após ${
                                  (durationMs / 1000).toFixed(2)
                                }s`,
                              );
                              processStartTimeRef.current = null;
                              processIsAiRef.current = false;
                            }

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

          {canEdit && (
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
        {/* RNF-F2-02: non-blocking progress of the run of this project */}
        {processing && (
          <div
            role="region"
            aria-label="Processing"
            className="flex items-center gap-3 border-b border-sidebar-border px-4 py-2 text-sm"
          >
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
            <span className="font-medium">A processar</span>
            <Progress
              value={runPercent}
              aria-label={`Processing ${project.data.name}`}
              className="max-w-96"
            />
            <span className="tabular-nums text-muted-foreground">{Math.floor(runPercent)}%</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || cancelProcess.isPending}
              onClick={handleCancel}
            >
              {cancelProcess.isPending ? (
                <LoaderCircle className="size-[1em] animate-spin" />
              ) : (
                "Cancelar"
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