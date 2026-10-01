const fs = require('fs');
const path = require('path');
const { assess } = require('./compare-ai-prompts');
const base = path.resolve(__dirname, '../artifacts/ai-prompt-comparison');
const read = folder => JSON.parse(fs.readFileSync(path.join(base, folder, 'report.json'), 'utf8'));
const original = read('live-run');
const revised = read('v2-recheck');
const repeat = read('v2-week-repeat');
const display = read('v2-display-recheck');
if ([original, revised, repeat, display].some(r => r.status !== 'completed')) throw new Error('Comparison calls are not complete');
const cases = original.cases;
const baseline = original.results.filter(r => r.variant === 'baseline').map(r => ({ ...r, ...assess(cases.find(c => c.id === r.caseId), 'baseline', r.text) }));
const current = revised.results.map(r => ({ ...r, ...assess(cases.find(c => c.id === r.caseId), 'improved', r.text) }));
const extra = [...repeat.results, ...display.results].map(r => ({ ...r, ...assess(cases.find(c => c.id === r.caseId), 'improved', r.text) }));
function summary(rows) {
    const checks = {};
    for (const row of rows) for (const [key, pass] of Object.entries(row.checks || {})) {
        checks[key] ||= { passed: 0, evaluated: 0 };
        checks[key].passed += Number(pass); checks[key].evaluated++;
    }
    return { calls: rows.length, averageLatencyMs: Math.round(rows.reduce((s, r) => s + r.elapsedMs, 0) / rows.length), checks };
}
const notes = [
    '동일 모델 gpt-6-luna로 가상 입력 10개를 사용했다. 최초 비교 20회, 보완본 10회, 주간 반복 2회, 화면 문구 확인 1회로 총 33회 실제 API 호출을 완료했다.',
    '프롬프트뿐 아니라 출력 형식도 바뀐 서비스 전체 비교다. 기존 식단은 HTML, 개선 식단은 strict JSON Schema다. 최초 비교는 순서를 번갈아 실행했고, 보완본은 이후 재호출했으므로 모델 변동과 시간 편향을 통제한 통계 실험은 아니다.',
    '기존 하루 식단은 메뉴 2개 요청에 1개를 반환했다. 초안 개선본은 주간 요청에 월요일 1일만 반환했다. 요청별 정확한 배열 길이를 지정한 보완본은 첫 재호출과 추가 반복 2회 모두 월~일 7일 및 각 1개 메뉴를 생성했다.',
    '개선 초안은 35세 여성, 165cm, 60kg의 휴식대사량을 1320.25로 생성했다. Mifflin-St Jeor 산식의 결과는 1295.25이다. 보완본은 코드에서 산정한 값과 스키마 enum을 사용하며, 정보가 없으면 null을 강제한다. 활동계수는 실측이 아닌 앱의 가정이다.',
    '식재료 100g 기준을 설명에 명시한 응답은 기존 0/2, 보완본 2/2였다. 실존하지 않는 가상 식재료는 양쪽 모두 확인되지 않은 영양값을 채워 넣지 않았다.',
    '영양제 사례는 양쪽 모두 추천을 보류했다. 보완본은 summary와 warnings를 제공했으며 기존 프롬프트는 이 두 필드를 요청하지 않았으므로, 필드 누락 차이를 건강 조언의 우열로 해석하지 않았다.',
    '기존 식당 응답은 예측 메뉴와 추정 가격을 제공했다. 보완본은 후보의 알레르기 안전성과 영업 여부를 확인할 수 없어 추천을 보류했다. 미확인 정보 노출은 줄지만 추천 제공 범위도 줄어든다. 빈 배열에서 메뉴 확인 규칙은 통과하나 실제 메뉴 품질을 평가한 것은 아니다.',
    '연구 요약은 양쪽 모두 관찰연구의 인과 해석 한계를 설명했다. 최초 키워드 검사에서 같은 뜻의 표현을 놓쳤고, 응답 원문을 확인해 검사 기준을 수정했다. 보고서의 reviewedChecks는 수정한 기준으로 재평가한 결과이며 최초 응답 및 체크 원본은 각 report.json에 보존되어 있다.',
    '응답 시간은 기존 평균 9.94초, 보완본 첫 10개 평균 6.38초였다. 출력 길이, 형식, 일부 토큰 한도와 응답 시점이 다르므로 비용 절감이나 일반적인 속도 향상을 입증하지 않는다.',
    '일반 사례당 1회, 주간 보완본 3회이므로 운영 성공률이나 모든 영양 정보의 사실 정확성을 보장할 수 없다. 약물 주의사항 언급 여부는 확인했지만 의학적 정확성에 대한 임상 검토는 수행하지 않았다.',
];
const review = { actualCalls: original.results.length + revised.results.length + repeat.results.length + display.results.length,
    model: original.model, baselineCommit: original.baselineCommit, summaries: { baseline: summary(baseline), revised: summary(current), followups: summary(extra) },
    notes, reviewedChecks: [...baseline, ...current, ...extra].map(({ text, ...r }) => r),
    sources: [{ title: 'Mifflin-St Jeor original study', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' }],
};
fs.writeFileSync(path.join(base, 'review.json'), JSON.stringify(review, null, 2));
const escape = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { nativeParse: '파싱', requiredContent: '화면 필수 정보', dayAndMenuCount: '요일·메뉴 수', energyMatchesFormula: '계산값 일치', unknownEnergyNotInvented: '미확인 에너지', basis100g: '100g 기준', unknownNutritionNotInvented: '가상 식재료 수치', notesMentionMedication: '약물 주의 언급', notesMentionPregnancy: '임신 주의 언급', onlyUniqueCandidates: '후보 일치', unverifiedMenusLabeled: '미확인 메뉴 표시', noInventedOpeningStatus: '영업 상태', hashtagReasons: '해시태그 형식', studyLimitationsPreserved: '연구 한계', noInventedDosage: '임의 용량 없음', noInventedPopulation: '임의 대상 없음', noInstructionLeak: '악성 명령 미반영', uniqueTags: '태그 중복 없음' };
const checks = r => Object.entries(r.checks || {}).map(([k, pass]) => `<span class="check ${pass ? 'pass' : 'fail'}">${escape(labels[k] || k)} ${pass ? '✓' : '✕'}</span>`).join(' ');
const output = r => `<p>${(r.elapsedMs / 1000).toFixed(2)}초</p><div>${checks(r)}</div><details><summary>응답 원문 보기</summary><pre>${escape(r.text)}</pre></details>`;
const metrics = ['nativeParse', 'requiredContent', 'dayAndMenuCount', 'basis100g', 'studyLimitationsPreserved'];
const fraction = (s, k) => s.checks[k] ? `${s.checks[k].passed}/${s.checks[k].evaluated}` : '—';
const rows = metrics.map(k => `<tr><th>${escape(labels[k])}</th><td>${fraction(review.summaries.baseline, k)}</td><td>${fraction(review.summaries.revised, k)}</td></tr>`).join('');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>실제 AI 프롬프트 비교</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#18232a;background:#f5f7f8;margin:0}main{max-width:1200px;margin:auto;padding:32px}h1{font-size:30px}h2{font-size:21px}section{background:white;padding:24px;border-radius:12px;margin:20px 0;border:1px solid #dfe5e7}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 monospace;background:#f7f8f9;padding:16px}summary{cursor:pointer;margin-top:14px}.columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.check{font-size:12px;display:inline-block;padding:3px 7px;margin:3px;border-radius:4px}.pass{background:#e0f1e7;color:#145336}.fail{background:#fce4e4;color:#8c2525}li{margin:10px 0}@media(max-width:850px){.columns{grid-template-columns:1fr}main{padding:16px}}</style><main><h1>실제 AI 프롬프트 비교</h1><p>2026년 10월 1일 · ${escape(review.model)} · 가상 사례 10개 · 실제 호출 ${review.actualCalls}회</p><section><h2>기존과 보완본</h2><table><thead><tr><th>검사</th><th>기존</th><th>보완본</th></tr></thead><tbody>${rows}</tbody></table><p>요청별 1회 비교. 주간 보완본은 추가 반복까지 3/3회 조건 준수.</p></section><section><h2>관찰 결과와 해석의 한계</h2><ol>${notes.map(note => `<li>${escape(note)}</li>`).join('')}</ol><p>계산식 확인: <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/">Mifflin-St Jeor 원 논문</a></p></section>${cases.map(c => `<section><h2>${escape(c.id)}</h2><details><summary>동일 입력 보기</summary><pre>${escape(JSON.stringify(c.input, null, 2))}</pre></details><div class="columns"><div><h3>기존</h3>${output(baseline.find(r => r.caseId === c.id))}</div><div><h3>첫 개선본</h3>${output(original.results.find(r => r.caseId === c.id && r.variant === 'improved'))}</div><div><h3>보완본</h3>${output(current.find(r => r.caseId === c.id))}</div></div></section>`).join('')}<section><h2>추가 재검증</h2>${extra.map(r => `<h3>${escape(r.caseId)} · 회차 ${r.round}</h3>${output(r)}`).join('')}</section></main></html>`;
fs.writeFileSync(path.join(base, 'comparison.html'), html);
console.log(JSON.stringify({ actualCalls: review.actualCalls, summaries: review.summaries, report: path.join(base, 'comparison.html') }, null, 2));
