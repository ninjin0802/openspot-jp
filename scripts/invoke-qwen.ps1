param(
    [Parameter(Mandatory = $true)]
    [string]$PromptFile,
    [string]$Model = "qwen3.5:4b"
)

$promptPath = Resolve-Path -LiteralPath $PromptFile
$prompt = Get-Content -Raw -LiteralPath $promptPath
$body = @{
    model = $Model
    stream = $false
    think = $false
    format = "json"
    options = @{ temperature = 0 }
    messages = @(
        @{ role = "system"; content = "You are the OpenSpot JP implementation worker. Return strict JSON only." },
        @{ role = "user"; content = $prompt }
    )
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:11434/api/chat" -ContentType "application/json" -Body $body
$response.message.content
