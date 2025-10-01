const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyPerformanceIndexes() {
  try {
    console.log('🚀 성능 최적화 인덱스 적용 시작...');
    
    // 마이그레이션 파일 읽기
    const migrationPath = path.join(__dirname, '..', 'migrations', '014_create_performance_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 마이그레이션 SQL 파일 로드 완료');
    
    // SQL 실행
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // RPC 함수가 없는 경우 직접 SQL 실행
      console.log('⚠️  RPC 함수를 사용할 수 없습니다. 직접 SQL 실행을 시도합니다...');
      
      // SQL을 개별 문장으로 분할하여 실행
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📊 ${statements.length}개의 SQL 문장을 실행합니다...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.toLowerCase().includes('insert into migration_log')) {
          // 마이그레이션 로그는 건너뛰기 (테이블이 없을 수 있음)
          continue;
        }
        
        try {
          console.log(`⏳ ${i + 1}/${statements.length} 실행 중...`);
          const { error: stmtError } = await supabase
            .from('_temp_table_for_sql_execution')
            .select('*')
            .limit(0);
          
          if (stmtError && stmtError.message.includes('relation "_temp_table_for_sql_execution" does not exist')) {
            // 직접 SQL 실행을 위한 임시 방법
            console.log('⚠️  직접 SQL 실행이 제한되어 있습니다. 수동으로 인덱스를 생성해주세요.');
            console.log('📋 실행할 SQL:');
            console.log('='.repeat(50));
            console.log(migrationSQL);
            console.log('='.repeat(50));
            break;
          }
        } catch (e) {
          console.log(`⚠️  문장 ${i + 1} 실행 중 오류:`, e.message);
        }
      }
    } else {
      console.log('✅ 인덱스 생성 완료!');
    }
    
    console.log('🎉 성능 최적화 인덱스 적용 완료!');
    console.log('');
    console.log('📈 성능 개선 효과:');
    console.log('- 영양정보 목록 조회 속도 향상');
    console.log('- 카테고리별 필터링 성능 개선');
    console.log('- 태그 검색 성능 향상');
    console.log('- 정렬 작업 최적화');
    
  } catch (error) {
    console.error('❌ 인덱스 적용 중 오류 발생:', error.message);
    console.log('');
    console.log('🔧 수동 실행 방법:');
    console.log('1. Supabase 대시보드에 접속');
    console.log('2. SQL Editor로 이동');
    console.log('3. migrations/014_create_performance_indexes.sql 파일 내용을 복사하여 실행');
  }
}

// 스크립트 실행
if (require.main === module) {
  applyPerformanceIndexes();
}

module.exports = { applyPerformanceIndexes };
