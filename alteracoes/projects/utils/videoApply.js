// UC-VID-003: validation is authoritative here; the worker also validates.
const { limitsFor } = require("./videoLimits");

function applyLimitsFor(profile) {
  const common = limitsFor(profile);
  if (!common) return null;
  return {
    ...common,
    maxDuration: profile === "premium" ? 600 : 120,
    maxWidth: profile === "premium" ? 3840 : 1920,
    maxHeight: profile === "premium" ? 2160 : 1080,
  };
}

function validateTools(tools, width, height, limits) {
  if (!Array.isArray(tools) || tools.length < 1 || tools.length > 3) {
    return { error: "Escolha entre 1 e 3 ferramentas." };
  }
  const chain = [];
  for (const tool of tools) {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      return { error: "Ferramenta inválida." };
    }
    switch (tool.type) {
      case "resize":
        if (![tool.width, tool.height].every((n) => Number.isInteger(n) && n >= 16 && n <= 3840)) {
          return { error: "A largura e a altura têm de ser inteiros entre 16 e 3840 px." };
        }
        chain.push({ type: "resize", width: tool.width, height: tool.height });
        width = tool.width;
        height = tool.height;
        break;
      case "binarization":
        if (!Number.isInteger(tool.threshold) || tool.threshold < 0 || tool.threshold > 255) {
          return { error: "O limiar tem de ser um inteiro entre 0 e 255." };
        }
        chain.push({ type: "binarization", threshold: tool.threshold });
        break;
      case "rotate":
        if (![90, 180, 270].includes(tool.degrees)) {
          return { error: "A rotação tem de ser de 90, 180 ou 270 graus." };
        }
        chain.push({ type: "rotate", degrees: tool.degrees });
        if (tool.degrees !== 180) [width, height] = [height, width];
        break;
      default:
        return { error: "Ferramenta não suportada. Escolha redimensionar, binarizar ou rodar." };
    }
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { error: "Não foi possível determinar a resolução do vídeo." };
  }
  if (width > limits.maxWidth || height > limits.maxHeight) {
    return { error: `A resolução final (${width} × ${height} px) excede o limite de ${limits.maxWidth} × ${limits.maxHeight} px do seu perfil.` +
      (limits.maxWidth === 1920 ? " Com o plano Premium tem limites maiores." : "") };
  }
  return { tools: chain, width, height };
}

module.exports = { applyLimitsFor, validateTools };
