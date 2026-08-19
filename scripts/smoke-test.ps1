param(
  [string]$BaseUrl = 'http://localhost:3000',
  [switch]$ConsumeSlot
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$availability = Invoke-RestMethod -Uri "$BaseUrl/api/access/availability"
Write-Output "名额检查：已用 $($availability.used)，剩余 $($availability.remaining)，每日 $($availability.limit)"

if (-not $ConsumeSlot) {
  Write-Output '只读检查完成。若要执行完整模拟并消耗一个名额，请加 -ConsumeSlot。'
  exit 0
}

$claim = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/access/claim" -ContentType 'application/json' -Body '{"serviceConsent":true,"researchConsent":false}'
$code = $claim.code
$experimentId = 'EXP-{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $code.Split('-')[0]
$headers = @{ 'x-access-code' = $code }

$answers = @(
  '我会先判断事情是否重要，再列出两三件必须完成的事；变化出现时保留目标，但调整顺序。',
  '陌生聚会里我通常先观察，遇到感兴趣的人会主动聊；如果只是礼貌社交，不会勉强自己一直活跃。',
  '朋友犯错时我会先确认事实，也照顾他的感受，不过该承担的责任仍然需要说清楚。',
  '面对不同观点，我会请对方解释依据；如果证据更好，我愿意修改原来的判断。',
  '压力来时会先紧张，然后把问题拆成步骤；睡眠不足时恢复会明显变慢。',
  '我喜欢有结构的计划，但不会为了计划本身而计划；路线不对时会及时换方法。',
  '独处能让我恢复精力，和信任的人合作也会增加动力，主动程度取决于安全感与事情价值。',
  '我对文字、配色和空间氛围比较敏感，也喜欢把不同领域的概念连接起来。',
  '冲突时我会先谈具体问题，再说明边界；对方愿意修复时，我也愿意继续合作。',
  '长期项目里，目标意义和责任清晰时我很能坚持；意义消失时会重新评估。'
)

$result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/interview" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body '{}'
foreach ($answer in $answers) {
  $payload = @{ answer = $answer } | ConvertTo-Json -Compress
  $result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/interview" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $payload
}

if ($result.type -ne 'report') { throw "预期生成 report，实际得到 $($result.type)" }
$restore = Invoke-RestMethod -Uri "$BaseUrl/api/session" -Headers $headers
$facetCount = ($result.report.dimensions | ForEach-Object { $_.facets.Count } | Measure-Object -Sum).Sum
if ($facetCount -ne 15) { throw "预期 15 个子特质，实际 $facetCount" }
if (-not $result.report.methodology.version) { throw '报告缺少专业判定方法版本' }
if (-not $result.report.confidence.components) { throw '报告缺少可信度分项' }
if (-not $result.report.evidenceAppendix) { throw '报告缺少可追溯证据索引' }

Write-Output "实验编号：$experimentId"
Write-Output "实验代码／访问码：$code"
Write-Output "结果链接：$BaseUrl/?code=$code"
Write-Output "报告：$($result.report.persona.title)；五维 $($result.report.dimensions.Count)；子特质 $facetCount；恢复状态 $($restore.current.type)"
