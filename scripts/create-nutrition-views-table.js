/**
 * 영양정보 포스팅 조회수 테이블 생성 스크립트
 * 
 * 이 스크립트는 nutrition_post_views 테이블을 생성하여
 * 일별 조회수를 기록하고 통계 분석에 활용합니다.
 * 
 * 실행 방법: node scripts/create-nutrition-views-table.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase 설정이 없습니다. .env 파일을 확인해주세요.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createNutritionViewsTable() {
    console.log('🚀 영양정보 조회수 테이블 생성 시작...\n');

    try {
        // 마이그레이션 파일 읽기
        const migrationPath = path.join(__dirname, '..', 'migrations', '015_create_nutrition_post_views_table.sql');
        
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`마이그레이션 파일을 찾을 수 없습니다: ${migrationPath}`);
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        
        console.log('📄 마이그레이션 파일 읽기 완료');
        console.log('📊 SQL 실행 중...\n');

        // SQL 문을 세미콜론으로 분할하여 각각 실행
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.includes('CREATE TABLE') || 
                statement.includes('CREATE INDEX') || 
                statement.includes('ALTER TABLE') ||
                statement.includes('CREATE POLICY') ||
                statement.includes('COMMENT ON')) {
                
                try {
                    // Supabase의 SQL 실행 API 사용
                    const { data, error } = await supabase.rpc('exec_sql', { 
                        sql: statement + ';' 
                    });

                    if (error) {
                        // 이미 존재하는 테이블/인덱스 오류는 무시
                        if (error.message.includes('already exists')) {
                            console.log('⚠️  이미 존재함 (무시):', statement.substring(0, 50) + '...');
                        } else {
                            console.error('❌ SQL 실행 실패:', statement.substring(0, 100));
                            console.error('오류:', error.message);
                        }
                    } else {
                        console.log('✅', statement.substring(0, 60) + '...');
                    }
                } catch (execError) {
                    console.error('❌ SQL 실행 예외:', execError.message);
                }
            }
        }

        // 테이블 생성 확인
        console.log('\n🔍 테이블 생성 확인 중...');
        
        const { data: tableCheck, error: checkError } = await supabase
            .from('nutrition_post_views')
            .select('count', { count: 'exact', head: true });

        if (checkError) {
            if (checkError.message.includes('does not exist')) {
                console.error('❌ nutrition_post_views 테이블이 생성되지 않았습니다.');
                console.log('\n📝 수동 마이그레이션 방법:');
                console.log('1. Supabase 대시보드의 SQL Editor로 이동');
                console.log('2. migrations/015_create_nutrition_post_views_table.sql 파일 내용을 복사');
                console.log('3. SQL Editor에 붙여넣고 실행\n');
            } else {
                console.error('❌ 테이블 확인 중 오류:', checkError.message);
            }
        } else {
            console.log('✅ nutrition_post_views 테이블이 성공적으로 생성되었습니다!\n');
            console.log('📊 테이블 구조:');
            console.log('   - id: UUID (Primary Key)');
            console.log('   - post_id: UUID (Foreign Key to nutrition_posts)');
            console.log('   - viewed_at: TIMESTAMP');
            console.log('   - view_count: INTEGER (기본값: 1)');
            console.log('   - user_id: TEXT (선택적)');
            console.log('   - ip_address: TEXT (선택적)');
            console.log('   - user_agent: TEXT (선택적)\n');
        }

        console.log('✅ 마이그레이션 완료!\n');

    } catch (error) {
        console.error('❌ 테이블 생성 중 오류 발생:', error);
        console.error(error.stack);
        
        console.log('\n📝 수동 마이그레이션 방법:');
        console.log('1. Supabase 대시보드의 SQL Editor로 이동');
        console.log('2. migrations/015_create_nutrition_post_views_table.sql 파일 내용을 복사');
        console.log('3. SQL Editor에 붙여넣고 실행\n');
        
        process.exit(1);
    }
}

// 스크립트 실행
createNutritionViewsTable()
    .then(() => {
        console.log('✅ 스크립트 실행 완료');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ 스크립트 실행 실패:', error);
        process.exit(1);
    });
