const { supabaseAdmin } = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');

async function createUsersTable() {
    try {
        console.log('🔄 users 테이블 생성을 시작합니다...');
        
        // SQL 파일 읽기
        const sqlPath = path.join(__dirname, '../migrations/005_create_users_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 SQL 파일을 읽었습니다.');
        
        // 각 명령어를 개별적으로 실행
        const commands = sql.split(';').filter(cmd => cmd.trim());
        
        for (const command of commands) {
            if (command.trim()) {
                console.log(`실행 중: ${command.trim().substring(0, 50)}...`);
                const { error } = await supabaseAdmin.rpc('exec_sql', { sql: command });
                if (error) {
                    console.warn(`명령어 실행 중 경고: ${error.message}`);
                }
            }
        }
        
        console.log('✅ users 테이블 생성이 완료되었습니다!');
        
    } catch (error) {
        console.error('❌ users 테이블 생성 중 오류:', error);
        throw error;
    }
}

// 스크립트 실행
if (require.main === module) {
    createUsersTable()
        .then(() => {
            console.log('🎉 users 테이블 생성이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 users 테이블 생성 실패:', error);
            process.exit(1);
        });
}

module.exports = { createUsersTable };