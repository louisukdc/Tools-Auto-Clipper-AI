param (
    [Parameter(Mandatory=$true)][string]$Url
)

$Basename = "livestream_$(Get-Date -Format 'yyyyMMdd')"

while ($true) {
    Write-Host "Fetching live stream URL..." -ForegroundColor Cyan
    # Get the m3u8 URL from yt-dlp up to 1080p
    $StreamUrl = yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -g $Url

    if (-not $StreamUrl) {
        Write-Host "Failed to get stream URL. Retrying in 10 seconds..." -ForegroundColor Red
        Start-Sleep -Seconds 10
        continue
    }

    $Timestamp = Get-Date -Format 'HHmmss'
    $Output = "${Basename}_${Timestamp}.ts"

    Write-Host "Downloading to $Output..." -ForegroundColor Green
    
    # Run ffmpeg without re-encoding
    ffmpeg -i $StreamUrl -c copy $Output

    Write-Host "Stream interrupted. Retrying in 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}
