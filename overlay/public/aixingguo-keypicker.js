/* AI 兴国 · 密钥选择器（在线对话页右下角）
 *
 * 用户在 /custom/chat 打开时（面板会话 cookie 存在），这里列出他自己的全部密钥，
 * 由他自己选一把来聊；选中的 id 写进 aixingguo_key_id cookie，服务端按它转发。
 * 只显示 id / 名称 / 所属分组 / 是否可用 —— 密钥明文永远不下发浏览器。
 */
(function () {
  "use strict";

  var TOKEN_COOKIE = "aixingguo_token";
  var KEY_COOKIE = "aixingguo_key_id";

  function getCookie(name) {
    var m = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"),
    );
    return m ? decodeURIComponent(m[1]) : "";
  }

  function setCookie(name, value, maxAge) {
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      (maxAge || 31536000) +
      "; SameSite=Lax";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isDark() {
    return (
      document.documentElement.classList.contains("dark") ||
      (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }

  var css = [
    "#aixingguo-keypill{position:fixed;right:12px;bottom:86px;z-index:2147483000;",
    "display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;",
    "font:12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;",
    "border:1px solid rgba(125,125,125,.35);backdrop-filter:blur(8px);transition:opacity .15s}",
    "#aixingguo-keypill:hover{opacity:.85}",
    "#aixingguo-keypill .dot{width:6px;height:6px;border-radius:50%;background:#22c55e}",
    "#aixingguo-keymask{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.45);",
    "display:flex;align-items:center;justify-content:center;padding:16px}",
    "#aixingguo-keybox{width:min(460px,100%);max-height:76vh;overflow:auto;border-radius:14px;",
    "padding:16px 16px 10px;font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",
    "box-shadow:0 18px 50px rgba(0,0,0,.35)}",
    "#aixingguo-keybox h3{margin:0 0 4px;font-size:15px;font-weight:600}",
    "#aixingguo-keybox .hint{margin:0 0 12px;font-size:12px;opacity:.65}",
    "#aixingguo-keybox .krow{display:flex;flex-direction:column;gap:2px;padding:10px 12px;",
    "border-radius:10px;border:1px solid transparent;cursor:pointer;margin-bottom:6px}",
    "#aixingguo-keybox .krow.dim{opacity:.45;cursor:not-allowed}",
    "#aixingguo-keybox .krow .top{display:flex;align-items:center;justify-content:space-between;gap:8px}",
    "#aixingguo-keybox .krow .nm{font-weight:600}",
    "#aixingguo-keybox .krow .meta{font-size:11.5px;opacity:.7}",
    "#aixingguo-keybox .krow .badge{font-size:11px;padding:1px 7px;border-radius:999px;white-space:nowrap}",
    "#aixingguo-keybox .foot{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}",
    "#aixingguo-keybox button{font:inherit;padding:7px 14px;border-radius:9px;cursor:pointer;",
    "border:1px solid rgba(125,125,125,.4);background:transparent;color:inherit}",
    "#aixingguo-keybox button.primary{background:#10a37f;border-color:#10a37f;color:#fff}",
  ].join("");

  var dark = [
    "#aixingguo-keypill{background:rgba(32,33,35,.9);color:#ececf1}",
    "#aixingguo-keybox{background:#202123;color:#ececf1}",
    "#aixingguo-keybox .krow:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}",
    "#aixingguo-keybox .krow.sel{border-color:#10a37f;background:rgba(16,163,127,.12)}",
    "#aixingguo-keybox .krow.lock{background:rgba(255,255,255,.03)}",
    "#aixingguo-keybox .badge.ok{background:rgba(34,197,94,.18);color:#4ade80}",
    "#aixingguo-keybox .badge.bad{background:rgba(239,68,68,.18);color:#f87171}",
  ].join("");

  var light = [
    "#aixingguo-keypill{background:rgba(255,255,255,.92);color:#202123;box-shadow:0 2px 10px rgba(0,0,0,.08)}",
    "#aixingguo-keybox{background:#fff;color:#202123}",
    "#aixingguo-keybox .krow:hover{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.1)}",
    "#aixingguo-keybox .krow.sel{border-color:#10a37f;background:rgba(16,163,127,.08)}",
    "#aixingguo-keybox .krow.lock{background:rgba(0,0,0,.02)}",
    "#aixingguo-keybox .badge.ok{background:rgba(34,197,94,.15);color:#15803d}",
    "#aixingguo-keybox .badge.bad{background:rgba(239,68,68,.12);color:#b91c1c}",
  ].join("");

  function injectCss() {
    var st = document.createElement("style");
    st.id = "aixingguo-keypicker-style";
    st.textContent = css + (isDark() ? dark : light);
    document.head.appendChild(st);
  }

  function closeModal() {
    var m = document.getElementById("aixingguo-keymask");
    if (m) m.remove();
  }

  function openModal(data) {
    closeModal();
    var mask = document.createElement("div");
    mask.id = "aixingguo-keymask";
    var usable = data.keys.filter(function (k) { return k.usable; }).length;
    var rows = data.keys
      .map(function (k) {
        var sel = k.id === data.selectedId;
        var cls = "krow" + (sel ? " sel" : "") + (k.usable ? "" : " dim lock");
        var badge = k.usable
          ? '<span class="badge ok">可用</span>'
          : '<span class="badge bad">' + esc(k.reason || "不可用") + "</span>";
        var rate =
          k.rateMultiplier != null
            ? "倍率 " + (k.rateMultiplier * 100).toFixed(0) + "%"
            : "";
        var meta = [k.groupName, rate].filter(Boolean).join(" · ");
        return (
          '<div class="' + cls + '" data-kid="' + k.id + '">' +
          '<div class="top"><span class="nm">' + esc(k.name) + (sel ? " ✓" : "") + "</span>" + badge + "</div>" +
          (meta ? '<div class="meta">' + esc(meta) + "</div>" : "") +
          "</div>"
        );
      })
      .join("");

    mask.innerHTML =
      '<div id="aixingguo-keybox" role="dialog" aria-label="选择密钥">' +
      "<h3>选择要用哪一把密钥</h3>" +
      '<p class="hint">都是你自己在控制台创建的密钥；密钥所属分组决定这次能用哪些模型。共 ' +
      esc(data.keys.length) + " 把，可用 " + esc(usable) + " 把。</p>" +
      rows +
      '<div class="foot"><button id="aixingguo-keyclose">关闭</button></div>' +
      "</div>";
    document.body.appendChild(mask);

    mask.addEventListener("click", function (e) {
      if (e.target === mask) closeModal();
    });
    document.getElementById("aixingguo-keyclose").onclick = closeModal;
    Array.prototype.forEach.call(
      mask.querySelectorAll(".krow"),
      function (row) {
        if (row.classList.contains("dim")) return;
        row.addEventListener("click", function () {
          var kid = row.getAttribute("data-kid");
          if (!kid) return;
          setCookie(KEY_COOKIE, kid, 31536000);
          // 分组变了 → 模型清单也变，重载让 /api/config 重新出清单
          window.location.reload();
        });
      },
    );
  }

  function renderPill(data) {
    var pill = document.createElement("div");
    pill.id = "aixingguo-keypill";
    pill.title = "选择要用哪一把密钥";
    var cur =
      data.selectedName ||
      (data.keys.filter(function (k) { return k.id === data.selectedId; })[0] || {}).name ||
      "未选择";
    pill.innerHTML =
      '<span class="dot"></span><span>密钥 · ' + esc(cur) + "</span>";
    pill.addEventListener("click", function () { openModal(data); });
    document.body.appendChild(pill);
  }

  function boot() {
    if (!getCookie(TOKEN_COOKIE)) return; // 不是从控制台内嵌打开的，不显示
    injectCss();
    fetch("/api/aixingguo/keys", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.keys || !data.keys.length) return;
        renderPill(data);
      })
      .catch(function (e) { console.warn("[aixingguo-keypicker]", e); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
