# GitHub Workflows

This directory contains GitHub Actions workflows for the Bitsacco OS project.

## Publish Server Workflow

The `publish-server.yml` workflow automatically builds and publishes the Bitsacco Server Docker image to Docker Hub.

### Workflow Triggers

The workflow is triggered on:

- **Push to main/master branch** - Automatically builds and pushes the latest image
- **Git tags starting with 'v'** - Builds and pushes tagged releases (e.g., v1.0.0)
- **Pull requests** - Builds the image for testing (doesn't push)
- **Manual trigger** - Can be manually triggered via GitHub Actions UI

### Required Secrets

To use this workflow, you need to configure the following secrets in your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following repository secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKER_USERNAME` | Your Docker Hub username | `bitsacco` |
| `DOCKER_PASSWORD` | Your Docker Hub password or access token | `dckr_pat_...` |

### Generated Tags

The workflow automatically generates the following Docker image tags:

- `latest` - Latest build from the main branch
- `main` / `master` - Branch-specific tag
- `v1.0.0` - Git tag releases
- `sha-abc1234` - Short commit SHA
- `pr-123` - Pull request builds

### Example Usage

Once the workflow runs successfully, you can pull and use the Docker image:

```bash
# Pull the latest version
docker pull bitsacco/server:latest

# Pull a specific version
docker pull bitsacco/server:v1.0.0

# Run the container
docker run -d \
  --name bitsacco-server \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=mongodb://localhost:27017/bitsacco \
  bitsacco/server:latest
```

### Multi-Platform Support

The workflow builds images for multiple architectures:
- `linux/amd64` - Intel/AMD 64-bit
- `linux/arm64` - ARM 64-bit (Apple Silicon, ARM servers)

### Security Scanning

The workflow includes security scanning using Trivy, which:
- Scans the built Docker image for vulnerabilities
- Uploads results to GitHub Security tab
- Helps identify potential security issues

### Build Process

1. **Test Stage**: Runs linting and tests
2. **Build Stage**: Creates optimized Docker image
3. **Security Scan**: Scans for vulnerabilities
4. **Notification**: Provides deployment information

### Troubleshooting

**Build Failures:**
- Check that all tests pass locally
- Ensure Docker secrets are correctly configured
- Verify the Dockerfile builds successfully

**Permission Issues:**
- Ensure Docker Hub credentials have push permissions
- Check that repository secrets are properly set

**Path Issues:**
- The workflow builds from the repository root
- Ensure file paths in Dockerfile are correct relative to root

### Local Testing

You can test the Docker build locally:

```bash
# Build from repository root
docker build -f apps/server/Dockerfile -t bitsacco/server:local .

# Test the built image
docker run --rm -p 4000:4000 bitsacco/server:local
```