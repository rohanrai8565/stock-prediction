# Production Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Domain name (for SSL)
- SSL certificates (Let's Encrypt recommended)
- Cloud hosting (AWS, GCP, Azure, or VPS)

## Environment Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd stock-prediction-main
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. **Generate SSL certificates** (for production)
```bash
# Using Let's Encrypt
certbot certonly --standalone -d yourdomain.com
```

## Docker Deployment

### Build and Start Services

```bash
# Build and start all services
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### Service Architecture

- **web**: Main application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **nginx**: Reverse proxy (ports 80, 443)
- **websocket**: WebSocket server (port 8080)

## Manual Deployment

### Without Docker

1. **Install dependencies**
```bash
npm install
```

2. **Build the application**
```bash
npm run build
```

3. **Set up PostgreSQL**
```bash
# Create database
createdb stockdb
```

4. **Start the application**
```bash
NODE_ENV=production npm start
```

## Cloud Deployment

### AWS Deployment

#### Using ECS (Elastic Container Service)

1. **Push Docker images to ECR**
```bash
aws ecr create-repository --repository-name stock-prediction
docker tag stock-prediction:latest <your-ecr-uri>
docker push <your-ecr-uri>
```

2. **Create ECS task definition**
3. **Configure load balancer**
4. **Set up auto-scaling**

#### Using EC2

1. **Launch EC2 instance**
2. **Install Docker**
3. **Deploy using docker-compose**
4. **Configure security groups**

### Google Cloud Platform

#### Using Cloud Run

```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/stock-prediction
gcloud run deploy stock-prediction --image gcr.io/PROJECT-ID/stock-prediction --platform managed
```

#### Using GKE (Google Kubernetes Engine)

1. **Create GKE cluster**
2. **Deploy using kubectl**
3. **Configure ingress and services**

### Azure Deployment

#### Using Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name stock-prediction \
  --image your-registry/stock-prediction \
  --dns-name-label stock-prediction-unique
```

## Database Setup

### PostgreSQL Migration

```bash
# Run migrations
npm run migrate

# Seed database
npm run seed
```

### Redis Configuration

```bash
# Connect to Redis
redis-cli

# Test connection
ping
```

## Monitoring and Logging

### Application Monitoring

- **Health checks**: `/health` endpoint
- **Metrics**: Prometheus-compatible metrics
- **Logging**: Structured JSON logs

### Log Management

```bash
# View application logs
docker-compose logs -f web

# View database logs
docker-compose logs -f postgres
```

## Security Configuration

### SSL/TLS Setup

1. **Obtain SSL certificates**
2. **Configure Nginx**
3. **Enable HTTPS only**

### Firewall Rules

```bash
# Allow only necessary ports
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

### API Key Management

- Store keys in environment variables
- Never commit keys to version control
- Rotate keys regularly
- Use key management services (AWS KMS, etc.)

## Performance Optimization

### Caching Strategy

- Redis for session storage
- CDN for static assets
- Database query optimization

### Load Balancing

- Configure Nginx load balancing
- Set up multiple application instances
- Configure health checks

## Backup and Recovery

### Database Backups

```bash
# Automated backups
docker-compose exec postgres pg_dump -U stockuser stockdb > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U stockuser stockdb < backup.sql
```

### Disaster Recovery

- Regular backups to S3/GCS
- Multi-region deployment
- Failover procedures

## Scaling

### Horizontal Scaling

```bash
# Scale web service
docker-compose up -d --scale web=3
```

### Vertical Scaling

- Increase instance size
- Optimize database queries
- Add caching layers

## Troubleshooting

### Common Issues

**Service won't start**
```bash
docker-compose logs web
```

**Database connection failed**
```bash
docker-compose exec postgres psql -U stockuser -d stockdb
```

**WebSocket connection issues**
```bash
docker-compose logs websocket
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Analyze slow queries
docker-compose exec postgres pg_stat_statements
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and push Docker image
        run: |
          docker build -t your-registry/stock-prediction .
          docker push your-registry/stock-prediction
      - name: Deploy to production
        run: |
          docker-compose pull
          docker-compose up -d
```

## Maintenance

### Regular Tasks

- **Daily**: Monitor logs and metrics
- **Weekly**: Review security updates
- **Monthly**: Database maintenance, backup verification
- **Quarterly**: Performance review, capacity planning

### Updates

```bash
# Update dependencies
npm update

# Rebuild and redeploy
docker-compose up -d --build
```

## Cost Optimization

- **Right-sizing instances**
- **Auto-scaling configuration**
- **Reserved instances for predictable workloads
- **Spot instances for non-critical workloads

## Support and Monitoring

### Monitoring Tools

- **Application Performance Monitoring (APM)**: New Relic, Datadog
- **Log aggregation**: ELK Stack, CloudWatch
- **Uptime monitoring**: UptimeRobot, Pingdom

### Alerting

- Configure alerts for:
  - Service downtime
  - High error rates
  - Performance degradation
  - Security incidents

## Compliance

### Data Protection

- GDPR compliance
- Data encryption at rest and in transit
- Access controls and authentication
- Audit logging

### Financial Compliance

- SEC regulations (if applicable)
- Data retention policies
- Trade execution logging
- Risk management documentation
