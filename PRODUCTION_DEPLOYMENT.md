# Production Deployment Guide

This guide provides comprehensive instructions for deploying the Trading Bot to a production environment using Docker and Docker Compose.

## 📋 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Network**: Stable internet connection with sufficient bandwidth

### Required Software
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: For repository management
- **Domain**: Configured domain name pointing to your server
- **SSL Certificate**: Let's Encrypt (automated) or custom certificate

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd algo-trading-bot
```

### 2. Configure Environment
```bash
# Copy and edit production environment file
cp .env.production.template .env.production
nano .env.production
```

### 3. Deploy to Production
```bash
# Make scripts executable
chmod +x scripts/deploy.sh
chmod +x scripts/backup.sh

# Run deployment
./scripts/deploy.sh production
```

## ⚙️ Detailed Configuration

### Environment Variables

#### Required Variables (Must Change)
```bash
# Domain and SSL
DOMAIN=your-domain.com
SSL_EMAIL=admin@your-domain.com

# Database
DB_NAME=trading_bot_prod
DB_USER=trading_bot_user
DB_PASSWORD=CHANGE_ME_STRONG_DB_PASSWORD

# Redis
REDIS_PASSWORD=CHANGE_ME_STRONG_REDIS_PASSWORD

# Security
JWT_SECRET=CHANGE_ME_VERY_STRONG_JWT_SECRET_AT_LEAST_64_CHARACTERS
REFRESH_TOKEN_SECRET=CHANGE_ME_VERY_STRONG_REFRESH_SECRET
SESSION_SECRET=CHANGE_ME_VERY_STRONG_SESSION_SECRET

# Monitoring
GRAFANA_PASSWORD=CHANGE_ME_STRONG_GRAFANA_PASSWORD
```

#### Optional Variables
```bash
# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key

# Backups (S3)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
BACKUP_S3_BUCKET=your-backup-bucket
```

### SSL Certificate Setup

#### Automatic (Let's Encrypt)
The deployment automatically configures Let's Encrypt SSL certificates:

1. Ensure your domain points to your server
2. Set `SSL_EMAIL` and `DOMAIN` in `.env.production`
3. Run deployment - certificates will be automatically obtained

#### Manual Certificate
If using custom certificates:

1. Place certificates in `nginx/ssl/`
2. Update `nginx/nginx.prod.conf` certificate paths
3. Disable certbot service in `docker-compose.prod.yml`

## 🗄️ Database Setup

### PostgreSQL + TimescaleDB
The production setup includes:
- PostgreSQL 15 with TimescaleDB extension
- Automated backups
- Performance optimization
- Connection pooling

### Initial Setup
```bash
# Database will be automatically initialized on first run
# Migration scripts in database/init/ will be executed
```

### Manual Database Operations
```bash
# Connect to database
docker exec -it trading-bot-postgres-prod psql -U trading_bot_user -d trading_bot_prod

# Run manual backup
./scripts/backup.sh

# Restore from backup
docker exec -i trading-bot-postgres-prod psql -U trading_bot_user -d trading_bot_prod < backup.sql
```

## 📊 Monitoring and Logging

### Included Monitoring Stack
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Nginx**: Access and error logs

### Accessing Monitoring
```bash
# Grafana (local access only)
http://localhost:3000
# Default login: admin / [GRAFANA_PASSWORD from env]

# Prometheus (local access only)
http://localhost:9090

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service_name]
```

### Custom Dashboards
Pre-configured dashboards include:
- Application Performance
- Database Metrics
- System Resources
- Trading Bot Metrics
- Error Rates and Response Times

## 🔐 Security Features

### Built-in Security
- **SSL/TLS**: Automatic HTTPS redirect
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: API and authentication endpoints
- **Container Security**: Non-root users, minimal images
- **Network Security**: Internal Docker networks
- **Input Validation**: Request validation and sanitization

### Firewall Configuration
```bash
# Recommended firewall rules (UFW)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Block direct access to services
sudo ufw deny 3001      # Backend
sudo ufw deny 5432      # PostgreSQL
sudo ufw deny 6379      # Redis
```

## 📦 Service Management

### Service Status
```bash
# View all services
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

### Service Operations
```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart [service_name]

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks
All services include health checks:
- **Frontend**: HTTP health endpoint
- **Backend**: API health endpoint
- **Database**: Connection test
- **Redis**: Ping test
- **Nginx**: Process check

## 🔄 Backup and Recovery

### Automated Backups
- **Database**: Daily automated backups
- **Retention**: 30 days (configurable)
- **Compression**: Gzip compression
- **S3 Upload**: Optional cloud backup

### Manual Backup
```bash
# Create backup
./scripts/backup.sh

# Create backup with custom retention
./scripts/backup.sh 60  # 60 days retention
```

### Disaster Recovery
```bash
# Full system backup
docker-compose -f docker-compose.prod.yml down
tar -czf system_backup.tar.gz . --exclude=node_modules --exclude=logs

# System restoration
tar -xzf system_backup.tar.gz
./scripts/deploy.sh production
```

## 🚦 Deployment Process

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          ssh user@your-server.com 'cd /path/to/app && ./scripts/deploy.sh production'
```

### Rolling Updates
```bash
# Zero-downtime deployment
./scripts/deploy.sh production

# The script automatically:
# 1. Builds new images
# 2. Creates backups
# 3. Updates services with health checks
# 4. Validates deployment
```

### Rollback Procedure
```bash
# Rollback to previous version
docker-compose -f docker-compose.prod.yml down
# Restore from backup
# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Performance Optimization

### Resource Limits
Services are configured with resource limits:
- **Backend**: 1GB RAM, 1 CPU
- **Frontend**: 128MB RAM, 0.5 CPU
- **Database**: 2GB RAM, 1 CPU
- **Redis**: 512MB RAM, 0.5 CPU

### Scaling
```bash
# Scale backend replicas
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Load balancing is handled by nginx upstream configuration
```

### Database Optimization
- Connection pooling (20 connections)
- Query optimization with indexes
- TimescaleDB for time-series data
- Regular VACUUM and ANALYZE

## 🔍 Troubleshooting

### Common Issues

#### SSL Certificate Problems
```bash
# Check certificate status
docker-compose -f docker-compose.prod.yml logs certbot

# Manually renew certificate
docker-compose -f docker-compose.prod.yml exec certbot certbot renew
```

#### Service Won't Start
```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Check resource usage
docker stats

# Verify environment variables
docker-compose -f docker-compose.prod.yml config
```

#### Database Connection Issues
```bash
# Check database status
docker exec trading-bot-postgres-prod pg_isready -U trading_bot_user

# Verify credentials
docker exec -it trading-bot-postgres-prod psql -U trading_bot_user -d trading_bot_prod -c "SELECT 1;"
```

#### High Memory Usage
```bash
# Check container memory usage
docker stats

# Optimize Redis memory
docker exec -it trading-bot-redis-prod redis-cli config set maxmemory 256mb
```

### Log Analysis
```bash
# View nginx access logs
docker-compose -f docker-compose.prod.yml logs nginx | grep "GET\|POST\|PUT\|DELETE"

# Check error rates
docker-compose -f docker-compose.prod.yml logs backend | grep ERROR

# Monitor database performance
docker exec -it trading-bot-postgres-prod psql -U trading_bot_user -d trading_bot_prod -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- **Weekly**: Review logs and performance metrics
- **Monthly**: Update security patches and dependencies
- **Quarterly**: Review and optimize database performance
- **Annually**: Security audit and certificate renewal

### Health Monitoring
- **Uptime Monitoring**: Configure external monitoring (e.g., UptimeRobot)
- **Log Monitoring**: Set up alerts for error patterns
- **Performance Monitoring**: Monitor response times and resource usage
- **Business Metrics**: Track trading performance and system reliability

### Getting Help
- Review logs in `/logs/` directory
- Check service status with Docker commands
- Monitor system metrics in Grafana
- Consult application-specific documentation

## 📋 Post-Deployment Checklist

After successful deployment:

- [ ] Verify all services are running and healthy
- [ ] Test SSL certificate and HTTPS redirect
- [ ] Confirm database connectivity and migrations
- [ ] Validate API endpoints are responding
- [ ] Check monitoring dashboards are populated
- [ ] Test backup and restoration procedures
- [ ] Verify log aggregation is working
- [ ] Configure external monitoring and alerts
- [ ] Document any custom configuration changes
- [ ] Set up regular maintenance schedule

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Internet      │    │   Load Balancer │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          │              ┌───────▼───────┐
          └──────────────►│     Nginx     │
                         │   (SSL Term)  │
                         └───────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼───────┐    │    ┌───────▼───────┐
            │   Frontend    │    │    │   Backend     │
            │  (React/Vite) │    │    │  (Node.js)    │
            └───────────────┘    │    └───────┬───────┘
                                 │            │
                                 │    ┌───────▼───────┐
                                 │    │   Database    │
                                 │    │ (PostgreSQL+  │
                                 │    │  TimescaleDB) │
                                 │    └───────┬───────┘
                                 │            │
                         ┌───────▼───────┐    │
                         │     Redis     │    │
                         │   (Cache)     │    │
                         └───────────────┘    │
                                              │
                    ┌─────────────────────────▼─────────────────────────┐
                    │                Monitoring                         │
                    │  Prometheus + Grafana + Loki                     │
                    └───────────────────────────────────────────────────┘
```

This production deployment provides enterprise-grade reliability, security, and scalability for your algorithmic trading platform.