# CVAlyze Backend

A microservices-based backend architecture for CVAlyze - an intelligent CV/Resume analysis and management system.

## 📋 Overview

The CVAlyze backend is built using a microservices architecture, consisting of multiple independent services that communicate with each other to provide a scalable and maintainable solution. Each service is designed to handle specific responsibilities, ensuring separation of concerns and easier maintenance.

## 🏗️ Architecture

```
Backend/
├── gateway/              # API Gateway Service
├── etl_service/          # ETL (Extract, Transform, Load) Service
├── user_service/         # User Management Service
└── prometheus/           # Monitoring & Metrics Configuration
```

## Services

### 1. Gateway Service
**Purpose**: Acts as the single entry point for all client requests, handling routing, authentication, and load balancing across microservices.

**Key Responsibilities**:
- API request routing to appropriate microservices
- Authentication and authorization
- Rate limiting and request validation
- API aggregation and response composition

📖 **[View Gateway Documentation](./gateway/README.md)**

---

### 2. User Service
**Purpose**: Manages user accounts, authentication, profiles, and user-related operations.

**Key Responsibilities**:
- User registration and authentication
- Profile management
- User preferences and settings
- Access control and permissions

📖 **[View User Service Documentation](./user_service/README.md)**

---

### 3. ETL Service
**Purpose**: Handles the extraction, transformation, and loading of CV/Resume data, including parsing, analysis, and data processing.

**Key Responsibilities**:
- Resume/CV file parsing (PDF, DOCX, etc.)
- Data extraction and normalization
- Skills and experience analysis
- Data transformation and storage

📖 **[View ETL Service Documentation](./etl_service/README.md)**

---

### 4. Prometheus Monitoring
**Purpose**: Provides monitoring, metrics collection, and observability for all backend services.

**Key Responsibilities**:
- Metrics collection from all services
- Performance monitoring
- Service health checks
- Alert management

**Configuration**: 
- Main config file: `prometheus/prometheus.yml`
- Configured scrape targets for all microservices
- Custom metrics and alerting rules

📖 **[View Prometheus Configuration](./prometheus/prometheus.yml)**

---

## 🔧 Technology Stack

- **Languages**: Python
- **Frameworks**: FastAPI
- **Databases**: PostgreSQL (Prisma)
- **Monitoring**: Prometheus + Grafana
- **Containerization**: Docker & Docker Compose

## 🚦 Getting Started

### Prerequisites

- Docker, Docker Compose and Kubernetes (If you want to test in Kubernetes)
- Python 3.9+ (if running locally)
- PostgreSQL (if running locally)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/me-Afzal/CVAlyze.git
   cd CVAlyze/Backend
   ```

2. **Start all services using Docker Compose after creating Docker Compose file**
   ```bash
   docker-compose up -d
   ```

3. **Verify services are running**
   ```bash
   docker-compose ps
   ```

### Service Endpoints

- **Gateway**: `http://localhost:8000`
- **User Service**: `http://localhost:8001`
- **ETL Service**: `http://localhost:8002`
- **Prometheus**: `http://localhost:9090`

## 📊 Monitoring

Access Prometheus dashboard at `http://localhost:9090` to monitor:
- Service health and uptime
- Request rates and latencies
- Resource utilization
- Custom application metrics

## 🔒 Security

- All services implement JWT-based authentication
- API endpoints are protected by the gateway
- Sensitive data is encrypted at rest and in transit
- Environment variables are used for secrets management

## 🧪 Testing

Each service contains its own test suite. To run tests for all services:

```bash
# Run tests for all services
./scripts/run-all-tests.sh

# Or run tests for individual services
cd gateway && pytest
cd etl_service && pytest
cd user_service && pytest
```

## 📝 API Documentation

Detailed API documentation for each service is available:
- Gateway API: [./gateway/README.md](./gateway/README.md)
- User Service API: [./user_service/README.md](./user_service/README.md)
- ETL Service API: [./etl_service/README.md](./etl_service/README.md)

Swagger/OpenAPI documentation is available at:
- Gateway: `http://localhost:8000/docs`
- User Service: `http://localhost:8001/docs`
- ETL Service: `http://localhost:8002/docs`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 📞 Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Contact: [afzalkottukkal23@gamil.com]

---

**Note**: For detailed information about each service, please refer to their respective README files linked above.