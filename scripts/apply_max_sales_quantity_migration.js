const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase 클라이언트 생성
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 마이그레이션 SQL 실행 함수
async function applyMigration() {
    try {
        console.log('🔄 최대 판매 개수 필드 마이그레이션 시작...');
        
        // 1. max_sales_quantity 컬럼 추가
        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE products 
                ADD COLUMN IF NOT EXISTS max_sales_quantity INTEGER DEFAULT NULL;
            `
        });
        
        if (alterError) {
            console.log('컬럼이 이미 존재하거나 오류 발생:', alterError.message);
        } else {
            console.log('✅ max_sales_quantity 컬럼 추가 완료');
        }
        
        // 2. 체크 제약 조건 추가
        const { error: constraintError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE products 
                DROP CONSTRAINT IF EXISTS check_max_sales_quantity_positive;
                
                ALTER TABLE products 
                ADD CONSTRAINT check_max_sales_quantity_positive 
                CHECK (max_sales_quantity IS NULL OR max_sales_quantity > 0);
            `
        });
        
        if (constraintError) {
            console.error('❌ 체크 제약 조건 추가 실패:', constraintError);
        } else {
            console.log('✅ 체크 제약 조건 추가 완료');
        }
        
        // 3. 인덱스 추가
        const { error: indexError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE INDEX IF NOT EXISTS idx_products_max_sales_quantity 
                ON products(max_sales_quantity);
            `
        });
        
        if (indexError) {
            console.error('❌ 인덱스 추가 실패:', indexError);
        } else {
            console.log('✅ 인덱스 추가 완료');
        }
        
        // 4. 트리거 함수 생성
        const { error: functionError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE OR REPLACE FUNCTION check_and_update_product_stock()
                RETURNS TRIGGER AS $$
                BEGIN
                    -- 최대 판매 개수가 설정되어 있고, 현재 판매 개수가 최대 개수에 도달한 경우
                    IF NEW.max_sales_quantity IS NOT NULL AND NEW.purchase_count >= NEW.max_sales_quantity THEN
                        NEW.status = 'out_of_stock';
                    -- 최대 판매 개수가 설정되어 있고, 현재 판매 개수가 최대 개수 미만이면서 현재 상태가 품절인 경우
                    ELSIF NEW.max_sales_quantity IS NOT NULL AND NEW.purchase_count < NEW.max_sales_quantity AND NEW.status = 'out_of_stock' THEN
                        NEW.status = 'active';
                    END IF;
                    
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            `
        });
        
        if (functionError) {
            console.error('❌ 트리거 함수 생성 실패:', functionError);
        } else {
            console.log('✅ 트리거 함수 생성 완료');
        }
        
        // 5. 트리거 생성
        const { error: triggerError } = await supabase.rpc('exec_sql', {
            sql: `
                DROP TRIGGER IF EXISTS trigger_check_product_stock ON products;
                CREATE TRIGGER trigger_check_product_stock
                    BEFORE UPDATE ON products
                    FOR EACH ROW
                    EXECUTE FUNCTION check_and_update_product_stock();
            `
        });
        
        if (triggerError) {
            console.error('❌ 트리거 생성 실패:', triggerError);
        } else {
            console.log('✅ 트리거 생성 완료');
        }
        
        // 6. 댓글 추가
        const { error: commentError } = await supabase.rpc('exec_sql', {
            sql: `
                COMMENT ON COLUMN products.max_sales_quantity IS '최대 판매 가능 개수 (NULL은 무제한 판매)';
                COMMENT ON FUNCTION check_and_update_product_stock() IS '판매 개수에 따라 자동으로 품절 상태를 업데이트하는 함수';
            `
        });
        
        if (commentError) {
            console.error('❌ 댓글 추가 실패:', commentError);
        } else {
            console.log('✅ 댓글 추가 완료');
        }
        
        console.log('🎉 마이그레이션 완료!');
        
        // 7. 현재 제품 테이블 구조 확인
        const { data: products, error: selectError } = await supabase
            .from('products')
            .select('id, name, max_sales_quantity, purchase_count, status')
            .limit(5);
            
        if (selectError) {
            console.error('❌ 제품 조회 실패:', selectError);
        } else {
            console.log('📋 현재 제품 샘플 (최대 5개):', products);
        }
        
    } catch (error) {
        console.error('❌ 마이그레이션 실행 중 오류 발생:', error);
    }
}

// 스크립트 실행
applyMigration();
