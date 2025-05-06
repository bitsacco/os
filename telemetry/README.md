# Bitsacco Production Monitoring Setup with Traefik

This directory contains a production-ready setup for monitoring infrastructure using Prometheus, Grafana, Alertmanager, and Traefik as a reverse proxy with automatic HTTPS.

## Features

- Automatic HTTPS via Let's Encrypt
- Traefik for routing and SSL termination
- Subdomain-based access to each service
- Basic authentication for security-sensitive endpoints
- Alert notifications via email
- Comprehensive dashboards for monitoring services
- Preconfigured alert rules for critical metrics
- Non-root container execution for enhanced security
- Log rotation to prevent disk space issues

## Setup Instructions

### 1. Prerequisites

- Docker and Docker Compose installed
- DNS records for your subdomains (*.example.com pointing to your server)
- Network reachable on ports 80 and 443 for Let's Encrypt validation

### 2. Configuration

1. Copy `.env.example` to `.env` and run the setup script:

```bash
cp .env.example .env
./setup.sh
```

2. The setup script will:
   - Generate secure credentials for basic auth
   - Create required directories
   - Copy existing dashboards (if available)
   - Pull required Docker images

3. Update configuration files:
   - Edit `prometheus/alertmanager.yml` with your SMTP settings for alerts

### 3. DNS Configuration

Ensure you have the following DNS records pointing to your server:

- grafana.<example.com>
- prometheus.<example.com>
- alertmanager.<example.com>
- node-exporter.<example.com>
- cadvisor.<example.com>

### 4. Launch Services

```bash
docker-compose -f compose.telemetry.yml up -d
```

### 5. Access Monitoring

- Grafana: https://grafana.<example.com>
- Prometheus: https://prometheus.<example.com> (requires basic auth)
- Alertmanager: https://alertmanager.<example.com> (requires basic auth)
- Node Exporter: https://node-exporter.<example.com> (requires basic auth)
- cAdvisor: https://cadvisor.<example.com> (requires basic auth)

## Security Considerations

- All services use HTTPS with automatic certificate management
- Security-sensitive services protected with basic authentication
- Services run as non-root users
- Grafana configured with strong password
- Log rotation to prevent information disclosure

## Maintenance

### Updating

To update the monitoring stack:

```bash
docker-compose -f compose.telemetry.yml pull
docker-compose -f compose.telemetry.yml up -d
```

### Backups

Back up important volumes:

```bash
docker run --rm -v bitsacco_grafana_data:/data -v $(pwd)/backups:/backups \
  alpine tar -czf /backups/grafana-data-$(date +%Y%m%d).tar.gz /data
```

## Troubleshooting

Check logs:

```bash
docker-compose -f compose.telemetry.yml logs -f [service_name]
```

To test Prometheus configuration:

```bash
docker-compose -f compose.telemetry.yml exec prometheus \
  promtool check config /etc/prometheus/prometheus.yml
```

