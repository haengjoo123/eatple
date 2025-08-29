const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabaseClient');

// 관리자 권한 확인 미들웨어
const requireAdmin = async (req, res, next) => {
  try {
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/auth/me`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });
    const data = await response.json();
    
    if (!data.loggedIn || !data.user || data.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    req.user = data.user;
    next();
  } catch (error) {
    console.error('권한 확인 오류:', error);
    return res.status(500).json({ success: false, message: '권한 확인 중 오류가 발생했습니다.' });
  }
};

// 모든 프로모션 조회 (관리자용)
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { data: promotions, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      promotions: promotions || []
    });
  } catch (error) {
    console.error('프로모션 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 조회 중 오류가 발생했습니다.'
    });
  }
});

// 활성 프로모션 조회 (스토어용)
router.get('/active', async (req, res) => {
  try {
    const now = new Date().toISOString();
    
    const { data: promotions, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('display_order', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      promotions: promotions || []
    });
  } catch (error) {
    console.error('활성 프로모션 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 조회 중 오류가 발생했습니다.'
    });
  }
});

// 프로모션 생성
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      badge,
      tag,
      theme,
      image_url,
      icons,
      display_order,
      is_active,
      start_date,
      end_date
    } = req.body;

    // 필수 필드 검증
    if (!title || !theme) {
      return res.status(400).json({
        success: false,
        message: '제목과 테마는 필수 입력 항목입니다.'
      });
    }

    const { data: promotion, error } = await supabaseAdmin
      .from('promotions')
      .insert([{
        title,
        subtitle: subtitle || null,
        description: description || null,
        badge: badge || null,
        tag: tag || null,
        theme,
        image_url: image_url || null,
        icons: icons || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        start_date: start_date || null,
        end_date: end_date || null
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: '프로모션이 성공적으로 생성되었습니다.',
      promotion
    });
  } catch (error) {
    console.error('프로모션 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 생성 중 오류가 발생했습니다.'
    });
  }
});

// 프로모션 수정
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      description,
      badge,
      tag,
      theme,
      image_url,
      icons,
      display_order,
      is_active,
      start_date,
      end_date
    } = req.body;

    // 필수 필드 검증
    if (!title || !theme) {
      return res.status(400).json({
        success: false,
        message: '제목과 테마는 필수 입력 항목입니다.'
      });
    }

    const { data: promotion, error } = await supabaseAdmin
      .from('promotions')
      .update({
        title,
        subtitle: subtitle || null,
        description: description || null,
        badge: badge || null,
        tag: tag || null,
        theme,
        image_url: image_url || null,
        icons: icons || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        start_date: start_date || null,
        end_date: end_date || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: '해당 프로모션을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: '프로모션이 성공적으로 수정되었습니다.',
      promotion
    });
  } catch (error) {
    console.error('프로모션 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 수정 중 오류가 발생했습니다.'
    });
  }
});

// 프로모션 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: promotion, error } = await supabaseAdmin
      .from('promotions')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: '해당 프로모션을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: '프로모션이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('프로모션 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 프로모션 순서 변경
router.put('/:id/order', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_order } = req.body;

    if (display_order === undefined || display_order < 0) {
      return res.status(400).json({
        success: false,
        message: '유효한 순서 값을 입력해주세요.'
      });
    }

    const { data: promotion, error } = await supabaseAdmin
      .from('promotions')
      .update({
        display_order,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: '해당 프로모션을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: '프로모션 순서가 변경되었습니다.',
      promotion
    });
  } catch (error) {
    console.error('프로모션 순서 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 순서 변경 중 오류가 발생했습니다.'
    });
  }
});

// 프로모션 활성화/비활성화 토글
router.put('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 먼저 현재 상태를 확인
    const { data: currentPromotion, error: fetchError } = await supabaseAdmin
      .from('promotions')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: '해당 프로모션을 찾을 수 없습니다.'
        });
      }
      throw fetchError;
    }

    // 상태를 토글
    const { data: promotion, error } = await supabaseAdmin
      .from('promotions')
      .update({
        is_active: !currentPromotion.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const status = promotion.is_active ? '활성화' : '비활성화';
    
    res.json({
      success: true,
      message: `프로모션이 ${status}되었습니다.`,
      promotion
    });
  } catch (error) {
    console.error('프로모션 토글 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로모션 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
