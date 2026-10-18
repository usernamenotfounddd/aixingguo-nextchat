import { NextRequest, NextResponse } from "next/server";

import { getServerSideConfig } from "../../config/server";
import { TOKEN_COOKIE, resolveSession } from "../../utils/aixingguo";

const serverConfig = getServerSideConfig();

// Danger! Do not hard code any secret value here!
// 警告！不要在这里写入任何敏感信息！
const DANGER_CONFIG = {
  needCode: serverConfig.needCode,
  hideUserApiKey: serverConfig.hideUserApiKey,
  disableGPT4: serverConfig.disableGPT4,
  hideBalanceQuery: serverConfig.hideBalanceQuery,
  disableFastLink: serverConfig.disableFastLink,
  customModels: serverConfig.customModels,
  defaultModel: serverConfig.defaultModel,
  visionModels: serverConfig.visionModels,
};

declare global {
  type DangerConfig = typeof DANGER_CONFIG;
}

/** 模型 id → 展示名（不在表里的直接用 id） */
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-flash": "DeepSeek Flash",
  "qwen3.8-flash": "Qwen3.8 Flash",
  "qwen3.7-plus": "Qwen3.7 Plus",
  "glm-5.3-flash": "GLM-5.3 Flash",
  "glm-5.2": "GLM-5.2",
  "kimi-k2.6": "Kimi K2.6",
  "kimi-k2.7-code": "Kimi K2.7 Code",
  "minimax-m3": "MiniMax M3",
  "mimo-v2.6-flash": "MiMo V2.6 Flash",
  "hy4-preview": "混元 4 Preview",
  "longcat-2.0": "LongCat 2.0",
  "longcat-2.5-preview-free": "LongCat 2.5 Preview",
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "gpt-5.6-terra": "GPT-5.6 Terra",
  "gpt-6.1-sol": "GPT-6.1 Sol",
  "gpt-6-sol": "GPT-6 Sol",
  "gpt-6-astra": "GPT-6 Astra",
  "codex-auto-review": "Codex Auto Review",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-opus-5": "Claude Opus 5",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "muse-spark-1.3-contributor": "Muse Spark 1.3",
};

const PREFERRED_DEFAULT = "deepseek-v4.1-flash";

function toCustomModels(models: string[]): string {
  // -all 先清掉内置清单，再逐个登记；一律绑 @OpenAI（走本站同源代理）
  const entries = models.map(
    (m) => `+${m}@OpenAI=${MODEL_DISPLAY_NAMES[m] ?? m}`,
  );
  return ["-all", ...entries].join(",");
}

async function handle(req: NextRequest) {
  // 带面板会话时：按「这位用户自己的密钥所属分组」给出真正可用的模型清单
  try {
    const token = req.cookies.get(TOKEN_COOKIE)?.value;
    const session = await resolveSession(token);
    if (session && session.models.length > 0) {
      const models = session.models;
      const def = models.includes(PREFERRED_DEFAULT)
        ? PREFERRED_DEFAULT
        : models[0];
      console.log(
        "[Aixingguo] per-user model list:",
        models.length,
        "group=",
        session.groupId,
      );
      return NextResponse.json({
        ...DANGER_CONFIG,
        customModels: toCustomModels(models),
        defaultModel: `${def}@OpenAI`,
        // 内嵌场景不需要用户自己填密钥（服务端已用他自己的密钥转发）
        hideUserApiKey: true,
      });
    }
  } catch (e) {
    console.error("[Aixingguo] config session resolve failed", e);
  }

  return NextResponse.json(DANGER_CONFIG);
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
