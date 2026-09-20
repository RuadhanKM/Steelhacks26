import os
import traceback

import logfire
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load backend/.env before any module reads the provider API key at import time.
load_dotenv()

# Configure Logfire once, at startup, before the agent is imported. configure()
# on its own sends nothing for an agent run — instrument_pydantic_ai() is what
# records the model calls, tool calls and their arguments.
logfire.configure(
    service_name="banking-assistant",
    environment=os.environ.get("ENVIRONMENT", "dev"),
)
logfire.instrument_pydantic_ai()

from api.accounts import router as accounts_router
from api.chat import router as chat_router
from api.dispute_review import router as dispute_review_router
from api.cards import router as cards_router
from api.disputes import router as disputes_router
from api.fraud import router as fraud_router
from api.session import router as session_router



app = FastAPI(title="Agentic banking assistant")


# Order matters: this is added first so CORS ends up wrapping it. An unhandled
# exception otherwise escapes past the CORS middleware and reaches the browser
# as a CORS error, hiding the real failure.
@app.middleware("http")
async def unhandled_errors_as_json(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "The server hit an unexpected error. Check the backend logs."},
        )


# The Expo app runs on its own origin (localhost:8081 on web, a LAN address on a
# device), so the browser needs these headers to allow the call. Set
# CORS_ORIGINS in backend/.env to tighten this beyond local development.
cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(accounts_router)
app.include_router(chat_router)
app.include_router(disputes_router)
app.include_router(dispute_review_router)
app.include_router(session_router)
app.include_router(cards_router)
app.include_router(fraud_router)

# Request spans, so a slow or failing chat turn shows the HTTP call around it.
logfire.instrument_fastapi(app)


@app.get("/")
def read_root():
    return {"message": "FastAPI is connected to Firebase!"}


