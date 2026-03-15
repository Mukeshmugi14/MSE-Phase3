# AI-MSE Docker Deployment Guide

To run this application on another device using Docker, follow these steps:

## Prerequisites
1. Ensure **Docker** and **Docker Compose** are installed on the target device.
2. Clone the repository:
   ```bash
   git clone https://github.com/Mukeshmugi14/MSE-Phase3.git
   cd MSE-Phase3
   ```

## Setup Environment Variables
The application requires several environment variables for Supabase and the Gemini API to function properly. 

1. Create a file named `.env.local` in the root of the cloned directory:
   ```bash
   touch .env.local
   ```
2. Copy your credentials into this file. It should look exactly like this:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Gemini API
   GEMINI_API_KEY=your_gemini_api_key

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

## Build and Run
Once the repository is cloned and the `.env.local` file is in place, you can build and start the container in detached mode:

```bash
docker-compose --env-file .env.local up --build -d
```

### What this command does:
- `--env-file .env.local`: Tells Docker Compose to load the environment variables from your file, injecting them into the Next.js build and runtime.
- `--build`: Forces Docker to build the optimized standalone Next.js image using the provided `Dockerfile`.
- `-d`: Runs the container in the background (detached mode) so it doesn't block your terminal.

## Accessing the App
After the build completes, the AI-MSE platform will be running and accessible at:
👉 **http://localhost:3000**

## Managing the Container
- To **stop** the application:
  ```bash
  docker-compose down
  ```
- To **view the live console logs**:
  ```bash
  docker logs -f ai-mse-web
  ```
