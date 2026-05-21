from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import subprocess
import os
import uuid
import re

app = FastAPI(title="YouTube Downloader")

# Create directories
os.makedirs("templates", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("downloads", exist_ok=True)

# Try mounting static files
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception:
    pass

templates = Jinja2Templates(directory="templates")

# Store download progress
downloads = {}

class DownloadRequest(BaseModel):
    url: str
    quality: str = "best" # e.g. "1080p", "720p", "best"

def run_download(download_id: str, url: str, quality: str):
    format_str = "bestvideo+bestaudio/best"
    if quality != "best":
        format_str = f"bestvideo[height<={quality[:-1]}]+bestaudio/best"
    
    output_template = "downloads/%(title)s.%(ext)s"
    
    cmd = [
        "yt-dlp",
        "--newline",
        "-f", format_str,
        "-o", output_template,
        "--merge-output-format", "mp4",
        url
    ]
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        encoding="utf-8"
    )
    
    downloads[download_id]["status"] = "downloading"
    
    # Simple regex to catch percentage
    progress_regex = re.compile(r'\[download\]\s+([\d\.]+)\%')
    
    for line in process.stdout:
        match = progress_regex.search(line)
        if match:
            percent = float(match.group(1))
            downloads[download_id]["progress"] = percent
            
    process.wait()
    
    if process.returncode == 0:
        downloads[download_id]["status"] = "completed"
        downloads[download_id]["progress"] = 100
    else:
        downloads[download_id]["status"] = "failed"

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/download")
async def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    if not req.url or "youtube.com" not in req.url and "youtu.be" not in req.url:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
    download_id = str(uuid.uuid4())
    downloads[download_id] = {
        "url": req.url,
        "status": "starting",
        "progress": 0,
        "quality": req.quality
    }
    
    background_tasks.add_task(run_download, download_id, req.url, req.quality)
    
    return {"download_id": download_id, "message": "Download started"}

@app.get("/api/download/{download_id}/status")
async def get_download_status(download_id: str):
    if download_id not in downloads:
        raise HTTPException(status_code=404, detail="Download not found")
        
    return downloads[download_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
