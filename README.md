# Pyre

Pyre is an AI-powered banking assistant and operations dashboard for helping customers understand charges, dispute issues, request fee waivers, and escalate suspicious activity. The project combines a customer mobile app, a staff-facing web dashboard, and a Python FastAPI backend powered by LLM-driven workflows.

## Overview

This repository contains three main parts:

- backend/: FastAPI service and banking workflow engine
- frontend/: Expo + React Native customer app
- dashboard/: Next.js staff dashboard for reviewing disputes and managing tools

Together, they support a complete banking experience:

- answer balance and transaction questions
- detect duplicate charges and start dispute flows
- handle unauthorized charge reports and fraud triage
- process fee waiver requests
- provide staff review and case decision workflows

## Architecture

```text
Customer App (Expo / React Native)
        |
        v
FastAPI Backend (Python)
  - chat agent
  - dispute review
  - fraud triage
  - fee waiver flows
  - Firestore-backed session state
        |
        v
Staff Dashboard (Next.js)
  - queue of review cases
  - staff actions
  - admin/settings tools
```

## Features

### Customer-facing experience
- chat-based banking support
- dispute flow for duplicate or incorrect transactions
- fraud triage for unauthorized charges
- fee waiver handling for account charges
- authentication and persistent session flow

### Staff dashboard
- dispute queue and case review interface
- claim, approve, reject, and provisional credit actions
- tools and settings panels
- Firebase-authenticated admin flows

### Backend intelligence
- route classification for banking intents
- structured tool-based agent flows
- policy-aware confirmations before taking actions
- provider-agnostic LLM integration via configured API keys

## Tech Stack

- Frontend: React Native, Expo, TypeScript
- Dashboard: Next.js, React, TypeScript, Tailwind CSS
- Backend: Python, FastAPI, Pydantic, Firebase Admin SDK
- AI: model-driven agent workflows with provider API keys configured in environment variables
- Data: Firestore-backed session and case tracking

## Repository Structure

```text
.
├── backend/
│   ├── agent/
│   ├── api/
│   ├── db/
│   ├── models/
│   ├── policy/
│   ├── services/
│   ├── main.py
│   ├── requirements.txt
│   └── .gitignore
├── frontend/
│   ├── src/
│   ├── assets/
│   ├── package.json
│   └── ...
├── dashboard/
│   ├── src/
│   ├── package.json
│   └── ...
├── .gitignore
└── README.md
```

## Prerequisites

Before running the project, install:

- Python 3.11+
- Node.js 20+
- npm
- Firebase project credentials (for auth and Firestore)
- an LLM provider API key (for example Anthropic, OpenAI, or another configured provider)

## Environment Variables

### Backend
Create a `backend/.env` file with the necessary configuration, for example:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
# Model provider key, depending on your setup
ANTHROPIC_API_KEY=your_key_here
# or OPENAI_API_KEY=your_key_here
# or GOOGLE_API_KEY=your_key_here
```

The backend loads environment variables at startup and checks for required provider configuration before running chat flows.

### Frontend (Expo app)
Create a `.env` file in `frontend/` or set environment values for Expo:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Dashboard
Set equivalent values in the dashboard environment, using `NEXT_PUBLIC_` variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Running the Project

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- http://localhost:8000

### 2) Frontend (customer app)

```bash
cd frontend
npm install
npx expo start
```

Use Expo Go or an emulator to run the mobile app.

### 3) Dashboard (staff interface)

```bash
cd dashboard
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Important Notes

- The project is structured around a real banking support workflow rather than a generic chatbot.
- Some features are policy-gated and require proper authentication/session state.
- The backend enforces a clear separation between customer-facing conversations and staff review actions.

## License

This project does not currently declare a license in the repository root.

## Contributing

Pull requests and improvements are welcome. For local development, make sure all required environment variables are configured before running the app and dashboard.

## Project Status

This repository is an active prototype and demo application focused on an AI-assisted banking workflow experience.
