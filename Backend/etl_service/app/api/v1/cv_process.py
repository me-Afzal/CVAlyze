"""CV Processing main logic for ETL Service."""
import os
import asyncio
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
import pandas as pd
import aiosmtplib
import pytz
from dotenv import load_dotenv
from google.cloud import bigquery

from app.api.v1.preprocess import extract_text, clean_text, get_lat_lon, get_gender
from app.api.v1.rag_extractor import CvExtractor


# ------------------ Load Environment ------------------
load_dotenv()

# ------------------ Logging ------------------
logger = logging.getLogger("etl_service")

# ------------------ API Key Config ------------------
API_KEYS = [os.getenv("API_KEY1"), os.getenv("API_KEY2")]
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

_active_api_key = None
_key_checked_at = None

# ------------------ API Key Check ------------------
async def check_api_key_async(api_key):
    """Send a small test request asynchronously to verify if the API key works."""
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
    payload = {"contents": [{"parts": [{"text": "ping"}]}]}

    async with httpx.AsyncClient(timeout=5) as client:
        try:
            response = await client.post(API_URL, headers=headers, json=payload)
            if response.status_code == 200:
                logger.info(
                    "API key validated successfully: %s********", api_key[:8])
                return api_key

            logger.warning(
                "API key might be invalid or rate-limited: %s******** | Status: %s",
                api_key[:8],
                response.status_code,
            )
            return None

        except Exception as e:
            logger.error("API key check failed for %s******** — %s", api_key[:8], e)
            return None


async def get_active_api_key(force_refresh=False):
    """Return the first valid API key, checking sequentially to save time."""
    global _active_api_key, _key_checked_at

    # Use cached key if valid
    if _active_api_key and _key_checked_at and not force_refresh:
        if datetime.now() - _key_checked_at < timedelta(minutes=20):
            logger.debug("Using cached active API key.")
            return _active_api_key

    for key in API_KEYS:
        valid_key = await check_api_key_async(key)
        if valid_key:
            _active_api_key = valid_key
            _key_checked_at = datetime.now()
            logger.info("Using API key: %s*****", valid_key[:8])
            return valid_key

        logger.warning(
            "API key %s**** is invalid or rate-limited, checking next...",
            key[:8])

    logger.critical("All API keys are invalid or rate-limited.")
    raise RuntimeError("All API keys are invalid or rate-limited.")


# ------------------ Email Notification ------------------
async def send_extraction_success_email():
    """
    Sends an email notification after successful CV extraction and 
    data warehouse update.
    """
    sender_email = os.getenv("SENDER_EMAIL")
    receiver_email = os.getenv("RECEIVER_EMAIL")
    password = os.getenv("APP_PASSWORD")  # Gmail App Password

    if not all([sender_email, receiver_email, password]):
        logger.error("Missing required environment variables for email configuration.")
        return

    # Current date and time (IST)
    india_tz = pytz.timezone("Asia/Kolkata")
    current_time = datetime.now(india_tz).strftime("%d-%m-%Y %H:%M:%S")

    # Create email
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = "CVAlyze | CV Extraction and Warehouse Update Completed"

    body = f"""Dear Team,

We are pleased to inform you that the latest CV extraction and data loading process 
has been successfully completed through the CVAlyze automation pipeline.

Completion Timestamp: {current_time} (IST)

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
        logger.info("Email notification sent successfully!")
    except Exception as e:
        logger.exception("Error sending email: %s", e)

# ------------------ DataFrame Sanitization ------------------
def sanitize_dataframe_for_bigquery(df):
    """Remove null elements from list columns to prevent BigQuery errors."""
    list_columns = ['skills', 'experience', 'projects', 'certifications', 'achievements', 'education']
    
    for col in list_columns:
        if col in df.columns:
            if col == 'projects':
                # Special handling for projects (list of dicts)
                df[col] = df[col].apply(lambda x: [
                    {
                        **project,
                        'links': [link for link in (project.get('links') or []) 
                                  if link is not None and link != '' and link != 'null']
                    }
                    for project in (x if isinstance(x, list) else [])
                ] if x else [])
            else:
                # For other list columns - filter out null/None/empty strings
                df[col] = df[col].apply(lambda x: [
                    item for item in (x if isinstance(x, list) else [])
                    if item is not None and item != '' and item != 'null'
                ] if x else [])
    
    return df

# ------------------ BigQuery Upload ------------------
def _load_to_bigquery_sync(df):
    """Function to load DataFrame to BigQuery synchronously."""
    list_columns = ['skills', 'experience', 'projects', 'certifications', 'achievements']

    for col in list_columns:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x if isinstance(x, list) else [])
    # Sanitize to remove any null elements from arrays
    df = sanitize_dataframe_for_bigquery(df)
    
    client = bigquery.Client()
    table_id = "project-72dfbe56-9a82-4b81-a1a.cv_warehouse.cv_data"
    job_config = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        autodetect=True,
    )

    logger.info("Uploading %d CV records to BigQuery table: %s", len(df), table_id)
    job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
    job.result()
    logger.info("BigQuery upload completed successfully.")
    return True


async def load_to_bigquery(df):
    """Asynchronous wrapper to load DataFrame to BigQuery."""
    return await asyncio.to_thread(_load_to_bigquery_sync, df)


# ------------------ CV Processing ------------------
async def process_single_cv(filename, file_stream, extractor):
    """Process a single CV file and extract structured data."""
    try:
        text = clean_text(extract_text(file_stream, filename))
        logger.debug("Extracted text successfully from %s", filename)
        return extractor.extract(text)
    except Exception as e:
        logger.exception("Error processing file %s: %s", filename, e)
        return {"error": str(e), "file": filename}


async def process_cvs(files):
    """
    Process uploaded CV files and return structured JSON with additional info.
    """
    logger.info("Starting processing of %d CV files...", len(files))
    api_key = await get_active_api_key()

    extractor = CvExtractor(api_key)

    # Process all CVs concurrently
    tasks = [process_single_cv(f, s, extractor) for f, s in files]
    results = await asyncio.gather(*tasks)

    all_cv_data = [r for r in results if "error" not in r]
    errors = [r for r in results if "error" in r]

    # Initialize json_response as empty list
    json_response = []

    # Feature Engineering: Data Enrichment
    expected_cols = ['name', 'profession', 'phone_number', 'email', 'location',
                     'github_link', 'linkedin_link', 'skills', 'education',
                     'experience', 'projects', 'certifications', 'achievements']

    df = pd.DataFrame(all_cv_data).reindex(columns=expected_cols, fill_value=None)
    df = df.dropna(how='all')

    if not df.empty:
        # Latitude, Longitude, Country and Gender Enrichment
        logger.info("Enriching data with geolocation and gender for %d candidates.",
                    len(df))
        df[['latitude', 'longitude', 'country']] = df['location'].apply(
            lambda loc: pd.Series(get_lat_lon(loc))
        )
        df['gender'] = df['name'].apply(get_gender)

        # Convert DataFrame to JSON records
        json_response = df.to_dict(orient='records')

        # Load to BigQuery
        success = await load_to_bigquery(df)
        if success:
            await send_extraction_success_email() # Send notification email
        else:
            logger.error("BigQuery upload failed — email not sent.")
    else:
        logger.warning("No valid CV data found to upload.")

    logger.info("CV processing completed.")
    return {"jsonCv": json_response, "errors": errors}
