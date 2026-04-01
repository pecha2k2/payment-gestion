import os
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse

from app.database import SessionLocal
from app.models.user import User
from app.routers import auth, users, payments, documents, workflow, incidences
from app.services.workflow import init_default_workflow_configs
from app.utils.security import get_password_hash

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Payment Gestion API",
    description="Sistema de gestión documental de pagos",
    version="1.0.0",
)

# CORS — configurable via ALLOWED_ORIGINS env var (comma-separated)
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(payments.router)
app.include_router(documents.router)
app.include_router(workflow.router)
app.include_router(workflow.search_router)
app.include_router(incidences.router)


# Serve static files (frontend)
STATIC_DIR = os.getenv("STATIC_DIR", "/app/frontend")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Payment Gestion API", "version": "1.0.0"}


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    # API and static assets are handled above — serve SPA for everything else
    if full_path.startswith(("api/", "static/", "docs", "openapi")):
        raise HTTPException(status_code=404)
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404)


@app.on_event("startup")
def startup_event():
    # Initialize default workflow configs and admin user if not present
    db = SessionLocal()
    try:
        init_default_workflow_configs(db)

        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
            if admin_password == "admin123":
                logger.warning(
                    "Using default admin password. Set ADMIN_PASSWORD env var in production."
                )
            admin = User(
                username="admin",
                password_hash=get_password_hash(admin_password),
                name="Administrador",
                email="admin@company.com",
                role="admin",
                area="Administración",
                active=True,
                created_at=datetime.now(timezone.utc),
            )
            db.add(admin)
            db.commit()
            logger.info("Default admin user created.")
    finally:
        db.close()
