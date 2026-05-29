import os
import logging
from pathlib import Path
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from routes_auth import router as auth_router
from routes_core import router as core_router
from routes_ops import router as ops_router
from routes_analytics import router as analytics_router
from routes_admin import router as admin_router


app = FastAPI(title="Restaurant OPS BOM")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "Restaurant OPS BOM"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(core_router)
api_router.include_router(ops_router)
api_router.include_router(analytics_router)
api_router.include_router(admin_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_seed():
    """Auto-run demo seed at startup so the app is usable out-of-the-box."""
    try:
        from routes_admin import seed_demo
        await seed_demo()
        logger.info("Demo seed completed")
    except Exception as e:
        logger.warning(f"Seed skipped: {e}")
