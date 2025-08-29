const { supabase } = require('./supabaseClient');

class SupabaseQnaManager {
    // Q&A 등록
    async createQna(qnaData) {
        try {
            const { data, error } = await supabase
                .from('product_qna')
                .insert([{
                    product_id: qnaData.productId,
                    user_id: qnaData.userId || null,
                    username: qnaData.username || '익명',
                    title: qnaData.title,
                    content: qnaData.content,
                    type: qnaData.type || '일반문의',
                    is_secret: qnaData.isSecret || false,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) {
                console.error('QnA 생성 오류:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('QnA 생성 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 상품별 Q&A 조회
    async getQnaByProductId(productId) {
        try {
            const { data, error } = await supabase
                .from('product_qna')
                .select(`
                    id,
                    title,
                    content,
                    type,
                    is_secret,
                    status,
                    created_at,
                    answer,
                    answered_at,
                    username
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('QnA 조회 오류:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('QnA 조회 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 특정 Q&A 조회 (권한 검증용)
    async getQnaById(qnaId) {
        try {
            const { data, error } = await supabase
                .from('product_qna')
                .select(`
                    id,
                    product_id,
                    user_id,
                    username,
                    title,
                    content,
                    type,
                    is_secret,
                    status,
                    created_at,
                    answer,
                    answered_at
                `)
                .eq('id', qnaId)
                .single();

            if (error) {
                console.error('QnA 단일 조회 오류:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('QnA 단일 조회 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Q&A 답변 등록
    async answerQna(qnaId, answer, answeredBy) {
        try {
            const { data, error } = await supabase
                .from('product_qna')
                .update({
                    answer: answer,
                    answered_at: new Date().toISOString(),
                    answered_by: answeredBy,
                    status: 'answered'
                })
                .eq('id', qnaId)
                .select()
                .single();

            if (error) {
                console.error('QnA 답변 오류:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('QnA 답변 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = SupabaseQnaManager;