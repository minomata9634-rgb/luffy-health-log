# Luffy Health Log

A simple mobile-first shared web app for recording a cat's fluid treatment, veterinary visits, weight, CREA and BUN.

## Architecture

- Static web app: GitHub Pages
- Cloud database + login: Supabase
- Two phones: both sign in to the same Supabase project and see the same records
- Charts: Chart.js
- Data export: CSV

## Setup

### 1. Create a Supabase project

Create a free Supabase project.

In **SQL Editor**, paste and run the complete contents of `schema.sql`.

Then create two users in **Authentication > Users**:
- Miyu
- Partner

Email/password login is used so the app can remember the session on each phone.

### 2. Configure the app

Copy:

`config.js.example` → `config.js`

Put your Supabase project URL and the **anon/public** key in `config.js`.

Do NOT put a `service_role` key in this file.

### 3. Test locally

Because browser security can behave differently with local files, use a simple local web server.

For example, in this folder:

`python3 -m http.server 8000`

Then open:

`http://localhost:8000`

### 4. Deploy with GitHub Pages

Upload all files to a GitHub repository, including your newly created `config.js`.

In GitHub:
Settings → Pages → Deploy from branch → main → root

After deployment, GitHub gives you one URL. Open that same URL on both phones.

### 5. First use

1. Sign in on phone 1.
2. Sign in on phone 2.
3. On either phone, record today's fluid.
4. Refresh the other phone: the same record should appear.

## Important privacy note

The app contains pet health records. Supabase RLS is enabled by `schema.sql`, and only authenticated users can access the tables.

The app deliberately does not provide medical diagnoses, treatment recommendations, or "safe/danger" judgments. It only stores and compares recorded values.

## Included features

- Today's fluid record with minimal steps
- Fluid amount/time/performer/note
- Veterinary visit and weight records
- CREA and BUN records
- Previous/latest comparison
- Change notices based on configurable thresholds
- Weight / CREA / BUN / fluid trend charts
- 1 / 3 / 6 months / all-time ranges
- History screen
- Edit/delete records
- Input performer: Miyu / Partner
- Next vet visit and next blood test dates
- CSV backup export
