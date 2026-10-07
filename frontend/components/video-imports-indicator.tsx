"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  cancelLocalVideoImport,
  dismissVideoImport,
  useListedVideoProject,
  useVideoImports,
} from "@/lib/video-imports";
import { VIDEO_STATE_LABELS } from "@/lib/videos";

// Shows the video imports started in this tab while the user is somewhere
// else in the app; when the project's video list is on screen, they are there.
export function VideoImportsIndicator() {
  const tasks = useVideoImports();
  const listedProject = useListedVideoProject();

  const uploading = tasks.some((t) => t.state === "uploading");
  useEffect(() => {
    if (!uploading) return;

    // leaving the app (not just the page) stops the upload
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const visible = tasks.filter((t) => t.pid !== listedProject);
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {visible.map((task) => {
        const percent = Math.min(
          100,
          Math.floor((task.sent * 100) / task.size),
        );
        const active =
          task.state === "uploading" || task.state === "validating";

        return (
          <Card key={task.id} className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <Film className="size-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/dashboard/${task.pid}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {task.name}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title={active ? "Cancelar" : "Fechar"}
                onClick={() =>
                  active
                    ? cancelLocalVideoImport(task.id).catch(() => {})
                    : dismissVideoImport(task.id)
                }
              >
                <X />
              </Button>
            </div>
            {task.state === "uploading" && <Progress value={percent} />}
            <p className="text-xs text-muted-foreground">
              {VIDEO_STATE_LABELS[task.state]}
              {task.state === "uploading" && ` · ${percent}%`}
              {task.state === "failed" && task.reason && ` · ${task.reason}`}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
