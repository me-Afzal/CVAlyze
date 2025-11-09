# ETL Service Documentation

## 📋 Overview

The ETL Service is a core component of CVAlyze that handles the **Extract, Transform, Load** operations for CV/Resume processing. It provides intelligent parsing, data extraction, enrichment, and warehouse loading capabilities using AI-powered analysis.

### Key Features

- **Multi-format Support**: Processes PDF, DOCX, and TXT resume files
- **AI-Powered Extraction**: Uses Google Gemini 2.5 Flash Lite for intelligent data extraction
- **Concurrent Processing**: Handles multiple CV files simultaneously with async operations
- **Data Enrichment**: Automatically enriches data with geolocation (latitude, longitude, country) and gender prediction
- **Warehouse Integration**: Automatically loads processed data to BigQuery data warehouse
- **Email Notifications**: Sends success notifications after warehouse updates
- **API Key Rotation**: Intelligent API key management with automatic fallback
- **Prometheus Metrics**: Built-in monitoring and observability
- **Structured Logging**: IST timezone-based logging with file and console outputs

### Technology Stack

- **Framework**: FastAPI
- **AI Model**: Google Gemini 2.5 Flash Lite API
- **Data Warehouse**: Google BigQuery
- **Async Processing**: asyncio, httpx
- **Document Parsing**: PyMuPDF, pdfplumber, python-docx
- **Data Processing**: pandas
- **Geolocation**: geopy (Nominatim)
- **Gender Prediction**: genderize
- **Monitoring**: Prometheus FastAPI Instrumentator

---

## 🔄 API Versioning

The ETL Service uses versioned API endpoints to ensure backward compatibility and smooth upgrades.

**Current Version**: `v1`

All endpoints are prefixed with `/api/v1/`

**Base URL**: `http://localhost:8002` (adjust based on deployment)

---

## 📡 API Endpoints

### 1. Root Endpoint

**GET** `/`

Returns the service status and welcome message.

#### Request
```bash
curl -X GET http://localhost:8002/
```

#### Success Response (200 OK)
```json
{
  "message": "Welcome to CVAlyze ETL Service"
}
```

#### Use Case
- Health check to verify the service is running
- Service discovery

---

### 2. API v1 Root

**GET** `/api/v1/`

Health check for the versioned API.

#### Request
```bash
curl -X GET http://localhost:8002/api/v1/
```

#### Success Response (200 OK)
```json
{
  "message": "ETL Service v1 running successfully"
}
```

#### Use Case
- Verify specific API version availability
- Version-specific health checks

---

### 3. Upload and Process CVs

**POST** `/api/v1/upload_cvs`

Upload one or multiple resume files for processing and extraction.

#### Request

**Content-Type**: `multipart/form-data`

**Parameters**:
- `files` (required): Array of file uploads (PDF, DOCX, or TXT)

```bash
curl -X POST http://localhost:8002/api/v1/upload_cvs \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.docx" \
  -F "files=@resume3.pdf"
```

#### Success Response (200 OK)

```json
{
  "jsonCv": [
    {
      "name": "John Doe",
      "profession": "Software Engineer",
      "phone_number": "+91-9876543210",
      "email": "john.doe@example.com",
      "location": "Bangalore, Karnataka",
      "github_link": "https://github.com/johndoe",
      "linkedin_link": "https://linkedin.com/in/johndoe",
      "skills": [
        "Python",
        "FastAPI",
        "Machine Learning",
        "Docker",
        "AWS"
      ],
      "education": [
        "B.Tech in Computer Science – ABC University (2016-2020)"
      ],
      "experience": [
        "Senior Software Engineer – Tech Corp",
        "Software Developer – StartupXYZ"
      ],
      "projects": [
        {
          "name": "AI Resume Parser",
          "links": ["https://github.com/johndoe/resume-parser"]
        },
        {
          "name": "E-commerce Platform",
          "links": null
        }
      ],
      "certifications": [
        "AWS Certified Solutions Architect",
        "Google Cloud Professional"
      ],
      "achievements": [
        "Led team of 5 developers",
        "Reduced API latency by 40%"
      ],
      "latitude": 12.9716,
      "longitude": 77.5946,
      "country": "India",
      "gender": "male"
    },
    {
      "name": "Jane Smith",
      "profession": "Data Scientist",
      "phone_number": "+91-9123456789",
      "email": "jane.smith@example.com",
      "location": "Mumbai, Maharashtra",
      "github_link": null,
      "linkedin_link": "https://linkedin.com/in/janesmith",
      "skills": [
        "Python",
        "TensorFlow",
        "SQL",
        "Data Visualization"
      ],
      "education": [
        "M.Sc in Data Science – XYZ Institute (2019-2021)"
      ],
      "experience": [
        "Data Scientist – Analytics Co"
      ],
      "projects": [],
      "certifications": null,
      "achievements": null,
      "latitude": 19.0760,
      "longitude": 72.8777,
      "country": "India",
      "gender": "female"
    }
  ],
  "errors": []
}
```

#### Error Responses

**1. No Files Uploaded (400 Bad Request)**
```json
{
  "detail": "No files were uploaded."
}
```

**2. Unsupported File Type (400 Bad Request)**
```json
{
  "detail": "Unsupported file type: .jpg"
}
```

**3. File Reading Error (500 Internal Server Error)**
```json
{
  "detail": "Error reading resume3.pdf: File is corrupted or unreadable"
}
```

**4. Processing Timeout (504 Gateway Timeout)**
```json
{
  "detail": "Processing timed out. Try again."
}
```

**5. General Processing Error (500 Internal Server Error)**
```json
{
  "detail": "CV processing failed: API key exhausted"
}
```

#### Processing Flow

1. **File Validation**: Checks file extensions (PDF, DOCX, TXT only)
2. **Concurrent Reading**: Reads all files asynchronously
3. **Text Extraction**: Extracts text from documents with link detection
4. **Text Cleaning**: Normalizes Unicode, removes artifacts, cleans formatting
5. **AI Extraction**: Gemini API extracts structured data (with automatic key rotation)
6. **Data Enrichment**: 
   - Geolocation lookup (latitude, longitude, country)
   - Gender prediction from name
7. **Data Warehouse**: Loads to BigQuery `cv_warehouse.cv_data` table
8. **Email Notification**: Sends success email after warehouse update

#### Use Cases

- Bulk CV processing for recruitment
- Automated candidate data extraction
- Building searchable resume databases
- Analytics and reporting pipelines

#### Notes

- **Timeout**: Processing timeout is set to 300 seconds (5 minutes)
- **Supported Formats**: `.pdf`, `.docx`, `.txt`
- **Concurrent Processing**: All files are processed simultaneously
- **Empty Fields**: Returns `null` for missing single values, `[]` for missing lists
- **Link Extraction**: Automatically detects GitHub, LinkedIn, and project URLs
- **API Key Rotation**: Automatically switches between API keys if one is rate-limited

---

### 4. View Service Logs

**GET** `/logs`

Retrieve the current service log file for debugging and monitoring.

#### Request
```bash
curl -X GET http://localhost:8002/logs --output etl_service.log
```

#### Success Response (200 OK)

**Content-Type**: `text/plain`

Returns the log file as plain text for download.

**Example Log Content**:
```
2025-10-26 14:30:15 [INFO] etl_service: Starting CVAlyze ETL Service
2025-10-26 14:30:16 [INFO] etl_service: ETL Service starting up...
2025-10-26 14:30:17 [INFO] etl_service: API key validated successfully: AIzaSyBx********
2025-10-26 14:30:17 [INFO] etl_service: Using API key: AIzaSyBx*****
2025-10-26 14:35:22 [INFO] etl_service: Received 3 files for processing
2025-10-26 14:35:45 [INFO] etl_service: Enriching data with geolocation and gender for 3 candidates.
2025-10-26 14:35:50 [INFO] etl_service: Uploading 3 CV records to BigQuery table: project-72dfbe56-9a82-4b81-a1a.cv_warehouse.cv_data
2025-10-26 14:35:55 [INFO] etl_service: BigQuery upload completed successfully.
2025-10-26 14:35:56 [INFO] etl_service: Email notification sent successfully!
2025-10-26 14:35:56 [INFO] etl_service: CV processing completed.
```

#### Error Response

**Log File Not Found (404 Not Found)**
```json
{
  "detail": "Log file not found."
}
```

#### Use Cases

- Debugging processing failures
- Monitoring service activity
- Auditing API usage
- Performance analysis

#### Notes

- **Timezone**: All timestamps are in IST (Asia/Kolkata)
- **Log File**: `etl_service.log` in service root directory
- **Log Levels**: INFO, WARNING, ERROR, CRITICAL
- **Rotation**: Log file is appended (not rotated automatically)

---

### 5. Prometheus Metrics

**GET** `/metrics`

Exposes Prometheus-compatible metrics for monitoring.

#### Request
```bash
curl -X GET http://localhost:8002/metrics
```

#### Success Response (200 OK)

**Content-Type**: `text/plain`

Returns Prometheus metrics in text format.

**Example Metrics**:
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/v1/upload_cvs",status="200"} 45.0

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.5",method="POST",path="/api/v1/upload_cvs"} 10.0
http_request_duration_seconds_bucket{le="1.0",method="POST",path="/api/v1/upload_cvs"} 25.0
```

#### Use Cases

- Integration with Prometheus monitoring
- Grafana dashboards
- Performance tracking
- SLA monitoring

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the service root:

```env
# Gemini API Keys (for rotation)
API_KEY1=your_gemini_api_key_1
API_KEY2=your_gemini_api_key_2

# Email Configuration (for notifications)
SENDER_EMAIL=your_email@gmail.com
RECEIVER_EMAIL=recipient@example.com
APP_PASSWORD=your_gmail_app_password

# Google Cloud (for BigQuery)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### BigQuery Configuration

The service uploads to:
- **Project**: `project-72dfbe56-9a82-****-***`
- **Dataset**: `cv_warehouse`
- **Table**: `cv_data`

**Schema** (auto-detected with manual overrides):
- Personal: name, profession, phone_number, email, location
- Links: github_link, linkedin_link
- Arrays: skills, education, experience, projects, certifications, achievements
- Enriched: latitude, longitude, country, gender

---

## 🚀 Running the Service

### Using Docker
```bash
docker build -t etl-service .
docker run -p 8001:8001 --env-file .env etl-service
```

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

---

## 📊 Data Extraction Schema

### Extracted Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Candidate's full name | "John Doe" |
| `profession` | string | Current role/title | "Software Engineer" |
| `phone_number` | string | Contact number | "+91-9876543210" |
| `email` | string | Email address | "john@example.com" |
| `location` | string | Personal address (contact location only) | "Bangalore, Karnataka" |
| `github_link` | string | GitHub profile URL | "https://github.com/johndoe" |
| `linkedin_link` | string | LinkedIn profile URL | "https://linkedin.com/in/johndoe" |
| `skills` | array | Technical/professional skills | ["Python", "FastAPI", "AWS"] |
| `education` | array | Educational qualifications | ["B.Tech in CS – ABC Univ (2016-2020)"] |
| `experience` | array | Work experience entries | ["Senior Engineer – Tech Corp"] |
| `projects` | array | Project objects with name and links | [{"name": "...", "links": [...]}] |
| `certifications` | array | Professional certifications | ["AWS Certified Solutions Architect"] |
| `achievements` | array | Key accomplishments (max 10 words each) | ["Led team of 5 developers"] |
| `latitude` | float | Enriched geolocation | 12.9716 |
| `longitude` | float | Enriched geolocation | 77.5946 |
| `country` | string | Enriched country name | "India" |
| `gender` | string | Predicted gender | "male" / "female" / "unknown" |

### Null Handling

- **Missing single values**: Returns `null`
- **Missing list values**: Returns `[]` (empty array)
- **Empty strings**: Converted to `null`
- **Invalid data**: Uses sensible defaults (e.g., India center coordinates for unknown locations)

---

## 🔍 Processing Details

### Text Extraction Pipeline

1. **PDF Processing**:
   - PyMuPDF: Extracts hyperlinks
   - pdfplumber: Extracts text with layout preservation
   - Link detection: Regex-based URL extraction
   - CID character removal
   - Page-wise processing

2. **DOCX Processing**:
   - python-docx: Paragraph extraction
   - Formatting preservation

3. **Text Cleaning**:
   - Unicode normalization (NFKC)
   - Emoji/icon replacement with labels
   - Bullet normalization
   - Whitespace cleanup
   - Non-ASCII character handling

### AI Extraction Process

Uses **Google Gemini 2.5 Flash Lite** with:
- **Prompt Engineering**: Structured extraction instructions
- **JSON Schema**: Enforced output format
- **Retry Logic**: Automatic API key rotation
- **Timeout**: 180 seconds per extraction
- **Fallback**: Returns null schema on failure

### Data Enrichment

1. **Geolocation** (geopy/Nominatim):
   - 3 retry attempts with 1-second delay
   - 5-second timeout per request
   - Default: India center coordinates (20.5937, 78.9629)

2. **Gender Prediction** (Genderize API):
   - Based on first name
   - Returns: "male", "female", or "unknown"
   - Graceful fallback on API failure

---

## 📧 Email Notifications

After successful BigQuery upload, the service sends an automated email:

**Subject**: `CVAlyze | CV Extraction and Warehouse Update Completed`

**Content**:
- Completion timestamp (IST)
- Number of records processed
- Link to Looker Studio dashboards
- Professional automated message

**Configuration**: Requires Gmail SMTP with App Password

---

## 🐛 Error Handling

### API Key Management
- Sequential key validation on startup
- 20-minute cache for validated keys
- Automatic rotation on rate limits
- Logs all key status changes

### Processing Errors
- Individual file errors don't block batch
- Errors returned in separate `errors` array
- Detailed exception logging
- Graceful degradation

### Timeout Management
- 5-minute total processing timeout
- 180-second per-CV extraction timeout
- 5-second geolocation timeout
- HTTP client timeout configurations

---

## 📝 Logging

### Log Levels
- **INFO**: Normal operations, successful processing
- **WARNING**: Recoverable issues, missing optional data
- **ERROR**: Processing failures, API errors
- **CRITICAL**: Service-critical failures

### Log Format
```
YYYY-MM-DD HH:MM:SS [LEVEL] logger_name: message
```

### Log Locations
- **File**: `etl_service.log` (append mode)
- **Console**: stdout (for Docker logs)
- **Timezone**: IST (Asia/Kolkata)

---

## 🔒 Security Considerations

- API keys stored in environment variables
- No sensitive data in logs (keys masked)
- BigQuery service account authentication
- Gmail App Password (not regular password)
- Input validation for file uploads
- File type restrictions

---

## 📈 Performance

- **Concurrent Processing**: Multiple CVs processed simultaneously
- **Async I/O**: Non-blocking file operations
- **Batch Upload**: Single BigQuery insert for all records
- **API Caching**: 20-minute key validation cache
- **Typical Throughput**: 10-20 CVs per minute (depends on API limits)

---

## 🔗 Related Services

- **Gateway Service**: Routes requests to ETL Service → [Documentation](../gateway/README.md)
- **User Service**: Manages user authentication → [Documentation](../user_service/README.md)

---

## 📞 Support

For issues or questions:
- Check service logs: `GET /logs`
- Review Prometheus metrics: `GET /metrics`
- Open GitHub issue with log excerpts
- Contact: CVAlyze Development Team