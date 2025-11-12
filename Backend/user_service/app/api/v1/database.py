"""Database configuration for the user service."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DB_URL")

# pool_pre_ping=True to prevent "server closed connection" errors
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # This tests connections before using them
    pool_recycle=300,        # Recycle connections every 5 minutes
    connect_args={
        "connect_timeout": 10
    }
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
