#!/bin/bash
set -e

# Setup script for Bitsacco monitoring infrastructure
echo "Setting up Bitsacco monitoring infrastructure..."

# Create required directories
mkdir -p ./prometheus ./grafana/dashboards ./grafana/provisioning/datasources ./grafana/provisioning/dashboards

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
  echo "Creating .env file from example..."
  cp .env.example .env
  echo "Please edit .env file with your configuration before continuing."
  
  # Generate secure password for prometheus basic auth
  echo "Generating secure basic auth credentials..."
  ADMIN_PASSWORD=$(openssl rand -base64 12)
  HASHED_PASSWORD=$(docker run --rm httpd:alpine htpasswd -nb admin "$ADMIN_PASSWORD")
  
  # Escape special characters for sed
  ESCAPED_PASSWORD=$(echo "$HASHED_PASSWORD" | sed -e 's/[\/&]/\\&/g')
  
  # Update .env file
  sed -i "s/PROMETHEUS_BASIC_AUTH=.*/PROMETHEUS_BASIC_AUTH=$ESCAPED_PASSWORD/" .env
  
  echo "Generated admin password for monitoring: $ADMIN_PASSWORD"
  echo "Please save this password securely!"
  echo "You can update it in .env file if needed."
  
  exit 1
fi

# Copy dashboards from the existing setup if available
cp -r ../grafana/dashboards/* ./grafana/dashboards/ 2>/dev/null || echo "No dashboards found to copy"

# Pull the latest images
echo "Pulling Docker images..."
docker-compose -f compose.telemetry.yml -p infra pull

# Start the services
echo "Starting services..."
docker-compose -f compose.telemetry.yml -p infra up -d

echo "Setup complete!"
echo "Access your monitoring infrastructure via the following URLs:"
echo "- Grafana: https://grafana.<example.com>"
echo "- Prometheus: https://prometheus.<example.com>"
echo "- Alertmanager: https://alertmanager.<example.com>"
echo "- Node Exporter: https://node-exporter.<example.com>"
echo "- cAdvisor: https://cadvisor.<example.com>"

