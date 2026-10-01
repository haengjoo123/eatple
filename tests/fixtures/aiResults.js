const { schemas } = require('../../utils/aiContracts');
function fixture(schema) {
    if (schema.enum) return schema.enum[0];
    if (schema.pattern) return '#정보부족';
    const type = [].concat(schema.type)[0];
    if (type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([key, sub]) => [key, fixture(sub)]));
    if (type === 'array') return Array.from({ length: schema.minItems || 0 }, () => fixture(schema.items));
    return type === 'number' ? 100 : '정보 없음';
}
function result(task) {
    const value = fixture(schemas[task]);
    if (task === 'meal') {
        value.diagnosis.bmr = null;
        value.diagnosis.tee = null;
        value.days[0].day = '하루';
        value.days[0].menus.push(structuredClone(value.days[0].menus[0]));
    }
    return value;
}
module.exports = { result };
