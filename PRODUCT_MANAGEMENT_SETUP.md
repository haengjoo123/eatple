# Product Management Database Setup Instructions

## Overview
This document provides step-by-step instructions to set up the database schema for the shop product management system.

## Current Status
✅ Supabase connection is working  
✅ Storage bucket `product-images` is created  
❌ Product management tables need to be created  

## Setup Steps

### Step 1: Apply Database Migration

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Navigate to your project: `jtomskzwaqoeosxuchwg`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration SQL**
   - Copy the entire contents of `migrations/002_create_product_management_tables_simple.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

### Step 2: Verify Setup

After running the SQL migration, verify the setup by running:

```bash
node scripts/setup-product-tables.js
```

This should show:
- ✅ Product categories table: Ready
- ✅ Products table: Ready  
- ✅ Product analytics table: Ready
- ✅ Storage bucket: Ready

### Step 3: Final Verification

Run the comprehensive verification script:

```bash
node scripts/verify-product-db-setup.js
```

This should show all checks passing.

## What the Migration Creates

### Tables Created:
1. **`product_categories`** - Stores product categories (supplement, vitamin, etc.)
2. **`products`** - Main products table with all required fields
3. **`product_analytics`** - Tracks product views and purchases

### Indexes Created:
- Performance indexes on frequently queried columns
- Composite indexes for common query patterns

### Functions Created:
- `increment_product_view(UUID)` - Safely increment view count
- `increment_product_purchase(UUID, UUID)` - Safely increment purchase count

### Views Created:
- `product_statistics` - Aggregated statistics for admin dashboard

### Default Data:
- 8 default product categories with Korean display names

### Storage:
- `product-images` bucket for storing product images (already exists)

## Troubleshooting

### If Migration Fails:
1. Check that you have the correct permissions in Supabase
2. Ensure you're running the SQL in the correct project
3. Check the error message for specific issues

### If Tables Still Don't Exist:
1. Verify you ran the complete SQL script
2. Check the Supabase logs for any errors
3. Try running the migration in smaller chunks

### If Setup Script Shows Errors:
1. Ensure your `.env` file has the correct Supabase credentials
2. Check that the `SUPABASE_SERVICE_ROLE_KEY` has sufficient permissions
3. Verify network connectivity to Supabase

## Next Steps

Once the database setup is complete, you can proceed to the next task in the implementation plan:

**Task 2: Create server-side product management utilities**

This will involve creating the ProductManager and CategoryManager classes that will interact with these database tables.

## Files Created

- `migrations/002_create_product_management_tables.sql` - Complete migration with RLS policies
- `migrations/002_create_product_management_tables_simple.sql` - Simplified migration for manual execution
- `scripts/setup-product-tables.js` - Setup verification script
- `scripts/verify-product-db-setup.js` - Comprehensive verification script
- `scripts/check-existing-tables.js` - Table existence checker

## Database Schema Summary

```sql
-- Core tables structure:
product_categories (id, name, display_name, description, timestamps)
products (id, name, description, price, category, image_url, image_path, status, timestamps, created_by, view_count, purchase_count)
product_analytics (id, product_id, event_type, user_id, session_id, ip_address, user_agent, created_at)
```

The schema is designed to support:
- Full CRUD operations on products
- Category management
- Image storage integration
- Analytics tracking
- Performance optimization through indexes
- Data integrity through constraints and foreign keys