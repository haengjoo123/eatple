/**
 * Product Management Error Handling Utilities
 * Centralized error handling for product management operations
 * Requirements: 2.3, 4.3
 */

class ProductErrorHandler {
  constructor() {
    this.errorTypes = {
      VALIDATION_ERROR: "VALIDATION_ERROR",
      DATABASE_ERROR: "DATABASE_ERROR",
      PERMISSION_ERROR: "PERMISSION_ERROR",
      NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
      DUPLICATE_ERROR: "DUPLICATE_ERROR",
      IMAGE_ERROR: "IMAGE_ERROR",
      NETWORK_ERROR: "NETWORK_ERROR",
      SERVER_ERROR: "SERVER_ERROR",
    };

    this.errorMessages = {
      ko: {
        VALIDATION_ERROR: "입력 데이터가 유효하지 않습니다.",
        DATABASE_ERROR: "데이터베이스 오류가 발생했습니다.",
        PERMISSION_ERROR: "권한이 없습니다.",
        NOT_FOUND_ERROR: "요청한 리소스를 찾을 수 없습니다.",
        DUPLICATE_ERROR: "이미 존재하는 데이터입니다.",
        IMAGE_ERROR: "이미지 처리 중 오류가 발생했습니다.",
        NETWORK_ERROR: "네트워크 연결을 확인해주세요.",
        SERVER_ERROR: "서버 오류가 발생했습니다.",
      },
      en: {
        VALIDATION_ERROR: "Invalid input data.",
        DATABASE_ERROR: "Database error occurred.",
        PERMISSION_ERROR: "Permission denied.",
        NOT_FOUND_ERROR: "Requested resource not found.",
        DUPLICATE_ERROR: "Resource already exists.",
        IMAGE_ERROR: "Image processing error.",
        NETWORK_ERROR: "Network connection error.",
        SERVER_ERROR: "Internal server error.",
      },
    };
  }

  /**
   * 에러 분류 및 처리
   * Requirements: 2.3, 4.3
   */
  handleError(error, context = "", language = "ko") {
    const errorInfo = this.classifyError(error);
    const message = this.getErrorMessage(errorInfo.type, language);

    // 로깅
    this.logError(error, context, errorInfo);

    return {
      success: false,
      error: {
        type: errorInfo.type,
        code: errorInfo.code,
        message: message,
        details: errorInfo.details,
        context: context,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 에러 분류
   * Requirements: 2.3
   */
  classifyError(error) {
    // Supabase 에러 분류
    if (error.code) {
      switch (error.code) {
        case "PGRST116":
          return {
            type: this.errorTypes.NOT_FOUND_ERROR,
            code: error.code,
            details: "Resource not found in database",
          };
        case "23505":
          return {
            type: this.errorTypes.DUPLICATE_ERROR,
            code: error.code,
            details: "Unique constraint violation",
          };
        case "23503":
          return {
            type: this.errorTypes.VALIDATION_ERROR,
            code: error.code,
            details: "Foreign key constraint violation",
          };
        case "23502":
          return {
            type: this.errorTypes.VALIDATION_ERROR,
            code: error.code,
            details: "Not null constraint violation",
          };
        default:
          return {
            type: this.errorTypes.DATABASE_ERROR,
            code: error.code,
            details: error.message,
          };
      }
    }

    // 에러 타입 속성 확인
    if (error.type) {
      return {
        type: error.type,
        code: error.code || "CUSTOM_ERROR",
        details: error.message,
      };
    }

    // 일반적인 에러 분류
    if (error.message) {
      const message = error.message.toLowerCase();

      if (message.includes("validation failed")) {
        return {
          type: this.errorTypes.VALIDATION_ERROR,
          code: "VALIDATION_FAILED",
          details: error.message,
        };
      }

      if (message.includes("permission") || message.includes("unauthorized")) {
        return {
          type: this.errorTypes.PERMISSION_ERROR,
          code: "PERMISSION_DENIED",
          details: error.message,
        };
      }

      if (message.includes("not found")) {
        return {
          type: this.errorTypes.NOT_FOUND_ERROR,
          code: "NOT_FOUND",
          details: error.message,
        };
      }

      if (
        message.includes("image") ||
        message.includes("upload") ||
        message.includes("파일") ||
        message.includes("형식")
      ) {
        return {
          type: this.errorTypes.IMAGE_ERROR,
          code: "IMAGE_PROCESSING_ERROR",
          details: error.message,
        };
      }

      if (message.includes("network") || message.includes("connection")) {
        return {
          type: this.errorTypes.NETWORK_ERROR,
          code: "NETWORK_ERROR",
          details: error.message,
        };
      }
    }

    // 기본 서버 에러
    return {
      type: this.errorTypes.SERVER_ERROR,
      code: "UNKNOWN_ERROR",
      details: error.message || "Unknown error occurred",
    };
  }

  /**
   * 에러 메시지 조회
   * Requirements: 2.3
   */
  getErrorMessage(errorType, language = "ko") {
    return (
      this.errorMessages[language][errorType] ||
      this.errorMessages.ko.SERVER_ERROR
    );
  }

  /**
   * 에러 로깅
   * Requirements: 4.3
   */
  logError(error, context, errorInfo) {
    const logData = {
      timestamp: new Date().toISOString(),
      context: context,
      errorType: errorInfo.type,
      errorCode: errorInfo.code,
      message: error.message,
      stack: error.stack,
      details: errorInfo.details,
    };

    // 개발 환경에서는 콘솔에 출력
    if (process.env.NODE_ENV === "development") {
      console.error("Product Management Error:", logData);
    }

    // 프로덕션 환경에서는 로그 파일에 기록 (향후 구현)
    if (process.env.NODE_ENV === "production") {
      this.writeToLogFile(logData);
    }
  }

  /**
   * 로그 파일 작성 (향후 구현)
   */
  writeToLogFile(logData) {
    // TODO: 로그 파일 작성 로직 구현
    // 예: Winston, Bunyan 등의 로깅 라이브러리 사용
  }

  /**
   * Express 미들웨어용 에러 핸들러
   * Requirements: 4.3
   */
  expressErrorHandler() {
    return (error, req, res, next) => {
      const context = `${req.method} ${req.path}`;
      const errorResponse = this.handleError(error, context);

      // HTTP 상태 코드 결정
      let statusCode = 500;
      switch (errorResponse.error.type) {
        case this.errorTypes.VALIDATION_ERROR:
          statusCode = 400;
          break;
        case this.errorTypes.PERMISSION_ERROR:
          statusCode = 403;
          break;
        case this.errorTypes.NOT_FOUND_ERROR:
          statusCode = 404;
          break;
        case this.errorTypes.DUPLICATE_ERROR:
          statusCode = 409;
          break;
        case this.errorTypes.IMAGE_ERROR:
          statusCode = 422;
          break;
        default:
          statusCode = 500;
      }

      res.status(statusCode).json(errorResponse);
    };
  }

  /**
   * 비동기 함수 래퍼 (에러 자동 처리)
   * Requirements: 4.3
   */
  asyncWrapper(fn, context = "") {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error, context);
      }
    };
  }

  /**
   * 검증 에러 생성
   * Requirements: 2.3
   */
  createValidationError(errors) {
    const error = new Error(`Validation failed: ${errors.join(", ")}`);
    error.type = this.errorTypes.VALIDATION_ERROR;
    error.details = errors;
    return error;
  }

  /**
   * 권한 에러 생성
   * Requirements: 4.3
   */
  createPermissionError(message = "권한이 없습니다.") {
    const error = new Error(message);
    error.type = this.errorTypes.PERMISSION_ERROR;
    return error;
  }

  /**
   * 찾을 수 없음 에러 생성
   * Requirements: 4.3
   */
  createNotFoundError(resource = "Resource") {
    const error = new Error(`${resource} not found`);
    error.type = this.errorTypes.NOT_FOUND_ERROR;
    return error;
  }

  /**
   * 중복 에러 생성
   * Requirements: 2.3
   */
  createDuplicateError(resource = "Resource") {
    const error = new Error(`${resource} already exists`);
    error.type = this.errorTypes.DUPLICATE_ERROR;
    return error;
  }

  /**
   * 이미지 에러 생성
   * Requirements: 2.3
   */
  createImageError(message = "이미지 처리 중 오류가 발생했습니다.") {
    const error = new Error(message);
    error.type = this.errorTypes.IMAGE_ERROR;
    return error;
  }

  /**
   * 성공 응답 생성
   * Requirements: 2.3
   */
  createSuccessResponse(
    data = null,
    message = "작업이 성공적으로 완료되었습니다."
  ) {
    return {
      success: true,
      data: data,
      message: message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 페이지네이션 응답 생성
   * Requirements: 4.3
   */
  createPaginatedResponse(
    data,
    pagination,
    message = "조회가 완료되었습니다."
  ) {
    return {
      success: true,
      data: data,
      pagination: pagination,
      message: message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 에러 통계 조회 (모니터링용)
   * Requirements: 4.3
   */
  getErrorStats() {
    // TODO: 에러 통계 수집 및 반환 로직 구현
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsByContext: {},
      recentErrors: [],
    };
  }

  /**
   * 에러 복구 시도
   * Requirements: 4.3
   */
  async attemptRecovery(error, context, retryFunction, maxRetries = 3) {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        attempts++;
        console.log(
          `Recovery attempt ${attempts}/${maxRetries} for ${context}`
        );

        const result = await retryFunction();

        if (result.success) {
          console.log(`Recovery successful after ${attempts} attempts`);
          return result;
        }

        // 잠시 대기 후 재시도
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      } catch (retryError) {
        console.error(`Recovery attempt ${attempts} failed:`, retryError);

        if (attempts >= maxRetries) {
          return this.handleError(
            retryError,
            `${context} (recovery failed after ${maxRetries} attempts)`
          );
        }
      }
    }

    return this.handleError(error, `${context} (recovery exhausted)`);
  }

  /**
   * 정적 메서드로 에러 처리 (Express 라우터용)
   * Requirements: 2.3, 4.3
   */
  static handle(error, req, res, context = "") {
    const handler = new ProductErrorHandler();
    const errorResponse = handler.handleError(error, context);

    // HTTP 상태 코드 결정
    let statusCode = 500;
    switch (errorResponse.error.type) {
      case handler.errorTypes.VALIDATION_ERROR:
        statusCode = 400;
        break;
      case handler.errorTypes.PERMISSION_ERROR:
        statusCode = 403;
        break;
      case handler.errorTypes.NOT_FOUND_ERROR:
        statusCode = 404;
        break;
      case handler.errorTypes.DUPLICATE_ERROR:
        statusCode = 409;
        break;
      case handler.errorTypes.IMAGE_ERROR:
        statusCode = 422;
        break;
      default:
        statusCode = 500;
    }

    res.status(statusCode).json({
      success: false,
      error: errorResponse.error.message,
      details: errorResponse.error.details,
    });
  }
}

// 싱글톤 인스턴스 생성
const productErrorHandler = new ProductErrorHandler();

module.exports = ProductErrorHandler;
