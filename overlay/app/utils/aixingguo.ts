/**
 * AI 兴国（aixingguo.com）面板会话 → 用户自己的 API Key
 *
 * 背景：sub2api 的「自定义菜单项」页面会把 user_id / token(=面板 JWT) 拼在 iframe URL 上
 * （frontend/src/utils/embedded-url.ts）。客户端脚本 aixingguo-session.js 把 token 存进
 * aixingguo_token cookie，本模块在【服务端】用这个 token 调面板的 /api/v1/keys，
 * 取到「这位用户自己的」sk- 密钥，供 /api/openai/* 转发使用，并按该密钥所属分组
 * 返回真正可用的模型列表。
 *
 * 设计约束：
 *  - 密钥只在服务端进程内短暂缓存（5 分钟），不回传浏览器；
 *  - 面板地址可用环境变量 AIXINGGUO_PANEL_URL 覆盖（默认 https://aixingguo.com）；
 *  - 只用 fetch，不碰 Node API → 可在 edge runtime 与 node runtime 复用。
 */

const PANEL_URL = (
  process.env.AIXINGGUO_PANEL_URL || "https://aixingguo.com"
).replace(/\/+$/, "");

export const TOKEN_COOKIE = "aixingguo_token";

export type PanelSession = {
  key: string;
  keyName: string;
  groupId?: number;
  models: string[];
  exp: number;
};

const cache = new Map<string, PanelSession>();
const TTL_MS = 5 * 60 * 1000;

async function fetchJson(url: string, token: string): Promise<any | undefined> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

function isUsable(k: any): boolean {
  if (!k || typeof k.key !== "string" || !k.key) return false;
  if (k.status && k.status !== "active") return false;
  if (k.expires_at && Date.parse(k.expires_at) <= Date.now()) return false;
  if (typeof k.quota === "number" && k.quota > 0 && (k.quota_used ?? 0) >= k.quota) {
    return false;
  }
  return true;
}

/** 用面板 token 解析出该用户可用的密钥 + 该密钥所属分组的模型清单 */
export async function resolveSession(
  token: string | undefined | null,
): Promise<PanelSession | undefined> {
  if (!token) return undefined;
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit;

  const json = await fetchJson(
    `${PANEL_URL}/api/v1/keys?page=1&page_size=100&sort_by=created_at&sort_order=desc`,
    token,
  );
  const items: any[] = json?.data?.items ?? [];
  const usable = items.filter(isUsable);
  if (!usable.length) return undefined;

  const chosen = usable[0];

  let models: string[] = [];
  const m = await fetchJson(`${PANEL_URL}/v1/models`, chosen.key);
  if (m?.data) {
    models = (m.data as any[]).map((x) => x?.id).filter(Boolean);
  }

  const session: PanelSession = {
    key: chosen.key,
    keyName: chosen.name ?? "",
    groupId: chosen.group_id,
    models,
    exp: Date.now() + TTL_MS,
  };
  cache.set(token, session);
  return session;
}
