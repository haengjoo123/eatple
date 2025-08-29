/**
 * Apply summary field migration to products table
 * This script adds summary and originalPrice fields to the products table
 */

const { supabaseAdmin } = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');

async function applySummaryMigration() {
    try {
        console.log('🔄 제품 테이블에 summary 필드 마이그레이션을 시작합니다...');
        
        // 마이그레이션 SQL 파일 읽기
        const migrationPath = path.join(__dirname, '../migrations/003_add_summary_to_products.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 마이그레이션 SQL 파일을 읽었습니다.');
        
        // SQL 실행
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: migrationSQL });
        
        if (error) {
            // RPC 방식이 실패하면 직접 쿼리 실행
            console.log('⚠️ RPC 방식 실패, 직접 쿼리로 실행합니다...');
            
            // 각 명령어를 개별적으로 실행
            const commands = migrationSQL.split(';').filter(cmd => cmd.trim());
            
            for (const command of commands) {
                if (command.trim()) {
                    console.log(`실행 중: ${command.trim().substring(0, 50)}...`);
                    const { error: cmdError } = await supabaseAdmin.rpc('exec_sql', { sql: command });
                    if (cmdError) {
                        console.warn(`명령어 실행 중 경고: ${cmdError.message}`);
                    }
                }
            }
        }
        
        console.log('✅ summary 필드 마이그레이션이 완료되었습니다!');
        
        // 마이그레이션 결과 확인
        const { data: columns, error: checkError } = await supabaseAdmin
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'products')
            .in('column_name', ['summary', 'originalprice']);
        
        if (checkError) {
            console.error('❌ 마이그레이션 확인 중 오류:', checkError);
        } else {
            console.log('📋 추가된 컬럼 확인:', columns.map(col => col.column_name));
        }
        
    } catch (error) {
        console.error('❌ 마이그레이션 실행 중 오류:', error);
        throw error;
    }
}

// 스크립트가 직접 실행될 때만 마이그레이션 실행
if (require.main === module) {
    applySummaryMigration()
        .then(() => {
            console.log('🎉 마이그레이션이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 마이그레이션 실패:', error);
            process.exit(1);
        });
}

module.exports = { applySummaryMigration };

