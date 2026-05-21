#!/bin/bash

# Exit on user interrupt (Ctrl+C)
trap "echo 'Download stopped by user.'; exit 0" SIGINT

if [ -z "$1" ]; then
    echo "Usage: $0 <youtube_live_url> [output_file.ts]"
    echo "Example: $0 https://www.youtube.com/watch?v=XXXXXX my_livestream.ts"
    exit 1
fi

URL="$1"
# Default to .ts for safer concatenation if the stream drops
OUTPUT_FILE="${2:-"livestream_$(date +%Y%m%d_%H%M%S).ts"}"

echo "======================================"
echo "Target URL  : $URL"
echo "Output File : $OUTPUT_FILE"
echo "======================================"

while true; do
    echo "[*] Extracting direct stream URL using yt-dlp..."
    # Get the raw m3u8 URL from YouTube up to 1080p
    STREAM_URL=$(yt-dlp -f "bestvideo[height<=1080]+bestaudio/best" -g "$URL" 2>/dev/null)

    if [ -z "$STREAM_URL" ]; then
        echo "[!] Failed to get stream URL. The stream might be offline."
        echo "[*] Retrying in 10 seconds..."
        sleep 10
        continue
    fi

    echo "[*] Starting ffmpeg download..."
    # Use a temporary file for the current chunk to allow safe appending
    TEMP_FILE="chunk_$(date +%s).ts"

    # Download without re-encoding (-c copy)
    ffmpeg -y -i "$STREAM_URL" -c copy "$TEMP_FILE"
    
    EXIT_CODE=$?

    # Append the downloaded chunk to the final output file
    if [ -f "$TEMP_FILE" ]; then
        echo "[*] Appending chunk to $OUTPUT_FILE..."
        cat "$TEMP_FILE" >> "$OUTPUT_FILE"
        rm "$TEMP_FILE"
    fi

    # Check if ffmpeg exited gracefully (usually means the stream naturally ended)
    if [ $EXIT_CODE -eq 0 ]; then
        echo "[*] Stream ended or downloaded successfully."
        break
    else
        echo "[!] Stream interrupted (ffmpeg exit code $EXIT_CODE)."
        echo "[*] Reconnecting in 5 seconds to resume..."
        sleep 5
    fi
done
