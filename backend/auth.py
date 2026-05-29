import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Header, HTTPException
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALGO = 'HS256'


def create_token(user_id: str, tenant_id: str | None, role: str) -> str:
    payload = {
        'user_id': user_id,
        'tenant_id': tenant_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")


async def require_auth(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, "Missing authorization header")
    token = authorization.split(' ', 1)[1]
    return decode_token(token)


async def require_tenant(authorization: str = Header(None)) -> dict:
    claims = await require_auth(authorization)
    if not claims.get('tenant_id') and claims.get('role') != 'super_admin':
        raise HTTPException(403, "Tenant scope required")
    return claims


async def require_super_admin(authorization: str = Header(None)) -> dict:
    claims = await require_auth(authorization)
    if claims.get('role') != 'super_admin':
        raise HTTPException(403, "Super admin required")
    return claims
