/**
 * AI 兴国（aixingguo.com）面板会话 → 用户自己的 API Key（支持多 key 选择）
 *
 * 数据流：
 *  1. sub2api 的自定义菜单页把 `?user_id=&token=` 拼在 iframe URL 上
 *  2. public/aixingguo-session.js 把 token 落成 aixingguo_token cookie
 *  3. 本模块在【服务端】用 token 调面板 GET /api/v1/keys，拿到这位用户的全部密钥
 *     （密钥明文只在这里持有，永不下发浏览器）
 *  4. 用户在 /custom/chat 右下角的选择器里选一把 → 客户端写 aixingguo_key_id cookie
 *     → 服务端按这个 id 选密钥；没选则回退到第一把可用密钥
 *  5. /api/config 按「所选密钥所属分组」返回真正可用的模型清单
 */
const PANEL_URL = (
  process.env.AIXINGGUO_PANEL_URL || "https://aixingguo.com"
).replace(/\/+$/, "");

export const TOKEN_COOKIE = "aixingguo_token";
export const KEY_COOKIE = "aixingguo_key_id";

/** 面板密钥的「安全投影」：可下发浏览器（不含明文） */
export type PanelKey = {
  id: number;
  name: string;
  groupId?: number;
  groupName?: string;
  rateMultiplier?: number;
  usable: boolean;
  reason?: string;
};

type RawKey = {
  id: number;
  key: string;
  name: string;
  group_id?: number;
  group?: {
    id?: number;
    name?: string;
    rate_multiplier?: number;
    status?: string;
  };
  status?: string;
  expires_at?: string | null;
  quota?: number;
  quota_used?: number;
};

export type PanelSession = {
  key: string;
  keyName: string;
  keyId: number;
  groupId?: number;
  models: string[];
};

const LIST_TTL = 60 * 1000;
const MODELS_TTL = 5 * 60 * 1000;

const listCache = new Map<string, { raw: RawKey[]; exp: number }>();
const modelsCache = new Map<number, { models: string[]; exp: number }>();

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

async function rawKeys(token: string): Promise<RawKey[]> {
  const hit = listCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.raw;
  const json = await fetchJson(
    `${PANEL_URL}/api/v1/keys?page=1&page_size=100&sort_by=created_at&sort_order=desc`,
    token,
  );
  const raw: RawKey[] = (json?.data?.items ?? []).filter(
    (k: any) => k && typeof k.key === "string" && k.key,
  );
  listCache.set(token, { raw, exp: Date.now() + LIST_TTL });
  return raw;
}

function usability(k: RawKey): { usable: boolean; reason?: string } {
  if (k.status && k.status !== "active") return { usable: false, reason: "已禁用" };
  if (k.group?.status && k.group.status !== "active")
    return { usable: false, reason: "所属分组已下架" };
  if (k.expires_at && Date.parse(k.expires_at) <= Date.now())
    return { usable: false, reason: "已过期" };
  if (typeof k.quota === "number" && k.quota > 0 && (k.quota_used ?? 0) >= k.quota)
    return { usable: false, reason: "额度已用完" };
  return { usable: true };
}

/** 可下发浏览器的密钥清单（不带明文） */
export async function listKeys(
  token: string | undefined | null,
): Promise<PanelKey[]> {
  if (!token) return [];
  const raw = await rawKeys(token);
  return raw.map((k) => {
    const u = usability(k);
    return {
      id: k.id,
      name: k.name || `密钥 ${k.id}`,
      groupId: k.group_id ?? k.group?.id,
      groupName: k.group?.name,
      rateMultiplier: k.group?.rate_multiplier,
      usable: u.usable,
      reason: u.reason,
    };
  });
}

async function modelsForKey(key: string, keyId: number): Promise<string[]> {
  const hit = modelsCache.get(keyId);
  if (hit && hit.exp > Date.now()) return hit.models;
  const m = await fetchJson(`${PANEL_URL}/v1/models`, key);
  const models: string[] = (m?.data ?? []).map((x: any) => x?.id).filter(Boolean);
  modelsCache.set(keyId, { models, exp: Date.now() + MODELS_TTL });
  return models;
}

/** 解析出「这次请求该用哪把密钥」 */
export async function resolveSession(
  token: string | undefined | null,
  keyIdCookie?: string | undefined | null,
): Promise<PanelSession | undefined> {
  if (!token) return undefined;
  const raw = await rawKeys(token);
  if (!raw.length) return undefined;
  const usable = raw.filter((k) => usability(k).usable);
  if (!usable.length) return undefined;

  const wanted =
    keyIdCookie && /^\d+$/.test(keyIdCookie) ? Number(keyIdCookie) : undefined;
  const chosen = (wanted && usable.find((k) => k.id === wanted)) || usable[0];

  return {
    key: chosen.key,
    keyName: chosen.name || `密钥 ${chosen.id}`,
    keyId: chosen.id,
    groupId: chosen.group_id ?? chosen.group?.id,
    models: await modelsForKey(chosen.key, chosen.id),
  };
}
