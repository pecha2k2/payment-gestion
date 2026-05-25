import os
import sys

# Set test environment variables before importing any app modules
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test_secret_key"
os.environ["ENVIRONMENT"] = "development"
os.environ["ADMIN_PASSWORD"] = "admin123"

# Ensure workspace is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient, ASGITransport

from app.database import Base, get_db, engine
from app.main import app
from app.models.user import User
from app.utils.security import get_password_hash
from app.services.workflow import init_default_workflow_configs

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def setup_test_db(db):
    init_default_workflow_configs(db)
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            name="Administrador",
            email="admin@company.com",
            role="admin",
            area="Administración",
            active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin)
        db.commit()

@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db_session():
    """Provides a clean database session for each test, ensuring full isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    setup_test_db(db)
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield db
    finally:
        db.close()
        app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """Provides an async client configured with the test application and lifespan context."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

