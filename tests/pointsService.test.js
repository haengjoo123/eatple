const fs = require('fs');
const os = require('os');
const path = require('path');
const PointsService = require('../utils/pointsService');
const ProfileCompletionService = require('../utils/profileCompletionService');

let directory;
let usersFile;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-plan-points-'));
    usersFile = path.join(directory, 'users.json');
    PointsService.USERS_FILE_PATH = usersFile;
    jest.spyOn(ProfileCompletionService, 'USERS_FILE_PATH', 'get').mockReturnValue(usersFile);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.writeFileSync(usersFile, JSON.stringify([{ id: 'test-user', profile: {} }]));
});

afterEach(() => {
    PointsService.USERS_FILE_PATH = undefined;
    jest.restoreAllMocks();
    fs.unlinkSync(usersFile);
    fs.rmdirSync(directory);
});

test('profile completion persists its reward exactly once, together with the reward flag', () => {
    jest.spyOn(ProfileCompletionService, 'calculateCompletionPercentage').mockReturnValue({
        isComplete: true, percentage: 100, missingFields: []
    });
    const first = ProfileCompletionService.checkAndRewardCompletion('test-user', {});
    expect(first.rewardGiven).toBe(true);
    expect(PointsService.getPointsBalance('test-user').totalPoints).toBe(500);
    expect(PointsService.getPointsHistory('test-user')).toHaveLength(1);
    expect(ProfileCompletionService.checkAndRewardCompletion('test-user', {}).rewardGiven).toBe(false);
    expect(PointsService.getPointsBalance('test-user').totalPoints).toBe(500);
});

test.each([NaN, Infinity, -Infinity, '10', undefined, null, 1.5, 0, -1])(
    'invalid point amount %p cannot change a balance', amount => {
        const original = fs.readFileSync(usersFile, 'utf8');
        expect(() => PointsService.earnPoints('test-user', amount)).toThrow();
        expect(() => PointsService.usePoints('test-user', amount)).toThrow();
        expect(fs.readFileSync(usersFile, 'utf8')).toBe(original);
    }
);

test('daily limit clamps an award without losing existing points', () => {
    PointsService.earnPoints('test-user', 90);
    expect(PointsService.earnPoints('test-user', 30).earnedPoints).toBe(10);
    expect(PointsService.getPointsBalance('test-user').totalPoints).toBe(100);
    expect(() => PointsService.earnPoints('test-user', 1)).toThrow(/한도/);
});

test('a failed reward save persists neither points nor the completion flag and can be retried', () => {
    jest.spyOn(ProfileCompletionService, 'calculateCompletionPercentage').mockReturnValue({
        isComplete: true, percentage: 100, missingFields: []
    });
    const replace = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk failure'); });
    expect(ProfileCompletionService.checkAndRewardCompletion('test-user', {}).success).toBe(false);
    expect(JSON.parse(fs.readFileSync(usersFile, 'utf8'))[0].profileCompletionReward).toBeUndefined();
    expect(PointsService.getPointsBalance('test-user').totalPoints).toBe(0);
    replace.mockRestore();
    expect(ProfileCompletionService.checkAndRewardCompletion('test-user', {}).rewardGiven).toBe(true);
    expect(PointsService.getPointsBalance('test-user').totalPoints).toBe(500);
});
