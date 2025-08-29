# 🚀 Complete Deployment Guide: Business Knowledge Management Tool

## Overview
This guide will walk you through deploying your Business Knowledge Management Tool to your website using GitHub and Cloudflare Pages. The deployment is **completely free** and provides global edge performance.

---

## 📋 Prerequisites
Before starting, ensure you have:
- [ ] A GitHub account ([Sign up here](https://github.com))
- [ ] A Cloudflare account ([Sign up here](https://cloudflare.com))
- [ ] Your domain name (if you want custom domain, otherwise Cloudflare provides free subdomain)

---

## 🎯 Deployment Architecture
**Your Setup**: GitHub Repository → Cloudflare Pages → Your Live Website

**Benefits**:
- ✅ **Free hosting** with Cloudflare Pages
- ✅ **Global CDN** - Fast loading worldwide
- ✅ **Automatic deployments** from GitHub
- ✅ **SSL certificate** included
- ✅ **Serverless database** with Cloudflare D1
- ✅ **AI integration** with Cloudflare Workers AI

---

## 📖 Step-by-Step Deployment

### Step 1: Set up GitHub Repository

#### 1.1 Create GitHub Repository
1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** button in top right corner
3. Select **"New repository"**
4. Fill in repository details:
   - **Repository name**: `business-knowledge-tool` (or your preferred name)
   - **Description**: `AI-powered business knowledge management system`
   - **Visibility**: Choose **Public** (free) or **Private** (if you have paid GitHub)
   - **DO NOT** initialize with README (we have existing code)
5. Click **"Create repository"**

#### 1.2 Connect Local Code to GitHub
**Important**: Copy these commands exactly as GitHub shows them after creating the repository.

```bash
# Navigate to your project
cd /home/user/webapp

# Add GitHub repository as remote origin
git remote add origin https://github.com/YOUR_USERNAME/business-knowledge-tool.git

# Push your code to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username.

### Step 2: Set up Cloudflare Account & Pages

#### 2.1 Create Cloudflare Account
1. Go to [Cloudflare](https://cloudflare.com)
2. Click **"Sign Up"** and create account
3. Verify your email address
4. Skip domain setup for now (we'll use Cloudflare's free subdomain)

#### 2.2 Create Cloudflare Pages Project
1. In Cloudflare dashboard, click **"Workers & Pages"** in left sidebar
2. Click **"Create application"**
3. Choose **"Pages"** tab
4. Click **"Connect to Git"**

#### 2.3 Connect GitHub Repository
1. Click **"Connect GitHub"** 
2. Authorize Cloudflare to access your GitHub account
3. Select your repository: `business-knowledge-tool`
4. Click **"Begin setup"**

#### 2.4 Configure Build Settings
**Framework preset**: Select **"Hono"**

**Build settings**:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty)

**Environment variables** (click "Add variable"):
```
NODE_VERSION = 18
```

5. Click **"Save and Deploy"**

### Step 3: Set up Database (Cloudflare D1)

#### 3.1 Create D1 Database
1. In Cloudflare dashboard, go to **"Workers & Pages"**
2. Click **"D1 SQL Database"** in left sidebar  
3. Click **"Create database"**
4. Database name: `webapp-production`
5. Click **"Create"**

#### 3.2 Get Database ID
1. Click on your newly created database
2. Copy the **Database ID** (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### 3.3 Update wrangler.jsonc
**In your local code**, open `wrangler.jsonc` and update:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "compatibility_date": "2025-08-29",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "YOUR_DATABASE_ID_HERE"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

Replace `YOUR_DATABASE_ID_HERE` with the Database ID you copied.

#### 3.4 Apply Database Migrations
**Option A - Using Wrangler CLI (Recommended)**:
1. Install Wrangler globally: `npm install -g wrangler`
2. Login to Cloudflare: `npx wrangler login`
3. Apply migrations: `npx wrangler d1 migrations apply webapp-production --remote`

**Option B - Using Cloudflare Dashboard**:
1. Go to your D1 database in Cloudflare dashboard
2. Click **"Console"** tab
3. Copy and paste the SQL from `migrations/0001_initial_schema.sql`
4. Click **"Execute"**

### Step 4: Configure Cloudflare Pages Environment

#### 4.1 Add Database Binding to Pages
1. Go to **Workers & Pages** → Your project
2. Click **"Settings"** tab
3. Scroll to **"Functions"**
4. Click **"D1 database bindings"** 
5. Click **"Add binding"**:
   - **Variable name**: `DB`
   - **D1 database**: Select `webapp-production`
6. Click **"Save"**

#### 4.2 Add AI Binding (Automatic)
The AI binding is automatically available in Cloudflare Workers - no manual setup needed.

#### 4.3 Custom Domain (Optional)
If you want to use your own domain:
1. Go to **"Custom domains"** tab in your Pages project
2. Click **"Set up a custom domain"** 
3. Enter your domain name
4. Follow Cloudflare's instructions to update DNS

### Step 5: Deploy & Test

#### 5.1 Commit Database Configuration
```bash
cd /home/user/webapp
git add wrangler.jsonc
git commit -m "Add production database configuration"
git push origin main
```

#### 5.2 Trigger Deployment
1. Push to GitHub automatically triggers Cloudflare deployment
2. Monitor deployment in Cloudflare Pages dashboard
3. Deployment typically takes 1-3 minutes

#### 5.3 Access Your Live Site
1. In Cloudflare Pages dashboard, find your project URL
2. It will look like: `https://webapp-abc.pages.dev`
3. Click the URL to open your live website!

---

## 🧪 Testing Your Deployment

### Test Checklist
- [ ] Website loads correctly
- [ ] Upload Documents tab works
- [ ] Browse Knowledge tab shows segments
- [ ] Chat Assistant responds (may take a moment for first response)
- [ ] File upload works for text files
- [ ] Document categorisation works
- [ ] Chat provides source citations

### Common Issues & Solutions

#### Issue: "Database not found"
**Solution**: Ensure D1 database binding is correctly configured in Pages settings.

#### Issue: "AI binding not available" 
**Solution**: AI binding is automatic. If not working, redeploy the project.

#### Issue: "Build failed"
**Solutions**:
- Check build logs in Cloudflare Pages
- Ensure `NODE_VERSION = 18` environment variable is set
- Verify `package.json` has correct build scripts

#### Issue: File uploads show "processing errors"
**Solution**: This is expected for PDF, Word, Excel files in the free version. Users should paste content directly or you can integrate external processing services.

---

## 🔧 Production Configuration

### Environment Variables
For production, you may want to add:

```bash
# In Cloudflare Pages Settings → Environment variables
NODE_ENV=production
APP_NAME=Business Knowledge Tool
```

### Security Considerations
- Database is automatically secured with Cloudflare's security
- All traffic is HTTPS by default
- No API keys needed for basic functionality
- Chat responses are limited to uploaded documents only

### Performance Optimization
- Static files are cached on Cloudflare's global CDN
- Database queries are optimized for edge locations
- AI responses cached briefly to improve performance

---

## 📈 Scaling & Maintenance

### Monitoring
- View analytics in Cloudflare Pages dashboard
- Monitor database usage in D1 dashboard
- Check AI usage in Workers dashboard

### Backups
- D1 database automatically backed up by Cloudflare
- Source code backed up in GitHub
- Regular git commits ensure version history

### Updates
1. Make changes to local code
2. Commit and push to GitHub: `git push origin main`
3. Cloudflare automatically deploys updates
4. Zero downtime deployments

---

## 💰 Cost Breakdown

### Free Tier Limits (Perfect for Small-Medium Business)
- **Cloudflare Pages**: 500 builds/month, unlimited sites
- **D1 Database**: 100,000 reads/day, 1,000 writes/day  
- **Workers AI**: 10,000 requests/day
- **Bandwidth**: Unlimited
- **SSL Certificate**: Free
- **Custom Domain**: Free

### Paid Upgrades (When You Need More)
- **Workers Paid Plan**: £4/month - 10M requests, faster AI
- **D1 Larger**: Pay per request beyond free limits
- **Pages Pro**: £16/month - Analytics, advanced features

**For most small-medium businesses, the free tier is sufficient.**

---

## 🆘 Getting Help

### Support Resources
1. **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
2. **GitHub Issues**: Create issues in your repository
3. **Cloudflare Community**: [community.cloudflare.com](https://community.cloudflare.com)
4. **Stack Overflow**: Tag questions with `cloudflare-pages`

### Quick Commands Reference
```bash
# Check deployment status
git log --oneline -5

# Force redeploy  
git commit --allow-empty -m "Trigger redeploy"
git push origin main

# View database console
npx wrangler d1 execute webapp-production --remote

# Check AI usage
npx wrangler ai models list
```

---

## ✅ Post-Deployment Checklist

- [ ] Site loads on live URL
- [ ] Document upload works
- [ ] AI categorisation functions  
- [ ] Chat assistant responds
- [ ] Database persists data
- [ ] Custom domain configured (if desired)
- [ ] Analytics tracking set up
- [ ] Team members have access
- [ ] Backup strategy confirmed

---

**🎉 Congratulations!** 

Your Business Knowledge Management Tool is now live and accessible worldwide. Share the URL with your team and start uploading your business documents!

**Next Steps**: 
- Train your team on using the system
- Upload important business documents
- Monitor usage and performance
- Consider additional features based on user feedback

---

*Need help with deployment? Create an issue in your GitHub repository or refer to the troubleshooting section above.*