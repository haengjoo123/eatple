const axios = require("axios");

/**
 * 목업 영양 정보 데이터
 */
function getMockNutritionData(productName) {
  // 부분 일치 검색을 시뮬레이션하기 위한 다양한 목업 데이터
  const allMockData = [
    {
      식품명: "불닭볶음면",
      에너지: "530",
      단백질: "11.0",
      지방: "22.0",
      탄수화물: "72.0",
      당류: "8.0",
      나트륨: "1790",
      콜레스테롤: "0",
      포화지방산: "11.0",
      트랜스지방산: "0.0",
      식품중량: "140",
      제조사명: "삼양식품",
      유통업체명: "삼양식품",
    },
    {
      식품명: "불닭볶음면 치즈맛",
      에너지: "540",
      단백질: "12.0",
      지방: "23.0",
      탄수화물: "70.0",
      당류: "9.0",
      나트륨: "1850",
      콜레스테롤: "5",
      포화지방산: "12.0",
      트랜스지방산: "0.0",
      식품중량: "140",
      제조사명: "삼양식품",
      유통업체명: "삼양식품",
    },
    {
      식품명: "불닭볶음면 카르보나라맛",
      에너지: "550",
      단백질: "13.0",
      지방: "24.0",
      탄수화물: "68.0",
      당류: "10.0",
      나트륨: "1900",
      콜레스테롤: "8",
      포화지방산: "13.0",
      트랜스지방산: "0.0",
      식품중량: "140",
      제조사명: "삼양식품",
      유통업체명: "삼양식품",
    },
    {
      식품명: "불닭스낵면",
      에너지: "480",
      단백질: "9.0",
      지방: "18.0",
      탄수화물: "70.0",
      당류: "6.0",
      나트륨: "1650",
      콜레스테롤: "0",
      포화지방산: "9.0",
      트랜스지방산: "0.0",
      식품중량: "120",
      제조사명: "삼양식품",
      유통업체명: "삼양식품",
    },
  ];

  // 검색어를 포함하는 제품들을 필터링 (부분 일치 검색)
  const searchKeyword = productName.toLowerCase().trim();
  const filteredData = allMockData.filter((item) => {
    const foodName = item.식품명.toLowerCase();
    return foodName.includes(searchKeyword);
  });

  console.log(
    `[foodNutritionApi] 목업 데이터 반환: ${productName} (${filteredData.length}개 결과)`
  );
  return filteredData;
}

/**
 * 네트워크 연결 상태 확인
 */
async function checkNetworkConnectivity() {
  try {
    // 간단한 연결 테스트
    await axios.get("https://www.google.com", { timeout: 5000 });
    return true;
  } catch (error) {
    console.error("[foodNutritionApi] 네트워크 연결 확인 실패:", error.message);
    return false;
  }
}

/**
 * API 키 유효성 검증
 */
function validateApiKey(serviceKey) {
  if (!serviceKey) {
    return { valid: false, error: "API 키가 설정되지 않았습니다." };
  }

  if (serviceKey === "your_api_key_here" || serviceKey.includes("test")) {
    return {
      valid: false,
      error: "유효하지 않은 API 키입니다. 실제 API 키를 설정해주세요.",
    };
  }

  // URL 디코딩 테스트
  try {
    decodeURIComponent(serviceKey);
  } catch (error) {
    return { valid: false, error: "API 키 형식이 올바르지 않습니다." };
  }

  return { valid: true };
}

/**
 * 다양한 검색 전략으로 식품 검색
 * @param {string} productName - 검색할 식품명
 * @param {string} searchTerm - 실제 API에 전송할 검색어
 * @returns {Promise<Object[]>} - 영양정보 배열 반환
 */
async function searchWithTerm(
  productName,
  searchTerm,
  serviceKey,
  useMockData = false
) {
  // 재시도 로직을 위한 설정
  const maxRetries = 3;
  const retryDelay = 2000; // 2초

  // 공공데이터 문의 답변에 따른 새로운 API URL 사용
  const apiUrls = [
    "http://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api",
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (let urlIndex = 0; urlIndex < apiUrls.length; urlIndex++) {
      const url = apiUrls[urlIndex];

      try {
        console.log(
          `[foodNutritionApi] API 요청 시도 ${attempt}/${maxRetries} (URL ${
            urlIndex + 1
          }/${apiUrls.length}): ${productName}`
        );
        console.log(`[foodNutritionApi] 사용 URL: ${url}`);

        const params = {
          serviceKey: decodeURIComponent(serviceKey), // 디코딩된 키 사용
          pageNo: 1,
          numOfRows: 200, // 더 많은 결과를 가져와서 부분 일치 검색 지원
          type: "json",
          foodNm: searchTerm, // 전달받은 검색어 사용
        };

        console.log("[foodNutritionApi] 요청 파라미터:", {
          url,
          params: {
            ...params,
            serviceKey: serviceKey.substring(0, 10) + "...", // 보안을 위해 일부만 로깅
          },
        });

        const response = await axios.get(url, {
          params,
          timeout: 30000, // 타임아웃 30초
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          // DNS 해석 문제 해결을 위한 추가 설정
          family: 4, // IPv4만 사용
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 300; // 2xx 상태 코드만 성공으로 처리
          },
        });

        console.log("[foodNutritionApi] 응답 상태 코드:", response.status);
        console.log(
          "[foodNutritionApi] 응답 헤더:",
          response.headers["content-type"]
        );

        const { data } = response;

        // 응답이 문자열인 경우 JSON 파싱 시도
        let parsedData = data;
        if (typeof data === "string") {
          try {
            parsedData = JSON.parse(data);
          } catch (parseErr) {
            console.error(
              "[foodNutritionApi] JSON 파싱 오류:",
              parseErr.message
            );
            console.log(
              "[foodNutritionApi] 원본 응답 (처음 500자):",
              data.substring(0, 500)
            );
            continue; // 다음 URL 시도
          }
        }

        console.log(
          "[foodNutritionApi] 파싱된 응답 구조:",
          Object.keys(parsedData)
        );

        // API 응답 구조 검증 및 파싱
        if (!parsedData) {
          console.error("[foodNutritionApi] 응답 데이터가 없습니다.");
          continue; // 다음 URL 시도
        }

        // 공공데이터포털 표준 응답 구조: response.header/body
        if (parsedData.response) {
          const header = parsedData.response.header;
          const body = parsedData.response.body;

          console.log(
            `[foodNutritionApi] 응답 코드: ${header?.resultCode}, 메시지: ${header?.resultMsg}`
          );

          if (header?.resultCode !== "00") {
            console.error(
              "[foodNutritionApi] API 에러:",
              header?.resultCode,
              header?.resultMsg
            );

            // 특정 에러 코드에 대한 상세 안내
            if (header?.resultCode === "30") {
              console.error(
                "[foodNutritionApi] API 키가 등록되지 않았습니다. 공공데이터포털에서 승인 상태를 확인하세요."
              );
            } else if (header?.resultCode === "31") {
              console.error(
                "[foodNutritionApi] API 키가 유효하지 않습니다. API 키를 확인하세요."
              );
            } else if (header?.resultCode === "99") {
              console.error(
                "[foodNutritionApi] 시스템 오류가 발생했습니다. 잠시 후 다시 시도하세요."
              );
            }

            continue; // 다음 URL 시도
          }

          // body.items 또는 body.item 확인
          const items = body?.items || body?.item || [];
          const itemArray = Array.isArray(items) ? items : items ? [items] : [];

          console.log(
            `[foodNutritionApi] API에서 ${itemArray.length}개 결과 수신`
          );

          // 검색어를 포함하는 제품들을 필터링 (부분 일치 검색 지원)
          const searchKeyword = productName.toLowerCase().trim();
          const filteredItems = itemArray.filter((item) => {
            const foodName = (item.foodNm || item.prdlstNm || "").toLowerCase();
            return foodName.includes(searchKeyword);
          });

          console.log(
            `[foodNutritionApi] 부분 일치 필터링 후 ${filteredItems.length}개 결과 반환`
          );

          return filteredItems.map((item) => ({
            식품명: item.foodNm || item.prdlstNm || "",
            에너지: item.enerc || "",
            단백질: item.prot || "",
            지방: item.fatce || item.fat || "",
            탄수화물: item.chocdf || "",
            당류: item.sugar || "",
            나트륨: item.nat || item.na || "",
            콜레스테롤: item.chole || item.cholstl || "",
            포화지방산: item.fasat || "",
            트랜스지방산: item.fatrn || "",
            식품중량: item.foodSize || item.servingWt || "",
            제조사명: item.mfrNm || item.manufacturer || "",
            유통업체명: item.distNm || item.distributor || "",
          }));
        }
        // 직접 배열이 반환되는 경우
        else if (Array.isArray(parsedData)) {
          console.log(
            `[foodNutritionApi] API에서 직접 배열로 ${parsedData.length}개 결과 수신`
          );

          // 검색어를 포함하는 제품들을 필터링 (부분 일치 검색 지원)
          const searchKeyword = productName.toLowerCase().trim();
          const filteredItems = parsedData.filter((item) => {
            const foodName = (item.foodNm || item.prdlstNm || "").toLowerCase();
            return foodName.includes(searchKeyword);
          });

          console.log(
            `[foodNutritionApi] 부분 일치 필터링 후 ${filteredItems.length}개 결과 반환`
          );

          return filteredItems.map((item) => ({
            식품명: item.foodNm || item.prdlstNm || "",
            에너지: item.enerc || "",
            단백질: item.prot || "",
            지방: item.fatce || item.fat || "",
            탄수화물: item.chocdf || "",
            당류: item.sugar || "",
            나트륨: item.nat || item.na || "",
            콜레스테롤: item.chole || item.cholstl || "",
            포화지방산: item.fasat || "",
            트랜스지방산: item.fatrn || "",
            식품중량: item.foodSize || item.servingWt || "",
            제조사명: item.mfrNm || item.manufacturer || "",
            유통업체명: item.distNm || item.distributor || "",
          }));
        }
        // 기타 응답 구조
        else {
          console.error(
            "[foodNutritionApi] 예상치 못한 응답 구조:",
            parsedData
          );
          console.log(
            "[foodNutritionApi] 전체 응답:",
            JSON.stringify(parsedData, null, 2)
          );
          continue; // 다음 URL 시도
        }
      } catch (err) {
        console.error(
          `[foodNutritionApi] API 호출 오류 (시도 ${attempt}/${maxRetries}, URL ${
            urlIndex + 1
          }):`,
          err.message
        );

        // 상세 에러 정보 로깅
        if (err.response) {
          console.error("[foodNutritionApi] 응답 상태:", err.response.status);
          console.error("[foodNutritionApi] 응답 헤더:", err.response.headers);
          console.error("[foodNutritionApi] 응답 데이터:", err.response.data);

          // 특정 에러 코드에 대한 안내
          if (err.response.status === 401) {
            console.error("[foodNutritionApi] 인증 오류: API 키를 확인하세요.");
          } else if (err.response.status === 403) {
            console.error(
              "[foodNutritionApi] 접근 거부: API 키 권한을 확인하세요."
            );
          } else if (err.response.status === 429) {
            console.error(
              "[foodNutritionApi] 요청 한도 초과: 잠시 후 다시 시도하세요."
            );
          }

          // HTTP 에러는 다음 URL 시도
          continue;
        } else if (err.request) {
          console.error(
            "[foodNutritionApi] 네트워크 오류: 요청이 전송되었으나 응답이 없습니다."
          );

          // DNS 해석 실패 또는 네트워크 오류인 경우
          if (
            err.code === "ENOTFOUND" ||
            err.code === "ECONNREFUSED" ||
            err.code === "ETIMEDOUT"
          ) {
            console.error(
              `[foodNutritionApi] 네트워크 연결 실패 (${err.code}): ${err.message}`
            );

            // 마지막 URL이 아니면 다음 URL 시도
            if (urlIndex < apiUrls.length - 1) {
              console.log(`[foodNutritionApi] 다음 URL 시도...`);
              continue;
            }

            // 모든 URL을 시도했고 아직 재시도 횟수가 남아있으면 재시도
            if (attempt < maxRetries) {
              console.log(
                `[foodNutritionApi] ${retryDelay / 1000}초 후 재시도...`
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              break; // 다음 재시도로
            }
          }
        } else if (err.code === "ECONNABORTED") {
          console.error("[foodNutritionApi] 요청 타임아웃");

          // 마지막 URL이 아니면 다음 URL 시도
          if (urlIndex < apiUrls.length - 1) {
            console.log(`[foodNutritionApi] 다음 URL 시도...`);
            continue;
          }

          if (attempt < maxRetries) {
            console.log(
              `[foodNutritionApi] ${retryDelay / 1000}초 후 재시도...`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            break; // 다음 재시도로
          }
        }

        // 마지막 시도이거나 재시도하지 않을 에러인 경우
        if (attempt === maxRetries && urlIndex === apiUrls.length - 1) {
          console.error(
            "[foodNutritionApi] 모든 재시도 및 URL 시도 실패. 빈 결과 반환."
          );
          console.error("[foodNutritionApi] 문제 해결 방법:");
          console.error("1. 인터넷 연결 상태 확인");
          console.error("2. API 키 유효성 확인");
          console.error("3. 공공데이터포털 서비스 상태 확인");

          // 목업 데이터 사용 설정이 있으면 목업 데이터 반환
          if (useMockData) {
            console.log(
              "[foodNutritionApi] 목업 데이터 사용 설정이 활성화되어 목업 데이터를 반환합니다."
            );
            return getMockNutritionData(productName);
          }
        }
      }
    }
  }

  // 목업 데이터 사용 설정이 있으면 목업 데이터 반환
  if (useMockData) {
    console.log(
      "[foodNutritionApi] API 호출 실패로 인해 목업 데이터를 반환합니다."
    );
    return getMockNutritionData(productName);
  }

  return [];
}

/**
 * 식품명으로 영양정보 검색 (다양한 검색 전략 사용)
 * @param {string} productName - 검색할 식품명
 * @returns {Promise<Object[]>} - 영양정보 배열 반환
 */
async function searchFoodNutrition(productName) {
  // 환경변수에서 API 키 가져오기
  const serviceKey = process.env.FOOD_NUTRITION_API_KEY;

  // 목업 데이터 사용 설정 확인
  const useMockData = process.env.USE_MOCK_FOOD_DATA === "true";

  // API 키 검증
  const keyValidation = validateApiKey(serviceKey);
  if (!keyValidation.valid) {
    console.error("[foodNutritionApi] API 키 오류:", keyValidation.error);
    console.error("[foodNutritionApi] 환경 변수 확인: FOOD_NUTRITION_API_KEY");

    // 목업 데이터 사용 설정이 있으면 목업 데이터 반환
    if (useMockData) {
      return getMockNutritionData(productName);
    }
    return [];
  }

  // 에러는 함수 초반에 처리
  if (!productName || typeof productName !== "string") {
    console.error("[foodNutritionApi] 유효하지 않은 제품명:", productName);
    return [];
  }

  // 네트워크 연결 상태 확인
  const isNetworkAvailable = await checkNetworkConnectivity();
  if (!isNetworkAvailable) {
    console.error("[foodNutritionApi] 네트워크 연결이 불안정합니다.");
    console.error("[foodNutritionApi] 인터넷 연결을 확인해주세요.");

    // 목업 데이터 사용 설정이 있으면 목업 데이터 반환
    if (useMockData) {
      return getMockNutritionData(productName);
    }
    return [];
  }

  // 다양한 검색 전략을 순차적으로 시도
  const searchStrategies = [
    productName, // 1. 원본 검색어
  ];

  // 한글인 경우 추가 전략 (중복 방지)
  if (/[가-힣]/.test(productName) && productName.length >= 3) {
    // 3글자 이상인 경우에만 부분 검색 시도
    if (productName.length >= 4) {
      searchStrategies.push(productName.substring(0, 3)); // 2. 첫 3글자만
    }
  } else if (productName.length >= 4) {
    // 영어나 기타 언어의 경우 4글자 이상일 때만
    searchStrategies.push(productName.substring(0, 3)); // 첫 3글자
  }

  console.log(`[foodNutritionApi] 검색 전략: ${searchStrategies.join(", ")}`);

  let allResults = [];
  const seenProducts = new Set(); // 중복 제거를 위한 Set

  for (let i = 0; i < searchStrategies.length; i++) {
    const searchTerm = searchStrategies[i];
    console.log(
      `[foodNutritionApi] 검색 전략 ${i + 1}/${
        searchStrategies.length
      }: "${searchTerm}"`
    );

    try {
      const results = await searchWithTerm(
        productName,
        searchTerm,
        serviceKey,
        useMockData
      );
      console.log(
        `[foodNutritionApi] 검색 전략 "${searchTerm}"으로 ${results.length}개 결과 발견`
      );

      // 중복 제거하면서 결과 누적
      results.forEach((item) => {
        const key = `${item.식품명}_${item.제조사명}_${item.식품중량}`;
        if (!seenProducts.has(key)) {
          seenProducts.add(key);
          allResults.push(item);
        }
      });
    } catch (error) {
      console.error(
        `[foodNutritionApi] 검색 전략 "${searchTerm}" 실패:`,
        error.message
      );
      continue;
    }

  }

  if (allResults.length > 0) {
    console.log(
      `[foodNutritionApi] 총 ${allResults.length}개의 고유한 결과 발견`
    );
    return allResults;
  }

  console.log("[foodNutritionApi] 모든 검색 전략 실패");

  // 목업 데이터 사용 설정이 있으면 목업 데이터 반환
  if (useMockData) {
    console.log(
      "[foodNutritionApi] 목업 데이터 사용 설정이 활성화되어 목업 데이터를 반환합니다."
    );
    return getMockNutritionData(productName);
  }

  return [];
}

module.exports = { searchFoodNutrition };

