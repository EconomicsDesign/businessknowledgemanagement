#!/bin/bash

# 🌐 Cloudflare Pages & D1 Database Setup Script
# Run this script after setting up GitHub to configure Cloudflare services

echo "🌐 Cloudflare Pages & D1 Database Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if wrangler is available
print_status "Checking Cloudflare Wrangler CLI..."

if ! command -v wrangler &> /dev/null; then
    print_warning "Wrangler CLI not found. Installing..."
    npm install -g wrangler
    print_success "Wrangler CLI installed"
fi

# Login to Cloudflare (if needed)
print_status "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    print_warning "Not authenticated with Cloudflare. Please login:"
    wrangler login
    
    if ! wrangler whoami &> /dev/null; then
        print_error "Authentication failed. Please check your Cloudflare account."
        exit 1
    fi
fi

print_success "Authenticated with Cloudflare: $(wrangler whoami)"

# Create D1 Database
print_status "Setting up D1 Database..."
echo "Creating production database: webapp-production"

# Check if database already exists
if wrangler d1 list | grep -q "webapp-production"; then
    print_warning "Database 'webapp-production' already exists"
    database_id=$(wrangler d1 list | grep "webapp-production" | awk '{print $2}')
    print_success "Found existing database ID: $database_id"
else
    print_status "Creating new D1 database..."
    create_output=$(wrangler d1 create webapp-production 2>&1)
    
    if echo "$create_output" | grep -q "database_id"; then
        database_id=$(echo "$create_output" | grep "database_id" | sed 's/.*database_id = "\([^"]*\)".*/\1/')
        print_success "Database created successfully!"
        print_success "Database ID: $database_id"
    else
        print_error "Failed to create database. Output:"
        echo "$create_output"
        exit 1
    fi
fi

# Update wrangler.jsonc with the database ID
print_status "Updating wrangler.jsonc configuration..."
if [ -f "wrangler.jsonc" ]; then
    # Create backup
    cp wrangler.jsonc wrangler.jsonc.backup
    
    # Update the database ID
    sed -i.tmp "s/placeholder-will-be-updated-when-deployed/$database_id/g" wrangler.jsonc
    rm wrangler.jsonc.tmp 2>/dev/null || true
    
    print_success "Updated wrangler.jsonc with database ID"
    
    # Show the updated configuration
    print_status "Updated configuration:"
    echo "----------------------------------------"
    grep -A 10 "d1_databases" wrangler.jsonc
    echo "----------------------------------------"
else
    print_error "wrangler.jsonc not found!"
    exit 1
fi

# Apply database migrations
print_status "Applying database migrations..."
if [ -f "migrations/0001_initial_schema.sql" ]; then
    wrangler d1 migrations apply webapp-production --remote
    
    if [ $? -eq 0 ]; then
        print_success "Database migrations applied successfully"
    else
        print_error "Failed to apply migrations"
        exit 1
    fi
else
    print_error "Migration file not found: migrations/0001_initial_schema.sql"
    exit 1
fi

# Verify database setup
print_status "Verifying database setup..."
verification_result=$(wrangler d1 execute webapp-production --remote --command="SELECT name FROM segments LIMIT 3;")

if echo "$verification_result" | grep -q "General\|Accounting\|Finance"; then
    print_success "Database verification successful - segments table populated"
else
    print_warning "Database verification inconclusive. Check manually if needed."
fi

# Commit configuration changes
print_status "Committing configuration changes..."
git add wrangler.jsonc
git commit -m "Configure production D1 database: $database_id"

if [ $? -eq 0 ]; then
    print_success "Configuration committed to git"
else
    print_warning "No changes to commit (configuration may already be up to date)"
fi

# Display deployment information
print_success "Cloudflare Setup Complete!"
echo ""
print_status "Database Information:"
echo "  Name: webapp-production"
echo "  ID: $database_id"
echo "  Status: ✅ Created and configured"
echo "  Migrations: ✅ Applied"
echo ""

print_status "Next Steps:"
echo ""
echo "1. Push to GitHub (triggers automatic Cloudflare Pages deployment):"
echo "   git push origin main"
echo ""
echo "2. Set up Cloudflare Pages (if not already done):"
echo "   - Go to https://dash.cloudflare.com"
echo "   - Workers & Pages → Create application → Pages"
echo "   - Connect to Git → Select your repository"
echo "   - Framework: Hono"
echo "   - Build command: npm run build"
echo "   - Build output directory: dist"
echo ""
echo "3. Configure Pages bindings:"
echo "   - In your Pages project settings → Functions"
echo "   - Add D1 database binding:"
echo "     Variable name: DB"
echo "     D1 database: webapp-production"
echo ""

print_status "Useful Commands:"
echo "  wrangler d1 execute webapp-production --remote  # Database console"
echo "  wrangler pages deploy dist --project-name=webapp  # Manual deploy"
echo "  wrangler d1 list  # List all databases"
echo ""

print_success "Your Business Knowledge Management Tool is ready for production! 🚀"