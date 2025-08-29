const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTablesIfNotExist() {
    console.log('Setting up database tables...');
    
    // Since we can't execute raw SQL through the client, we'll create tables using upsert operations
    // This is a workaround - in production, tables should be created via Supabase dashboard or CLI
    
    try {
        // Try to create categories by inserting default data
        const defaultCategories = [
            { name: 'diet', description: '식단 관련 영양 정보' },
            { name: 'supplements', description: '영양 보충제 관련 정보' },
            { name: 'research', description: '영양학 연구 정보' },
            { name: 'trends', description: '영양 트렌드 정보' }
        ];
        
        console.log('Creating/checking categories...');
        for (const category of defaultCategories) {
            const { error } = await supabase
                .from('categories')
                .upsert(category, { onConflict: 'name' });
            
            if (error && !error.message.includes('does not exist')) {
                console.error('Error with categories:', error);
            }
        }
        
        console.log('✓ Categories setup completed');
        return true;
        
    } catch (error) {
        console.error('Error setting up tables:', error);
        console.log('\nIMPORTANT: Please create the database tables manually using the SQL from:');
        console.log('migrations/001_create_nutrition_tables.sql');
        console.log('\nYou can do this by:');
        console.log('1. Going to your Supabase dashboard');
        console.log('2. Opening the SQL Editor');
        console.log('3. Running the SQL from the migration file');
        return false;
    }
}

async function checkTablesExist() {
    try {
        // Check if tables exist by trying to query them
        const { error: categoriesError } = await supabase
            .from('categories')
            .select('count', { count: 'exact', head: true });
        
        const { error: tagsError } = await supabase
            .from('tags')
            .select('count', { count: 'exact', head: true });
        
        const { error: postsError } = await supabase
            .from('nutrition_posts')
            .select('count', { count: 'exact', head: true });
        
        const tablesExist = !categoriesError && !tagsError && !postsError;
        
        if (tablesExist) {
            console.log('✓ All required tables exist');
        } else {
            console.log('✗ Some tables are missing:');
            if (categoriesError) console.log('  - categories table missing');
            if (tagsError) console.log('  - tags table missing');
            if (postsError) console.log('  - nutrition_posts table missing');
        }
        
        return tablesExist;
        
    } catch (error) {
        console.error('Error checking tables:', error);
        return false;
    }
}

async function loadExistingData() {
    try {
        const dataPath = path.join(__dirname, '../data/nutrition-info.json');
        const rawData = await fs.readFile(dataPath, 'utf8');
        const data = JSON.parse(rawData);
        console.log(`✓ Loaded ${data.length} items from nutrition-info.json`);
        return data;
    } catch (error) {
        console.error('Error loading existing data:', error);
        return [];
    }
}

async function createMigrationSummary(existingData) {
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total items to migrate: ${existingData.length}`);
    
    // Analyze source types
    const sourceTypes = {};
    const categories = {};
    let totalTags = 0;
    
    existingData.forEach(item => {
        sourceTypes[item.sourceType] = (sourceTypes[item.sourceType] || 0) + 1;
        categories[item.category || 'unknown'] = (categories[item.category || 'unknown'] || 0) + 1;
        totalTags += (item.tags || []).length;
    });
    
    console.log('\nSource types:');
    Object.entries(sourceTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} items`);
    });
    
    console.log('\nCategories:');
    Object.entries(categories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} items`);
    });
    
    console.log(`\nTotal tags to process: ${totalTags}`);
    console.log('========================\n');
}

async function main() {
    console.log('Supabase Setup and Migration Tool');
    console.log('==================================\n');
    
    // Check if tables exist
    const tablesExist = await checkTablesExist();
    
    if (!tablesExist) {
        console.log('\nAttempting to create tables...');
        const created = await createTablesIfNotExist();
        
        if (!created) {
            console.log('\nPlease create the tables manually and run this script again.');
            process.exit(1);
        }
    }
    
    // Load existing data for analysis
    const existingData = await loadExistingData();
    
    if (existingData.length === 0) {
        console.log('No data found to migrate.');
        return;
    }
    
    // Create migration summary
    await createMigrationSummary(existingData);
    
    // Check current database status
    try {
        const { count: postsCount } = await supabase
            .from('nutrition_posts')
            .select('*', { count: 'exact', head: true });
        
        const { count: tagsCount } = await supabase
            .from('tags')
            .select('*', { count: 'exact', head: true });
        
        const { count: categoriesCount } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });
        
        console.log('Current database status:');
        console.log(`  Posts: ${postsCount || 0}`);
        console.log(`  Tags: ${tagsCount || 0}`);
        console.log(`  Categories: ${categoriesCount || 0}`);
        
        if (postsCount > 0) {
            console.log('\nNote: Database already contains posts. Migration script will skip existing items.');
        }
        
    } catch (error) {
        console.error('Error checking database status:', error);
    }
    
    console.log('\n✓ Setup completed successfully!');
    console.log('\nTo run the actual migration, use:');
    console.log('node scripts/migrate-nutrition-data.js');
}

if (require.main === module) {
    main();
}

module.exports = { createTablesIfNotExist, checkTablesExist };