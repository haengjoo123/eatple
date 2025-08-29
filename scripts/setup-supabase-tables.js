const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTables() {
    console.log('Setting up Supabase tables...');
    
    try {
        // First, let's check if tables exist and create them if they don't
        console.log('Checking existing tables...');
        
        // Try to query categories table to see if it exists
        const { data: categoriesCheck, error: categoriesCheckError } = await supabase
            .from('categories')
            .select('count', { count: 'exact', head: true });
        
        if (categoriesCheckError && categoriesCheckError.message.includes('does not exist')) {
            console.log('Categories table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Categories table exists');
        }

        // Try to query tags table to see if it exists
        const { data: tagsCheck, error: tagsCheckError } = await supabase
            .from('tags')
            .select('count', { count: 'exact', head: true });
        
        if (tagsCheckError && tagsCheckError.message.includes('does not exist')) {
            console.log('Tags table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Tags table exists');
        }

        // Try to query nutrition_posts table to see if it exists
        const { data: postsCheck, error: postsCheckError } = await supabase
            .from('nutrition_posts')
            .select('count', { count: 'exact', head: true });
        
        if (postsCheckError && postsCheckError.message.includes('does not exist')) {
            console.log('Nutrition posts table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Nutrition posts table exists');
        }

        // If categories table exists, insert default categories
        if (!categoriesCheckError) {
            const { data: existingCategories } = await supabase
                .from('categories')
                .select('name');

            const defaultCategories = [
                { name: 'diet', description: '식단 관련 영양 정보' },
                { name: 'supplements', description: '영양 보충제 관련 정보' },
                { name: 'research', description: '영양학 연구 정보' },
                { name: 'trends', description: '영양 트렌드 정보' }
            ];

            const existingCategoryNames = existingCategories?.map(c => c.name) || [];
            const categoriesToInsert = defaultCategories.filter(
                cat => !existingCategoryNames.includes(cat.name)
            );

            if (categoriesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('categories')
                    .insert(categoriesToInsert);

                if (insertError) {
                    console.error('Error inserting default categories:', insertError);
                } else {
                    console.log('✓ Default categories inserted');
                }
            } else {
                console.log('✓ Default categories already exist');
            }
        }

        console.log('\nTable setup status:');
        console.log('- Categories table: ' + (!categoriesCheckError ? '✓ Ready' : '✗ Needs creation'));
        console.log('- Tags table: ' + (!tagsCheckError ? '✓ Ready' : '✗ Needs creation'));
        console.log('- Nutrition posts table: ' + (!postsCheckError ? '✓ Ready' : '✗ Needs creation'));
        
        if (categoriesCheckError || tagsCheckError || postsCheckError) {
            console.log('\nNote: Some tables need to be created manually via Supabase SQL editor.');
            console.log('Please run the SQL from migrations/001_create_nutrition_tables.sql');
        }

        console.log('Supabase tables setup completed!');
        
    } catch (error) {
        console.error('Error setting up tables:', error);
        process.exit(1);
    }
}

// Test connection first
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('count', { count: 'exact', head: true });
        
        if (error && !error.message.includes('relation "categories" does not exist')) {
            throw error;
        }
        
        console.log('✓ Supabase connection successful');
        return true;
    } catch (error) {
        console.error('✗ Supabase connection failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('Testing Supabase connection...');
    const connected = await testConnection();
    
    if (connected) {
        await setupTables();
    } else {
        console.error('Cannot proceed without Supabase connection');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { setupTables, testConnection };