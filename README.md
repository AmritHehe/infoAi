# footprint

InfoAI is a full-stack, AI-powered application that extracts digital footprint data from public social profiles (X/Twitter and LinkedIn) and allows users to interactively chat with a specialized AI agent about that person's background. It utilizes **Retrieval-Augmented Generation (RAG)** to provide highly accurate, hallucination-free answers based exclusively on the extracted profile context.

---

## 🌟 Features

- **Instant Profile Extraction:** Scrapes and processes public data from X/Twitter and LinkedIn instantly.
- **AI-Powered Chat:** Leverages OpenRouter LLMs to answer specific questions based on the extracted profile context.
- **RAG Architecture:** Uses localized chunking, embedding generation, and Postgres vector similarity search (`pgvector`) to find exact quotes and stats for the AI to reference.
- **Session Management:** Secure JWT authentication, persistent chat sessions, and profile caching to prevent redundant API/scraping calls.
- **Sleek Aesthetic:** A beautiful, minimalist "Island" architecture UI built with Next.js and Tailwind CSS v4.

---

## 🏗 System Architecture & Flow Diagram

The system operates as a Turborepo monorepo containing a **Next.js web client** and an **Express REST API backend**. 

```mermaid
sequenceDiagram
    participant U as User / Client (Next.js)
    participant A as Express API (Node.js)
    participant DB as Neon DB (Postgres + pgvector)
    participant S as Scraper (Puppeteer/Axios)
    participant LLM as OpenRouter API

    U->>A: 1. Submit Profile URL (X/LinkedIn)
    A->>DB: 2. Check Cache for Profile
    alt Not in Cache
        A->>S: 3. Trigger Scraper
        Note over S: Logs in via li_at cookie <br/> Scrolls & Extracts Data
        S-->>A: Return Raw Profile Data
        A->>DB: 4. Upsert Profile Data
    end
    
    A->>LLM: 5. Generate Vector Embeddings (Chunks)
    LLM-->>A: Return Text Embeddings
    A->>DB: 6. Store Vectors in pgvector
    
    A-->>U: 7. Profile Ready (UI Transitions to Chat)
    
    U->>A: 8. Send Chat Message
    A->>LLM: 9. Embed User Question
    LLM-->>A: Vector
    A->>DB: 10. Vector Similarity Search (Top-K Chunks)
    DB-->>A: Return matching context chunks
    A->>LLM: 11. LLM Chat Generation with Context (RAG)
    LLM-->>A: Final Answer
    A-->>U: 12. Display Answer to User
```

---

## 💻 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS v4, Lucide Icons.
- **Backend:** Node.js, Express, Puppeteer (Headless Web Scraping).
- **Database:** PostgreSQL (hosted on [Neon.tech](https://neon.tech/)) utilizing the `pgvector` extension for similarity search.
- **ORM:** Prisma Client.
- **AI & Embeddings:** OpenRouter AI.
- **Package Manager:** Bun / Turborepo.

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- A [Neon.tech](https://neon.tech/) PostgreSQL database (or any local Postgres instance with the `pgvector` extension enabled).
- An [OpenRouter](https://openrouter.ai/) account and API key for generating embeddings and chat completions.
- A LinkedIn account (to extract a `li_at` session cookie to bypass login walls).

### 2. Clone and Install
Clone the repository and install the dependencies from the root of the Turborepo:
```bash
git clone <your-repo-url>
cd infoai
bun install
```

### 3. Environment Variables
You need to set up environment variables for the backend API. Create a `.env` file inside `apps/api/.env`:

```env
# Server
PORT=8000
NODE_ENV=development

# Database
# Note: Ensure your database has the pgvector extension enabled!
DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# AI
OPENROUTER_API_KEY="sk-or-v1-..."

# LinkedIn Scraper Authentication
# You can get this by logging into LinkedIn, opening DevTools -> Application -> Cookies
LINKEDIN_LI_AT="your-linkedin-li_at-cookie-value"
```

### 4. Database Setup
Once your `.env` is configured with a valid Neon Postgres URL, generate the Prisma client and push the schema to your database.
```bash
cd apps/api
bunx prisma generate
bunx prisma db push
```

*Note: If Prisma complains about the `vector` type missing, you may need to manually run `CREATE EXTENSION vector;` in your Neon SQL editor before pushing.*

### 5. Run the Application
Start both the frontend and backend concurrently from the root directory using Turbo:
```bash
bun run dev
```

- **Frontend:** Localhost port 3000 (`http://localhost:3000`)
- **Backend API:** Localhost port 8000 (`http://localhost:8000`)

*(Note: If testing locally, ensure you update the `API_BASE` variable in `apps/web/app/lib/api.ts` to point to `http://localhost:8000` instead of the production EC2 URL).*

---

## 📌 Usage Guide

1. **Sign Up/In:** Create an account on the landing page to get an active JWT session token.
2. **Idle State:** Paste a valid X/Twitter handle (e.g., `elonmusk`) or an entire LinkedIn URL.
3. **Extraction & Chunking:** The backend will scrape the latest data, chunk it, request vector embeddings from OpenRouter, and save them directly to the Neon DB. 
4. **Chat:** Once the UI transitions to the Chat Island, begin asking targeted questions like *"Where does this person currently work?"* or *"What did they tweet about last week?"*.
5. **Session History:** You can access past conversations via the "Sessions" tab without needing to re-scrape or re-embed the user's profile.
