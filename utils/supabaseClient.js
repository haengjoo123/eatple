const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase 클라이언트 설정
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || !supabaseServiceRoleKey) {
    throw new Error('Supabase URL, API 키, 서비스 역할 키가 모두 환경 변수에 설정되어 있어야 합니다.');
}

// 일반 클라이언트 (anon key 사용)
const supabase = createClient(supabaseUrl, supabaseKey);

// 서비스 역할 클라이언트 (관리자 작업용)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = {
    supabase,
    supabaseAdmin
};