# 🌐 Monopoly India: Worldwide Multiplayer Public Hosting Setup

This guide details the complete architecture, deployment workflow, and operational procedures for hosting **Indian Monopoly** publicly for worldwide multiplayer using **GitHub Pages** (frontend) and **Render Free Web Service** (authoritative Node.js + Socket.IO backend).

---

## 📑 Table of Contents

1. [Architectural Overview: LAN vs. Public Hosted Mode](#1-architectural-overview-lan-vs-public-hosted-mode)
2. [Branching & Safety Strategy](#2-branching--safety-strategy)
3. [Step-by-Step Render Deployment](#3-step-by-step-render-deployment)
4. [Step-by-Step GitHub Pages Configuration](#4-step-by-step-github-pages-configuration)
5. [Verifying Backend Health & Connectivity](#5-verifying-backend-health--connectivity)
6. [Testing Worldwide Multiplayer Across Networks](#6-testing-worldwide-multiplayer-across-networks)
7. [Preserving Offline Wi-Fi LAN Mode](#7-preserving-offline-wi-fi-lan-mode)
8. [Render Free-Tier Behavior & State Management](#8-render-free-tier-behavior--state-management)
9. [Troubleshooting Guide](#9-troubleshooting-guide)

---

## 1. Architectural Overview: LAN vs. Public Hosted Mode

The application supports two independent, non-conflicting multiplayer execution modes using the exact same server-authoritative game engine:

| Capability / Attribute | 🏠 Local Wi-Fi (LAN) Mode | 🌐 Public Hosted Worldwide Mode |
|---|---|---|
| **Primary Use Case** | Living room, dorm, office local network play | Friends & players across different cities or networks |
| **Frontend Location** | Served locally from the Node host at `http://<LAN_IP>:4173` | Hosted on GitHub Pages: `https://k-692.github.io/Monopoly-India-Game/` |
| **Backend Location** | Local machine running `npm run lan:host` | Render Free Web Service (Node.js 20/22 runtime) |
| **Connection Configuration** | Detects local page origin or dev port `5173 -> 4173` | Reads `VITE_SERVER_URL` at build time |
| **CORS Policy** | Permissive (local IPs and development ports) | Strict: Only `https://k-692.github.io` permitted |
| **Internet Requirement** | Fully offline (zero internet required) | Internet required for all connected clients |
| **State Persistence** | In-memory on host machine | In-memory on Render instance (single instance) |
| **Invite Links** | `http://<LAN_IP>:4173/#/join/<code>` | `https://k-692.github.io/Monopoly-India-Game/#/join/<code>` |

```
                       [ Worldwide Public Players ]
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-------------------------------+             +----------------------------------+
|         GitHub Pages          |             |         Render Web Service       |
|    (Static React 19 Frontend) |             |     (Authoritative Node Server)  |
| https://k-692.github.io/...   |             | https://<your-render-app>.render |
+---------------+---------------+             +-----------------+----------------+
                |                                               ^
                | Reads VITE_SERVER_URL at build time           |
                +=================== Socket.IO ================>+
                                    (WebSocket + Polling)
```

---

## 2. Branching & Safety Strategy

All public hosting configurations and workflows are maintained on a dedicated branch:

- **Branch Name:** `feature/render-public-hosting`
- **Base:** Latest `origin/main`

### Non-Interference Guarantee
- The default `main` branch remains untouched and strictly preserved for standard LAN gameplay and development.
- Existing LAN scripts (`npm run lan:host`, `npm run lan:dev`, `npm run server`) and environment files (`.env.lan`, `.env.example`) remain unmodified and fully functional.
- The new GitHub Pages deployment workflow triggers **only** on pushes to `feature/render-public-hosting`, never on `main`.

---

## 3. Step-by-Step Render Deployment

### Option A: Automatic Blueprint Deployment (Recommended)

1. Log in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the upper right, then select **Blueprint**.
3. Connect your GitHub repository: `https://github.com/K-692/Monopoly-India-Game`.
4. Select the branch: `feature/render-public-hosting`.
5. Render will automatically detect `render.yaml` at the root of the repository:
   - **Service Name:** `monopoly-india-server`
   - **Plan:** Free ($0/month)
   - **Runtime:** Node
   - **Build Command:** `npm ci --include=dev && npm run build:server`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Environment Variables:**
     - `NODE_ENV=production`
     - `CLIENT_ORIGIN`: Set in the Render Dashboard to your frontend origin (e.g. `https://<your-frontend>.onrender.com` or `https://k-692.github.io`). Multiple origins can be comma-separated.
6. Click **Apply**.
7. Once deployed, note your service URL (e.g., `https://monopoly-india-server.onrender.com`).

### Option B: Manual Web Service Creation

If you prefer to configure manually:
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select your repository `K-692/Monopoly-India-Game`.
3. Fill in the following fields:
   - **Name:** `monopoly-india-server`
   - **Region:** Any (e.g. Oregon or Frankfurt)
   - **Branch:** `feature/render-public-hosting`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** Node
   - **Build Command:** `npm ci --include=dev && npm run build:server`
   - **Start Command:** `npm start`
   - **Plan Type:** Free
4. Under **Advanced Settings**:
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** Yes
5. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `CLIENT_ORIGIN` = `https://<your-frontend>.onrender.com` (or `https://k-692.github.io`, or comma-separated list)
6. Click **Create Web Service**.
7. Copy your backend URL once live.

---

## 4. Step-by-Step GitHub Pages Configuration

### Step 1: Add the Repository Actions Variable
1. Navigate to your repository on GitHub: `https://github.com/K-692/Monopoly-India-Game`.
2. Click **Settings** (top navigation bar).
3. In the left sidebar, click **Secrets and variables** -> **Actions**.
4. Switch to the **Variables** tab (next to Secrets).
5. Click **New repository variable**.
   - **Name:** `VITE_SERVER_URL`
   - **Value:** Your Render Web Service URL (e.g., `https://monopoly-india-server.onrender.com`)
   *(Ensure no trailing slash)*
6. Click **Add variable**.

### Step 2: Enable GitHub Pages with GitHub Actions
1. In the repository **Settings**, scroll to **Pages** (under Code and automation in the left sidebar).
2. Under **Build and deployment**:
   - **Source:** Select **GitHub Actions**.
3. Under **Custom domain**, leave empty unless you use a custom domain.

### Step 3: Trigger Frontend Deployment
Push a commit to `feature/render-public-hosting` or manually dispatch the workflow:
1. Go to the **Actions** tab on GitHub.
2. Click **Deploy Monopoly India to GitHub Pages** in the left workflow list.
3. Click **Run workflow** -> select branch `feature/render-public-hosting` -> click **Run workflow**.
4. Once completed, your public frontend will be live at:
   `https://k-692.github.io/Monopoly-India-Game/`

---

## 5. Verifying Backend Health & Connectivity

### 1. HTTP Health Check Verification
In your terminal or browser, query the health endpoint:
```bash
curl -i https://<your-render-service>.onrender.com/api/health
```
Expected response:
```http
HTTP/2 200 OK
content-type: application/json; charset=utf-8

{"status":"ok","uptime":120.45,"timestamp":1794555000000}
```

### 2. CORS Policy Verification
Verify that only the GitHub Pages origin is permitted:
```bash
# Allowed origin test (should return Access-Control-Allow-Origin: https://k-692.github.io)
curl -i -H "Origin: https://k-692.github.io" https://<your-render-service>.onrender.com/api/health

# Unauthorized origin test (should return HTTP 403 Forbidden)
curl -i -H "Origin: https://unauthorized-domain.com" https://<your-render-service>.onrender.com/api/health
```

---

## 6. Testing Worldwide Multiplayer Across Networks

To test multiplayer between two players on completely different networks (e.g. Wi-Fi and mobile data):

1. **Host Player (Device 1):**
   - Open `https://k-692.github.io/Monopoly-India-Game/` in any desktop or mobile browser.
   - Confirm the status pill says: **"Hosted Multiplayer Server: Online"** (with pulsing green indicator).
   - Set player name and avatar token.
   - Click **Host Custom Room**, select game rules, and click **Create & Host Room**.
   - Copy the 6-character room code or shareable link (or show the QR code).

2. **Joining Player (Device 2 - Different Network):**
   - Open the share link or navigate to `https://k-692.github.io/Monopoly-India-Game/`.
   - Enter the 6-character invite code and click **Join Match**.
   - Both players appear in real-time in the lobby slots.
   - When all human players click **READY**, the host clicks **START MATCH**.
   - Both players seamlessly transition into the real-time board game!

---

## 7. Preserving Offline Wi-Fi LAN Mode

You can continue playing on local offline Wi-Fi anytime without modifying anything:

```bash
# Switch to main branch
git checkout main

# Start local LAN host server
npm run lan:host
```

- Clients on the same Wi-Fi connect to `http://<HOST_LAN_IP>:4173`.
- No Render instance or internet connection is used in LAN mode.

---

## 8. Render Free-Tier Behavior & Supabase Persistent State Architecture

### Durable PostgreSQL Persistence (Supabase Free Tier)
- The game backend uses durable ACID persistence powered by **Supabase PostgreSQL 17** (hosted in `ap-south-1`).
- All critical application entities (`player_sessions`, `rooms`, `room_members`, `games`, `game_events`, `processed_commands`, `game_archives`) reside in a dedicated, isolated `game` database schema.
- Privileged access is restricted exclusively to the Node.js backend; client-side PostgREST access is revoked (`REVOKE ALL ON SCHEMA game FROM anon, authenticated`).
- A partial unique index (`idx_one_active_game_per_room`) guarantees that a room cannot accidentally spawn duplicate concurrent matches.
- Exactly **one** backend instance runs on Render Free Web Service with a conservative connection pool (`max: 10`) connected via Supabase Session Pooler or Direct Connection.
- 100% zero-cost architecture within the Free tier limits of both platforms.

### Free-Tier Inactivity Spin-Down & Crash Recovery
- Render spins down free Web Services after **15 minutes of inactivity**.
- **Cold Start Duration:** When a player visits the frontend while the backend is sleeping, waking up typically takes **50 to 70 seconds**.
- **User Feedback:** The frontend automatically detects cold starts and displays an informational message:
  > *"Render Free Instance Spin-Up: Free web services automatically spin down after inactivity. Cold starts typically take 50–70 seconds. Once awake, the board connects automatically!"*
- A **Retry** button allows players to manually trigger reconnection attempts without refreshing the page.

### Backend Restarts & Match Recovery
- Unlike purely in-memory servers, server restarts (such as deployments or sleep/wake cycles) **do NOT destroy active matches**.
- On startup, the backend automatically queries Supabase PostgreSQL to recover:
  1. All active rooms with status `LOBBY` or `IN_PROGRESS`.
  2. All ongoing game states and versions.
  3. Authoritative player slots, turn orders, property ownership, and cash balances.
  4. Authoritative countdown timers and deadlines recalculated relative to `updated_at`.
- Reconnecting players authenticate using their cryptographic handshake token hash, cancel any temporary bot takeover, and resume control seamlessly.

### How to Configure DATABASE_URL on Render
1. In the [Render Dashboard](https://dashboard.render.com/), open your `monopoly-india-server` Web Service.
2. Navigate to **Environment**.
3. Add environment variable:
   - **Key:** `DATABASE_URL`
   - **Value:** Your Supabase connection string.
     - **Option A (Session Pooler - Recommended):**
       `postgresql://postgres.omelbzqsmqsjazaliqvo:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`
     - **Option B (Direct Connection):**
       `postgresql://postgres:[YOUR-PASSWORD]@db.omelbzqsmqsjazaliqvo.supabase.co:5432/postgres?sslmode=require`
4. Click **Save Changes**. Render will automatically redeploy the service with persistent database access.

---

## 9. Troubleshooting Guide

### 1. Status shows "Configuration Required: VITE_SERVER_URL missing"
- **Cause:** GitHub Actions built the frontend without the `VITE_SERVER_URL` repository variable.
- **Fix:** Go to GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **Variables**, add `VITE_SERVER_URL`, and re-run the workflow.

### 2. Frontend stuck on "Connecting to server..."
- **Cause:** Render free service is spinning up from sleep, or backend URL is incorrect.
- **Fix:**
  - Check `https://<your-render-service>.onrender.com/api/health` directly in your browser.
  - Wait ~60 seconds for cold start completion.
  - Verify that `VITE_SERVER_URL` matches your actual Render service URL.

### 3. "CORS forbidden" error in browser console
- **Cause:** `CLIENT_ORIGIN` on Render does not match the frontend origin.
- **Fix:** In Render Dashboard -> Service Environment Variables, verify that `CLIENT_ORIGIN` is set to your frontend origin (e.g. `https://<your-frontend>.onrender.com` or `https://k-692.github.io`). Multiple origins can be comma-separated.

### 4. GitHub Actions build fails with "Repository Actions variable 'VITE_SERVER_URL' is missing"
- **Cause:** The workflow strictly validates the presence of `VITE_SERVER_URL` to prevent broken builds.
- **Fix:** Add `VITE_SERVER_URL` to the repository Actions variables as explained in [Step 4](#4-step-by-step-github-pages-configuration).

