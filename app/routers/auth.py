from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.middleware.rate_limit import auth_limits
from app.models.user import User
from app.schemas.user import UserLogin, Token, UserResponse
from app.services.auth import get_current_user
from app.utils.security import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@auth_limits()
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo"
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
def get_current_user_info(current_user: User = Depends(get_current_user)):
    from app.services.workflow import AREA_TO_ROLES

    accessible = [
        area for area, roles in AREA_TO_ROLES.items() if current_user.role in roles
    ]
    role_value = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else current_user.role
    )
    return {
        "id": current_user.id,
        "username": current_user.username,
        "name": current_user.name,
        "email": current_user.email,
        "role": role_value,
        "area": current_user.area,
        "active": current_user.active,
        "accessible_areas": accessible,
    }


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # In a stateless JWT system, logout is handled client-side
    return {"message": "Logout successful"}
