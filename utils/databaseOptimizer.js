/**
 * Database Optimizer for Product Management System
 * Handles query optimization, indexing, and performance monitoring
 * Requirements: 3.3, 3.4, 8.1, 8.2
 */

const { supabaseAdmin } = require('./supabaseClient');

class DatabaseOptimizer {
    constructor() {
        this.queryStats = {
            totalQueries: 0,
            slowQueries: 0,
            averageResponseTime: 0,
            queryTypes: {}
        };
        
        this.slowQueryThreshold = 1000; // 1 second
        this.indexRecommendations = [];
    }

    /**
     * Execute optimized query with performance monitoring
     */
    async executeQuery(queryBuilder, queryType = 'unknown', options = {}) {
        const startTime = Date.now();
        const queryId = this.generateQueryId();
        
        try {
            console.log(`[${queryId}] Executing ${queryType} query`);
            
            // Add query optimization hints
            if (options.useIndex) {
                // Supabase automatically uses indexes, but we can optimize the query structure
                queryBuilder = this.optimizeQueryStructure(queryBuilder, options);
            }
            
            const result = await queryBuilder;
            const executionTime = Date.now() - startTime;
            
            // Track query performance
            this.trackQueryPerformance(queryType, executionTime, queryId);
            
            // Log slow queries
            if (executionTime > this.slowQueryThreshold) {
                console.warn(`[${queryId}] Slow query detected: ${executionTime}ms`);
                this.queryStats.slowQueries++;
            }
            
            console.log(`[${queryId}] Query completed in ${executionTime}ms`);
            return result;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`[${queryId}] Query failed after ${executionTime}ms:`, error);
            throw error;
        }
    }

    /**
     * Optimize query structure for better performance
     */
    optimizeQueryStructure(queryBuilder, options) {
        // Note: Supabase query builder doesn't support dynamic select columns
        // The select method should be called before passing to this optimizer
        
        // Add limit for large datasets
        if (options.autoLimit && !options.hasLimit) {
            // Check if queryBuilder has limit method
            if (typeof queryBuilder.limit === 'function') {
                queryBuilder = queryBuilder.limit(100); // Default limit
            }
        }
        
        // Optimize ordering for indexed columns
        if (options.orderBy && options.indexedColumns?.includes(options.orderBy)) {
            // Check if queryBuilder has order method
            if (typeof queryBuilder.order === 'function') {
                queryBuilder = queryBuilder.order(options.orderBy, { ascending: options.ascending || false });
            }
        }
        
        return queryBuilder;
    }

    /**
     * Create database indexes for better performance
     */
    async createOptimalIndexes() {
        console.log('Creating optimal database indexes...');
        
        const indexes = [
            // Products table indexes
            {
                table: 'products',
                name: 'idx_products_category_status',
                columns: ['category', 'status'],
                type: 'btree'
            },
            {
                table: 'products',
                name: 'idx_products_created_at',
                columns: ['created_at'],
                type: 'btree'
            },
            {
                table: 'products',
                name: 'idx_products_status_created_at',
                columns: ['status', 'created_at'],
                type: 'btree'
            },
            {
                table: 'products',
                name: 'idx_products_view_count',
                columns: ['view_count'],
                type: 'btree'
            },
            {
                table: 'products',
                name: 'idx_products_name_search',
                columns: ['name'],
                type: 'gin',
                expression: 'to_tsvector(\'english\', name)'
            },
            
            // Product analytics indexes
            {
                table: 'product_analytics',
                name: 'idx_analytics_product_event',
                columns: ['product_id', 'event_type'],
                type: 'btree'
            },
            {
                table: 'product_analytics',
                name: 'idx_analytics_created_at',
                columns: ['created_at'],
                type: 'btree'
            },
            {
                table: 'product_analytics',
                name: 'idx_analytics_product_date',
                columns: ['product_id', 'created_at'],
                type: 'btree'
            }
        ];
        
        const results = [];
        
        for (const index of indexes) {
            try {
                await this.createIndex(index);
                results.push({ ...index, status: 'created' });
                console.log(`✓ Created index: ${index.name}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    results.push({ ...index, status: 'exists' });
                    console.log(`- Index already exists: ${index.name}`);
                } else {
                    results.push({ ...index, status: 'failed', error: error.message });
                    console.error(`✗ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
        
        return results;
    }

    /**
     * Create individual index
     */
    async createIndex(indexConfig) {
        let sql;
        
        if (indexConfig.type === 'gin' && indexConfig.expression) {
            // Full-text search index
            sql = `CREATE INDEX IF NOT EXISTS ${indexConfig.name} ON ${indexConfig.table} USING gin (${indexConfig.expression})`;
        } else {
            // Regular B-tree index
            const columns = indexConfig.columns.join(', ');
            sql = `CREATE INDEX IF NOT EXISTS ${indexConfig.name} ON ${indexConfig.table} USING ${indexConfig.type || 'btree'} (${columns})`;
        }
        
        const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql });
        
        if (error) {
            throw new Error(error.message);
        }
    }

    /**
     * Analyze query performance and suggest optimizations
     */
    async analyzeQueryPerformance() {
        console.log('Analyzing query performance...');
        
        // Get slow queries from PostgreSQL stats
        const slowQueriesQuery = `
            SELECT 
                query,
                calls,
                total_time,
                mean_time,
                rows
            FROM pg_stat_statements 
            WHERE mean_time > ${this.slowQueryThreshold}
            ORDER BY mean_time DESC 
            LIMIT 10
        `;
        
        try {
            const { data: slowQueries } = await supabaseAdmin.rpc('execute_sql', { 
                sql_query: slowQueriesQuery 
            });
            
            // Analyze and generate recommendations
            const recommendations = this.generateOptimizationRecommendations(slowQueries);
            
            return {
                slowQueries: slowQueries || [],
                recommendations,
                stats: this.queryStats
            };
            
        } catch (error) {
            console.warn('Could not analyze query performance (pg_stat_statements may not be enabled):', error.message);
            return {
                slowQueries: [],
                recommendations: this.getGeneralRecommendations(),
                stats: this.queryStats
            };
        }
    }

    /**
     * Generate optimization recommendations based on query analysis
     */
    generateOptimizationRecommendations(slowQueries) {
        const recommendations = [];
        
        if (!slowQueries || slowQueries.length === 0) {
            return this.getGeneralRecommendations();
        }
        
        slowQueries.forEach(query => {
            if (query.query.includes('products') && query.query.includes('WHERE')) {
                if (query.query.includes('category')) {
                    recommendations.push({
                        type: 'index',
                        priority: 'high',
                        description: 'Add index on products.category for faster filtering',
                        sql: 'CREATE INDEX idx_products_category ON products (category)'
                    });
                }
                
                if (query.query.includes('status')) {
                    recommendations.push({
                        type: 'index',
                        priority: 'high',
                        description: 'Add index on products.status for faster status filtering',
                        sql: 'CREATE INDEX idx_products_status ON products (status)'
                    });
                }
                
                if (query.query.includes('ORDER BY created_at')) {
                    recommendations.push({
                        type: 'index',
                        priority: 'medium',
                        description: 'Add index on products.created_at for faster sorting',
                        sql: 'CREATE INDEX idx_products_created_at ON products (created_at)'
                    });
                }
            }
            
            if (query.query.includes('LIKE') || query.query.includes('ilike')) {
                recommendations.push({
                    type: 'optimization',
                    priority: 'medium',
                    description: 'Consider using full-text search instead of LIKE queries',
                    suggestion: 'Implement PostgreSQL full-text search with GIN indexes'
                });
            }
        });
        
        return recommendations;
    }

    /**
     * Get general optimization recommendations
     */
    getGeneralRecommendations() {
        return [
            {
                type: 'index',
                priority: 'high',
                description: 'Ensure composite index on (category, status) for common filters',
                sql: 'CREATE INDEX idx_products_category_status ON products (category, status)'
            },
            {
                type: 'index',
                priority: 'medium',
                description: 'Add index on created_at for date-based sorting',
                sql: 'CREATE INDEX idx_products_created_at ON products (created_at)'
            },
            {
                type: 'optimization',
                priority: 'low',
                description: 'Consider partitioning large tables by date',
                suggestion: 'Implement table partitioning for analytics data'
            }
        ];
    }

    /**
     * Optimize bulk operations
     */
    async executeBulkOperation(operation, data, batchSize = 100) {
        console.log(`Executing bulk ${operation} for ${data.length} items`);
        
        const results = [];
        const batches = this.createBatches(data, batchSize);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
            
            try {
                let batchResult;
                
                switch (operation) {
                    case 'insert':
                        batchResult = await this.executeBulkInsert(batch);
                        break;
                    case 'update':
                        batchResult = await this.executeBulkUpdate(batch);
                        break;
                    case 'delete':
                        batchResult = await this.executeBulkDelete(batch);
                        break;
                    default:
                        throw new Error(`Unsupported bulk operation: ${operation}`);
                }
                
                results.push(...batchResult);
                
            } catch (error) {
                console.error(`Batch ${i + 1} failed:`, error);
                throw error;
            }
        }
        
        console.log(`Bulk ${operation} completed: ${results.length} items processed`);
        return results;
    }

    /**
     * Execute bulk insert with optimization
     */
    async executeBulkInsert(data) {
        const { data: result, error } = await supabaseAdmin
            .from('products')
            .insert(data)
            .select();
            
        if (error) {
            throw new Error(`Bulk insert failed: ${error.message}`);
        }
        
        return result;
    }

    /**
     * Execute bulk update with optimization
     */
    async executeBulkUpdate(updates) {
        const results = [];
        
        // Group updates by the fields being updated for better performance
        const updateGroups = this.groupUpdatesByFields(updates);
        
        for (const group of updateGroups) {
            const ids = group.items.map(item => item.id);
            const updateData = group.updateData;
            
            const { data: result, error } = await supabaseAdmin
                .from('products')
                .update(updateData)
                .in('id', ids)
                .select();
                
            if (error) {
                throw new Error(`Bulk update failed: ${error.message}`);
            }
            
            results.push(...result);
        }
        
        return results;
    }

    /**
     * Execute bulk delete with optimization
     */
    async executeBulkDelete(ids) {
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .in('id', ids);
            
        if (error) {
            throw new Error(`Bulk delete failed: ${error.message}`);
        }
        
        return ids.map(id => ({ id, deleted: true }));
    }

    /**
     * Create batches from array
     */
    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Group updates by fields being updated
     */
    groupUpdatesByFields(updates) {
        const groups = new Map();
        
        updates.forEach(update => {
            const { id, ...updateData } = update;
            const fieldsKey = Object.keys(updateData).sort().join(',');
            
            if (!groups.has(fieldsKey)) {
                groups.set(fieldsKey, {
                    updateData,
                    items: []
                });
            }
            
            groups.get(fieldsKey).items.push({ id });
        });
        
        return Array.from(groups.values());
    }

    /**
     * Track query performance
     */
    trackQueryPerformance(queryType, executionTime, queryId) {
        this.queryStats.totalQueries++;
        
        // Update query type stats
        if (!this.queryStats.queryTypes[queryType]) {
            this.queryStats.queryTypes[queryType] = {
                count: 0,
                totalTime: 0,
                averageTime: 0
            };
        }
        
        const typeStats = this.queryStats.queryTypes[queryType];
        typeStats.count++;
        typeStats.totalTime += executionTime;
        typeStats.averageTime = typeStats.totalTime / typeStats.count;
        
        // Update overall average
        const totalTime = Object.values(this.queryStats.queryTypes)
            .reduce((sum, stats) => sum + stats.totalTime, 0);
        this.queryStats.averageResponseTime = totalTime / this.queryStats.totalQueries;
    }

    /**
     * Generate unique query ID
     */
    generateQueryId() {
        return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get database performance statistics
     */
    async getDatabaseStats() {
        try {
            // Get table sizes
            const tableSizeQuery = `
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            `;
            
            const { data: tableSizes } = await supabaseAdmin.rpc('execute_sql', { 
                sql_query: tableSizeQuery 
            });
            
            // Get index usage
            const indexUsageQuery = `
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes 
                WHERE schemaname = 'public'
                ORDER BY idx_scan DESC
            `;
            
            const { data: indexUsage } = await supabaseAdmin.rpc('execute_sql', { 
                sql_query: indexUsageQuery 
            });
            
            return {
                tableSizes: tableSizes || [],
                indexUsage: indexUsage || [],
                queryStats: this.queryStats,
                recommendations: this.indexRecommendations
            };
            
        } catch (error) {
            console.warn('Could not get database stats:', error.message);
            return {
                tableSizes: [],
                indexUsage: [],
                queryStats: this.queryStats,
                recommendations: []
            };
        }
    }

    /**
     * Optimize database connections
     */
    optimizeConnections() {
        // Connection pooling is handled by Supabase, but we can optimize our usage
        return {
            recommendations: [
                'Use connection pooling (handled by Supabase)',
                'Minimize long-running transactions',
                'Close connections promptly',
                'Use read replicas for read-heavy operations'
            ],
            currentStats: this.queryStats
        };
    }

    /**
     * Health check for database performance
     */
    async healthCheck() {
        const stats = await this.getDatabaseStats();
        const slowQueryRate = this.queryStats.totalQueries > 0 
            ? (this.queryStats.slowQueries / this.queryStats.totalQueries * 100).toFixed(2)
            : 0;
        
        return {
            status: slowQueryRate < 10 ? 'healthy' : 'warning',
            metrics: {
                totalQueries: this.queryStats.totalQueries,
                slowQueries: this.queryStats.slowQueries,
                slowQueryRate: `${slowQueryRate}%`,
                averageResponseTime: `${this.queryStats.averageResponseTime.toFixed(2)}ms`
            },
            recommendations: stats.recommendations,
            warnings: this.generatePerformanceWarnings(slowQueryRate)
        };
    }

    generatePerformanceWarnings(slowQueryRate) {
        const warnings = [];
        
        if (slowQueryRate > 10) {
            warnings.push('High percentage of slow queries detected');
        }
        
        if (this.queryStats.averageResponseTime > 500) {
            warnings.push('Average response time is high');
        }
        
        if (this.queryStats.totalQueries > 10000) {
            warnings.push('High query volume - consider caching');
        }
        
        return warnings;
    }
}

// Singleton instance
let databaseOptimizerInstance = null;

function getDatabaseOptimizer() {
    if (!databaseOptimizerInstance) {
        databaseOptimizerInstance = new DatabaseOptimizer();
    }
    return databaseOptimizerInstance;
}

module.exports = {
    DatabaseOptimizer,
    getDatabaseOptimizer
};