const { schemas, buildPrompt, buildInstructions, parseResult, invalidResult } = require('../utils/aiContracts');
const express = require("express");
const router = express.Router();
const axios = require("axios");

// 서비스 이용 횟수 추적 모듈
const {
  incrementServiceUsage,
  SERVICE_TYPES,
} = require("../utils/serviceUsageTracker");

// AI 요청 큐 모듈
const aiRequestQueue = require("../utils/aiRequestQueue");

// 카카오 REST API 키
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "test_key";

const { generateText } = require("../utils/openaiClient");

// Google Places API 설정
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// AI requests use the shared queue and propagate cancellation to OpenAI.
async function callOpenAI(prompt, metadata = {}) {
  const response = await aiRequestQueue.add(
    (signal) => generateText(prompt, { signal, timeout: 200000, schema: schemas.restaurants, schemaName: 'restaurants', instructions: buildInstructions('restaurants') }),
    { type: "restaurant-recommendation", ...metadata }
  );
  return response.text;
}

// AI 추천 시스템 (Google Search API 활용)
async function recommendRestaurantWithAI(restaurants, userProfile, requirements) {
  if (!restaurants?.length) return { error: "추천할 식당이 없습니다." };
  try {
    const candidates = restaurants.map((r, index) => ({
      candidateId: String(index), name: r.place_name || r.name,
      address: r.address_name || r.address, category: r.category_name || r.category,
      distance: r.distance_m ?? r.distance ?? null,
      googleRating: r.googleRating ?? null, reviewCount: r.reviewCount ?? null,
      openHour: r.openHour ?? null, googleOpeningHours: r.googleOpeningHours || [],
      isOpenNow: typeof r.isOpenNow === 'boolean' ? r.isOpenNow : null,
    }));
    const prompt = buildPrompt('restaurants', { userProfile, requirements, candidates });
    const parsed = parseResult(await callOpenAI(prompt), 'restaurants');
    const selected = new Set();
    const recommendations = parsed.recommendations.map(item => {
      const candidate = candidates.find(c => c.candidateId === item.candidateId);
      if (!candidate || selected.has(item.candidateId)) throw invalidResult();
      selected.add(item.candidateId);
      const original = restaurants[Number(item.candidateId)];
      return {
        ...original, name: candidate.name, address: candidate.address,
        category: candidate.category, googleRating: candidate.googleRating,
        distance: original.distance_km ?? original.distance ?? candidate.distance,
        phone: original.phone || '정보 없음', openHour: original.openHour || '정보 없음',
        reason: item.reason, recommendedMenus: item.recommendedMenus,
        healthConsiderations: item.healthConsiderations, score: item.score,
      };
    });
    return { success: true, recommendations, reason: parsed.reason, totalRestaurants: restaurants.length };
  } catch (error) {
    console.error('AI 추천 오류:', error.message);
    return recommendRestaurant(restaurants, userProfile, requirements);
  }
}

// Google Places API로 리뷰 정보 및 영업시간 가져오기
async function getGoogleRating(restaurantName, lat, lng) {
  if (
    !GOOGLE_PLACES_API_KEY ||
    GOOGLE_PLACES_API_KEY === "your_google_places_api_key_here"
  ) {
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
          allRestaurants.push(...response.data.documents);

          // 마지막 페이지이거나 더 이상 결과가 없으면 중단
          if (response.data.documents.length < 15) {
            break;
          }
        } else {
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

      // 중복 제거 (ID 기준)
      const uniqueRestaurants = allRestaurants.filter(
        (restaurant, index, self) =>
          index === self.findIndex((r) => r.id === restaurant.id)
      );

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
              isOpenNow: additionalInfo.isOpenNow ?? null, // false means closed, not unknown
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

    const processSteps = {
      step1: { name: "주변 식당 검색", status: "pending" },
      step2: { name: "실시간 정보 검색", status: "pending" },
      step3: { name: "AI 추천 분석", status: "pending" },
      step4: { name: "거리 정보 조회", status: "pending" },
    };

    try {
      // 1단계: 위치 기반 식당 검색 (카카오 API)
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

      // 2단계: 실시간 정보 검색 (Google Search API)
      processSteps.step2.status = "processing";

      // Google Search API를 통해 실시간 정보 수집
      const restaurantsWithRealTimeInfo = nearbyRestaurants.slice(0, 60); // 최대 60개 처리

      processSteps.step2.status = "completed";

      // 3단계: AI 추천
      processSteps.step3.status = "processing";

      try {
        const recommendation = await recommendRestaurantWithAI(
          restaurantsWithRealTimeInfo,
          userProfile,
          requirements
        );

        if (recommendation.error) {
          // AI 실패 시 기본 추천으로 폴백
          const fallbackRecommendation = recommendRestaurant(
            restaurantsWithRealTimeInfo,
            userProfile,
            requirements
          );
          processSteps.step3.status = "completed";

          // 4단계: 거리 정보 조회 (폴백 케이스)
          processSteps.step4.status = "processing";

          try {
            const recommendationsWithDistance =
              await addDistanceInfoToRecommendations(
                fallbackRecommendation.recommendations,
                latitude,
                longitude
              );

            processSteps.step4.status = "completed";

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

        // 4단계: 거리 정보 조회
        processSteps.step4.status = "processing";

        try {
          const recommendationsWithDistance =
            await addDistanceInfoToRecommendations(
              recommendation.recommendations,
              latitude,
              longitude
            );

          processSteps.step4.status = "completed";

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

        // 4단계: 거리 정보 조회 (AI 오류 후 폴백)
        processSteps.step4.status = "processing";

        try {
          const recommendationsWithDistance =
            await addDistanceInfoToRecommendations(
              fallbackRecommendation.recommendations,
              latitude,
              longitude
            );

          processSteps.step4.status = "completed";

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

    const recommendationsWithDistance = await Promise.all(
      recommendations.map(async (restaurant) => {
        try {
          const restaurantName = restaurant.name || restaurant.place_name;

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

            // 거리 정보 추가 (카카오 API에서 받은 m 단위 그대로 사용)
            return {
              ...restaurant,
              distance_m: distance,
              kakao_id: kakaoResult.id,
              kakao_address: kakaoResult.address_name,
              kakao_phone: kakaoResult.phone,
            };
          } else {
            // 카카오에서 찾지 못한 경우 기존 정보 유지
            return {
              ...restaurant,
              distance_m: null,
            };
          }
        } catch (error) {

          return {
            ...restaurant,
            distance_m: null,
          };
        }
      })
    );

    // 결과 로깅
    recommendationsWithDistance.forEach((restaurant, index) => {
    });

    return recommendationsWithDistance;
  } catch (error) {
    console.error("거리 정보 추가 중 오류:", error);
    return recommendations; // 오류 시 원본 반환
  }
}

module.exports = router;
