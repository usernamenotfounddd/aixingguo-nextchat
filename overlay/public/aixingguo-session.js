/* AI 兴国 · 会话引导脚本
 *
 * 作用：sub2api 的自定义菜单页(iframe)会把面板身份拼在 URL 上
 * （?user_id=&token=&theme=&lang=&ui_mode=embedded&src_host=&src_url=）。
 * 这段脚本把那串 token 落到 aixingguo_token cookie（同源，NextChat 服务端可读），
 * 然后把 token 从地址栏/历史里抹掉，避免被截图、复制链接时外带。
 *
 * 之后 /api/config 与 /api/openai/* 会在服务端用该 token 调面板 /api/v1/keys
 * 换取「这位用户自己的」密钥 —— 浏览器全程拿不到密钥。
 */
(function () {
  try {
    var u = new URL(window.location.href);
    var token =
      u.searchParams.get("token") ||
      u.searchParams.get("access_token") ||
      "";
    if (!token) return;

    var maxAge = 7 * 24 * 60 * 60; // 7 天
    document.cookie =
      "aixingguo_token=" +
      encodeURIComponent(token) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";

    // 抹掉面板附加的身份参数（保留 theme/lang 之类无害的）
    ["token", "access_token", "user_id", "ui_mode", "src_host", "src_url"].forEach(
      function (k) {
        u.searchParams.delete(k);
      },
    );
    var qs = u.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      u.pathname + (qs ? "?" + qs : "") + u.hash,
    );
  } catch (e) {
    console.warn("[aixingguo-session]", e);
  }
})();
