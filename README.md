# Podimart Seller Center

Seller website for [podimart.lk](https://podimart.lk). Makers sign up, add products, and buyers see those listings on the public site.

Live URL later: **sellercenter.podimart.lk**

This repo is a **separate backend** from the buyer site. Both APIs must use the **same DynamoDB tables** (`podimart-sellers`, `podimart-products`) and the **same photo S3 bucket**.

| Piece | Local | AWS |
|---|---|---|
| Frontend | React 19.2 + Vite 8 | S3 + CloudFront |
| Backend | Python FastAPI | API Gateway + Lambda (Python 3.14) |
| Auth | Local accounts | Amazon Cognito |
| Data | `backend/data/db.json` | DynamoDB |
| Photos | `backend/uploads/` | S3 |

## Run locally

You need **Python 3.12+** (3.14 if you have it) and **Node 20.19+ or 22 LTS**. Vite 8 will not start on Node 18. Use **two** terminals. Do not start both APIs on port 8000 — the buyer API already uses that.

Check your Node version:

```powershell
node -v
```

If it starts with `v18`, install **Node 22 LTS** from [https://nodejs.org](https://nodejs.org), close PowerShell, open a new window, then check `node -v` again.

### 1. Seller API

```powershell
cd E:\Git\podimart-sellercenter\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8001
```

Open [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs) to check the API.

Leave `AUTH_MODE=local` and `STORAGE=local` in `.env` for now. Cognito is used after you deploy.

To see Seller Center products on the buyer site locally, point this API at the same JSON folder as podimart. Add these lines to `backend\.env`:

```
DATA_DIR=E:\Git\podimart\backend\data
UPLOAD_DIR=E:\Git\podimart\backend\uploads
```

### 2. Seller website

```powershell
cd E:\Git\podimart-sellercenter\frontend
copy .env.example .env
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174).

Signup and login work without AWS in local mode. Password must be at least 8 characters.

If the buyer site is also running (`http://localhost:5173`), the dashboard “public page” link will open that shop on podimart.

## What you can do in v1

- Open a free shop (name, city, WhatsApp)
- Edit shop profile
- Add / edit / remove products and photos
- Public listings are written in the same seller/product shape the buyer API already reads

## Deploy the backend (AWS)

This deploys **Cognito + API Gateway + Lambda + DynamoDB + photo S3**. The React site stays on your PC for now (`DeployFrontend=false`).

You need an AWS account, [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), and [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

```powershell
aws sts get-caller-identity
cd E:\Git\podimart-sellercenter\infra
sam build
sam deploy
```

`sam deploy` will show a changeset. Type `y` to create the stack in **ap-south-1**.

If the buyer site already created `podimart-sellers` / `podimart-products`, deploy with:

```powershell
sam deploy --parameter-overrides CreateSharedData=false DeployFrontend=false ExistingPhotoBucket=YOUR_PHOTO_BUCKET
```

After it finishes, copy three outputs:

```powershell
aws cloudformation describe-stacks --stack-name podimart-sellercenter --region ap-south-1 --query "Stacks[0].Outputs"
```

Put them in `frontend\.env`:

```
VITE_API_URL=https://XXXX.execute-api.ap-south-1.amazonaws.com
VITE_PUBLIC_URL=http://localhost:5173
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXX
VITE_COGNITO_CLIENT_ID=XXXX
VITE_COGNITO_REGION=ap-south-1
```

Then run **only** the website (no local uvicorn):

```powershell
cd E:\Git\podimart-sellercenter\frontend
npm run dev
```

Open [http://localhost:5174](http://localhost:5174). Signup now uses **Cognito**: you will get an email code, then the shop is saved in DynamoDB.

You do **not** need to host the React app yet. Hosting the website (S3 + CloudFront) is a later step.

## Host the website (S3 + CloudFront)

Keep `DeployFrontend=true` after this. Switching it back to `false` would delete the website bucket.

**1. Create the website bucket and CloudFront**

```powershell
cd E:\Git\podimart-sellercenter\infra
sam build
sam deploy
```

Type `y`. Then:

```powershell
aws cloudformation describe-stacks --stack-name podimart-sellercenter --region ap-south-1 --query "Stacks[0].Outputs"
```

You need `FrontendBucketName` and `CloudFrontUrl`.

**2. Build and upload the React app**

```powershell
cd E:\Git\podimart-sellercenter\frontend
npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET --delete --region ap-south-1
```

**3. Refresh CloudFront** (replace the distribution id)

```powershell
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

Open the `CloudFrontUrl` from the stack outputs. Signup still uses Cognito.

Point **sellercenter.podimart.lk** at that CloudFront distribution when the domain is ready.
