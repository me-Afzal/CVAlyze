from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    
class UserLogin(BaseModel):
    username: str
    password: str

class UpdateUser(BaseModel):
    username: str
    oldpassword: str
    newpassword: str        

class DeleteUser(BaseModel):
    username: str
    password: str    