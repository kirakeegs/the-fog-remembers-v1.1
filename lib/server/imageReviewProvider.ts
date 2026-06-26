export interface ImageReviewProviderConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface PublicImageReviewProviderConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
}

const DEFAULT_PROVIDER = "openai-compatible";
const DEFAULT_BASE_URL = "https://jiuuij.de5.net";
const DEFAULT_MODEL = "gpt-image-2";

export function getImageReviewProviderConfig(): ImageReviewProviderConfig {
  const provider = readEnv("FOG_IMAGE_REVIEW_PROVIDER") || DEFAULT_PROVIDER;
  const baseUrl = normalizeBaseUrl(readEnv("FOG_IMAGE_REVIEW_BASE_URL") || readEnv("IMAGE_GEN_BASE_URL") || DEFAULT_BASE_URL);
  const model = readEnv("FOG_IMAGE_REVIEW_MODEL") || readEnv("IMAGE_GEN_MODEL") || DEFAULT_MODEL;
  const apiKey = readEnv("FOG_IMAGE_REVIEW_API_KEY") || readEnv("IMAGE_GEN_API_KEY");

  if (!apiKey) {
    throw new Error("Missing FOG_IMAGE_REVIEW_API_KEY or IMAGE_GEN_API_KEY. Set it in .env.local or the server environment.");
  }

  return { provider, baseUrl, model, apiKey };
}

export function getPublicImageReviewProviderConfig(): PublicImageReviewProviderConfig {
  const provider = readEnv("FOG_IMAGE_REVIEW_PROVIDER") || DEFAULT_PROVIDER;
  const baseUrl = normalizeBaseUrl(readEnv("FOG_IMAGE_REVIEW_BASE_URL") || readEnv("IMAGE_GEN_BASE_URL") || DEFAULT_BASE_URL);
  const model = readEnv("FOG_IMAGE_REVIEW_MODEL") || readEnv("IMAGE_GEN_MODEL") || DEFAULT_MODEL;
  const apiKey = readEnv("FOG_IMAGE_REVIEW_API_KEY") || readEnv("IMAGE_GEN_API_KEY");

  return {
    provider,
    baseUrl,
    model,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: maskSecret(apiKey),
  };
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
