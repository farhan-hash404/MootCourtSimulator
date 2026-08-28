# ⚖️ CourtSimulator (Adalat AI)

> **Voice-First AI Moot Court Simulator for Pakistani Law Students**  
> An autonomous multi-agent courtroom (Judge, Opposing Counsel, Witness) orchestrated via LangGraph, powered by Hybrid RAG over a verified Pakistani statutory corpus with deterministic citation auditing and real-time voice streaming.

---

## 🏛️ Overview

**CourtSimulator** bridges the gap between legal academia and live courtroom advocacy. Built specifically for Pakistani law students, it provides a realistic, voice-interactive appellate and trial moot courtroom. As the student presents arguments or conducts cross-examinations, autonomous AI agents listen, evaluate procedural accuracy, raise timely objections, rule on legal grounds, and score performance against official statutory precedents.

### Key Highlights
- **🎭 Multi-Agent Autonomous Courtroom**: Powered by LangGraph state machines featuring a presiding **Judge** (ReAct reasoning with dynamic statutory retrieval), **Opposing Counsel** (adversarial objection generation on relevance, hearsay, leading questions, etc.), and **Witnesses** (grounded in sworn case facts).
- **🔍 Hybrid RAG & Re-ranking**: Combines Dense Vector Search (`text-embedding-3-small`, 1536-dim) and Sparse Lexical Search (**BM25**) merged via **Reciprocal Rank Fusion (RRF, $k=60$)**, followed by LLM-based reranking (achieving 1.00 Hit@1 on legal query benchmarks).
- **🛡️ Deterministic Citation Auditing**: Every statutory claim and legal section uttered by agents or students is cross-referenced against a verified corpus of 53 official provisions (QSO 1984, PPC 1860, CrPC 1898, and Constitution 1973). Fabricated provisions are immediately detected and penalised.
- **🎙️ Real-Time Voice Streaming**: Sub-second pipeline from browser audio recording $\rightarrow$ speech-to-text $\rightarrow$ graph turn stream $\rightarrow$ multi-character speech synthesis with distinct acoustic personae.
- **📊 Comprehensive Post-Trial Verdict**: Multi-criteria analytical scorecard evaluating argument structure, citation accuracy, objection handling, and persuasive advocacy.

---

## 🏗️ Architecture

The platform is architected as a clean 3-tier system with strict boundaries:

```mermaid
graph TD
    Client["💻 Web Client (React + Vite + TailwindCSS)<br/>artifacts/adalat-ai (Port 5173)"]
    API["⚡ API Gateway (Express + Drizzle ORM + Auth)<br/>artifacts/api-server (Port 5000)"]
    AI["🧠 AI & Reasoning Engine (FastAPI + LangGraph + RAG)<br/>artifacts/ai-service (Port 8000)"]
    DB[("🐘 PostgreSQL (pg_trgm)")<br/>Drizzle Schema Single Source of Truth]
    OpenAI["☁️ OpenAI APIs<br/>(Whisper-1, GPT-4o, TTS-1)"]

    Client <==>|"REST / SSE / Voice Chunks"| API
    API <==>|"Raw SQL / Sessions"| DB
    API <==>|"JSON / Stream"| AI
    AI <==>|"Embeddings & LLM"| OpenAI
    AI -.->|"Exact Cosine Scan & BM25"| DB
```

### Monorepo Structure
```
MootCourtSimulator/
├── artifacts/
│   ├── adalat-ai/          # Frontend Web Application (React 19, Vite, Tailwind CSS, Lucide)
│   ├── api-server/         # Backend Gateway (Node.js/Express, Drizzle ORM, Session Auth)
│   └── ai-service/         # Python AI Service (FastAPI, LangGraph, BM25, RRF, Citation Auditing)
├── data/
│   └── statutes/           # 53 verified statutory provisions (Constitution, QSO, PPC, CrPC)
├── docs/                   # Technical documentation, evaluation benchmarks, pitch slides & guides
├── lib/                    # Shared TypeScript packages (db, api-spec, api-zod, auth)
├── scripts/                # Database migrations, statute ingestion & corpus verification scripts
├── docker-compose.yml      # Full stack containerization
└── package.json            # Monorepo workspace configuration (pnpm)
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v20+` or `v22+`
- **pnpm**: `v10+` (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Python**: `3.12+` or `3.13+`
- **PostgreSQL**: PostgreSQL 15+ (with `pg_trgm` extension enabled) or a hosted instance (e.g. Supabase, Neon)
- **OpenAI API Key**

---

### Step 1: Clone Repository & Setup Environment

```bash
git clone https://github.com/your-username/MootCourtSimulator.git
cd MootCourtSimulator

# Copy example environment configuration
cp .env.example .env
```

Edit `.env` and fill in your keys:
```ini
# PostgreSQL Database URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_case_sim"

# Server Ports
PORT=5000
API_PORT=5000
BASE_PATH="/"

# OpenAI API Key
OPENAI_API_KEY="sk-proj-..."

# Session Cookie Secret (32+ characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET="your-32-character-secret-string-here"

# Python AI Service Endpoint
AI_SERVICE_URL="http://localhost:8000"
RERANKER_BACKEND="llm"
```

---

### Step 2: Install Dependencies

#### 1. Node.js Workspace Dependencies
```bash
pnpm install
```

#### 2. Python Virtual Environment & Dependencies
```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install core AI service dependencies
pip install -r requirements.txt
```

---

### Step 3: Database Migration & Statute Ingestion

Push the database schema using Drizzle and ingest the official Pakistani legal statutes:

```bash
# Push table schemas to PostgreSQL
pnpm run db:push

# Verify official statute corpus integrity (53/53 provisions)
pnpm run statutes:verify

# Ingest and embed statutes into database
pnpm run statutes:ingest
```

---

### Step 4: Run the Development Servers

You can launch each service individually across three terminals, or run all simultaneously:

| Service | Port | Dev Command | Description |
| :--- | :--- | :--- | :--- |
| **Python AI Service** | `8000` | `pnpm run dev:ai` | FastAPI, LangGraph Courtroom, Hybrid Search |
| **Express API Server** | `5000` | `pnpm run dev:api` | Backend gateway, authentication, session state |
| **Web Frontend** | `5173` | `pnpm run dev` | React + Vite UI with real-time audio controls |

#### Run Everything at Once:
```bash
# Terminal 1: Python AI Service
pnpm run dev:ai

# Terminal 2: API Server & Web UI
pnpm run dev:all
```

Open **`http://localhost:5173`** in your browser to start a moot court session!

---

## 🐳 Docker Deployment

The entire stack (PostgreSQL, Python AI Service, Express Gateway, Nginx Frontend) can be built and run with a single command:

```bash
docker compose up --build
```

- **Web Application**: `http://localhost:80` (or `http://localhost:3000`)
- **API Healthcheck**: `http://localhost:5001/api/healthz`
- **AI Service**: `http://localhost:8001/healthz`

---

## 📊 Evaluation & LLMOps Suite

The repository includes reproducible evaluation harnesses for measuring retrieval quality, judge reasoning, witness consistency, and adversarial robustness.

```bash
# 1. Retrieval & Judge Scoring Benchmarks (Hit@1, MRR, Rubric Discrimination)
pnpm run eval

# 2. Multi-Agent Courtroom Evaluation (Objection recall, ruling precision, routing leaks)
pnpm run eval:courtroom --runs 3

# 3. Witness Fabrication Gate (Cross-examination grounding & hallucination rate)
pnpm run eval:witness

# 4. Red-Team Jailbreak & Prompt-Injection Evaluation (36 attack vectors)
pnpm run eval:redteam

# 5. Launch MLflow Experiment Tracking UI
pnpm run eval:ui
```

### Benchmarked Metrics
- **Retrieval Hit@1**: `1.00` (RRF + LLM Reranking over golden test set)
- **Objection Decision Recall**: `1.00` (Opposing counsel catches all impermissible questions)
- **Witness Fabrication Rate**: `0 / 9` on ungrounded inquiries
- **Red-team Attack Success Rate**: `0 / 36` (All injection attacks intercepted by objection/judge routing)

---

## 📜 Verified Statutory Corpus

All provisions included in `data/statutes/*.json` have been verified word-for-word against official gazettes and prints:
- **Qanun-e-Shahadat Order, 1984 (QSO)**: 20 provisions (Relevance, Admissions, Hearsay, Privileges, Examination of Witnesses)
- **Pakistan Penal Code, 1860 (PPC)**: 15 provisions (Homicide, Culpable Homicide, Defamation, Kidnapping, Criminal Breach of Trust)
- **Code of Criminal Procedure, 1898 (CrPC)**: 10 provisions (Arrests, Remands, FIRs, Inquiries)
- **Constitution of the Islamic Republic of Pakistan, 1973**: 8 provisions (Fundamental Rights & Writs, updated through the 27th Amendment)

---

## 🧪 Testing & Code Quality

```bash
# Typecheck all TypeScript packages and applications
pnpm run typecheck

# Lint Python AI service
ruff check artifacts/ai-service

# Run Python unit tests
pytest artifacts/ai-service
```

---

## 👥 Authors & Capstone Team

- Developed as a Final Year Capstone Project in Artificial Intelligence & Law (2026).
- Supervised and evaluated on NLP, Hybrid RAG, Multi-Agent LangGraph Systems, and LLMOps metrics.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
