const { supabaseAdmin } = require('../utils/supabaseClient');

async function addEventColumns() {
    try {
        console.log('🔄 이벤트 컬럼 추가 시작...');
        
        // 각 컬럼을 개별적으로 추가
        const columns = [
            {
                name: 'is_event',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE'
            },
            {
                name: 'event_tag',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS event_tag VARCHAR(100)'
            },
            {
                name: 'event_start_date',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS event_start_date TIMESTAMP WITH TIME ZONE'
            },
            {
                name: 'event_end_date',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS event_end_date TIMESTAMP WITH TIME ZONE'
            },
            {
                name: 'event_discount_rate',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS event_discount_rate INTEGER'
            },
            {
                name: 'event_description',
                sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS event_description TEXT'
            }
        ];
        
        for (const column of columns) {
            console.log(`🔄 ${column.name} 컬럼 추가 중...`);
            try {
                await supabaseAdmin.rpc('exec_sql', { sql: column.sql });
                console.log(`✅ ${column.name} 컬럼 추가 완료`);
            } catch (error) {
                console.log(`⚠️  ${column.name} 컬럼 추가 실패 (이미 존재할 수 있음):`, error.message);
            }
        }
        
        // 인덱스 추가
        console.log('🔄 인덱스 추가 중...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_products_is_event ON products(is_event)',
            'CREATE INDEX IF NOT EXISTS idx_products_event_tag ON products(event_tag)',
            'CREATE INDEX IF NOT EXISTS idx_products_event_dates ON products(event_start_date, event_end_date)'
        ];
        
        for (const indexSQL of indexes) {
            try {
                await supabaseAdmin.rpc('exec_sql', { sql: indexSQL });
                console.log('✅ 인덱스 추가 완료');
            } catch (error) {
                console.log('⚠️  인덱스 추가 실패:', error.message);
            }
        }
        
        // 기존 할인 상품들을 이벤트 상품으로 마크
        console.log('🔄 기존 할인 상품을 이벤트 상품으로 마크 중...');
        const updateSQL = `
            UPDATE products 
            SET 
                is_event = TRUE,
                event_tag = 'discount_sale',
                event_discount_rate = CASE 
                    WHEN "originalPrice" > 0 AND price > 0 
                    THEN ROUND((("originalPrice" - price) / "originalPrice") * 100)
                    ELSE 0
                END,
                event_description = '특가 할인 상품'
            WHERE 
                "originalPrice" > price 
                AND (("originalPrice" - price) / "originalPrice") * 100 >= 15
                AND (is_event IS NULL OR is_event = FALSE)
        `;
        
        try {
            await supabaseAdmin.rpc('exec_sql', { sql: updateSQL });
            console.log('✅ 할인 상품 이벤트 마크 완료');
        } catch (error) {
            console.log('⚠️  할인 상품 이벤트 마크 실패:', error.message);
        }
        
        console.log('🎉 이벤트 컬럼 추가 완료!');
        
        // 테이블 구조 확인
        console.log('🔍 테이블 구조 확인 중...');
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('❌ 테이블 구조 확인 실패:', error);
        } else {
            console.log('📋 products 테이블 컬럼 확인 완료');
            console.log('✅ 이벤트 컬럼이 성공적으로 추가되었습니다!');
        }
        
    } catch (error) {
        console.error('❌ 이벤트 컬럼 추가 실패:', error);
        process.exit(1);
    }
}

addEventColumns();
