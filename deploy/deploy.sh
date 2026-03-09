#!/bin/bash
# =============================================================
# Impact Analysis Generator — OCI Compute VM Deployment Script
# Oracle Pythia-26 Hackathon
# =============================================================
# Usage: bash deploy.sh [--region REGION] [--compartment OCID]
# =============================================================

set -e

REGION="${OCI_REGION:-us-chicago-1}"
COMPARTMENT="${OCI_COMPARTMENT_ID:-}"
PORT="${PORT:-8000}"
APP_DIR="/opt/impact-analyzer"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --region) REGION="$2"; shift 2;;
        --compartment) COMPARTMENT="$2"; shift 2;;
        --port) PORT="$2"; shift 2;;
        *) echo "Unknown arg: $1"; exit 1;;
    esac
done

echo "=== Impact Analysis Generator — Deployment ==="
echo "Region:      $REGION"
echo "Compartment: ${COMPARTMENT:-(not set)}"
echo "Port:        $PORT"
echo ""

# Step 1: Install system dependencies
echo "[1/5] Installing system dependencies..."
sudo dnf install -y python3.11 python3.11-pip git 2>/dev/null || \
sudo yum install -y python3.11 python3.11-pip git 2>/dev/null || \
sudo apt-get update && sudo apt-get install -y python3.11 python3.11-pip git

# Step 2: Set up application directory
echo "[2/5] Setting up application directory..."
sudo mkdir -p "$APP_DIR"
sudo cp -r . "$APP_DIR/"
cd "$APP_DIR"

# Step 3: Create virtual environment and install dependencies
echo "[3/5] Installing Python dependencies..."
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Step 4: Configure environment
echo "[4/5] Configuring environment..."
cat > backend/.env <<EOF
OCI_GENAI_ENABLED=true
OCI_COMPARTMENT_ID=${COMPARTMENT}
OCI_REGION=${REGION}
HOST=0.0.0.0
PORT=${PORT}
EOF

# Step 5: Install and start systemd service
echo "[5/5] Installing systemd service..."
sudo cp deploy/impact-analyzer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable impact-analyzer
sudo systemctl restart impact-analyzer

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/opc/v1/vnics/ 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)[0].get('publicIp','<unknown>'))" 2>/dev/null || echo "<check-console>")

echo ""
echo "=== Deployment Complete ==="
echo "Backend:  http://${PUBLIC_IP}:${PORT}"
echo "Frontend: http://${PUBLIC_IP}:${PORT}/ui/"
echo "API Docs: http://${PUBLIC_IP}:${PORT}/docs"
echo ""
echo "Check status: sudo systemctl status impact-analyzer"
echo "View logs:    sudo journalctl -u impact-analyzer -f"
