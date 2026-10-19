import { NextRequest, NextResponse } from "next/server";

import {
  KEY_COOKIE,
  TOKEN_COOKIE,
  listKeys,
  resolveSession,
} from "../../../utils/aixingguo";

/**
 * 给聊天页的「密钥选择器」用：返回这位用户自己的密钥清单（不含明文）。
 * 只有密钥 id / 名称 / 所属分组 / 是否可用 —— 真正的 sk- 永远留在服务端。
 */
async function handle(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ keys: [], selectedId: null });
  }
  const keys = await listKeys(token);
  const session = await resolveSession(
    token,
    req.cookies.get(KEY_COOKIE)?.value,
  );
  console.log(
    "[Aixingguo] keys list:",
    keys.length,
    "usable:",
    keys.filter((k) => k.usable).length,
    "selected:",
    session?.keyName ?? "(none)",
  );
  return NextResponse.json({
    keys,
    selectedId: session?.keyId ?? null,
    selectedName: session?.keyName ?? null,
  });
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
