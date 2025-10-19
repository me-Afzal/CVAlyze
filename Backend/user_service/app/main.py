from fastapi import FastAPI
from app.api.v1.routes import router as v1_router
from prometheus_fastapi_instrumentator import Instrumentator
app = FastAPI(
    title="CVAlyze User Service API",
    version="1.0.0"
)

# Prometheus scrape metrics
Instrumentator().instrument(app).expose(app)

# Include versioned router
app.include_router(v1_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to CVAlyze User Service API"}