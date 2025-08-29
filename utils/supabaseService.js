const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 서비스
class SupabaseService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        console.log('SupabaseService 초기화됨 - 실제 Supabase 연결');
    }

    // 제품 목록 조회
    async getProducts() {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            console.log(`Supabase에서 ${data.length}개 제품 조회 완료`);
            return data;
        } catch (error) {
            console.error('제품 조회 실패:', error);
            throw error;
        }
    }

    // 제품 추가
    async createProduct(productData) {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .insert([productData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('새 제품 생성 완료:', data);
            return data;
        } catch (error) {
            console.error('제품 생성 실패:', error);
            throw error;
        }
    }

    // 제품 업데이트
    async updateProduct(productId, productData) {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('제품 업데이트 완료:', data);
            return data;
        } catch (error) {
            console.error('제품 업데이트 실패:', error);
            throw error;
        }
    }

    // 제품 삭제
    async deleteProduct(productId) {
        try {
            const { error } = await this.supabase
                .from('products')
                .delete()
                .eq('id', productId);

            if (error) {
                throw error;
            }

            console.log('제품 삭제 완료:', productId);
            return { success: true };
        } catch (error) {
            console.error('제품 삭제 실패:', error);
            throw error;
        }
    }

    // 상품 문의 목록 조회
    async getProductInquiries() {
        try {
            const { data: inquiries, error } = await this.supabase
                .from('product_qna')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('product_qna 테이블이 존재하지 않습니다. 빈 배열을 반환합니다.');
                    return [];
                }
                console.error('상품 문의 조회 중 오류:', error);
                throw error;
            }

            if (!inquiries) {
                return [];
            }

            const formattedDataPromises = inquiries.map(async (item) => {
                let productName = '알 수 없는 상품';
                if (item.product_id) {
                    const { data: product } = await this.supabase
                        .from('products')
                        .select('name')
                        .eq('id', item.product_id)
                        .single();
                    if (product) {
                        productName = product.name;
                    }
                }

                return {
                    id: item.id,
                    productId: item.product_id,
                    productName: productName,
                    userId: item.user_id,
                    userName: item.username || '익명',
                    title: item.title,
                    question: item.content,
                    answer: item.answer || '',
                    status: item.status || 'pending',
                    isSecret: item.is_secret,
                    createdAt: item.created_at,
                    answeredAt: item.answered_at,
                    answeredBy: item.answered_by
                };
            });

            const formattedData = await Promise.all(formattedDataPromises);
            console.log(`Supabase에서 ${formattedData.length}개 상품 문의 조회 완료`);
            return formattedData;
        } catch (error) {
            console.error('상품 문의 조회 실패:', error);
            throw error;
        }
    }

    // 상품 문의 답변 업데이트
    async updateProductInquiry(inquiryId, updateData) {
        try {
            const { data, error } = await this.supabase
                .from('product_qna')
                .update({
                    answer: updateData.answer,
                    status: updateData.status,
                    answered_at: new Date().toISOString(),
                    answered_by: updateData.adminId
                })
                .eq('id', inquiryId)
                .select('*')
                .single();

            if (error) {
                throw error;
            }

            let productName = '알 수 없는 상품';
            if (data.product_id) {
                const { data: product } = await this.supabase
                    .from('products')
                    .select('name')
                    .eq('id', data.product_id)
                    .single();
                if (product) {
                    productName = product.name;
                }
            }

            const formattedData = {
                id: data.id,
                productId: data.product_id,
                productName: productName,
                userId: data.user_id,
                userName: data.username || '익명',
                title: data.title,
                question: data.content,
                answer: data.answer || '',
                status: data.status,
                isSecret: data.is_secret,
                createdAt: data.created_at,
                answeredAt: data.answered_at,
                answeredBy: data.answered_by
            };

            console.log('상품 문의 답변 업데이트 완료:', formattedData);
            return formattedData;
        } catch (error) {
            console.error('상품 문의 업데이트 실패:', error);
            throw error;
        }
    }

    // 특정 상품의 문의 조회
    async getProductInquiriesByProductId(productId) {
        try {
            const { data: inquiries, error } = await this.supabase
                .from('product_qna')
                .select('* ')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            if (!inquiries) {
                return [];
            }

            const formattedDataPromises = inquiries.map(async (item) => {
                let productName = '알 수 없는 상품';
                if (item.product_id) {
                    const { data: product } = await this.supabase
                        .from('products')
                        .select('name')
                        .eq('id', item.product_id)
                        .single();
                    if (product) {
                        productName = product.name;
                    }
                }

                return {
                    id: item.id,
                    productId: item.product_id,
                    productName: productName,
                    userId: item.user_id,
                    userName: item.username || '익명',
                    title: item.title,
                    question: item.content,
                    answer: item.answer || '',
                    status: item.status || 'pending',
                    isSecret: item.is_secret,
                    createdAt: item.created_at,
                    answeredAt: item.answered_at,
                    answeredBy: item.answered_by
                };
            });

            const formattedData = await Promise.all(formattedDataPromises);
            return formattedData;
        } catch (error) {
            console.error('특정 상품 문의 조회 실패:', error);
            throw error;
        }
    }
}

module.exports = new SupabaseService();