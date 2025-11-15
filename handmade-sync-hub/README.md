This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Workflow

### Local development
1. Copy `.env.example` to `.env.local` and fill in the required environment variables (see project root README for details).
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

### Production build
```bash
npm run build
npm run start
```

### Playwright automation tests

#### Creema
- Ensure `.env.local` has valid `PLAYWRIGHT_CREEMA_EMAIL` / `PLAYWRIGHT_CREEMA_PASSWORD` and `PLAYWRIGHT_RUN_CREEMA=true`.
- Normal run:
  ```bash
  npx playwright test playwright/tests/creema-draft.spec.ts
  ```
- Debug run (opens Playwright Inspector; add `--headed` if you also want a browser window):
  ```bash
  npx playwright test playwright/tests/creema-draft.spec.ts --debug
  ```

#### BASE
- Ensure `.env.local` has valid `PLAYWRIGHT_BASE_EMAIL` / `PLAYWRIGHT_BASE_PASSWORD` and `PLAYWRIGHT_RUN_BASE=true`.
- The login endpoint is `https://admin.thebase.com/users/login`.
- Recommended flow (manual-assisted):
  1. Run the test in debug mode to allow manual input:
     ```bash
     PLAYWRIGHT_RUN_BASE=true npx playwright test playwright/tests/base-draft.spec.ts --debug
     ```
  2. Playwright fills the email/password fields automatically.
  3. **Pause screen will appear** – manually click the login button and complete any additional verification (e.g., one-time codes). After finishing, press “Resume” in Playwright Inspector.
  4. If the dashboard does not show the “商品を登録する” button, the script will pause again; complete the login/verification manually and resume.
  5. Once resumed, Playwright navigates to `/shop_admin/items/`, opens the modal via “商品を登録する”, and inputs sample product data on `/shop_admin/items/add`.
- For fully automated runs (only when additional verification is disabled):
  ```bash
  npx playwright test playwright/tests/base-draft.spec.ts
  ```
- Debug run:
  ```bash
  npx playwright test playwright/tests/base-draft.spec.ts --debug
  ```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
