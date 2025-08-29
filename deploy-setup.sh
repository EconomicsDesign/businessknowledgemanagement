#!/bin/bash

# 🚀 Business Knowledge Management Tool - Deployment Setup Script
# Run this script to set up GitHub and prepare for Cloudflare deployment

echo "🚀 Business Knowledge Management Tool - Deployment Setup"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the webapp directory."
    exit 1
fi

print_status "Checking project setup..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    print_error "Git repository not initialized. Please run 'git init' first."
    exit 1
fi

print_success "Git repository found"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Please commit them first:"
    echo "  git add ."
    echo "  git commit -m 'Pre-deployment commit'"
    echo ""
    read -p "Do you want to commit all changes now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Pre-deployment setup - $(date)"
        print_success "Changes committed"
    else
        print_warning "Please commit your changes manually before continuing"
        exit 1
    fi
fi

# Display current project status
print_status "Current project information:"
echo "  Project name: webapp"
echo "  Current branch: $(git branch --show-current)"
echo "  Last commit: $(git log -1 --pretty=format:'%h - %s (%cr)')"
echo "  Files ready for deployment: $(git ls-files | wc -l)"
echo ""

# Check for required files
required_files=("src/index.tsx" "package.json" "wrangler.jsonc" "migrations/0001_initial_schema.sql")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    print_error "Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

print_success "All required files present"

# Show deployment readiness checklist
print_status "Deployment Readiness Checklist:"
echo "  ✅ Git repository initialized"
echo "  ✅ All changes committed" 
echo "  ✅ Required files present"
echo "  ✅ Database schema ready"
echo "  ✅ Build configuration ready"
echo ""

# GitHub setup instructions
print_status "Next Steps for GitHub Setup:"
echo ""
echo "1. Create GitHub Repository:"
echo "   - Go to https://github.com/new"
echo "   - Repository name: business-knowledge-tool"
echo "   - Description: AI-powered business knowledge management system"
echo "   - Choose Public or Private"
echo "   - DO NOT initialize with README"
echo ""

echo "2. Connect to GitHub (replace YOUR_USERNAME with your actual GitHub username):"
echo "   git remote add origin https://github.com/YOUR_USERNAME/business-knowledge-tool.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""

echo "3. Set up Cloudflare Pages:"
echo "   - Go to https://dash.cloudflare.com"
echo "   - Workers & Pages → Create application → Pages → Connect to Git"
echo "   - Select your repository"
echo "   - Framework: Hono"
echo "   - Build command: npm run build"
echo "   - Build output directory: dist"
echo ""

echo "4. Create D1 Database:"
echo "   - In Cloudflare: Workers & Pages → D1 SQL Database → Create database"
echo "   - Database name: webapp-production"
echo "   - Copy the Database ID and update wrangler.jsonc"
echo ""

# Display current wrangler config
print_status "Current wrangler.jsonc configuration:"
if [ -f "wrangler.jsonc" ]; then
    echo "----------------------------------------"
    cat wrangler.jsonc
    echo "----------------------------------------"
    echo ""
    print_warning "Remember to update the database_id with your actual Cloudflare D1 Database ID"
else
    print_error "wrangler.jsonc not found!"
fi

# Offer to update wrangler config
echo ""
read -p "Do you want to update the database_id in wrangler.jsonc now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -n "Enter your Cloudflare D1 Database ID: "
    read database_id
    
    if [ ! -z "$database_id" ]; then
        # Update wrangler.jsonc with the new database ID
        sed -i.bak "s/placeholder-will-be-updated-when-deployed/$database_id/g" wrangler.jsonc
        print_success "Updated wrangler.jsonc with database ID: $database_id"
        
        # Commit the change
        git add wrangler.jsonc
        git commit -m "Update production database configuration"
        print_success "Changes committed to git"
    else
        print_warning "No database ID provided. You can update this later."
    fi
fi

# Final instructions
print_success "Setup Complete! Your project is ready for deployment."
echo ""
print_status "Deployment URLs (will be available after Cloudflare Pages deployment):"
echo "  Development: https://3000-ipcasslymqyl781ow4rmv.e2b.dev"
echo "  Production: https://webapp-[random].pages.dev (generated by Cloudflare)"
echo ""

print_status "What's included in your deployment:"
echo "  📄 Document upload (TXT, PDF*, Word*, Excel*, CSV, Images*)"
echo "  🤖 AI-powered categorisation"
echo "  💬 Intelligent chatbot"
echo "  🗂️ Business segment management"
echo "  📊 Knowledge base browser"
echo "  🎨 Responsive web interface"
echo ""

print_warning "Note: *PDF, Word, Excel, and Image processing requires additional setup"
print_warning "For production use, these files will show helpful error messages guiding users"
print_warning "to paste content directly or contact administrator for full processing setup."
echo ""

print_status "Need help? Check the DEPLOYMENT_GUIDE.md for detailed instructions!"
echo ""

print_success "Happy deploying! 🚀"