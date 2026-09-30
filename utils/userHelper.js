const { readUsers } = require('./userStore');

// 사용자 ID로 사용자 정보 조회
function getUserById(userId) {
  if (!userId) return null;

  const users = readUsers();
  return users.find((user) => user.id === userId) || null;
}

// 사용자 이메일로 사용자 정보 조회
function getUserByEmail(email) {
  if (!email) return null;

  const users = readUsers();
  return users.find((user) => user.email === email) || null;
}

// 사용자 표시명 가져오기 (우선순위: name > username > email)
function getUserDisplayName(user) {
  if (!user) return "익명";

  return user.name || user.username || user.email || "익명";
}

// 세션에서 사용자 정보 가져오기
function getUserFromSession(session) {
  if (!session || !session.user) {
    return {
      id: null,
      displayName: "익명",
      email: null,
      authType: null,
    };
  }

  const sessionUser = session.user;

  // 세션에 사용자 ID가 있으면 로컬 JSON에서 더 자세한 정보 조회
  let fullUser = null;
  if (sessionUser.id) {
    fullUser = getUserById(sessionUser.id);
  }

  // 로컬 JSON에서 찾지 못했으면 이메일로 조회
  if (!fullUser && sessionUser.email) {
    fullUser = getUserByEmail(sessionUser.email);
  }

  // 표시명 결정
  let displayName = "익명";
  if (fullUser) {
    displayName = getUserDisplayName(fullUser);
  } else if (sessionUser.name) {
    displayName = sessionUser.name;
  } else if (sessionUser.username) {
    displayName = sessionUser.username;
  } else if (sessionUser.email) {
    displayName = sessionUser.email;
  }

  return {
    id: sessionUser.id,
    displayName: displayName,
    email: sessionUser.email || (fullUser ? fullUser.email : null),
    authType: sessionUser.authType || (fullUser ? fullUser.authType : null),
    fullUser: fullUser,
  };
}

module.exports = {
  readUsers,
  getUserById,
  getUserByEmail,
  getUserDisplayName,
  getUserFromSession,
};
