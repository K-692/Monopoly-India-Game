# How to Securely Configure Firebase Credentials in GitHub Secrets

To ensure that your Firebase configuration is never exposed publicly in Git commits, follow these exact steps to store them securely in **GitHub Actions Secrets**.

---

## 1. Where to Find Your Firebase Web Configuration
In your [Firebase Console](https://console.firebase.google.com/):
1. Go to **Project Settings** (gear icon in the top left).
2. Under the **General** tab, scroll down to **Your apps**.
3. Select your Web App (or click `</>` to register a web app).
4. You will see your SDK snippet containing:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `measurementId`

---

## 2. Adding Secrets to Your GitHub Repository
1. Open your GitHub repository in your browser:
   `https://github.com/K-692/Monopoly-India-Game`
2. Click on the **Settings** tab (along the top navigation of the repository).
3. In the left sidebar, expand **Secrets and variables** and click **Actions**.
4. Click the green **New repository secret** button.
5. Add each of the following secrets one by one:

| Secret Name | Example / Value | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Your Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `monopoly-india-f9700.firebaseapp.com` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | `monopoly-india-f9700` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `monopoly-india-f9700.firebasestorage.app` | Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `586286552065` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | `1:586286552065:web:...` | Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-SY3THZVCRF` | Google Analytics ID |

*(Note: If you are using Firebase Realtime Database for presence, you can also add `VITE_FIREBASE_DATABASE_URL`).*

---

## 3. How the Build Uses These Secrets
When GitHub Actions runs the deployment workflow ([`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)), it automatically injects these secrets into the Vite build environment:

```yaml
- name: Build site
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
    VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
    VITE_APP_BASE_PATH: '/Monopoly-India-Game/'
  run: npm run build
```

This guarantees:
1. No secret keys or configuration files are tracked in public Git history.
2. The GitHub Pages bundle gets injected during the automated CI/CD pipeline.
3. The site is live and functional for all players worldwide.

