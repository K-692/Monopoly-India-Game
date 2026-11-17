<div align="center">

# 🇮🇳 Indian Monopoly

**Real-time multiplayer property trading board game with Indian cities, CPU players and custom room rules.
Play online for free from your browser, or offline over your home Wi-Fi.**

### 🎮 [Play online: https://k-692.github.io/Monopoly-India-Game/](https://k-692.github.io/Monopoly-India-Game/)

</div>

---

## Two ways to play

| Mode | Where it runs | Needs |
| --- | --- | --- |
| **🌐 Online** | GitHub Pages site + Supabase Realtime | A browser and internet. No server to run. |
| **📶 LAN** | Node.js host on your Wi-Fi | One computer running `npm run lan:host`; no internet needed. |

## 🌐 Online play (GitHub Pages + Supabase)

1. Open the [game](https://k-692.github.io/Monopoly-India-Game/), enter a name and click **Customize Rules & Host**.
2. Share the 6-letter code or invite link. Friends open the link (or type the code) on any device.
3. Ready up and start.

**How it works.** The player who creates the room becomes the **host**: their browser runs the same authoritative game engine the LAN server uses (rules, dice, turn timers, CPU players). Other players send moves to the host through a **Supabase Realtime** broadcast channel, and the host sends the updated game back the same way. Supabase Postgres stores:

- `online_rooms`: invite code → realtime channel directory (expires after 48 h)
- `online_host_snapshots`: the host's saved game, so a host can refresh the page and resume

Both tables have row-level security with no policies. The browser can only call four `online_*` database functions, using the public publishable key. No database password is in the site.

**Keep the host tab open.** If the host closes the tab, the game pauses until they come back (it resumes from the snapshot). If another player drops, a CPU takes over their turns until they reconnect.

The **ping badge** (bottom-right) shows live round-trip latency. For a remote player it's the full path through Supabase and the host. For the host, it's their round trip to Supabase.

## 📶 LAN play

```bash
npm install
npm run lan:host
```

Other devices on the same Wi-Fi open the printed `http://<your-ip>:4173` address or scan the lobby QR code. All state is kept in memory on the host computer.

## Development

```bash
npm run dev          # Vite dev server (talks to a LAN host on :4173)
npm run lan:dev      # Vite + LAN host together
npm test             # Vitest unit + integration tests
npm run build        # GitHub Pages build (base /Monopoly-India-Game/)
```

Set `VITE_NETWORK_MODE=online` to try online mode on `localhost`. See `.env.example` for the other optional variables.

## Deployment

Every push to `main` runs `.github/workflows/deploy-github-pages.yml`. It runs the tests, builds the site and publishes it to the `gh-pages` branch. In **Settings → Pages**, the source must be **Deploy from a branch → `gh-pages` / root**, and the repository must be public (GitHub Pages is free for public repos).

## Project layout

```
src/                 React UI, domain rules and game engine (src/domain)
src/lib/online/      Online mode: browser host, Supabase Realtime transport, virtual Socket.IO
server/              Authoritative room/game managers + LAN Socket.IO server
```

## License

MIT
