"use client";

// RNF-F2-02: running projects with their progress, for the pages whose
// sidebar does not list the projects (the account pages).

import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Progress } from "@/components/ui/progress";
import { useRuns } from "@/providers/runs-provider";

export function ActiveRuns() {
  const { runs } = useRuns();
  const running = Object.values(runs).filter((r) => r.state === "running");
  if (running.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Em processamento</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {running.map((r) => (
            <SidebarMenuItem key={r.projectId}>
              <SidebarMenuButton asChild className="h-fit py-1">
                <Link href={`/dashboard/${r.projectId}`}>{r.projectName}</Link>
              </SidebarMenuButton>
              <div className="flex items-center gap-2 px-2 pb-1">
                <Progress
                  value={r.percent}
                  aria-label={`Processing ${r.projectName}`}
                  className="h-1.5"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.floor(r.percent)}%
                </span>
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
