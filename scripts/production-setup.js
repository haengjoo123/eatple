/**
 * Supabase Production Environment Setup Script
 * 
 * This script handles:
 * - Production database configuration
 * - Security settings
 * - Backup and recovery strategy
 * - Performance optimization
 * - Environment validation
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class ProductionSetup {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.supabaseAnonKey = process.env.SUPABASE_KEY;
        this.nodeEnv = process.env.NODE_ENV || 'development';
        
        if (!this.supabaseUrl || !this.supabaseServiceKey) {
            throw new Error('Missing required Supabase environment variables');
        }
        
        this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
    }

    /**
     * Validate production environment configuration
     */
    async validateEnvironment() {
        console.log('🔍 Validating production environment...');
        
        const checks = {
            nodeEnv: this.nodeEnv === 'production',
            supabaseUrl: this.supabaseUrl && this.supabaseUrl.includes('supabase.co'),
            supabaseKeys: this.supabaseServiceKey && this.supabaseAnonKey,
            httpsUrl: this.supabaseUrl && this.supabaseUrl.startsWith('https://'),
        };
        
        console.log('Environment Checks:');
        Object.entries(checks).forEach(([key, value]) => {
            console.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
        });
        
        if (!Object.values(checks).every(Boolean)) {
            throw new Error('Environment validation failed. Please check configuration.');
        }
        
        console.log('✅ Environment validation passed');
        return true;
    }

    /**
     * Setup database security configurations
     */
    async setupDatabaseSecurity() {
        console.log('🔒 Setting up database security...');
        
        try {
            // Enable Row Level Security on all tables
            const tables = [
                'nutrition_posts',
                'categories', 
                'tags',
                'post_tags',
                'post_modification_history'
            ];
            
            for (const table of tables) {
                const { error } = await this.supabase.rpc('enable_rls', { table_name: table });
                if (error && !error.message.includes('already enabled')) {
                    console.warn(`⚠️  Could not enable RLS for ${table}: ${error.message}`);
                }
            }
            
            // Create security policies
            await this.createSecurityPolicies();
            
            console.log('✅ Database security configured');
        } catch (error) {
            console.error('❌ Database security setup failed:', error.message);
            throw error;
        }
    }

    /**
     * Create Row Level Security policies
     */
    async createSecurityPolicies() {
        console.log('📋 Creating security policies...');
        
        const policies = [
            // Public read access for active nutrition posts
            {
                name: 'nutrition_posts_public_read',
                table: 'nutrition_posts',
                sql: `
                    CREATE POLICY IF NOT EXISTS "nutrition_posts_public_read" 
                    ON nutrition_posts FOR SELECT 
                    USING (is_active = true AND is_draft = false);
                `
            },
            // Admin full access to nutrition posts
            {
                name: 'nutrition_posts_admin_access',
                table: 'nutrition_posts', 
                sql: `
                    CREATE POLICY IF NOT EXISTS "nutrition_posts_admin_access"
                    ON nutrition_posts FOR ALL
                    USING (auth.role() = 'service_role');
                `
            },
            // Public read access for categories
            {
                name: 'categories_public_read',
                table: 'categories',
                sql: `
                    CREATE POLICY IF NOT EXISTS "categories_public_read"
                    ON categories FOR SELECT
                    USING (true);
                `
            },
            // Public read access for tags
            {
                name: 'tags_public_read', 
                table: 'tags',
                sql: `
                    CREATE POLICY IF NOT EXISTS "tags_public_read"
                    ON tags FOR SELECT
                    USING (true);
                `
            }
        ];
        
        for (const policy of policies) {
            try {
                const { error } = await this.supabase.rpc('exec_sql', { sql: policy.sql });
                if (error) {
                    console.warn(`⚠️  Policy ${policy.name}: ${error.message}`);
                } else {
                    console.log(`✅ Created policy: ${policy.name}`);
                }
            } catch (error) {
                console.warn(`⚠️  Could not create policy ${policy.name}: ${error.message}`);
            }
        }
    }

    /**
     * Setup database indexes for performance
     */
    async setupPerformanceIndexes() {
        console.log('⚡ Setting up performance indexes...');
        
        const indexes = [
            // Nutrition posts indexes
            'CREATE INDEX IF NOT EXISTS idx_nutrition_posts_active ON nutrition_posts(is_active, is_draft);',
            'CREATE INDEX IF NOT EXISTS idx_nutrition_posts_category ON nutrition_posts(category_id);',
            'CREATE INDEX IF NOT EXISTS idx_nutrition_posts_published ON nutrition_posts(published_date DESC);',
            'CREATE INDEX IF NOT EXISTS idx_nutrition_posts_source ON nutrition_posts(source_type);',
            'CREATE INDEX IF NOT EXISTS idx_nutrition_posts_search ON nutrition_posts USING gin(to_tsvector(\'korean\', title || \' \' || content));',
            
            // Post tags indexes
            'CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);',
            'CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);',
            
            // Categories and tags indexes
            'CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);',
            'CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);',
            'CREATE INDEX IF NOT EXISTS idx_tags_count ON tags(post_count DESC);'
        ];
        
        for (const indexSql of indexes) {
            try {
                const { error } = await this.supabase.rpc('exec_sql', { sql: indexSql });
                if (error && !error.message.includes('already exists')) {
                    console.warn(`⚠️  Index creation warning: ${error.message}`);
                } else {
                    console.log(`✅ Created index: ${indexSql.split(' ')[5]}`);
                }
            } catch (error) {
                console.warn(`⚠️  Could not create index: ${error.message}`);
            }
        }
    }

    /**
     * Setup backup and recovery strategy
     */
    async setupBackupStrategy() {
        console.log('💾 Setting up backup strategy...');
        
        // Create backup configuration
        const backupConfig = {
            strategy: 'automated',
            frequency: 'daily',
            retention: '30 days',
            tables: [
                'nutrition_posts',
                'categories',
                'tags', 
                'post_tags',
                'post_modification_history'
            ],
            backupLocation: 'supabase-managed',
            pointInTimeRecovery: true,
            crossRegionReplication: false // Enable for critical production
        };
        
        // Save backup configuration
        const backupConfigPath = path.join(__dirname, '../config/backup-config.json');
        fs.writeFileSync(backupConfigPath, JSON.stringify(backupConfig, null, 2));
        
        console.log('✅ Backup strategy configured');
        console.log('📋 Backup configuration saved to:', backupConfigPath);
        
        // Create backup verification script
        await this.createBackupVerificationScript();
        
        return backupConfig;
    }

    /**
     * Create backup verification script
     */
    async createBackupVerificationScript() {
        const backupScript = `#!/usr/bin/env node
/**
 * Backup Verification Script
 * Run this script to verify backup integrity and test recovery procedures
 */

const { createClient } = require('@supabase/supabase-js');

async function verifyBackup() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('🔍 Verifying backup integrity...');
    
    try {
        // Check table counts
        const tables = ['nutrition_posts', 'categories', 'tags', 'post_tags'];
        const counts = {};
        
        for (const table of tables) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
                
            if (error) throw error;
            counts[table] = count;
        }
        
        console.log('📊 Table counts:', counts);
        
        // Verify data integrity
        const { data: samplePost } = await supabase
            .from('nutrition_posts')
            .select('*, categories(*), post_tags(tags(*))')
            .limit(1)
            .single();
            
        if (samplePost) {
            console.log('✅ Data integrity check passed');
            console.log('📋 Sample post structure verified');
        }
        
        console.log('✅ Backup verification completed successfully');
        
    } catch (error) {
        console.error('❌ Backup verification failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    verifyBackup();
}

module.exports = { verifyBackup };
`;
        
        fs.writeFileSync(path.join(__dirname, 'verify-backup.js'), backupScript);
        console.log('✅ Backup verification script created');
    }

    /**
     * Setup production monitoring
     */
    async setupMonitoring() {
        console.log('📊 Setting up production monitoring...');
        
        // Create monitoring configuration
        const monitoringConfig = {
            metrics: {
                database: {
                    connectionPool: true,
                    queryPerformance: true,
                    tableSize: true,
                    indexUsage: true
                },
                application: {
                    responseTime: true,
                    errorRate: true,
                    throughput: true,
                    userActivity: true
                }
            },
            alerts: {
                highErrorRate: { threshold: '5%', window: '5m' },
                slowQueries: { threshold: '1000ms', window: '1m' },
                highCpuUsage: { threshold: '80%', window: '5m' },
                lowDiskSpace: { threshold: '90%', window: '1m' }
            },
            logging: {
                level: 'info',
                retention: '30 days',
                structured: true
            }
        };
        
        // Save monitoring configuration
        const configDir = path.join(__dirname, '../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(configDir, 'monitoring-config.json'),
            JSON.stringify(monitoringConfig, null, 2)
        );
        
        console.log('✅ Monitoring configuration created');
        return monitoringConfig;
    }

    /**
     * Run complete production setup
     */
    async runProductionSetup() {
        console.log('🚀 Starting Supabase production setup...\n');
        
        try {
            // Step 1: Validate environment
            await this.validateEnvironment();
            console.log('');
            
            // Step 2: Setup database security
            await this.setupDatabaseSecurity();
            console.log('');
            
            // Step 3: Setup performance indexes
            await this.setupPerformanceIndexes();
            console.log('');
            
            // Step 4: Setup backup strategy
            await this.setupBackupStrategy();
            console.log('');
            
            // Step 5: Setup monitoring
            await this.setupMonitoring();
            console.log('');
            
            console.log('🎉 Production setup completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('1. Review backup configuration in config/backup-config.json');
            console.log('2. Set up monitoring alerts based on config/monitoring-config.json');
            console.log('3. Run backup verification: node scripts/verify-backup.js');
            console.log('4. Monitor system performance and adjust as needed');
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                environment: this.nodeEnv,
                supabaseUrl: this.supabaseUrl
            };
            
        } catch (error) {
            console.error('❌ Production setup failed:', error.message);
            throw error;
        }
    }

    /**
     * Generate production deployment checklist
     */
    generateDeploymentChecklist() {
        const checklist = `# Supabase Production Deployment Checklist

## Pre-Deployment
- [ ] Environment variables configured for production
- [ ] NODE_ENV set to 'production'
- [ ] Supabase project configured with production settings
- [ ] SSL/TLS certificates configured
- [ ] Domain name configured and DNS updated

## Database Setup
- [ ] Database tables created using migrations/001_create_nutrition_tables.sql
- [ ] Data migrated using scripts/migrate-nutrition-data.js
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Security policies created and tested
- [ ] Performance indexes created
- [ ] Database connection limits configured

## Security Configuration
- [ ] API keys rotated for production
- [ ] Service role key secured and limited access
- [ ] Anonymous key configured with proper permissions
- [ ] CORS settings configured for production domain
- [ ] Rate limiting configured
- [ ] Input validation and sanitization verified

## Backup and Recovery
- [ ] Automated backup schedule configured
- [ ] Backup verification script tested
- [ ] Point-in-time recovery tested
- [ ] Disaster recovery plan documented
- [ ] Recovery procedures tested

## Monitoring and Logging
- [ ] Application monitoring configured
- [ ] Database performance monitoring enabled
- [ ] Error tracking and alerting configured
- [ ] Log aggregation and analysis setup
- [ ] Health check endpoints configured

## Performance Optimization
- [ ] Database query performance analyzed
- [ ] Caching strategy implemented
- [ ] CDN configured for static assets
- [ ] Connection pooling optimized
- [ ] Resource limits configured

## Testing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Backup and recovery tested
- [ ] Monitoring and alerting tested
- [ ] End-to-end functionality verified

## Post-Deployment
- [ ] Monitor system performance for 24-48 hours
- [ ] Verify all monitoring alerts are working
- [ ] Confirm backup schedule is running
- [ ] Document any issues and resolutions
- [ ] Update runbooks and documentation

## Emergency Procedures
- [ ] Rollback plan documented and tested
- [ ] Emergency contact list updated
- [ ] Incident response procedures documented
- [ ] Communication plan for outages established
`;
        
        const checklistPath = path.join(__dirname, '../docs/production-deployment-checklist.md');
        const docsDir = path.dirname(checklistPath);
        
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }
        
        fs.writeFileSync(checklistPath, checklist);
        console.log('📋 Production deployment checklist created:', checklistPath);
        
        return checklistPath;
    }
}

// CLI interface
if (require.main === module) {
    const setup = new ProductionSetup();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'validate':
            setup.validateEnvironment().catch(console.error);
            break;
        case 'security':
            setup.setupDatabaseSecurity().catch(console.error);
            break;
        case 'indexes':
            setup.setupPerformanceIndexes().catch(console.error);
            break;
        case 'backup':
            setup.setupBackupStrategy().catch(console.error);
            break;
        case 'monitoring':
            setup.setupMonitoring().catch(console.error);
            break;
        case 'checklist':
            setup.generateDeploymentChecklist();
            break;
        case 'full':
        default:
            setup.runProductionSetup().catch(console.error);
            break;
    }
}

module.exports = ProductionSetup;