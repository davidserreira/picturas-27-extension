import type { ProjectVideo } from "./videos";

export type VideoApplyTool =
  | { type: "resize"; width: number; height: number }
  | { type: "binarization"; threshold: number }
  | { type: "rotate"; degrees: 90 | 180 | 270 };

export const APPLY_TOOL_LABELS = {
  resize: "Redimensionar",
  binarization: "Binarizar",
  rotate: "Rodar",
};

export function applyToolDescription(tool: VideoApplyTool) {
  switch (tool.type) {
    case "resize": return `Redimensionar para ${tool.width} × ${tool.height} px`;
    case "binarization": return `Binarizar (limiar ${tool.threshold})`;
    case "rotate": return `Rodar ${tool.degrees}°`;
  }
}

export function applyLimitsFor(profile: string) {
  return profile === "premium"
    ? { maxDuration: 600, maxSize: 2 * 1024 ** 3, maxWidth: 3840, maxHeight: 2160 }
    : { maxDuration: 120, maxSize: 200 * 1024 ** 2, maxWidth: 1920, maxHeight: 1080 };
}

export function applyDimensions(video: Pick<ProjectVideo, "width" | "height">, tools: VideoApplyTool[]) {
  let width = video.width ?? 0;
  let height = video.height ?? 0;
  for (const tool of tools) {
    if (tool.type === "resize") { width = tool.width; height = tool.height; }
    if (tool.type === "rotate" && tool.degrees !== 180) [width, height] = [height, width];
  }
  return { width, height };
}

export function applyToolsError(video: ProjectVideo, tools: VideoApplyTool[], profile: string): string | null {
  if (profile !== "free" && profile !== "premium") return "Crie uma conta para usar ferramentas de vídeo.";
  if (video.state !== "available") return "Este vídeo ainda não está disponível.";
  if (!(video.format === "mov" || (video.format === "mp4" && video.codec === "h264"))) {
    return "Formato não suportado. Formatos aceites: MP4 (H.264) e MOV";
  }
  const limits = applyLimitsFor(profile);
  const hint = profile === "free" ? " Com o plano Premium tem limites maiores." : "";
  if (!video.duration || video.duration > limits.maxDuration) {
    return `O seu perfil só permite editar vídeos até ${limits.maxDuration / 60} min.${hint}`;
  }
  if (video.size > limits.maxSize) return `O vídeo excede o limite de ${profile === "premium" ? "2 GB" : "200 MB"}.${hint}`;
  if (tools.length < 1 || tools.length > 3) return "Escolha entre 1 e 3 ferramentas.";
  for (const tool of tools) {
    if (tool.type === "resize" && ![tool.width, tool.height].every((n) => Number.isInteger(n) && n >= 16 && n <= 3840)) {
      return "A largura e a altura têm de ser inteiros entre 16 e 3840 px.";
    }
    if (tool.type === "binarization" && (!Number.isInteger(tool.threshold) || tool.threshold < 0 || tool.threshold > 255)) {
      return "O limiar tem de ser um inteiro entre 0 e 255.";
    }
    if (tool.type === "rotate" && ![90, 180, 270].includes(tool.degrees)) return "A rotação tem de ser de 90, 180 ou 270 graus.";
  }
  const { width, height } = applyDimensions(video, tools);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return "Não foi possível determinar a resolução do vídeo.";
  }
  if (width > limits.maxWidth || height > limits.maxHeight) {
    return `A resolução final (${width} × ${height} px) excede o limite de ${limits.maxWidth} × ${limits.maxHeight} px do seu perfil.${hint}`;
  }
  return null;
}
