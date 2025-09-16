# ReuniteAI

**AI-powered university lost & found platform.**  
ReuniteAI is a complete, AI-powered platform designed to automate the lost-and-found process for university campuses. It's a system of intelligent agents that work together to reconnect students with their belongings effortlessly.

---

## 🚀 Why ReuniteAI?
Campus lost & found systems are often fragmented, untrustworthy, and inefficient. Posters, group chats, and word-of-mouth make recovery slow and unreliable.  

ReuniteAI solves this by combining:
- **AI image matching** ([Hybrid search](https://docs.pingcap.com/tidbcloud/vector-search-hybrid-search/) using [TiDB](https://docs.pingcap.com) [vector search](https://docs.pingcap.com/tidbcloud/vector-search-overview/) and [full text search](https://docs.pingcap.com/tidbcloud/vector-search-full-text-search-sql/) capability on CLIP embeddings)  
- **Strict claim verification** (fraud prevention via LLM reasoning using [kimi-thinking-preview](https://platform.moonshot.ai/docs/guide/use-kimi-thinking-preview-model) Model)
- **User-friendly dashboard & notifications**  
<img width="1056" height="648" alt="reunite" src="https://github.com/user-attachments/assets/eaf3a911-7ed4-4582-8613-33f899a5bf1e" />
---

## ✨ Features
- 📷 **Report Lost/Found Items**: Upload an image (client auto-converts to high-quality JPEG; optional crop to 224×224).
- 🔎 **Smart Search**: Hybrid search using [TiDB](https://docs.pingcap.com) vector search and full text search capability on CLIP embeddings.
- ✅ **Fraud-Resistant Claim Flow**: AI verifies claims with strict yes/no logic; pickup codes for approved claims.
- 🔔 **In-App Notifications**: Matches, pending claims, and approvals delivered in 5 secs atm.
- 🔒 **Secure by Default**: [Clerk](clerk.com) authentication protects all API routes.
- ☁️ **Cloud-Native Stack**: Cloudinary for image hosting, [TiDB Serverless](https://www.pingcap.com/tidb-cloud-starter/) for data, [BentoML](https://bentoml.com/) for embeddings.

---

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, Vanilla JS (`/public`)  
- **Backend**: Node.js + Express (`/backend`)  
- **Database**: [TiDB Cloud](https://www.pingcap.com/tidb-cloud-starter/) (Serverless)
- **Auth**: Clerk (browser + server SDKs)  
- **Media Storage**: Cloudinary
- **Embeddings**: OpenAI [CLIP (Contrastive Language–Image Pre-training)](https://openai.com/research/clip) ViT-B/32 (`clip-vit-base-patch32`) via BentoML ([BentoCLIP](https://github.com/bentoml/BentoCLIP)) 
- **Verification Reasoning**: Moonshot AI [kimi-thinking-preview](https://platform.moonshot.ai/docs/guide/use-kimi-thinking-preview-model) Model.

## 🧠 Embeddings model & self-hosting
- This project uses OpenAI CLIP ViT-B/32 ([`clip-vit-base-patch32`](https://huggingface.co/openai/clip-vit-base-patch32)) for image embeddings.
- You can self-host the same model using BentoCLIP:
  - Repo: https://github.com/bentoml/BentoCLIP
  - After deploying, set `CLIP_API_URL` to your deployment's `/encode_image` endpoint.

---

## 📂 Project Structure
```text
ReuniteAI/
│
├── backend/              # Express backend
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── utils/
│
├── public/               # Static frontend
│   ├── *.html
│   ├── scripts/
│   └── styles/
│
├── LICENSE
└── README.md
```

---

## ⚡ Getting Started

### 1. Prerequisites
- Node.js & npm installed  
- Accounts & API keys for:
  - Clerk  
  - Cloudinary  
  - [TiDB Cloud](https://www.pingcap.com/tidb-cloud-starter/)
  - Moonshot AI ([kimi-thinking-preview](https://platform.moonshot.ai/docs/guide/use-kimi-thinking-preview-mode))  

### 2. Clone & Install
```bash
git clone https://github.com/oluwakayodemike/ReuniteAI.git
cd ReuniteAI/backend
npm install
```

### 3. Environment Variables

Create `backend/.env` (never commit secrets!):

```env
# Database (TiDB Cloud)
TIDB_CONNECTION_URL="mysql://<user>.<org>:<password>@<gateway-host>:4000/<db>"

# Embedding service (CLIP API SERVICE hosted on BentoML)
CLIP_API_URL="https://<your-bento-host>/encode_image"

# Cloudinary
CLOUDINARY_CLOUD_NAME="<cloud_name>"
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET="<api_secret>"

# Clerk
CLERK_PUBLISHABLE_KEY="<pk_...>"
CLERK_SECRET_KEY="<sk_...>"

# Claim verification (Moonshot)
MOONSHOT_API_KEY="<sk_...>"

# Optional
PORT=3001
```

`.env` already exists in the  `.gitignore`, please prevet.

### 4. Run the App

Start the backend with auto-reload:

```bash
cd backend
npm run dev
```

API runs on `http://localhost:3001`

Frontend can be opened via `public/index.html` or served via liveserver on Vscode.

---

## ⚠️ Dependency note: Clerk SDK
- This project targets `@clerk/clerk-sdk-node` version `^4.13.23`.
- Do not upgrade this dependency via `npm audit fix`, `npm update`, or similar unless you also refactor the authentication integration to the latest API.
- Upgrading without refactoring might break authentication (middleware, session/token retrieval, and helper APIs have changed in newer major versions).

---

## 📡 API Endpoints

Base path: `/api` (all routes protected by Clerk)

| Method | Endpoint                       | Description                                               |
| ------ | ------------------------------ | --------------------------------------------------------- |
| `POST` | `/items/report`                | Report a found item                                       |
| `POST` | `/items/search`                | Report a lost item + return `lostItemId`                  |
| `GET`  | `/items/matches/:lostItemId`   | Fetch potential matches                                   |
| `POST` | `/items/claim/start`           | Start claim, receive verification prompt                  |
| `POST` | `/items/claim/verify`          | AI verifies claim → returns yes/no + pickup code          |
| `GET`  | `/notifications`               | Get notifications (supports `limit`, `offset`, `is_read`) |
| `POST` | `/notifications/mark-read`     | Mark one notification as read                             |
| `POST` | `/notifications/mark-all-read` | Mark all notifications as read                            |

---

## 🖼️ Image Handling

* All non-JPEG uploads → converted to JPEG (95% quality).
* Filenames normalized (`photo.webp` → `photo.jpeg`).
* Optional **224×224 crop** ensures compatibility with OPENAI CLIP embeddings for accuracy.

---

## ✅ Claim Verification

* Prompt enforces **binary output**: `yes` or `no`.
* Deterministic config: `temperature=0.0`, `stream=false`.
* Any invalid output → defaults to manual review.
* On approval → pickup code + notifications sent.

---

## 🔔 Notifications UX

* Actionable notifications (e.g., matches) link directly to results.
* Non-actionable (e.g., approvals) remain static but can be marked read.
* Unread items display a subtle dot until dismissed.

---

## 🧩 Troubleshooting

* **401 from LLM API** → Check `MOONSHOT_API_KEY`.
* **Clerk auth issues** → Check both publishable (frontend) and secret (backend) keys.

---

## 🛤️ Roadmap

* [ ] Admin & moderation: RBAC, dashboards, manual review, audit log.
* [ ] Own auth: passwordless/OAuth, JWT sessions, MFA; dual-run then cut Clerk.
* [ ] Abuse prevention (rate limiting, anti-spam report).
* [ ] Matching upgrades: multi-image, deduping, prompt tuning.
* [ ] Add report items to be marked as Recent Activity without notification.
* [ ] Multi‑university support.
* [ ] Test coverage for pre-checks & notifications.
* [ ] Observability improvements (structured logs, metrics).
* [ ] Notifications: real-time (SSE/WebSocket) + email fallback.

---

## 📜 License

Distributed under the [MIT License](./LICENSE).
