# CVAlyze - AI-Powered CV Analysis Platform

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-CVAlyze-blue?logo=github)](https://github.com/me-Afzal/CVAlyze)
[![Status](https://img.shields.io/badge/Status-Active-success)]()

**End-to-End ETL + AI Candidate Analysis Platform**

*Streamlining recruitment with intelligent, data-driven insights*

[Features](#-key-features) • [Architecture](#%EF%B8%8F-system-architecture) • [Demo](#-demo) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 📋 Overview

**CVAlyze** is an end-to-end platform that automates the analysis of resumes, extracting structured insights from unstructured CVs, enriching data with AI-driven features, and presenting it through an interactive dashboard for HR teams and recruiters.

### 🎯 Objective

Streamline and accelerate the recruitment process by:
- ✅ Reducing manual CV screening effort
- ✅ Providing intelligent, data-driven candidate insights
- ✅ Enabling smarter, faster hiring decisions
- ✅ Automating candidate data enrichment

### 👥 Target Users

- HR Managers
- Recruiters
- Hiring Teams
- Talent Acquisition Specialists

---

## ✨ Key Features

### 📤 CV Processing
- **Multi-format Support**: Upload multiple CVs (.pdf, .docx, .txt)
- **Hybrid AI Extraction**: Regex + RAG (LLM) for accurate data extraction
- **Fast Processing**: 3-4 seconds per CV using optimized custom RAG

### 🤖 AI Integration
- **Gemini-Powered Chatbot**: Interactive candidate evaluation assistant
- **Smart Insights**: AI-driven analysis of skills, experience, and qualifications
- **Prompt Engineering**: Context-aware candidate recommendations

### 📊 Data Visualization
- **Interactive Dashboard**: Built with Plotly.js
  - 🌍 **World Map**: Geographic candidate distribution (bubble map)
  - 🥧 **Pie Charts**: Gender distribution analysis
  - 📋 **Matrix Tables**: Filterable candidate details
  - 👤 **Profile Cards**: Detailed candidate profiles
- **Advanced Reporting**: Looker Studio integration for HR analytics

### 🔐 Security & Authentication
- JWT-based authentication
- Role-based access control
- Secure credential storage

### 📧 Notifications
- Email confirmations for successful uploads
- Error alerts for failed processing
- Daily automated HR reports

---

## 🏗️ System Architecture

### Architecture Components
```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vercel)                        │
│              HTML • CSS • JavaScript • Plotly.js                 │
│                    Gemini Chatbot Integration                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐       ┌───────▼────────┐
        │  API Gateway   │       │  User Service  │
        │   (FastAPI)    │       │   (Auth/JWT)   │
        └───────┬────────┘       └───────┬────────┘
                │                        │
                │                   ┌────▼─────┐
                │                   │PostgreSQL│
                │                   └──────────┘
        ┌───────▼────────┐
        │ Transformation │
        │    Service     │
        │  (ETL + NLP)   │
        └───────┬────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐  ┌──▼───┐  ┌────▼──────┐
│Geopy   │  │Gemini│  │Genderize  │
│  API   │  │ API  │  │    API    │
└────────┘  └──────┘  └───────────┘
                │
        ┌───────▼────────┐
        │   BigQuery     │
        │ Data Warehouse │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │ Looker Studio  │
        │   Reporting    │
        └────────────────┘
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | HTML, CSS, JavaScript, Plotly.js |
| **Backend** | FastAPI, Python, GCP Kubernetes |
| **Database** | PostgreSQL (Prisma ORM), BigQuery |
| **AI/ML** | Gemini API 2.5 Flash, Custom RAG |
| **APIs** | Geopy, Genderize, SMTP |
| **Deployment** | Vercel (Frontend), GKE (Backend) |
| **Visualization** | Plotly.js, Looker Studio |

---

## 🔄 ETL Pipeline

### 1. Extract
- Extract text from PDF, DOCX, TXT files
- Tools: PyMuPDF, pdfplumber, python-docx
- Clean and normalize text (token cleaning)

### 2. Transform (Hybrid AI Approach)

**Extracted Fields:**
- **Basic Info**: Name, Email, Phone, Location
- **Professional**: Skills, Education, Experience, Projects
- **Links**: LinkedIn, GitHub, Portfolio Website
- **Additional**: Certifications, Achievements

**Enrichment:**
- **Geographic Data**: Country, Latitude, Longitude (via Geopy)
- **Demographics**: Gender prediction (via Genderize API)

### 3. Load
- Store structured data → BigQuery data warehouse
- Send confirmation email to HR
- Return JSON array to frontend for visualization

---

## 🤖 AI Chat Assistant

### Features
- **Direct Integration**: Gemini API called from frontend (reduces backend load)
- **Context-Aware**: System prompt includes filtered candidate data
- **Smart Recommendations**: Default query suggests top 5 candidates
- **Chat History**: Maintains 2-message conversation context

### Example Query
```
"Arrange and evaluate top 5 candidates based on skill, 
projects, and experience for a Senior Full-Stack Developer role."
```

---

## 🔐 Authentication Flow
```
Registration:  POST /register → User Service → PostgreSQL (hashed password)
Login:         POST /login → Generate JWT Token → Return to client
Protected:     JWT stored in localStorage → Used for API calls
```

---

## 📊 Data Storage

### PostgreSQL (User Database)
- User credentials (hashed passwords)
- JWT token management

### BigQuery (Candidate Data Warehouse)
**Schema:**
```sql
candidates (
  name, email, phone, location, country,
  skills, experience, education, projects,
  gender, latitude, longitude,
  linkedin, github, website,
  certifications, achievements,
)
```

**Benefits:**
- Scalable for large datasets
- Optimized for analytical queries
- Seamless Looker Studio integration

---

## 🚀 Deployment

### Backend Microservices (GCP Kubernetes)
```
cv-gateway          → API Gateway (routing, load balancing)
user_service        → Authentication & user management
etl_service   → ETL pipeline & AI extraction
```

### Deployment Steps

1. **Build Docker Images**
```bash
   docker build -t gcr.io/PROJECT_ID/cv-gateway .
   docker build -t gcr.io/PROJECT_ID/user-service .
   docker build -t gcr.io/PROJECT_ID/etl-service .
```

2. **Push to Google Container Registry**
```bash
   docker push gcr.io/PROJECT_ID/cv-gateway
   docker push gcr.io/PROJECT_ID/user-service
   docker push gcr.io/PROJECT_ID/etl-service
```

3. **Deploy to GKE**
```bash
   kubectl apply -f k8s/gateway-deployment.yaml
   kubectl apply -f k8s/user-service-deployment.yaml
   kubectl apply -f k8s/etl-service-deployment.yaml
```

4. **Configure Ingress**
   - Routes: `/login`, `/register`, `/transform`
   - SSL/TLS certificates
   - Load balancing

5. **Secrets Management**
   - Store API keys in GCP Secret Manager


### Frontend (Vercel)
- Automatic deployment from GitHub
- Environment variables configured in Vercel dashboard

---

## 📁 Repository Structure
```
CVAlyze/
├── Backend/
│   ├── gateway/
│   ├── user_service/
│   ├── etl_service/                  # Backend API documentation
│   └── README.md    #Backend-specific documentation
├── Frontend/
│   ├── src/
│   ├── assets/
│   └── README.md
├── .gitignore
└── README.md                   # This file
```

---

## 📖 Documentation

- **Backend Documentation**: [Backend/docs/README.md](https://github.com/me-Afzal/CVAlyze/blob/main/Backend/README.md)
  - API Endpoints
  - Microservice Architecture
  - Database Schema
  - Deployment Guide
  
- **POC Experiments**: [CVAlyze-Prototype Repository](https://github.com/me-Afzal/CVAlyze-Prototype)
  - Text Extraction Testing
  - LLM Model Comparisons
  - RAG Approach Experiments

---

## 🎯 End-to-End Workflow
```
1️⃣ User Login/Register → JWT Authentication

2️⃣ Upload Multiple CVs → Gateway → Transformer Service

3️⃣ ETL & AI Enrichment → BigQuery + Email Notification

4️⃣ Return JSON → Frontend Visualization (Plotly.js)

5️⃣ User Explores Data + Interacts with Gemini Chatbot

6️⃣ Looker Studio Auto-Report Sent to HR Daily
```

---

## 📈 Performance Metrics

| Metric | Performance |
|--------|-------------|
| **Text Extraction** | < 1 second per CV |
| **AI Data Extraction** | 3-4 seconds per CV |
| **Dashboard Load Time** | < 2 seconds |
| **API Response Time** | < 500ms (avg) |
| **Concurrent Users** | 100+ (scalable) |

---


## 👤 Author

**Afzal**

[![GitHub](https://img.shields.io/badge/GitHub-me--Afzal-black?logo=github)](https://github.com/me-Afzal)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/afzal-a-0b1962325/)
[![Email](https://img.shields.io/badge/Email-Contact-red?logo=gmail)](mailto:afzalkottukkal23@gmail.com)

---

## 🙏 Acknowledgments

- **Gemini API** by Google for AI capabilities
- **Plotly.js** for interactive visualizations
- **FastAPI** for high-performance backend
- **GCP** for cloud infrastructure
- Open-source community for various libraries

---

## 📞 Support

For questions, issues, or feature requests:
- Open an [Issue](https://github.com/me-Afzal/CVAlyze/issues)
- Check [Backend Documentation](https://github.com/me-Afzal/CVAlyze/blob/main/Backend/README.md)
- Review [POC Experiments](https://github.com/me-Afzal/CVAlyze-Prototype)

---

<div align="center">

**Made with ❤️ for modern recruitment**

⭐ Star this repo if you find it helpful!

</div>