# 🚀 AI-MSE Phase 3 Deployment Guide

This guide provides step-by-step instructions to run the AI-MSE platform on any device (Windows, macOS, or Linux).

## 📋 Prerequisites

### Quick Start (If you already have Docker/Git)
1. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
2. **Git**: [Download here](https://git-scm.com/downloads)

---

## 🍏 Special Instructions: Fresh Install on Mac M4 (Apple Silicon)

If you have a new Mac M4 and nothing is installed yet, follow these 3 steps:

### 1. Install Command Line Tools
Open your **Terminal** (CMD+Space, type "Terminal") and run:
```bash
xcode-select --install
```

### 2. Install Homebrew (Package Manager)
Paste this into your Terminal to install the most popular Mac tool manager:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 3. Install Git & Docker
Once Homebrew is installed, run:
```bash
brew install git
brew install --cask docker
```
*Note: After this, open the **Docker** app from your Applications folder and follow the on-screen setup.*

---

## 🛠 Step 1: Clone the Repository

Open your terminal (PowerShell, CMD, or Terminal) and run:

```bash
git clone https://github.com/Mukeshmugi14/MSE-Phase3.git
cd MSE-Phase3
```

---

## 🔑 Step 2: Configure Environment Variables

The project includes a `.env.local` file with default keys. If you need to use your own specialized keys:
1. Open `.env.local` in any text editor (Notepad, VS Code, etc.).
2. Update the `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Save the file.

---

## 🚀 Step 3: Run the Application

Choose the command based on your Operating System:

### For Windows (PowerShell)
```powershell
docker-compose --env-file .env.local up -d --build
```

### For macOS / Linux (Terminal)
```bash
chmod +x run.sh
./run.sh
```

---

## ⏳ Step 4: Wait for Initialization

The first time you run the app, it will download the **gemma3:4b** AI model (approx. 3GB). 
- To check the progress of the AI model download, run:
  ```bash
  docker logs -f ollama-pull-model
  ```

---

## 🌐 Step 5: Access the Platform

Once the containers are running, open your browser and go to:
👉 **http://localhost:3000**

---

## 🛑 Stopping the Application

To stop everything, run:
```bash
docker-compose down
```

## 📝 Troubleshooting
- **Port 3000 busy?** Ensure no other web servers are running.
- **Docker not running?** Make sure the Docker Desktop app is open and shows "Engine Running".
