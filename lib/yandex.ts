import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getYandex(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.YANDEX_CLOUD_API_KEY,
      baseURL: "https://ai.api.cloud.yandex.net/v1",
    });
  }
  return _client;
}

export function yandexModel(): string {
  const folder = process.env.YANDEX_CLOUD_FOLDER;
  const model = process.env.YANDEX_CLOUD_MODEL ?? "gpt-oss-20b/latest";
  if (!folder) throw new Error("YANDEX_CLOUD_FOLDER is not set");
  return `gpt://${folder}/${model}`;
}
