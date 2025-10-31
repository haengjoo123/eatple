const express = require("express");
const router = express.Router();
const axios = require("axios");

// 서비스 이용 횟수 추적 모듈
const {
  incrementServiceUsage,
  SERVICE_TYPES,
} = require("../utils/serviceUsageTracker");

// 카카오 REST API 키
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "test_key";

// Gemini API 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Google Places API 설정
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Gemini API 호출 함수 (Google Search 도구 포함)
async function callGeminiAPI(prompt) {
  try {
    console.log("🤖 Gemini API 호출 시작...");

    // API 키 확인
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
      console.error("❌ Gemini API 키가 설정되지 않았습니다.");
      throw new Error("Gemini API 키가 설정되지 않았습니다.");
    }

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        // Google Search 도구 제거 - 직접 API로 데이터 수집
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 200000, // 타임아웃 단축 (Google Search 불필요)
      }
    );

    console.log("✅ Gemini API 응답 수신");
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(
      "❌ Gemini API 호출 오류:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

// AI 추천 시스템 (Google Search API 활용)
async function recommendRestaurantWithAI(
  restaurants,
  userProfile,
  requirements
) {
  if (!restaurants || restaurants.length === 0) {
    return { error: "추천할 식당이 없습니다." };
  }

  try {
    // 사용자 프로필 정보 정리
    const profileInfo = {
      age: userProfile.age,
      gender: userProfile.gender,
      activity_level: userProfile.activity_level,
      allergies: userProfile.allergies || [],
      healthStatus: userProfile.healthStatus || [],
      budget: userProfile.budget,
      preferences: userProfile.preferences || [],
    };

    // 식당 데이터 정리 (이미 수집된 실시간 정보 포함)
    const restaurantData = restaurants.map((restaurant) => ({
      name: restaurant.place_name || restaurant.name,
      address: restaurant.address_name || restaurant.address,
      category: restaurant.category_name || restaurant.category,
      phone: restaurant.phone || "정보 없음",
      distance: restaurant.distance_m || restaurant.distance || "0",
      googleRating: restaurant.googleRating || null,
      reviewCount: restaurant.reviewCount || 0,
      openHour: restaurant.openHour || "정보 없음",
      googleOpeningHours: restaurant.googleOpeningHours || [],
      isOpenNow: restaurant.isOpenNow !== null ? restaurant.isOpenNow : "정보 없음",
    }));

    // AI 프롬프트 생성 (순수 추천 분석)
    const prompt = `
다음은 사용자의 프로필 정보와 주변 식당 목록입니다. 
사용자의 건강 상태, 알레르기, 예산, 선호도를 종합적으로 고려하여 가장 적합한 식당 3개를 추천해주세요.

사용자 프로필:
${JSON.stringify(profileInfo, null, 2)}

요구사항:
${JSON.stringify(requirements, null, 2)}

주변 식당 목록 (실시간 정보 포함):
${JSON.stringify(restaurantData, null, 2)}

위의 식당 목록에는 이미 다음 정보가 포함되어 있습니다:
- 구글 리뷰 평점 (googleRating)
- 리뷰 수 (reviewCount)  
- 기본 영업시간 (openHour) - 카카오 API에서 제공
- 상세 영업시간 (googleOpeningHours) - Google Places API에서 제공하는 요일별 영업시간
- 현재 영업 중 여부 (isOpenNow) - Google Places API에서 제공
- 전화번호 (phone)
- 거리 정보 (distance)

이 정보들을 바탕으로 사용자에게 가장 적합한 식당 3개를 추천해주세요.
추가적인 메뉴 정보나 가격 정보는 일반적인 지식을 바탕으로 추정해서 제공해주세요.

반드시 다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.
CRITICAL: 모든 reason 필드는 문장이 아닌 한글 키워드 해시태그로만 작성하세요. 각 태그는 #로 시작하고 공백으로 구분합니다. 예: "#적당한 거리 #24시 운영 #콩나물국밥 #현재영업"

{
  "reason": "전체적인 추천 이유를 해시태그로 표시 (예: #개인화 #가까운 거리 #영업중)",
  "recommendations": [
    {
      "name": "식당명",
      "address": "주소",
      "category": "카테고리",
      "googleRating": "이미 제공된 구글 평점 사용 (예: 4.5, 정보 없으면 null)",
      "distance": "거리",
      "phone": "전화번호(정보 없으면 '정보 없음')",
      "openHour": "영업시간(Google Places API의 상세 영업시간 정보 우선 활용, 없으면 기본 정보 사용)",
      "reason": "이 식당을 추천하는 이유를 해시태그로만 표시 (예: #적당한 거리 #24시 운영 #콩나물국밥 #현재영업)",
      "recommendedMenus": [
        {"name": "추천 메뉴1", "price": "가격1"},
        {"name": "추천 메뉴2", "price": "가격2"}
      ],
      "healthConsiderations": "건강상 고려사항",
      "score": 85
    }
  ]
}

추천 기준:
1. 사용자의 알레르기 정보를 고려하여 안전한 식당 우선
2. 건강 상태에 맞는 메뉴가 있는 식당
3. 예산 범위 내의 식당
4. 거리와 접근성 (가까운 거리 우선)
5. 구글 리뷰 평점이 높은 식당 우선
6. 현재 영업 중이거나 영업시간이 적절한 식당 우선 (isOpenNow 정보 활용)
7. 사용자 선호도와 식당 카테고리 매칭

각 추천에 대해 구체적인 이유와 해당 카테고리의 일반적인 추천 메뉴를 포함해주세요.
메뉴 가격은 해당 지역과 카테고리의 일반적인 가격대로 추정해서 제공해주세요.


CRITICAL: 응답에는 오직 JSON만 포함해야 합니다.
답변을 시작할 때 "알겠습니다", "네", "좋습니다" 등의 한국어 텍스트나 다른 설명은 절대 포함하지 마세요.
응답은 반드시 { 로 시작하고 } 로 끝나야 합니다.

RESPONSE FORMAT: JSON ONLY
{
  "reason": "전체적인 추천 이유를 해시태그로 표시 (예: #개인화 #가까운 거리 #영업중)",
  "recommendations": [...]
}
`;

    // Gemini API 호출
    console.log("🤖 AI 추천 분석 시작...");
    const aiResponse = await callGeminiAPI(prompt);
    console.log("📝 AI 응답 수신, JSON 파싱 시작...");

    // JSON 파싱
    try {
      console.log("AI 응답 원문:", aiResponse);

      // googleRating 정보 확인을 위한 로깅
      if (aiResponse.includes("googleRating")) {
        console.log("✅ AI 응답에 googleRating 정보 포함됨");
      } else {
        console.log("❌ AI 응답에 googleRating 정보 없음");
      }

      // AI 응답에서 JSON 부분 추출
      let jsonText = aiResponse;

      // 한국어 텍스트 제거 (AI가 실수로 포함한 경우)
      jsonText = jsonText.replace(/^[^{]*/, ""); // { 이전의 모든 텍스트 제거
      jsonText = jsonText.replace(/[^}]*$/, ""); // } 이후의 모든 텍스트 제거

      // 마크다운 코드 블록 제거
      if (jsonText.includes("```json")) {
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
          console.log("마크다운 코드 블록에서 JSON 추출됨");
        }
      } else if (jsonText.includes("```")) {
        const jsonMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
          console.log("일반 코드 블록에서 JSON 추출됨");
        }
      }

      // JSON 객체 찾기
      const jsonStart = jsonText.indexOf("{");
      const jsonEnd = jsonText.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        console.log("JSON 객체 범위 추출됨");
      }

      console.log("추출된 JSON 텍스트:", jsonText);

      // JSON 파싱 시도
      let parsedRecommendation = null;
      try {
        parsedRecommendation = JSON.parse(jsonText);
        console.log("✅ AI 추천 JSON 파싱 성공");
      } catch (parseError) {
        console.log("❌ JSON 파싱 실패:", parseError.message);

        // 대안: 더 유연한 파싱 시도
        try {
          // 불필요한 문자 제거 후 다시 시도
          const cleanedJson = jsonText
            .replace(/[\n\r\t]/g, " ")
            .replace(/,(\s*[}\]])/g, "$1") // trailing comma 제거
            .replace(/([^\\])"/g, '$1"') // 이스케이프되지 않은 따옴표 처리
            .replace(/,\s*}/g, "}") // 마지막 쉼표 제거
            .replace(/,\s*]/g, "]"); // 마지막 쉼표 제거

          parsedRecommendation = JSON.parse(cleanedJson);
          console.log("✅ 정리된 JSON 파싱 성공");
        } catch (secondError) {
          console.log("❌ 정리된 JSON 파싱도 실패:", secondError.message);

          // 마지막 시도: 더 강력한 정리
          try {
            const finalCleanedJson = jsonText
              .replace(/[^\x20-\x7E]/g, "") // ASCII가 아닌 문자 제거
              .replace(/\s+/g, " ") // 연속된 공백을 하나로
              .replace(/,\s*([}\]])/g, "$1") // trailing comma 제거
              .replace(/,\s*}/g, "}") // 마지막 쉼표 제거
              .replace(/,\s*]/g, "]"); // 마지막 쉼표 제거

            parsedRecommendation = JSON.parse(finalCleanedJson);
            console.log("✅ 최종 정리된 JSON 파싱 성공");
          } catch (finalError) {
            console.log("❌ 최종 JSON 파싱도 실패:", finalError.message);
            throw new Error("JSON 파싱 실패 - 모든 시도 실패");
          }
        }
      }

      if (parsedRecommendation) {
        // AI 응답의 추천 결과를 원본 데이터와 연결
        const enhancedRecommendations = (
          parsedRecommendation.recommendations || []
        ).map((aiRecommendation) => {
          // 원본 데이터에서 해당 식당 찾기
          const originalRestaurant = restaurants.find(
            (r) =>
              r.place_name === aiRecommendation.name ||
              r.place_name.includes(aiRecommendation.name) ||
              aiRecommendation.name.includes(r.place_name)
          );

          if (originalRestaurant) {
            return {
              ...originalRestaurant,
              name: aiRecommendation.name,
              address:
                aiRecommendation.address || originalRestaurant.address_name,
              category:
                aiRecommendation.category || originalRestaurant.category_name,
              googleRating: aiRecommendation.googleRating || "정보 없음",
              distance:
                aiRecommendation.distance || originalRestaurant.distance_km,
              phone:
                aiRecommendation.phone ||
                originalRestaurant.phone ||
                "정보 없음",
              openHour:
                aiRecommendation.openHour ||
                originalRestaurant.openHour ||
                "정보 없음",
              reason: aiRecommendation.reason,
              recommendedMenus: aiRecommendation.recommendedMenus || [],
              healthConsiderations: aiRecommendation.healthConsiderations,
              score: aiRecommendation.score || 0,
            };
          }

          return aiRecommendation;
        });

        return {
          success: true,
          recommendations: enhancedRecommendations,
          reason: parsedRecommendation.reason || "AI 추천",
          totalRestaurants: restaurants.length,
        };
      } else {
        throw new Error("JSON 파싱 실패 - 모든 패턴 시도 실패");
      }
    } catch (parseError) {
      console.error("❌ AI 응답 파싱 오류:", parseError);
      console.log("🔄 기본 추천으로 폴백...");
      // 기본 추천으로 폴백
      return recommendRestaurant(restaurants, userProfile, requirements);
    }
  } catch (error) {
    console.error("AI 추천 오류:", error);
    // AI 실패 시 기본 추천으로 폴백
    return recommendRestaurant(restaurants, userProfile, requirements);
  }
}

// Google Places API로 리뷰 정보 및 영업시간 가져오기
async function getGoogleRating(restaurantName, lat, lng) {
  if (
    !GOOGLE_PLACES_API_KEY ||
    GOOGLE_PLACES_API_KEY === "your_google_places_api_key_here"
  ) {
    console.log("Google Places API 키가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 1단계: Place Search로 place_id 찾기
    const searchResponse = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: `${restaurantName} 근처 ${lat},${lng}`,
          location: `${lat},${lng}`,
          radius: 1000,
          key: GOOGLE_PLACES_API_KEY,
          language: "ko",
        },
      }
    );

    if (searchResponse.data.results && searchResponse.data.results.length > 0) {
      const place = searchResponse.data.results[0];

      // 2단계: Place Details로 상세 정보 가져오기 (영업시간 정보 포함)
      const detailsResponse = await axios.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
          params: {
            place_id: place.place_id,
            fields: "rating,user_ratings_total,reviews,opening_hours,current_opening_hours,formatted_phone_number,international_phone_number",
            key: GOOGLE_PLACES_API_KEY,
            language: "ko",
          },
        }
      );

      if (detailsResponse.data.result) {
        const result = detailsResponse.data.result;
        
        // 영업시간 정보 처리
        let openingHours = null;
        let isOpenNow = null;
        
        if (result.opening_hours) {
          openingHours = result.opening_hours.weekday_text || [];
          isOpenNow = result.opening_hours.open_now || null;
        } else if (result.current_opening_hours) {
          openingHours = result.current_opening_hours.weekday_text || [];
          isOpenNow = result.current_opening_hours.open_now || null;
        }
        
        return {
          rating: result.rating || null,
          reviewCount: result.user_ratings_total || 0,
          reviews: result.reviews || [],
          openingHours: openingHours,
          isOpenNow: isOpenNow,
          phoneNumber: result.formatted_phone_number || result.international_phone_number || null,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Google Places API 오류 (${restaurantName}):`, error.message);
    return null;
  }
}

// 위치 기반 식당 검색 (실제 카카오 API 사용)
async function searchNearbyRestaurants(lat, lng, radius = 1000) {
  try {
    console.log(`카카오 API 호출: ${lat}, ${lng}, 반경 ${radius}m`);

    // 카카오 REST API 키 확인
    if (!KAKAO_REST_API_KEY || KAKAO_REST_API_KEY === "test_key") {
      console.error("카카오 REST API 키가 설정되지 않았습니다.");
      throw new Error(
        "카카오 REST API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요."
      );
    }

    // 카카오 API는 한 번에 최대 15개만 반환하므로 여러 번 호출
    const allRestaurants = [];
    const maxPages = 4; // 최대 4페이지 (15개씩 = 60개)

    for (let page = 1; page <= maxPages; page++) {
      try {
        console.log(`카카오 API 호출 (페이지 ${page}/${maxPages})`);

        const response = await axios.get(
          "https://dapi.kakao.com/v2/local/search/category.json",
          {
            headers: {
              Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
              KA: `sdk/1.0.0 os/javascript origin/${process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || 'https://eatple.net') : 'http://localhost:3000'}`,
            },
            params: {
              category_group_code: "FD6", // 음식점 카테고리
              x: lng,
              y: lat,
              radius: radius,
              sort: "accuracy",
              size: 15, // 최대 15개 (API 제한)
              page: page,
            },
          }
        );

        if (response.data && response.data.documents) {
          console.log(
            `페이지 ${page}: ${response.data.documents.length}개 식당 발견`
          );
          allRestaurants.push(...response.data.documents);

          // 마지막 페이지이거나 더 이상 결과가 없으면 중단
          if (response.data.documents.length < 15) {
            break;
          }
        } else {
          console.log(`페이지 ${page}: 결과 없음`);
          break;
        }

        // API 호출 간격 조절 (서버 부하 방지)
        if (page < maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(
          `페이지 ${page} API 호출 오류:`,
          error.response ? error.response.data : error.message
        );
        break;
      }
    }

    if (allRestaurants.length > 0) {
      console.log(`총 ${allRestaurants.length}개 식당 발견`);

      // 중복 제거 (ID 기준)
      const uniqueRestaurants = allRestaurants.filter(
        (restaurant, index, self) =>
          index === self.findIndex((r) => r.id === restaurant.id)
      );

      console.log(`중복 제거 후 ${uniqueRestaurants.length}개 식당`);

      // 각 식당에 대해 추가 정보 수집
      const restaurantsWithDetails = await Promise.all(
        uniqueRestaurants.map(async (place) => {
          try {
            // 개별 식당 상세 정보 가져오기
            const detailResponse = await axios.get(
              "https://dapi.kakao.com/v2/local/search/keyword.json",
              {
                headers: {
                  Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
                  KA: `sdk/1.0.0 os/javascript origin/${process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || 'https://eatple.net') : 'http://localhost:3000'}`,
                },
                params: {
                  query: place.place_name,
                  x: lng,
                  y: lat,
                  radius: 1000,
                  size: 1,
                },
              }
            );

            let additionalInfo = {};
            if (
              detailResponse.data &&
              detailResponse.data.documents.length > 0
            ) {
              const detail = detailResponse.data.documents[0];
              additionalInfo = {
                phone: detail.phone || place.phone,
                road_address_name: detail.road_address_name,
                place_url: detail.place_url,
                category_group_name: detail.category_group_name,
                open_hour: detail.business_hours || detail.open_hour || "", // 영업시간 정보 추출 시도
              };
            }

            // Google Places API로 리뷰 정보 및 영업시간 가져오기
            const googleInfo = await getGoogleRating(
              place.place_name,
              lat,
              lng
            );
            if (googleInfo) {
              additionalInfo.googleRating = googleInfo.rating;
              additionalInfo.reviewCount = googleInfo.reviewCount;
              additionalInfo.googleOpeningHours = googleInfo.openingHours;
              additionalInfo.isOpenNow = googleInfo.isOpenNow;
              additionalInfo.googlePhoneNumber = googleInfo.phoneNumber;
            }

            return {
              id: place.id,
              place_name: place.place_name,
              address_name: place.address_name,
              category_name: place.category_name,
              distance:
                place.distance && place.distance !== "0"
                  ? place.distance
                  : null,
              x: place.x,
              y: place.y,
              phone: additionalInfo.googlePhoneNumber || additionalInfo.phone || place.phone,
              road_address_name: additionalInfo.road_address_name,
              place_url: additionalInfo.place_url,
              category_group_name: additionalInfo.category_group_name,
              openHour: additionalInfo.open_hour || "", // 카카오 API에서 가져온 영업시간 (기본값)
              googleRating: additionalInfo.googleRating || null, // Google Places API에서 가져온 평점
              reviewCount: additionalInfo.reviewCount || 0, // Google Places API에서 가져온 리뷰 수
              googleOpeningHours: additionalInfo.googleOpeningHours || [], // Google Places API에서 가져온 상세 영업시간
              isOpenNow: additionalInfo.isOpenNow || null, // 현재 영업 중 여부
              // 거리 정보는 원본 미터 단위 그대로 사용 (null 처리)
              distance_m:
                place.distance && place.distance !== "0"
                  ? place.distance
                  : null,
            };
          } catch (error) {
            console.error(
              `식당 상세정보 조회 실패: ${place.place_name}`,
              error.message
            );
            return {
              id: place.id,
              place_name: place.place_name,
              address_name: place.address_name,
              category_name: place.category_name,
              distance: place.distance,
              x: place.x,
              y: place.y,
              phone: place.phone,
              openHour: "", // 기본값
              googleRating: null, // 상세정보 조회 실패 시 null
              reviewCount: 0,
              googleOpeningHours: [], // 기본값
              isOpenNow: null, // 기본값
              distance_m: place.distance,
            };
          }
        })
      );

      // 거리순으로 정렬
      restaurantsWithDetails.sort(
        (a, b) => parseInt(a.distance) - parseInt(b.distance)
      );

      return restaurantsWithDetails;
    } else {
      console.log("카카오 API 응답에 데이터가 없습니다.");
      return [];
    }
  } catch (error) {
    console.error(
      "카카오 API 호출 오류:",
      error.response ? error.response.data : error.message
    );
    return [];
  }
}

// AI 추천 시스템 (간단한 규칙 기반)
function recommendRestaurant(restaurants, userProfile, requirements) {
  if (!restaurants || restaurants.length === 0) {
    return { error: "추천할 식당이 없습니다." };
  }

  let recommendations = restaurants.map((restaurant) => {
    let score = 0;

    // 구글 리뷰 평점 기반 점수 (가중치 조정 - 다른 요소와 균형)
    const googleRating = parseFloat(restaurant.googleRating) || 0;
    if (googleRating > 0) {
      score += googleRating * 5; // 기존 10에서 5로 줄임
    }

    // 리뷰 수 기반 점수 (로그 스케일 사용 - 과도한 영향 완화)
    const reviewCount = parseInt(restaurant.reviewCount) || 0;
    if (googleRating > 0) {
      score += Math.log(reviewCount + 1) * 3; // 로그 스케일로 리뷰 수 영향 완화
    }

    // 거리 기반 점수 (단계별 점수 - 도보 5~10분 거리까지는 큰 차이 없음)
    const distance = restaurant.distance ? parseInt(restaurant.distance) : 1000; // 거리 정보가 없으면 기본값 1000m
    if (distance < 400) {
      score += 20; // 5분 이내 도보 거리
    } else if (distance < 700) {
      score += 10; // 5~10분 도보 거리
    } else if (distance < 1000) {
      score += 5; // 10~15분 도보 거리
    }
    // 1km 이상은 추가 점수 없음

    // 영업시간 기반 점수 (Google Places API 정보 우선 활용)
    if (restaurant.isOpenNow === true) {
      score += 15; // 현재 영업 중인 식당에 보너스 점수
    } else if (restaurant.isOpenNow === false) {
      score -= 10; // 현재 영업하지 않는 식당에 페널티
    }
    
    // 상세 영업시간 정보가 있으면 추가 점수
    if (restaurant.googleOpeningHours && restaurant.googleOpeningHours.length > 0) {
      score += 5; // 상세 영업시간 정보가 있는 식당에 소폭 보너스
    }

    // 사용자 프로필 기반 필터링
    if (userProfile.allergies && userProfile.allergies.length > 0) {
      const hasAllergen =
        restaurant.menus &&
        restaurant.menus.some((menu) =>
          userProfile.allergies.some(
            (allergy) =>
              (menu.name &&
                menu.name.toLowerCase().includes(allergy.toLowerCase())) ||
              (menu.desc &&
                menu.desc.toLowerCase().includes(allergy.toLowerCase()))
          )
        );
      if (hasAllergen) score -= 50;
    }

    // 예산 기반 필터링 (가격 정보가 있는 메뉴만 계산)
    if (userProfile.budget && restaurant.menus && restaurant.menus.length > 0) {
      // 가격 정보가 있는 메뉴만 필터링
      const validMenus = restaurant.menus.filter((menu) => {
        const price = parseInt((menu.price || "0").replace(/[^\d]/g, "")) || 0;
        return price > 0; // 0원이 아닌 메뉴만 포함
      });

      if (validMenus.length > 0) {
        const avgPrice =
          validMenus.reduce((sum, menu) => {
            const price =
              parseInt((menu.price || "0").replace(/[^\d]/g, "")) || 0;
            return sum + price;
          }, 0) / validMenus.length;

        if (avgPrice > userProfile.budget) score -= 30;
      }
      // 가격 정보가 있는 메뉴가 없으면 예산 필터링 건너뛰기
    }

    // 요구사항 기반 필터링
    if (
      requirements &&
      requirements.foodCategory &&
      requirements.foodCategory !== "무관"
    ) {
      const categoryMatch =
        restaurant.category_name &&
        restaurant.category_name
          .toLowerCase()
          .includes(requirements.foodCategory.toLowerCase());
      if (categoryMatch) score += 20;
    }

    // 선호도 기반 필터링
    if (userProfile.preferences && userProfile.preferences.length > 0) {
      const hasPreference = userProfile.preferences.some(
        (pref) =>
          (restaurant.category_name &&
            restaurant.category_name
              .toLowerCase()
              .includes(pref.toLowerCase())) ||
          (restaurant.menus &&
            restaurant.menus.some(
              (menu) =>
                menu.name &&
                menu.name.toLowerCase().includes(pref.toLowerCase())
            ))
      );
      if (hasPreference) score += 20;
    }

    return { ...restaurant, score };
  });

  // 점수 순으로 정렬
  recommendations.sort((a, b) => b.score - a.score);

  // 상위 3개 추천
  const topRecommendations = recommendations.slice(0, 3);

  return {
    recommendations: topRecommendations,
    totalRestaurants: restaurants.length,
    userProfile,
    requirements,
  };
}

// 위치 기반 식당 검색 API
router.post("/search", async (req, res) => {
  try {
    const { latitude, longitude, radius = 1000 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "위도와 경도가 필요합니다." });
    }

    console.log(`위치 기반 검색: ${latitude}, ${longitude}, 반경 ${radius}m`);

    // 1. 위치 기반 식당 검색
    const nearbyRestaurants = await searchNearbyRestaurants(
      latitude,
      longitude,
      radius
    );

    res.json({
      success: true,
      restaurants: nearbyRestaurants,
      count: nearbyRestaurants.length,
    });
  } catch (error) {
    console.error("위치 기반 검색 오류:", error);
    res.status(500).json({ error: "검색 중 오류가 발생했습니다." });
  }
});

// AI 추천 API
router.post("/recommend", async (req, res) => {
  try {
    const { userProfile, requirements, searchTerm } = req.body;

    if (!userProfile) {
      return res.status(400).json({ error: "사용자 프로필이 필요합니다." });
    }

    console.log("AI 추천 시작:", { userProfile, requirements, searchTerm });

    let restaurants = [];

    // 검색어가 있으면 해당 식당 정보 가져오기
    if (searchTerm) {
      // Google Search를 통해 실시간 정보 검색
      const searchResults = await searchNearbyRestaurants(
        37.5665,
        126.978,
        1000
      );
      restaurants = searchResults.filter((r) =>
        r.place_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      // 전체 식당 목록에서 추천
      restaurants = await searchNearbyRestaurants(37.5665, 126.978, 1000);
    }

    // AI 추천 실행
    const recommendation = await recommendRestaurantWithAI(
      restaurants,
      userProfile,
      requirements
    );

    res.json({
      success: true,
      ...recommendation,
    });
  } catch (error) {
    console.error("AI 추천 오류:", error);
    res.status(500).json({ error: "추천 중 오류가 발생했습니다." });
  }
});

// 통합 API: 위치 → 검색 → AI 추천
router.post("/integrated", async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      userProfile,
      requirements,
      radius = 1000,
    } = req.body;

    if (!latitude || !longitude || !userProfile) {
      return res
        .status(400)
        .json({ error: "위도, 경도, 사용자 프로필이 필요합니다." });
    }

    console.log("🚀 통합 API 시작:", {
      latitude,
      longitude,
      userProfile,
      requirements,
    });

    const processSteps = {
      step1: { name: "주변 식당 검색", status: "pending" },
      step2: { name: "실시간 정보 검색", status: "pending" },
      step3: { name: "AI 추천 분석", status: "pending" },
      step4: { name: "거리 정보 조회", status: "pending" },
    };

    try {
      // 1단계: 위치 기반 식당 검색 (카카오 API)
      console.log("📍 1단계: 주변 식당 검색 시작");
      processSteps.step1.status = "processing";

      const nearbyRestaurants = await searchNearbyRestaurants(
        latitude,
        longitude,
        radius
      );

      if (nearbyRestaurants.length === 0) {
        return res.status(404).json({
          error: "주변에 식당을 찾을 수 없습니다.",
          processSteps: {
            ...processSteps,
            step1: { ...processSteps.step1, status: "failed" },
          },
        });
      }

      processSteps.step1.status = "completed";
      console.log(`✅ 1단계 완료: ${nearbyRestaurants.length}개 식당 발견`);

      // 2단계: 실시간 정보 검색 (Google Search API)
      console.log("🔍 2단계: 실시간 정보 검색 시작");
      processSteps.step2.status = "processing";

      // Google Search API를 통해 실시간 정보 수집
      const restaurantsWithRealTimeInfo = nearbyRestaurants.slice(0, 60); // 최대 60개 처리

      processSteps.step2.status = "completed";
      console.log(
        `✅ 2단계 완료: ${restaurantsWithRealTimeInfo.length}개 식당 실시간 정보 수집`
      );
      console.log(`\n🔄 3단계로 전환 중...`);

      // 3단계: AI 추천
      console.log("🤖 3단계: AI 추천 분석 시작");
      processSteps.step3.status = "processing";

      try {
        const recommendation = await recommendRestaurantWithAI(
          restaurantsWithRealTimeInfo,
          userProfile,
          requirements
        );

        if (recommendation.error) {
          console.log(
            "AI 추천 실패, 기본 추천으로 폴백:",
            recommendation.error
          );
          // AI 실패 시 기본 추천으로 폴백
          const fallbackRecommendation = recommendRestaurant(
            restaurantsWithRealTimeInfo,
            userProfile,
            requirements
          );
          processSteps.step3.status = "completed";
          console.log(`✅ 3단계 완료: 기본 추천 완료`);

          // 4단계: 거리 정보 조회 (폴백 케이스)
          console.log("📍 4단계: 거리 정보 조회 시작 (폴백)");
          processSteps.step4.status = "processing";

          try {
            const recommendationsWithDistance =
              await addDistanceInfoToRecommendations(
                fallbackRecommendation.recommendations,
                latitude,
                longitude
              );

            processSteps.step4.status = "completed";
            console.log(`✅ 4단계 완료: 거리 정보 조회 완료 (폴백)`);

            return res.json({
              success: true,
              processSteps,
              nearbyCount: nearbyRestaurants.length,
              processedCount: restaurantsWithRealTimeInfo.length,
              ...fallbackRecommendation,
              recommendations: recommendationsWithDistance,
            });
          } catch (distanceError) {
            console.error("거리 정보 조회 중 오류 (폴백):", distanceError);
            processSteps.step4.status = "completed";
            console.log(
              `✅ 4단계 완료: 거리 정보 조회 실패, 원본 결과 반환 (폴백)`
            );

            return res.json({
              success: true,
              processSteps,
              nearbyCount: nearbyRestaurants.length,
              processedCount: restaurantsWithRealTimeInfo.length,
              ...fallbackRecommendation,
            });
          }
        }

        processSteps.step3.status = "completed";
        console.log(`✅ 3단계 완료: AI 추천 완료`);

        // 4단계: 거리 정보 조회
        console.log("📍 4단계: 거리 정보 조회 시작");
        processSteps.step4.status = "processing";

        try {
          const recommendationsWithDistance =
            await addDistanceInfoToRecommendations(
              recommendation.recommendations,
              latitude,
              longitude
            );

          processSteps.step4.status = "completed";
          console.log(`✅ 4단계 완료: 거리 정보 조회 완료`);

          // 로그인한 사용자인 경우 서비스 이용 횟수 증가
          if (req.session && req.session.user) {
            incrementServiceUsage(
              req.session.user.id,
              SERVICE_TYPES.RESTAURANT_RECOMMENDATION
            );
          }

          // 최종 결과 반환 (거리 정보 포함)
          res.json({
            success: true,
            processSteps,
            nearbyCount: nearbyRestaurants.length,
            processedCount: restaurantsWithRealTimeInfo.length,
            ...recommendation,
            recommendations: recommendationsWithDistance,
          });
        } catch (distanceError) {
          console.error("거리 정보 조회 중 오류:", distanceError);
          processSteps.step4.status = "completed";
          console.log(`✅ 4단계 완료: 거리 정보 조회 실패, 원본 결과 반환`);

          // 거리 정보 조회 실패 시 원본 결과 반환
          res.json({
            success: true,
            processSteps,
            nearbyCount: nearbyRestaurants.length,
            processedCount: restaurantsWithRealTimeInfo.length,
            ...recommendation,
          });
        }
      } catch (aiError) {
        console.error("AI 추천 중 오류:", aiError);
        // AI 오류 시 기본 추천으로 폴백
        const fallbackRecommendation = recommendRestaurant(
          restaurantsWithRealTimeInfo,
          userProfile,
          requirements
        );
        processSteps.step3.status = "completed";
        console.log(`✅ 3단계 완료: 기본 추천 완료 (AI 오류 후)`);

        // 4단계: 거리 정보 조회 (AI 오류 후 폴백)
        console.log("📍 4단계: 거리 정보 조회 시작 (AI 오류 후 폴백)");
        processSteps.step4.status = "processing";

        try {
          const recommendationsWithDistance =
            await addDistanceInfoToRecommendations(
              fallbackRecommendation.recommendations,
              latitude,
              longitude
            );

          processSteps.step4.status = "completed";
          console.log(`✅ 4단계 완료: 거리 정보 조회 완료 (AI 오류 후 폴백)`);

          return res.json({
            success: true,
            processSteps,
            nearbyCount: nearbyRestaurants.length,
            processedCount: restaurantsWithRealTimeInfo.length,
            ...fallbackRecommendation,
            recommendations: recommendationsWithDistance,
          });
        } catch (distanceError) {
          console.error(
            "거리 정보 조회 중 오류 (AI 오류 후 폴백):",
            distanceError
          );
          processSteps.step4.status = "completed";
          console.log(
            `✅ 4단계 완료: 거리 정보 조회 실패, 원본 결과 반환 (AI 오류 후 폴백)`
          );

          return res.json({
            success: true,
            processSteps,
            nearbyCount: nearbyRestaurants.length,
            processedCount: restaurantsWithRealTimeInfo.length,
            ...fallbackRecommendation,
          });
        }
      }
    } catch (error) {
      console.error("❌ 통합 API 처리 중 오류:", error);

      // 실패한 단계 표시
      Object.keys(processSteps).forEach((step) => {
        if (processSteps[step].status === "processing") {
          processSteps[step].status = "failed";
        }
      });

      res.status(500).json({
        error: "처리 중 오류가 발생했습니다.",
        processSteps,
        details: error.message,
      });
    }
  } catch (error) {
    console.error("❌ 통합 API 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// AI 추천 결과에 거리 정보 추가
async function addDistanceInfoToRecommendations(
  recommendations,
  userLat,
  userLng
) {
  try {
    console.log("📍 추천 결과에 거리 정보 추가 중...");
    console.log(`사용자 위치: ${userLat}, ${userLng}`);
    console.log(`추천 식당 수: ${recommendations.length}`);

    const recommendationsWithDistance = await Promise.all(
      recommendations.map(async (restaurant) => {
        try {
          const restaurantName = restaurant.name || restaurant.place_name;
          console.log(`거리 조회 중: ${restaurantName}`);

          // 카카오 API로 식당명 검색하여 거리 정보 가져오기
          const response = await axios.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            {
              headers: {
                Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
                KA: `sdk/1.0.0 os/javascript origin/${process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || 'https://eatple.net') : 'http://localhost:3000'}`,
              },
              params: {
                query: restaurantName,
                x: userLng,
                y: userLat,
                radius: 5000, // 5km 반경 내에서 검색
                size: 1,
              },
            }
          );

          if (response.data && response.data.documents.length > 0) {
            const kakaoResult = response.data.documents[0];
            const distance = parseInt(kakaoResult.distance) || 0;

            console.log(
              `거리 정보 조회 성공 (${restaurantName}): ${distance}m`
            );
            console.log(`카카오 API 응답:`, {
              name: kakaoResult.place_name,
              address: kakaoResult.address_name,
              distance: kakaoResult.distance,
              id: kakaoResult.id,
            });

            // 거리 정보 추가 (카카오 API에서 받은 m 단위 그대로 사용)
            return {
              ...restaurant,
              distance_m: distance,
              kakao_id: kakaoResult.id,
              kakao_address: kakaoResult.address_name,
              kakao_phone: kakaoResult.phone,
            };
          } else {
            console.log(`카카오에서 찾지 못함 (${restaurantName})`);
            // 카카오에서 찾지 못한 경우 기존 정보 유지
            return {
              ...restaurant,
              distance_m: null,
            };
          }
        } catch (error) {
          console.log(
            `거리 정보 조회 실패 (${
              restaurant.name || restaurant.place_name
            }):`,
            error.message
          );
          if (error.response) {
            console.log(`카카오 API 오류 응답:`, error.response.data);
          }
          return {
            ...restaurant,
            distance_m: null,
          };
        }
      })
    );

    console.log(
      `✅ 거리 정보 추가 완료: ${recommendationsWithDistance.length}개 식당`
    );

    // 결과 로깅
    recommendationsWithDistance.forEach((restaurant, index) => {
      console.log(
        `${index + 1}. ${restaurant.name || restaurant.place_name}: ${
          restaurant.distance_m ? `${restaurant.distance_m}m` : "정보 없음"
        }`
      );
    });

    return recommendationsWithDistance;
  } catch (error) {
    console.error("거리 정보 추가 중 오류:", error);
    return recommendations; // 오류 시 원본 반환
  }
}

module.exports = router;
