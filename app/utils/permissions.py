"""Permission decorators for common access patterns.

NOTE: Dead code — these decorators are not currently used by any router.
Kept as reference for future refactoring. Do NOT delete until a decision
is made on whether to adopt this pattern across the codebase.
"""

from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth import get_current_user


def require_owner_or_admin(get_resource_owner_id):
    """Decorator factory that requires current user to be owner or admin.

    Usage:
        @router.delete("/{payment_id}")
        @require_owner_or_admin(lambda payment: payment.creadora_id)
        def delete_payment(payment_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
            ...
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")

            # Get resource_id from first positional arg or from kwargs
            resource_id = None
            if args:
                resource_id = args[0] if isinstance(args[0], int) else None
            if not resource_id:
                for key, value in kwargs.items():
                    if key.endswith("_id") and isinstance(value, int):
                        resource_id = value
                        break

            if not db or not current_user or resource_id is None:
                raise HTTPException(
                    status_code=500, detail="Permission check misconfigured"
                )

            # Get resource and check ownership
            resource = get_resource_owner_id(db, resource_id)
            if not resource:
                raise HTTPException(status_code=404, detail="Recurso no encontrado")

            owner_id = (
                resource.creadora_id
                if hasattr(resource, "creadora_id")
                else resource.user_id
            )

            if owner_id != current_user.id and current_user.role.value != "admin":
                raise HTTPException(
                    status_code=403, detail="No tienes permiso para esta acción"
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def require_payment_owner(get_payment):
    """Specific decorator for payment ownership."""
    return require_owner_or_admin(lambda db, pid: get_payment(db, pid))
