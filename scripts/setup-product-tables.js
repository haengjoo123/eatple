const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupProductTables() {
    console.log('Setting up product management tables...');
    
    try {
        // Check if tables exist
        console.log('Checking existing tables...');
        
        // Check product_categories table
        const { data: categoriesCheck, error: categoriesCheckError } = await supabase
            .from('product_categories')
            .select('count', { count: 'exact', head: true });
        
        if (categoriesCheckError && categoriesCheckError.message.includes('does not exist')) {
            console.log('Product categories table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Product categories table exists');
        }

        // Check products table
        const { data: productsCheck, error: productsCheckError } = await supabase
            .from('products')
            .select('count', { count: 'exact', head: true });
        
        if (productsCheckError && productsCheckError.message.includes('does not exist')) {
            console.log('Products table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Products table exists');
        }

        // Check product_analytics table
        const { data: analyticsCheck, error: analyticsCheckError } = await supabase
            .from('product_analytics')
            .select('count', { count: 'exact', head: true });
        
        if (analyticsCheckError && analyticsCheckError.message.includes('does not exist')) {
            console.log('Product analytics table does not exist, will need to create via SQL');
        } else {
            console.log('✓ Product analytics table exists');
        }

        // If product_categories table exists, insert default categories
        if (!categoriesCheckError) {
            const { data: existingCategories } = await supabase
                .from('product_categories')
                .select('name');

            const defaultCategories = [
                { name: 'supplement', display_name: '건강보조식품', description: '비타민, 미네랄 등 건강보조식품' },
                { name: 'vitamin', display_name: '비타민', description: '각종 비타민 제품' },
                { name: 'beauty', display_name: '뷰티', description: '미용 및 피부 관리 제품' },
                { name: 'protein', display_name: '프로틴', description: '단백질 보충제' },
                { name: 'diet', display_name: '다이어트', description: '체중 관리 제품' },
                { name: 'health', display_name: '건강식품', description: '일반 건강식품' },
                { name: 'functional', display_name: '기능성식품', description: '특정 기능을 가진 식품' },
                { name: 'organic', display_name: '유기농', description: '유기농 제품' }
            ];

            const existingCategoryNames = existingCategories?.map(c => c.name) || [];
            const categoriesToInsert = defaultCategories.filter(
                cat => !existingCategoryNames.includes(cat.name)
            );

            if (categoriesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('product_categories')
                    .insert(categoriesToInsert);

                if (insertError) {
                    console.error('Error inserting default categories:', insertError);
                } else {
                    console.log(`✓ ${categoriesToInsert.length} default categories inserted`);
                }
            } else {
                console.log('✓ Default categories already exist');
            }
        }

        // Check storage bucket
        console.log('Checking storage bucket...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.log('✗ Error accessing storage:', bucketsError.message);
        } else {
            const productBucket = buckets.find(b => b.id === 'product-images');
            if (!productBucket) {
                console.log('Creating product-images storage bucket...');
                const { error: createBucketError } = await supabase.storage.createBucket('product-images', {
                    public: true,
                    fileSizeLimit: 5242880, // 5MB
                    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
                });
                
                if (createBucketError) {
                    console.log('✗ Error creating bucket:', createBucketError.message);
                } else {
                    console.log('✓ Product images storage bucket created');
                }
            } else {
                console.log('✓ Product images storage bucket exists');
            }
        }

        console.log('\nTable setup status:');
        console.log('- Product categories table: ' + (!categoriesCheckError ? '✓ Ready' : '✗ Needs creation'));
        console.log('- Products table: ' + (!productsCheckError ? '✓ Ready' : '✗ Needs creation'));
        console.log('- Product analytics table: ' + (!analyticsCheckError ? '✓ Ready' : '✗ Needs creation'));
        console.log('- Storage bucket: ✓ Ready');
        
        if (categoriesCheckError || productsCheckError || analyticsCheckError) {
            console.log('\n⚠️  Some tables need to be created manually via Supabase SQL editor.');
            console.log('Please run the SQL from migrations/002_create_product_management_tables.sql');
            console.log('\nTo apply the migration:');
            console.log('1. Go to your Supabase dashboard');
            console.log('2. Navigate to SQL Editor');
            console.log('3. Copy and paste the contents of migrations/002_create_product_management_tables.sql');
            console.log('4. Run the SQL script');
            console.log('5. Run this setup script again to verify and insert default data');
        } else {
            console.log('\n🎉 All product management tables are ready!');
            
            // Test basic functionality
            console.log('\nTesting basic functionality...');
            
            // Test inserting a sample product
            const { data: testProduct, error: testError } = await supabase
                .from('products')
                .insert({
                    name: 'Test Product',
                    description: 'Test product for verification',
                    price: 1000,
                    category: 'supplement',
                    status: 'active'
                })
                .select()
                .single();

            if (testError) {
                console.log('✗ Test product insertion failed:', testError.message);
            } else {
                console.log('✓ Test product created successfully');
                
                // Clean up test product
                await supabase.from('products').delete().eq('id', testProduct.id);
                console.log('✓ Test product cleaned up');
            }
        }

        console.log('\nProduct management tables setup completed!');
        
    } catch (error) {
        console.error('Error setting up product tables:', error);
        process.exit(1);
    }
}

// Test connection first
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('product_categories')
            .select('count', { count: 'exact', head: true });
        
        if (error && !error.message.includes('relation "product_categories" does not exist')) {
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
        await setupProductTables();
    } else {
        console.error('Cannot proceed without Supabase connection');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { setupProductTables, testConnection };