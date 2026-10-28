param([string]$OutputDirectory = "$PSScriptRoot\film4_output")
$ErrorActionPreference = 'Stop'
$items = Get-Content -LiteralPath "$OutputDirectory\narration.json" -Raw -Encoding utf8 | ConvertFrom-Json
$voiceDirectory = Join-Path $OutputDirectory 'voice'
New-Item -Path $voiceDirectory -ItemType Directory -Force | Out-Null
$speaker = New-Object -ComObject SAPI.SpVoice
$chinese = @($speaker.GetVoices() | Where-Object { $_.GetDescription() -match 'Huihui|Chinese' })
if ($chinese.Count -eq 0) { throw 'No local Chinese SAPI voice installed.' }
$speaker.Voice = $chinese[0]
$report = @()
for ($i=0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $target = Join-Path $voiceDirectory ('{0:D2}.wav' -f $i)
    $slot = [double]$item.end - [double]$item.start
    $fits = $false
    for ($rate=0; $rate -le 10; $rate++) {
        $stream = New-Object -ComObject SAPI.SpFileStream
        $stream.Format.Type = 22
        $stream.Open($target,3,$false)
        $speaker.AudioOutputStream = $stream
        $speaker.Rate = $rate
        $speaker.Speak([string]$item.text) | Out-Null
        $stream.Close()
        $duration = [double](& python -c "import wave,sys; w=wave.open(sys.argv[1]); print(w.getnframes()/w.getframerate())" $target)
        if ($duration -le $slot - 0.12) { $fits=$true; break }
    }
    if (-not $fits) { throw "Narration $i cannot fit its assigned slot." }
    $report += [pscustomobject]@{ index=$i; rate=$rate; seconds=$duration; slot=$slot; text=$item.text }
    Write-Output "VOICE $i duration=$([math]::Round($duration,2)) rate=$rate"
}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$OutputDirectory\voice-synthesis.json" -Encoding utf8
