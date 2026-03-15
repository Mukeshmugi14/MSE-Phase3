# AI-MSE (Intelligent Mental Status Examination) — Phase 3

An advanced, multimodal psychiatric assessment platform built to modernize the traditional Mental Status Examination. AI-MSE integrates real-time clinical AI capabilities to capture, process, and synthesize behavioral, cognitive, and affective data alongside a clinician's interaction.

## 🚀 Key Features (Phase 3)

### 1. Multimodal Clinical Analysis
- **Speech-to-Text (ASR):** Serverless, defensive audio chunk processing via Whisper models for highly accurate clinical transcription.
- **Acoustic & Prosody Tracking:** Real-time extraction of speech rate (WPM), pitch variance, pause frequencies, and latency metrics to quantify psychomotor retardation or pressured speech.
- **Facial Affect Recognition:** Integration of `face-api.js` and MediaPipe for frame-by-frame analysis of micro-expressions, dominant emotion classifications, and affect congruence.

### 2. Comprehensive Cognitive Screening
- Digit Span (Forward & Backward)
- Trail Making Test (Part A & B simulations)
- Delayed Word Recall & Semantic Fluency

### 3. Automated Formulations
- **Diagnostic Impression Engine:** Employs specialized LLMs (like Llama-3/Gemini) to synthesize raw session data into cohesive clinical summaries.
- **Risk Digest:** Automated flagging for imminent suicide risk, violence probability, and psychosis based on multimodal markers.
- **Clinical PDF Export:** Industry-standard PDF generation using `jspdf` for comprehensive, color-coded, 10-section patient reports suitable for EHR integration.

### 4. Premium Interface
- High-fidelity Glassmorphism design system.
- Real-time "Clinical HUD" for visualizing active data streams.
- Secure, OTP-based clinician authentication via Supabase.

---

## 🛠 Tech Stack

- **Core Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom CSS Variables
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security)
- **State Management:** React Hooks
- **Data Visualization:** Recharts
- **PDF Generation:** jsPDF + autoTable
- **AI / ML Integration:** `@google/genai`, `@xenova/transformers`, `face-api.js`

---

## 🐳 Docker Deployment (Recommended)

To run the application in a production-ready, isolated container environment on your local system, follow these steps:

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Port `3000` available on your host machine.

### Step 1: Environment Setup
Ensure you have a `.env.local` file in the root directory containing your API keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Gemini AI Integration
GEMINI_API_KEY=your_gemini_api_key

# Application Identity
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 2: Build and Run
Execute the following command in the root directory to build the optimized Next.js standalone image and boot the container in the background:

```bash
docker-compose --env-file .env.local up --build -d
```

### Step 3: Access the Application
The platform is now available securely at:
👉 **http://localhost:3000**

---

## 💻 Local Native Deployment (Development)

If you prefer to run the development server natively without Docker:

1. **Install Node Utilities:** Ensure Node.js v20+ is installed.
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

---

## 🔒 Security & Privacy Notice
*This application is a prototype. While it employs secure database rules (RLS), it processes highly sensitive Protected Health Information (PHI). Ensure HIPAA/GDPR compliance frameworks are implemented before any true clinical deployment.*
