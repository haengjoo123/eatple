const { supabaseAdmin } = require('../utils/supabaseClient');

async function createPromotionsTable() {
  try {
    console.log('프로모션 테이블 생성 시작...');

    // 테이블 생성 SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        subtitle VARCHAR(200),
        description TEXT,
        badge VARCHAR(20),
        tag VARCHAR(100),
        theme VARCHAR(50) NOT NULL DEFAULT 'default-theme',
        image_url TEXT,
        icons JSONB,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 인덱스 생성 SQL
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
      CREATE INDEX IF NOT EXISTS idx_promotions_display_order ON promotions(display_order);
      CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
    `;

    // 테이블 생성
    const { error: tableError } = await supabaseAdmin.rpc('exec_sql', { sql: createTableSQL });
    if (tableError) {
      console.error('테이블 생성 오류:', tableError);
      return;
    }

    // 인덱스 생성
    const { error: indexError } = await supabaseAdmin.rpc('exec_sql', { sql: createIndexesSQL });
    if (indexError) {
      console.error('인덱스 생성 오류:', indexError);
      return;
    }

    console.log('프로모션 테이블 생성 완료');

    // 기본 데이터 삽입
    console.log('기본 프로모션 데이터 삽입 시작...');

    const defaultPromotions = [
      {
        title: '생수',
        subtitle: '최저가 도전',
        description: '15% 쿠폰 받고, 어디든 갑니다',
        badge: '15%',
        theme: 'water-theme',
        image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
        display_order: 1
      },
      {
        title: 'Bottle to Bottle',
        subtitle: '난 다시 태어나도, 나로 태어날래',
        description: '원더플 캠페인 시즌 6',
        tag: '플라스틱 순환 캠페인',
        theme: 'bottle-theme',
        icons: ['🥤', '📦', '🏠', '⭐'],
        display_order: 2
      },
      {
        title: '여행 빅세일',
        subtitle: '쿨 바캉스 타임',
        description: '항공/호텔/패키지/렌터카 ~10%',
        theme: 'travel-theme',
        image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
        display_order: 3
      },
      {
        title: '건강식품',
        subtitle: '자연의 힘',
        description: '유기농 건강식품 20% 할인',
        badge: '20%',
        theme: 'food-theme',
        image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&h=200&fit=crop',
        display_order: 4
      },
      {
        title: '뷰티 케어',
        subtitle: '아름다움의 시작',
        description: '프리미엄 뷰티 제품 25% 할인',
        tag: '뷰티 트렌드',
        theme: 'beauty-theme',
        icons: ['✨', '💄', '🌸', '💎'],
        display_order: 5
      },
      {
        title: '피트니스',
        subtitle: '강한 몸, 건강한 삶',
        description: '운동용품 및 보조제 30% 할인',
        theme: 'fitness-theme',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
        display_order: 6
      },
      {
        title: '비타민',
        subtitle: '필수 영양소',
        description: '종합비타민 18% 할인',
        badge: '18%',
        theme: 'vitamin-theme',
        image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop',
        display_order: 7
      },
      {
        title: '영양제',
        subtitle: '건강한 선택',
        description: '프리미엄 영양제 22% 할인',
        tag: '건강 관리',
        theme: 'supplement-theme',
        icons: ['💊', '🌿', '💪', '⭐'],
        display_order: 8
      }
    ];

    // 기존 데이터 확인
    const { data: existingPromotions, error: checkError } = await supabaseAdmin
      .from('promotions')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('기존 데이터 확인 오류:', checkError);
      return;
    }

    // 기존 데이터가 없으면 삽입
    if (!existingPromotions || existingPromotions.length === 0) {
      console.log('삽입할 데이터:', JSON.stringify(defaultPromotions, null, 2));
      
      const { data, error: insertError } = await supabaseAdmin
        .from('promotions')
        .insert(defaultPromotions)
        .select();

      if (insertError) {
        console.error('기본 데이터 삽입 오류:', insertError);
        console.error('오류 상세:', JSON.stringify(insertError, null, 2));
        return;
      }

      console.log('삽입된 데이터:', data);
      console.log('기본 프로모션 데이터 삽입 완료');
    } else {
      console.log('기존 프로모션 데이터가 존재하여 기본 데이터 삽입을 건너뜁니다.');
    }

    console.log('프로모션 테이블 설정 완료!');

  } catch (error) {
    console.error('프로모션 테이블 생성 중 오류 발생:', error);
    console.error('오류 상세:', JSON.stringify(error, null, 2));
  }
}

// 스크립트 실행
createPromotionsTable();
