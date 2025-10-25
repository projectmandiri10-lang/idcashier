# idCashier - Point of Sale System

A modern, multilingual Point of Sale (POS) system built with React, Vite, and Supabase.

## 🌟 Features

- **Multi-language Support**: English, Indonesian (Bahasa), and Chinese
- **Multi-tenant Architecture**: Owner and Cashier roles with granular permissions
- **Sales Management**: Complete POS interface with barcode scanning support
- **Product Management**: Inventory tracking with categories and suppliers
- **Customer Management**: Track customer information and purchase history
- **Report Generation**: Sales reports, profit/loss analysis with Excel export
- **Print Support**: Thermal receipt (58mm, 80mm, A4) and A4 invoice printing
- **Dark Mode**: Beautiful UI with light/dark theme switching
- **Subscription Management**: Built-in subscription system for users
- **Demo Account**: Auto-reset demo account every hour via cronjob

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Clone or extract this folder**
   ```bash
   cd deploy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example file
   copy .env.example .env
   
   # Edit .env and fill in your credentials
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Deploy**
   Upload the `dist` folder to your hosting provider

## 📋 Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (admin access)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` - SMTP configuration
- `JWT_SECRET` - Secret for JWT token signing
- `CRONJOB_SECRET` - Secret for cronjob authentication
- `DEMO_EMAIL` - Demo account email

### Generating Secure Secrets

Generate secure random strings for JWT_SECRET and CRONJOB_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this command twice to generate both secrets.

## 🗄️ Database Setup

### Supabase Configuration

1. Create a Supabase project at https://supabase.com
2. Get your credentials from: **Settings > API**
3. Set up Edge Functions (see `supabase/functions/` folder in main repository)
4. Run the database schema from main repository
5. Set environment variables in **Supabase Dashboard > Settings > Secrets**

### Required Environment Variables in Supabase

Set these in your Supabase project dashboard:

- `EMAIL_PASSWORD` - Your SMTP password
- `CRONJOB_SECRET` - For demo reset cronjob
- `DEMO_EMAIL` - Demo account email
- `SITE_URL` - Your production URL

## 📦 Project Structure

```
deploy/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and API
│   ├── pages/          # Page components
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # Entry HTML file
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
├── tailwind.config.js  # Tailwind CSS config
└── .env.example        # Environment variables template
```

## 🎨 Tech Stack

- **Frontend**: React 18, Vite 5
- **UI Framework**: Tailwind CSS, Shadcn UI
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth with JWT
- **State Management**: React Context API
- **Print**: react-to-print
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Date Handling**: date-fns
- **Excel Export**: xlsx

## 🔐 Default Login Credentials

After setting up the database, you can create users via the Developer Page.

**Note**: Change default passwords immediately in production!

## 🌐 Deployment

### Recommended Hosting Providers

1. **Vercel** (Recommended)
   ```bash
   npm install -g vercel
   vercel deploy
   ```

2. **Netlify**
   - Drag and drop the `dist` folder to Netlify

3. **Cloudflare Pages**
   - Connect your Git repository or upload `dist` folder

4. **Static Hosting (AWS S3, DigitalOcean Spaces, etc.)**
   - Upload `dist` folder contents
   - Configure static website hosting

### Build Configuration

For hosting platforms, use these settings:

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: 18 or higher

## 🕐 Cronjob Setup (Demo Reset)

To auto-reset the demo account every hour:

1. Get your cronjob URL:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/demo-reset?secret=YOUR_CRONJOB_SECRET
   ```

2. Set up a cronjob on your hosting provider to hit this URL every hour:
   ```bash
   curl "https://YOUR_PROJECT_ID.supabase.co/functions/v1/demo-reset?secret=YOUR_CRONJOB_SECRET"
   ```

3. Schedule: `0 * * * *` (every hour at minute 0)

## 🎯 Features Overview

### Sales Module
- Product search by name/barcode
- Shopping cart management
- Discount and tax calculation
- Multiple payment methods
- Print receipt (thermal 58mm, 80mm, A4)
- Print invoice (A4)

### Products Module
- Product CRUD operations
- Category management
- Supplier tracking
- Stock management
- Barcode support
- Excel import/export

### Reports Module
- Transaction history
- Profit/loss analysis
- Date range filtering
- Excel export
- Print reports
- Delete transactions (with permissions)

### Settings Module
- User profile management
- Company information
- Receipt customization
- Cashier management
- Granular permission system

### Subscription Module
- View subscription status
- Subscription period tracking
- Expiry notifications

## 👥 Permissions System

The app includes a granular permission system for cashiers:

- **Sales Page**: Discount, Tax
- **Products Page**: Edit, Delete, Add, Import
- **Reports Page**: Export, Delete Transactions
- **General**: Add Customer, Add Supplier

Owners have full access to all features.

## 🌍 Multi-language Support

Supported languages:
- 🇬🇧 English (en)
- 🇮🇩 Indonesian / Bahasa Indonesia (id)
- 🇨🇳 Chinese / 中文 (zh)

Language can be changed from the top navigation bar.

## 🎨 Theme Support

- **Light Mode**: Clean, modern interface
- **Dark Mode**: Eye-friendly dark interface
- Toggle from the navigation bar

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Troubleshooting

### Build Issues

If you encounter build errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variable Issues

Make sure all required environment variables are set in `.env` file. Check `.env.example` for reference.

### CORS Issues

Ensure your Supabase Edge Functions have proper CORS headers configured.

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For support and inquiries, please contact the development team.

## 🔗 Links

- **Supabase**: https://supabase.com
- **Vite**: https://vitejs.dev
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com

---

**Built with ❤️ for modern businesses**

