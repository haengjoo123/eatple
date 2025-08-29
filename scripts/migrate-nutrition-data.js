const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const crypto = require('crypto'); // Added for crypto.randomUUID()

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Category mapping for existing data
const categoryMapping = {
    'diet': 'diet',
    'supplements': 'supplements', 
    'research': 'research',
    'trends': 'trends',
    'default': 'diet' // fallback category
};

async function loadExistingData() {
    try {
        const dataPath = path.join(__dirname, '../data/nutrition-info.json');
        const rawData = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error loading existing data:', error);
        return [];
    }
}

async function getCategoryId(categoryName) {
    const mappedCategory = categoryMapping[categoryName] || categoryMapping.default;
    
    const { data, error } = await supabase
        .from('categories')
        .select('id')
        .eq('name', mappedCategory)
        .single();
    
    if (error) {
        console.error(`Error getting category ID for ${mappedCategory}:`, error);
        return null;
    }
    
    return data.id;
}

async function getOrCreateTag(tagName) {
    // First try to get existing tag
    const { data: existingTag, error: selectError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName.trim())
        .single();
    
    if (!selectError && existingTag) {
        return existingTag.id;
    }
    
    // Create new tag if it doesn't exist
    const { data: newTag, error: insertError } = await supabase
        .from('tags')
        .insert({ name: tagName.trim() })
        .select('id')
        .single();
    
    if (insertError) {
        console.error(`Error creating tag ${tagName}:`, insertError);
        return null;
    }
    
    return newTag.id;
}

async function transformDataItem(item) {
    // Get category ID
    const categoryId = await getCategoryId(item.category || 'diet');
    
    // Generate a new UUID instead of using the original ID
    const newId = crypto.randomUUID();
    
    // Transform the data structure to match Supabase schema
    const transformedItem = {
        // Don't specify id - let Supabase generate UUID automatically
        title: item.title,
        summary: item.summary || item.description?.substring(0, 500) || '',
        content: item.originalContent || item.description || item.summary || '',
        source_type: item.sourceType || 'youtube',
        source_url: item.sourceUrl,
        source_name: item.sourceName || item.channelTitle || 'Unknown',
        author: item.channelTitle || item.author || 'Unknown',
        published_date: item.publishedDate || item.collectedDate,
        collected_date: item.collectedDate,
        trust_score: item.trustScore || 50,
        category_id: categoryId,
        image_url: item.thumbnailUrl || item.imageUrl,
        language: 'ko',
        is_active: item.isActive !== false,
        view_count: item.viewCount || 0,
        like_count: item.likeCount || 0,
        bookmark_count: 0,
        is_manual_post: false, // These are auto-collected items
        admin_id: null,
        admin_name: null,
        is_draft: false,
        last_modified: item.collectedDate || new Date().toISOString(),
        created_at: item.collectedDate || new Date().toISOString(),
        updated_at: item.collectedDate || new Date().toISOString()
    };
    
    return {
        post: transformedItem,
        tags: item.tags || item.keywords || [],
        originalId: item.id // Store original ID for reference
    };
}

async function migrateData() {
    console.log('Starting data migration...');
    
    try {
        // Load existing data
        const existingData = await loadExistingData();
        console.log(`Found ${existingData.length} items to migrate`);
        
        if (existingData.length === 0) {
            console.log('No data to migrate');
            return;
        }
        
        // Check if categories exist
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('*');
        
        if (categoriesError) {
            console.error('Error checking categories:', categoriesError);
            console.log('Please ensure categories table exists and has default data');
            return;
        }
        
        console.log(`Found ${categories.length} categories in database`);
        
        let migratedCount = 0;
        let errorCount = 0;
        
        // Process items in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < existingData.length; i += batchSize) {
            const batch = existingData.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(existingData.length/batchSize)}`);
            
            for (const item of batch) {
                try {
                    // Transform the data
                    const { post, tags, originalId } = await transformDataItem(item);
                    
                    // Insert the post
                    const { data: insertedPost, error: postError } = await supabase
                        .from('nutrition_posts')
                        .insert(post)
                        .select('id')
                        .single();
                    
                    if (postError) {
                        console.error(`Error inserting post ${originalId}:`, postError);
                        errorCount++;
                        continue;
                    }
                    
                    console.log(`✓ Migrated: ${originalId} -> ${insertedPost.id}`);
                    migratedCount++;
                    
                    // Link tags if any
                    if (tags && tags.length > 0) {
                        for (const tagName of tags) {
                            try {
                                const tagId = await getOrCreateTag(tagName);
                                
                                const { error: tagLinkError } = await supabase
                                    .from('post_tags')
                                    .insert({
                                        post_id: insertedPost.id,
                                        tag_id: tagId
                                    });
                                
                                if (tagLinkError) {
                                    console.error(`Error linking tags for post ${originalId}:`, tagLinkError);
                                }
                            } catch (tagError) {
                                console.error(`Error processing tag ${tagName} for post ${originalId}:`, tagError);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing item ${item.id}:`, error);
                    errorCount++;
                }
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\nMigration completed!');
        console.log(`Successfully migrated: ${migratedCount} items`);
        console.log(`Errors: ${errorCount} items`);
        
        // Update category post counts
        console.log('Updating category post counts...');
        for (const category of categories) {
            const { count } = await supabase
                .from('nutrition_posts')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', category.id);
            
            await supabase
                .from('categories')
                .update({ post_count: count || 0 })
                .eq('id', category.id);
        }
        
        // Update tag post counts
        console.log('Updating tag post counts...');
        const { data: tags } = await supabase
            .from('tags')
            .select('id');
        
        if (tags) {
            for (const tag of tags) {
                const { count } = await supabase
                    .from('post_tags')
                    .select('*', { count: 'exact', head: true })
                    .eq('tag_id', tag.id);
                
                await supabase
                    .from('tags')
                    .update({ post_count: count || 0 })
                    .eq('id', tag.id);
            }
        }
        
        console.log('✓ Post counts updated');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

async function checkMigrationStatus() {
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
        
        console.log('\nMigration Status:');
        console.log(`Posts: ${postsCount || 0}`);
        console.log(`Tags: ${tagsCount || 0}`);
        console.log(`Categories: ${categoriesCount || 0}`);
        
    } catch (error) {
        console.error('Error checking migration status:', error);
    }
}

async function main() {
    const command = process.argv[2];
    
    if (command === 'status') {
        await checkMigrationStatus();
    } else {
        await migrateData();
        await checkMigrationStatus();
    }
}

if (require.main === module) {
    main();
}

module.exports = { migrateData, checkMigrationStatus };