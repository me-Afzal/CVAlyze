# User Service Documentation

## 📋 Overview

The User Service is a core authentication and user management microservice for CVAlyze. It handles user registration, authentication, password management, and account deletion with secure JWT-based token generation.

### Key Features

- **User Registration**: Secure account creation with password hashing
- **JWT Authentication**: Token-based authentication for stateless sessions
- **Password Management**: Secure password updates with verification
- **Account Deletion**: User account removal with password confirmation
- **Argon2 Password Hashing**: Industry-standard secure password storage
- **Database Management**: SQLAlchemy ORM with PostgreSQL/SQLite
- **Prometheus Metrics**: Built-in monitoring and observability
- **Structured Logging**: IST timezone-based logging with comprehensive tracking

### Technology Stack

- **Framework**: FastAPI
- **Database ORM**: SQLAlchemy
- **Password Hashing**: Argon2 (via passlib)
- **JWT Tokens**: python-jose
- **Database**: PostgreSQL (production)
- **Monitoring**: Prometheus FastAPI Instrumentator

### Security Features

- **Argon2 Hashing**: Memory-hard password hashing algorithm
- **JWT Tokens**: 24-hour token expiration
- **Password Verification**: All sensitive operations require password confirmation
- **Secure Token Generation**: HMAC-SHA256 signing algorithm

---

## 🔄 API Versioning

The User Service uses versioned API endpoints to ensure backward compatibility.

**Current Version**: `v1`

All endpoints are prefixed with `/api/v1/`

**Base URL**: `http://localhost:8001` (adjust based on deployment)

---

## 📡 API Endpoints

### 1. Root Endpoint

**GET** `/`

Returns the User Service status.

#### Request
```bash
curl -X GET http://localhost:8001/
```

#### Success Response (200 OK)
```json
{
  "message": "Welcome to CVAlyze User Service API"
}
```

#### Use Case
- Service discovery
- Health verification

---

### 2. API v1 Root

**GET** `/api/v1/`

Health check for the versioned API.

#### Request
```bash
curl -X GET http://localhost:8001/api/v1/
```

#### Success Response (200 OK)
```json
{
  "message": "Welcome to CVAlyze User Service API v1"
}
```

#### Use Case
- Version-specific health check
- API availability confirmation

---

### 3. User Registration

**POST** `/api/v1/register`

Register a new user account with secure password hashing.

#### Request

**Content-Type**: `application/json`

**Request Body Schema**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:8001/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123!"
  }'
```

#### Success Response (200 OK)
```json
{
  "Message": "User registered successfully"
}
```

#### Error Responses

**1. User Already Exists (409 Conflict)**
```json
{
  "detail": "User already exist"
}
```

**2. Missing Required Fields (422 Unprocessable Entity)**
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**3. Invalid Data Type (422 Unprocessable Entity)**
```json
{
  "detail": [
    {
      "loc": ["body", "password"],
      "msg": "str type expected",
      "type": "type_error.str"
    }
  ]
}
```

**4. Database Connection Error (500 Internal Server Error)**
```json
{
  "detail": "Internal server error"
}
```

#### Processing Flow

1. **Username Check**: Verifies username doesn't already exist
2. **Password Hashing**: Uses Argon2 algorithm for secure hashing
3. **Database Insert**: Creates new user record
4. **Response**: Returns success message

#### Use Cases

- New user account creation
- User onboarding
- Self-service registration

#### Security Notes

- **Password Storage**: Never stores plaintext passwords
- **Argon2 Hashing**: Memory-hard algorithm resistant to GPU attacks
- **Unique Username**: Enforced at database level

#### Related Services

📖 **Gateway Service**: [User Registration via Gateway](../gateway/README.md#user-registration)

---

### 4. User Login

**POST** `/api/v1/login`

Authenticate user credentials and receive a JWT access token.

#### Request

**Content-Type**: `application/json`

**Request Body Schema**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:8001/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123!"
  }'
```

#### Success Response (200 OK)
```json
{
  "Token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huX2RvZSIsImV4cCI6MTczMDkxOTYwMH0.abc123xyz456def789ghi",
  "token_type": "Bearer"
}
```

**Token Payload** (when decoded):
```json
{
  "sub": "john_doe",
  "exp": 1730919600
}
```

**Token Details**:
- **sub**: Username (subject)
- **exp**: Expiration timestamp (Unix time)
- **Valid Duration**: 24 hours from issue time
- **Algorithm**: HS256 (HMAC-SHA256)

#### Error Responses

**1. Invalid Credentials (401 Unauthorized)**
```json
{
  "detail": "Username/password is incorrect"
}
```

**2. User Not Found (401 Unauthorized)**
```json
{
  "detail": "Username/password is incorrect"
}
```
*Note: Same message for security (prevents username enumeration)*

**3. Missing Credentials (422 Unprocessable Entity)**
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**4. Database Connection Error (500 Internal Server Error)**
```json
{
  "detail": "Internal server error"
}
```

#### Authentication Flow

1. **User Lookup**: Queries database for username
2. **Password Verification**: Uses Argon2 to verify hashed password
3. **Token Generation**: Creates JWT with 24-hour expiration
4. **Response**: Returns token for subsequent authenticated requests

#### Token Usage

Include the token in subsequent requests:
```bash
curl -X POST http://localhost:8000/api/v1/upload_cvs \
  -H "Authorization: Bearer <your_token_here>" \
  -F "files=@resume.pdf"
```

#### Use Cases

- User authentication
- Session initialization
- Accessing protected endpoints

#### Security Notes

- **Password Never Logged**: Sensitive data excluded from logs
- **Timing Attack Prevention**: Same response time for invalid username/password
- **Token Expiration**: 24-hour validity period
- **Stateless Authentication**: No server-side session storage

#### Related Services

📖 **Gateway Service**: [User Login via Gateway](../gateway/README.md#user-login)

---

### 5. Update Password

**PUT** `/api/v1/register`

Update an existing user's password with old password verification.

#### Request

**Content-Type**: `application/json`

**Request Body Schema**:
```json
{
  "username": "string",
  "oldpassword": "string",
  "newpassword": "string"
}
```

**Example Request**:
```bash
curl -X PUT http://localhost:8001/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "oldpassword": "SecurePass123!",
    "newpassword": "NewSecurePass456!"
  }'
```

#### Success Response (200 OK)
```json
{
  "Message": "Your password is changed"
}
```

#### Error Responses

**1. User Not Found (404 Not Found)**
```json
{
  "detail": "User not found"
}
```

**2. Incorrect Old Password (401 Unauthorized)**
```json
{
  "detail": "Password is wrong"
}
```

**3. Missing Required Fields (422 Unprocessable Entity)**
```json
{
  "detail": [
    {
      "loc": ["body", "oldpassword"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**4. Database Connection Error (500 Internal Server Error)**
```json
{
  "detail": "Internal server error"
}
```

#### Processing Flow

1. **User Lookup**: Verifies user exists
2. **Old Password Verification**: Confirms current password is correct
3. **New Password Hashing**: Hashes new password with Argon2
4. **Database Update**: Updates password in database
5. **Response**: Returns success confirmation

#### Use Cases

- User-initiated password change
- Security updates
- Password reset flows
- Credential rotation

#### Security Notes

- **Old Password Required**: Prevents unauthorized password changes
- **New Password Hashed**: Immediately hashed before storage
- **No Token Invalidation**: Existing JWT tokens remain valid until expiration
- **Audit Logging**: All password changes logged

#### Best Practices

**Recommended**: Implement additional validation:
- Minimum password length (e.g., 8 characters)
- Password complexity requirements
- Prevent reuse of old passwords
- Rate limiting for password change attempts

#### Related Services

📖 **Gateway Service**: [Update Password via Gateway](../gateway/README.md#update-password)

---

### 6. Delete User Account

**POST** `/api/v1/register/delete`

Permanently delete a user account with password confirmation.

#### Request

**Content-Type**: `application/json`

**Request Body Schema**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:8001/api/v1/register/delete \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123!"
  }'
```

#### Success Response (200 OK)
```json
{
  "Message": "User is deleted"
}
```

#### Error Responses

**1. User Not Found (404 Not Found)**
```json
{
  "detail": "User not found"
}
```

**2. Incorrect Password (401 Unauthorized)**
```json
{
  "detail": "Password is wrong"
}
```

**3. Missing Required Fields (422 Unprocessable Entity)**
```json
{
  "detail": [
    {
      "loc": ["body", "password"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**4. Database Connection Error (500 Internal Server Error)**
```json
{
  "detail": "Internal server error"
}
```

#### Processing Flow

1. **User Lookup**: Verifies user exists in database
2. **Password Verification**: Confirms password is correct
3. **Database Deletion**: Removes user record from database
4. **Response**: Returns deletion confirmation

#### Use Cases

- User account closure
- GDPR compliance (right to be forgotten)
- Account deactivation
- User offboarding

#### Security Notes

- **Password Required**: Prevents accidental/unauthorized deletion
- **Irreversible Operation**: No soft delete; user is permanently removed
- **No Token Invalidation**: Existing JWT tokens remain valid until expiration
- **Audit Logging**: Deletion attempts and successes logged

#### Important Considerations

⚠️ **Data Retention**: This operation only deletes the user account. Consider:
- **Associated Data**: May need cascade deletion for user-related data
- **GDPR Compliance**: Ensure all user data is properly removed
- **Audit Trail**: Keep deletion logs for compliance

**Recommended Enhancements**:
- Implement soft delete with `is_active` flag
- Add confirmation step (e.g., email verification)
- Implement cooling-off period before permanent deletion
- Backup user data before deletion

#### Related Services

📖 **Gateway Service**: [Delete User via Gateway](../gateway/README.md#delete-user-account)

---

### 7. View Service Logs

**GET** `/logs`

Retrieve User Service logs for monitoring and debugging.

#### Request
```bash
curl -X GET http://localhost:8001/logs --output user_service.log
```

#### Success Response (200 OK)

**Content-Type**: `text/plain`

Returns the log file as plain text for download.

**Example Log Content**:
```
2025-10-26 14:30:15 [INFO] user_service: Starting CVAlyze User Service API
2025-10-26 14:30:16 [INFO] user_service: User Service Root endpoint accessed.
2025-10-26 14:35:22 [INFO] user_service: Registration attempt for user: john_doe
2025-10-26 14:35:23 [INFO] user_service: Registration is completed for user john_doe
2025-10-26 14:36:45 [INFO] user_service: Login attempt for user: john_doe
2025-10-26 14:36:46 [INFO] user_service: Login is successful for user john_doe
2025-10-26 14:40:12 [INFO] user_service: Password update attempt for user: jane_smith
2025-10-26 14:40:13 [INFO] user_service: Password update is completed for user jane_smith
2025-10-26 14:45:30 [INFO] user_service: Deletion attempt for user: test_user
2025-10-26 14:45:31 [INFO] user_service: Deletion is completed for user test_user
```

#### Error Response

**Log File Not Found (404 Not Found)**
```json
{
  "detail": "Log file not found."
}
```

#### Use Cases

- Debugging authentication issues
- Monitoring user activity
- Security audit trails
- Compliance reporting

#### Log Information

**Logged Events**:
- Service startup
- User registration attempts and completions
- Login attempts and successes
- Password update requests
- Account deletion requests
- Endpoint access

**Log Format**:
```
YYYY-MM-DD HH:MM:SS [LEVEL] logger_name: message
```

**Log Levels**:
- **INFO**: Normal operations (registrations, logins, updates)
- **WARNING**: Unusual activity, missing log file access
- **ERROR**: Database errors, authentication failures (implicitly via exceptions)

#### Security Notes

- **Password Never Logged**: Sensitive data excluded
- **Username Logged**: For audit trail purposes
- **Timezone**: All timestamps in IST (Asia/Kolkata)

#### Related Services

📖 **Gateway Service**: [Access User Logs via Gateway](../gateway/README.md#user-service-logs)

---

### 8. Prometheus Metrics

**GET** `/metrics`

Exposes Prometheus-compatible metrics for monitoring.

#### Request
```bash
curl -X GET http://localhost:8001/metrics
```

#### Success Response (200 OK)

**Content-Type**: `text/plain`

Returns Prometheus metrics in text format.

**Example Metrics**:
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/v1/register",status="200"} 45.0
http_requests_total{method="POST",path="/api/v1/login",status="200"} 152.0
http_requests_total{method="POST",path="/api/v1/login",status="401"} 12.0
http_requests_total{method="PUT",path="/api/v1/register",status="200"} 8.0
http_requests_total{method="POST",path="/api/v1/register/delete",status="200"} 3.0

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="POST",path="/api/v1/login"} 140.0
http_request_duration_seconds_bucket{le="0.5",method="POST",path="/api/v1/login"} 150.0
http_request_duration_seconds_bucket{le="1.0",method="POST",path="/api/v1/login"} 152.0

# HELP user_registrations_total Total number of user registrations
# TYPE user_registrations_total counter
user_registrations_total 45.0

# HELP login_attempts_total Total number of login attempts
# TYPE login_attempts_total counter
login_attempts_total{status="success"} 152.0
login_attempts_total{status="failure"} 12.0
```

#### Use Cases

- Integration with Prometheus monitoring
- Grafana dashboards
- Performance tracking
- Security monitoring (failed login attempts)

#### Related Services

📖 **Prometheus**: [Monitoring Configuration](../prometheus/prometheus.yml)

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the User Service root:

```env
# JWT Configuration
SECRET_KEY=your_super_secret_key_for_jwt_signing_min_32_chars
ALGORITHM=HS256

# Database Configuration
DATABASE_URL= #Take DB URL 
```

### Database Schema

**Table**: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | Integer | Primary Key, Auto-increment | User ID |
| `username` | String(255) | Unique, Not Null | Username |
| `password` | String(255) | Not Null | Hashed password (Argon2) |


---

## 🚀 Running the Service

### Using Docker
```bash
docker build -t user-service .
docker run -p 8001:8001 --env-file .env user-service
```

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Database Initialization

Database tables are automatically created on first run:
```python
models.Base.metadata.create_all(bind=engine)
```

---

## 🔐 Security Implementation

### Password Hashing

**Algorithm**: Argon2
- **Type**: Argon2id (hybrid mode)
- **Memory**: Configurable (default: 512 MB)
- **Iterations**: Configurable (default: 2)
- **Parallelism**: Configurable (default: 2)

**Example Hash Output**:
```
$argon2id$v=19$m=512,t=2,p=2$abc123$xyz789...
```

### JWT Token Structure

**Header**:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload**:
```json
{
  "sub": "username",
  "exp": 1730919600
}
```

**Signature**: HMAC-SHA256(base64Url(header) + "." + base64Url(payload), SECRET_KEY)

### Security Best Practices Implemented

✅ **Password Security**:
- Argon2 hashing (memory-hard, GPU-resistant)
- No plaintext password storage
- Password verification for sensitive operations

✅ **Token Security**:
- 24-hour expiration
- HMAC-SHA256 signing
- Subject (username) embedded in token

✅ **API Security**:
- Input validation via Pydantic schemas
- SQL injection prevention via ORM
- Error message sanitization (no user enumeration)

### Recommended Enhancements

⚠️ **Production Considerations**:
- Implement rate limiting for login attempts
- Add account lockout after failed attempts
- Implement refresh token mechanism
- Add email verification for registration
- Implement password complexity requirements
- Add HTTPS-only cookie storage for tokens
- Implement CSRF protection
- Add audit logging for security events

---

## 📊 Data Schemas

### UserCreate (Registration)
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

### UserLogin (Authentication)
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

### UpdateUser (Password Update)
```json
{
  "username": "string (required)",
  "oldpassword": "string (required)",
  "newpassword": "string (required)"
}
```

### DeleteUser (Account Deletion)
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

---

## 📝 Logging

### Log Format
```
YYYY-MM-DD HH:MM:SS [LEVEL] logger_name: message
```

### Log Levels
- **INFO**: Normal operations (registrations, logins, updates, deletions)
- **WARNING**: Unusual activity, missing resources
- **ERROR**: System errors, database failures

### Log Locations
- **File**: `user_service.log` (append mode)
- **Console**: stdout (for Docker logs)
- **Timezone**: IST (Asia/Kolkata)

### Logged Events
- Service startup
- All authentication attempts (with username)
- Registration completions
- Password updates
- Account deletions
- Log file access

---

## 🐛 Error Handling

### HTTP Status Codes Used

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful operations |
| 401 | Unauthorized | Invalid credentials, wrong password |
| 404 | Not Found | User not found, log file missing |
| 409 | Conflict | Username already exists |
| 422 | Unprocessable Entity | Invalid request schema |
| 500 | Internal Server Error | Database errors, system failures |

### Error Response Format

All errors follow FastAPI's standard format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## 🔗 Related Services

- **Gateway Service**: Routes client requests to User Service → [Documentation](../gateway/README.md)
- **ETL Service**: Processes CVs for authenticated users → [Documentation](../etl_service/README.md)

---

## 📈 Performance Considerations

- **Password Hashing**: Argon2 is intentionally slow (~100-200ms per hash)
- **Database Queries**: Indexed username lookups (~1-5ms)
- **JWT Generation**: Fast cryptographic operations (~1ms)
- **Token Validation**: Performed by Gateway Service

**Typical Latency**:
- Registration: 100-250ms (dominated by Argon2 hashing)
- Login: 100-250ms (password verification + token generation)
- Password Update: 200-400ms (two Argon2 operations)
- Account Deletion: 10-50ms (database delete operation)

---

## 📞 Support

For issues or questions:
- Check service logs: `GET /logs`
- Review Prometheus metrics: `GET /metrics`
- Verify database connectivity
- Check environment variable configuration
- Open GitHub issue with log excerpts
- Contact: CVAlyze Development Team

---

## 🔄 API Documentation

Interactive API documentation available at:
- **Swagger UI**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`
- **OpenAPI Spec**: `http://localhost:8001/openapi.json`