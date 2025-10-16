import os
import requests
import asyncio
import httpx
from io import BytesIO
import pandas as pd
import aiosmtplib
from datetime import datetime,timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from app.preprocess import extract_text, clean_text, get_lat_lon, get_gender
from app.rag_extractor import CvExtractor

load_dotenv()

API_KEYS = [os.getenv("API_KEY1"),os.getenv("API_KEY2")]
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

# 
_active_api_key = None
_key_checked_at = None

async def check_api_key_async(api_key):
    """Send a small test request asynchronously to verify if the API key works."""
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {"contents": [{"parts": [{"text": "ping"}]}]}
    
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            response = await client.post(API_URL, headers=headers, json=payload)
            if response.status_code == 200:
                return api_key
            else:
                print(f"[WARN] API key might be invalid or rate-limited: {api_key[:8]}...")
                return None
        except Exception as e:
            print(f"[ERROR] API check failed: {e}")
            return None


async def get_active_api_key(force_refresh=False):
    """Return the first valid API key, checking sequentially to save time."""
    global _active_api_key, _key_checked_at

    # Use cached key if valid
    if _active_api_key and _key_checked_at and not force_refresh:
        if datetime.now() - _key_checked_at < timedelta(minutes=20):
            return _active_api_key

    for key in API_KEYS:
        valid_key = await check_api_key_async(key)
        if valid_key:
            _active_api_key = valid_key
            _key_checked_at = datetime.now()
            print(f"[INFO] Using API key: {valid_key[:8]}********")
            return valid_key
        else:
            print(f"[INFO] API key {key[:8]} is invalid or rate-limited, checking next...")

    raise RuntimeError("All API keys are invalid or rate-limited.")

async def send_extraction_success_email():
    """
    Sends an email notification after successful CV extraction and 
    data warehouse update.
    """
    sender_email = os.getenv("SENDER_EMAIL")
    receiver_email = os.getenv("RECEIVER_EMAIL")
    password = os.getenv("APP_PASSWORD")  # Gmail App Password

    if not all([sender_email, receiver_email, password]):
        print("Missing required environment variables in .env file.")
        return

    # Current date and time
    current_time=datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    
    # Create the email
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = "CVAlyze | CV Extraction and Warehouse Update Completed"

    # Email body
    body = f"""Dear Team,

We are pleased to inform you that the latest CV extraction and data loading process 
has been successfully completed through the CVAlyze automation pipeline.

Completion Timestamp: {current_time}

All candidate records have been updated in the centralized data warehouse, ensuring 
that the most recent insights are now available for analysis.

You can access Looker Studio to explore comprehensive dashboards and trends derived 
from AI-powered CV parsing and historical job application data.

Best regards,
CVAlyze AI Data Automation System
"""
    message.attach(MIMEText(body, "plain"))

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=sender_email,
            password=password
        )
        print(" Email sent successfully!")
    except Exception as e:
        print(" Error while sending email:", e)


async def process_cvs(files):
    """
    Process uploaded CV files and return structured JSON with additional info.
    """
    api_key=await (get_active_api_key())

    extractor = CvExtractor(api_key)

    all_cv_data = []
    errors = []

    for filename, file_stream in files:
        try:
            text = clean_text(extract_text(file_stream, filename))
            info_dict = extractor.extract(text)
            all_cv_data.append(info_dict)
        except Exception as e:
            errors.append({"file": filename, "error": str(e)})

    # Define expected structure
    expected_cols = ['name', 'profession', 'phone_number', 'email', 'location', 
                     'github_link', 'linkedin_link', 'skills', 'education', 
                     'experience', 'projects', 'certifications', 'achievements']
    # Enriching data
    df = pd.DataFrame(all_cv_data).reindex(columns=expected_cols,fill_value=None)
    # Add geolocation and gender
    df[['latitude', 'longitude', 'country']] = df['location'].apply(
        lambda loc: pd.Series(get_lat_lon(loc)))
    df['gender'] = df['name'].apply(get_gender)

    # Convert to JSON records
    json_response = df.to_dict(orient="records")
    
    # Send success email
    # await send_extraction_success_email()

    return {"jsonCv": json_response, "errors": errors}
