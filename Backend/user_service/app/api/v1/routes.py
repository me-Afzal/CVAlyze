from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.v1 import schemas,auth,models
from app.api.v1.database import engine,SessionLocal

models.Base.metadata.create_all(bind=engine)

router=APIRouter()

def get_db():
    try:
        db=SessionLocal()
        yield db
    finally:
        db.close()    
        
# User_service v1 home endpoint
@router.get("/")
def root():
    return {"message":"Welcome to CVAlyze User Service API v1"} 

@router.post('/register')
def register_user(user: schemas.UserCreate,db: Session=Depends(get_db)):
    return auth.register_user(db,user)

@router.post('/login')
def login_user(user: schemas.UserLogin,db: Session=Depends(get_db)):
    return auth.authenticate_user(db,user)

@router.put('/register')
def update_pw(user: schemas.UpdateUser,db: Session=Depends(get_db)):
    return auth.update_pw(db,user)

@router.post('/register/delete')
def delete_user(user: schemas.DeleteUser, db: Session=Depends(get_db)):
    return auth.delete_user(db,user)
    
 