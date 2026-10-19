# aixingguo-nextchat

AI 兴国（aixingguo.com）在线对话用的 **NextChat v2.16.1 定制构建**。

上游：[ChatGPTNextWeb/NextChat](https://github.com/ChatGPTNextWeb/NextChat)（MIT）。本仓库**不 fork 上游历史**：
构建时浅克隆上游指定 tag，再用 `overlay/` 覆盖几个文件。改的是行为，不是 UI。

## 目的

sub2api 的「自定义菜单项」页面会把面板身份拼在 iframe URL 上
（`?user_id=&token=&theme=&lang=&ui_mode=embedded&src_host=&src_url=`，见
`frontend/src/utils/embedded-url.ts`）。上游 NextChat 只会用「用户手填的 key」或
「服务端唯一的 `OPENAI_API_KEY`」，不会读 URL —— 于是嵌进去的页面要么让用户自己粘 key，
要么全站共用一把 key。

本构建补上第三条路：**用面板会话 token 换「这位用户自己的」key**，
密钥全程留在服务端，浏览器拿不到。

## 覆盖的文件（`overlay/`）

| 文件 | 作用 |
|---|---|
| `public/aixingguo-session.js`（新增） | 把 iframe URL 上的 `token` 落成 `aixingguo_token` cookie，并从地址栏抹掉 |
| `public/aixingguo-keypicker.js`（新增） | 右下角「密钥」选择器：列出**这位用户自己**的密钥（名称/分组/可用状态），选中的 id 写进 `aixingguo_key_id` cookie 后重载 |
| `app/api/aixingguo/keys/route.ts`（新增） | 给选择器用的密钥清单接口（只回 id/名称/分组/状态，**永不回明文**） |
| `app/utils/aixingguo.ts`（新增） | 服务端用该 token 调面板 `GET /api/v1/keys` 选出可用密钥，再调 `GET /v1/models` 取该密钥所属分组的模型；进程内缓存 5 分钟 |
| `app/api/common.ts` | `/api/openai/*` 转发时：客户端没带 key 而请求带会话 cookie → 用「用户选中的那把 key」转发（未选则取第一把可用；用户自己填了 key 则仍优先） |
| `app/api/config/route.ts` | `/api/config` 按会话返回**该用户分组的模型清单**（并隐藏密钥输入框） |
| `app/layout.tsx` | 引入 `aixingguo-session.js` |

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AIXINGGUO_PANEL_URL` | `https://aixingguo.com` | 面板地址（`/api/v1/keys`、`/v1/models` 的宿主） |
| `BASE_URL` | 部署时设 | NextChat 自己的上游地址，本站为 `https://aixingguo.com`（**不带 `/v1`**） |
| `CUSTOM_MODELS` / `DEFAULT_MODEL` | 部署时设 | 会话缺失（未登录/无 token）时的兜底清单 |

## 行为矩阵

| 场景 | 结果 |
|---|---|
| 从 `/custom/chat` 打开（URL 带 token） | 用**该用户自己的** key；右下角可切换用哪一把；模型清单 = 所选密钥所属分组，无密钥输入框 |
| 直接打开 `chat.aixingguo.com`（无 token，浏览器里有自己的 key） | 照上游行为：用浏览器里那把 key |
| 直接打开且没有任何 key | 401 `API_KEY_REQUIRED`（不会偷偷用站长的 key） |
| 用户 token 过期 / 没有可用密钥 | 退回兜底配置，用户可自行填 key |

## 构建

GitHub Actions（`.github/workflows/build.yml`）→ `ghcr.io/usernamenotfounddd/aixingguo-nextchat:2.16.1-aixingguo`。
服务器只需 `docker compose pull && docker compose up -d`。

## 升级上游

改 `.github/workflows/build.yml` 的 `NEXTCHAT_VERSION` 与 `overlay/` 里对应的三个上游文件（
`app/api/common.ts`、`app/api/config/route.ts`、`app/layout.tsx` 是整文件覆盖，升级时要重新对照上游该版本重打）。
