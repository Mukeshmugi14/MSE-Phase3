# System and Dependency Requirements (AI-MSE)

Below are the hardware, software, and external dependency requirements needed to build and run the AI-MSE platform locally or via Docker.

## 💻 Hardware Requirements

### Minimum Specifications
- **CPU:** Quad-core processor (Intel i5 / AMD Ryzen 5 or equivalent)
- **RAM:** 8 GB
- **Storage:** 5 GB available space
- **Peripherals:** 720p Webcam & built-in/external Microphone (required for Multimodal capture)

### Recommended Specifications (For Local AI Processing)
- **CPU:** 8-core processor
- **RAM:** 16 GB+
- **GPU:** Dedicated GPU with at least **4GB VRAM** (e.g., Nvidia RTX series). 
  - *Note: Essential if running Llama-3 locally via Ollama or processing Whisper transcriptions natively without cloud fallbacks.*

---

## 🛠 Software Requirements

### Option A: Native Development Environment
If you intend to run the Next.js server directly on your operating system:
- **OS:** Windows 10/11, macOS, or Linux
- **Node.js:** v20.x or higher (LTS recommended)
- **Package Manager:** `npm` (v10+), `yarn`, or `pnpm`
- **Git:** v2.30+

### Option B: Containerized Deployment (Recommended)
If you intend to isolate the environment to avoid dependency conflicts:
- **Docker:** Docker Desktop v4.20+ (Ensure WSL2 backend is enabled on Windows)
- **Docker Compose:** v2+ (Included with Docker Desktop)

---

## 📦 Application Dependencies (package.json)

The core architecture is built upon the following primary technologies:

### 1. Framework & Runtime
- **Next.js:** `14.2.5` (App Router, Server Actions)
- **React:** `^18`
- **React DOM:** `^18`

### 2. Clinical AI & Multimodal Models
- **Google Gen AI:** `@google/genai` (For cloud-based diagnostic impression fallbacks)
- **Transformers.js:** `@xenova/transformers` (For local/in-browser Whisper ASR transcription)
- **MediaPipe Face Mesh:** `@mediapipe/face_mesh` (For 3D facial landmark detection)
- **Face API:** `face-api.js` (For emotional state classification)

### 3. Database & Authentication
- **Supabase SSR:** `@supabase/ssr` 
- **Supabase JS Client:** `@supabase/supabase-js`

### 4. UI & Data Visualization
- **Tailwind CSS:** `^3.4.1` (With PostCSS and Autoprefixer)
- **Recharts:** `^2.15.4` (For rendering the Affective Timeline and Acoustic tracks)

### 5. Reporting
- **jsPDF:** `^4.2.0` (Client-side PDF generation)
- **jsPDF-AutoTable:** `^5.0.7` (Complex table rendering for MSE Domains)

---

## 🔑 External Service Requirements

You must provision accounts and acquire API keys for these external integrations:

1. **Supabase Project:**
   - Requires a distinct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - The `SUPABASE_SERVICE_ROLE_KEY` is required for bypass/admin functions (e.g., creating patient records independently of RLS).
   - SQL Migrations (located in `/supabase/migrations`) must be executed to structure the `patients`, `users`, and `sessions` tables.

2. **Google Cloud (Gemini):**
   - Requires a `GEMINI_API_KEY` to run the Clinical Synthesis and Diagnostic Impression engine.

*Please refer to the `README.md` for exact `.env.local` configuration procedures.*
