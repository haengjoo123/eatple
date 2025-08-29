const fs = require("fs");
const path = require("path");

/**
 * 사용자 데이터 마이그레이션 유틸리티
 * 기존 사용자 데이터에 gamePoints와 gameStats 필드를 추가
 */

const USERS_FILE_PATH = path.join(__dirname, "../data/users.json");

/**
 * 사용자 데이터에 게임 관련 필드 추가
 */
function addGameFieldsToUser(user) {
  // gamePoints 필드가 없으면 기본값으로 초기화
  if (!user.gamePoints) {
    user.gamePoints = {
      totalPoints: 0,
      dailyEarned: 0,
      dailyLimit: 100, // 일일 한도를 100으로 복원
      lastEarnedDate: null,
      history: [],
    };
  }

  // gameStats 필드가 없으면 기본값으로 초기화
  if (!user.gameStats) {
    user.gameStats = {
      gamesPlayed: 0,
      bestScores: {},
      lastPlayedDate: null,
    };
  }

  return user;
}

/**
 * 모든 사용자 데이터 마이그레이션 실행
 */
function migrateUserData() {
  try {
    // users.json 파일 읽기
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, "utf8"));

    // 각 사용자에게 게임 필드 추가
    const migratedUsers = usersData.map((user) => addGameFieldsToUser(user));

    // 마이그레이션된 데이터를 파일에 저장
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(migratedUsers, null, 2));

    console.log("사용자 데이터 마이그레이션이 완료되었습니다.");
    return true;
  } catch (error) {
    console.error("사용자 데이터 마이그레이션 중 오류 발생:", error);
    return false;
  }
}

/**
 * 특정 사용자의 게임 필드 확인 및 초기화
 */
function ensureUserGameFields(userId) {
  try {
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, "utf8"));
    const userIndex = usersData.findIndex((user) => user.id === userId);

    if (userIndex === -1) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    // 해당 사용자의 게임 필드 확인 및 추가
    usersData[userIndex] = addGameFieldsToUser(usersData[userIndex]);

    // 파일에 저장
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(usersData, null, 2));

    return usersData[userIndex];
  } catch (error) {
    console.error("사용자 게임 필드 초기화 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 기존 사용자들의 일일 한도를 100으로 업데이트
 */
function updateDailyLimits() {
  try {
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE_PATH, "utf8"));
    let updatedCount = 0;

    // 각 사용자의 일일 한도 업데이트
    const updatedUsers = usersData.map((user) => {
      if (user.gamePoints && user.gamePoints.dailyLimit !== 100) {
        user.gamePoints.dailyLimit = 100;
        updatedCount++;
      }
      return user;
    });

    // 업데이트된 데이터를 파일에 저장
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(updatedUsers, null, 2));

    console.log(
      `${updatedCount}명의 사용자 일일 한도가 100으로 업데이트되었습니다.`
    );
    return true;
  } catch (error) {
    console.error("일일 한도 업데이트 중 오류 발생:", error);
    return false;
  }
}

module.exports = {
  migrateUserData,
  ensureUserGameFields,
  addGameFieldsToUser,
  updateDailyLimits,
};
