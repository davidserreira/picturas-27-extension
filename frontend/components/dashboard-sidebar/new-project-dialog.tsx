import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAddProject } from "@/lib/mutations/projects";
import ImageSubmissionArea from "../image-submission-area";
import { useSession } from "@/providers/session-provider";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/error-messages";
import { startVideoImport } from "@/lib/video-imports";
import { getVideoErrorMessage, hasVideoExtension } from "@/lib/videos";

export default function NewProjectDialog({
  files = [],
  setFiles,
  children,
}: {
  files?: File[];
  setFiles?: (files: File[]) => void;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const session = useSession();
  const addProject = useAddProject(session.user._id, session.token);

  // the submission area hands over images and videos together
  const images = imageFiles.filter((f) => !hasVideoExtension(f.name));
  const videos = imageFiles.filter((f) => hasVideoExtension(f.name));
  const videoProblem =
    videos.length === 0
      ? null
      : session.user.type === "anonymous"
        ? "A importação de vídeo não está disponível no perfil anónimo. Crie uma conta para importar vídeos."
        : videos.length > 1
          ? "Só é possível importar um vídeo de cada vez."
          : null;

  function handleCreate() {
    addProject.mutate(
      {
        uid: session.user._id,
        token: session.token,
        name: name,
        images,
      },
      {
        onSuccess: async (project) => {
          setOpen(false);
          toast({
            title: "Projeto criado com sucesso",
            description:
              images.length > 0
                ? "As imagens foram adicionadas ao novo projeto."
                : undefined,
          });
          if (!project) return;
          router.push(`/dashboard/${project._id}`);

          // the video is sent in the background, like any other import
          for (const video of videos) {
            try {
              await startVideoImport({
                uid: session.user._id,
                pid: project._id,
                token: session.token,
                file: video,
              });
            } catch (error) {
              toast({
                title: "O vídeo não foi importado",
                description: getVideoErrorMessage(error),
                variant: "destructive",
              });
            }
          }
        },
        onError: (error) => {
          const { title, description } = getErrorMessage("project-create", error);
          toast({
            title,
            description,
            variant: "destructive",
          });
        },
      },
    );
  }

  useEffect(() => {
    if (files.length > 0) {
      setOpen(true);
    }
  }, [files]);

  useEffect(() => {
    setName("");
    setImageFiles([]);
    if (setFiles && open === false) setFiles([]);
  }, [open, setFiles]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          placeholder="Enter project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ImageSubmissionArea
          onDrop={(files) => setImageFiles(files)}
          receivedFiles={files}
          acceptVideos
        />
        {videoProblem && (
          <p className="text-sm text-destructive">{videoProblem}</p>
        )}
        <DialogFooter>
          <Button
            onClick={() => handleCreate()}
            disabled={
              name.trim() === "" || !!videoProblem || addProject.isPending
            }
            className="inline-flex items-center gap-1"
          >
            <span>Create</span>
            {addProject.isPending && (
              <LoaderCircle className="size-[1em] animate-spin" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
