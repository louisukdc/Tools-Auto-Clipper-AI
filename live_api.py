from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import subprocess
import asyncio
import time
import os

app = FastAPI(title="Live Downloader API")

os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception:
    pass

templates = Jinja2Templates(directory="templates")

class DownloadRequest(BaseModel):
    url: str
    start_time: str = ""
    end_time: str = ""

class DownloaderState:
    def __init__(self):
        self.is_running = False
        self.process = None
        self.url = None
        self.start_time = ""
        self.end_time = ""
        self.output_file = None
        self.status_msg = "Idle"

downloader = DownloaderState()

async def download_loop():
    if downloader.start_time or downloader.end_time:
        # One-off slice download using yt-dlp
        downloader.status_msg = "Slicing stream..."
        try:
            start = downloader.start_time or "0"
            end = downloader.end_time or "inf"
            cmd = [
                "yt-dlp",
                "--download-sections", f"*{start}-{end}",
                "-f", "best",
                "-o", downloader.output_file,
                downloader.url
            ]
            downloader.process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            while downloader.process.poll() is None:
                if not downloader.is_running:
                    downloader.process.terminate()
                    break
                await asyncio.sleep(1)
                
            if downloader.is_running:
                if downloader.process.returncode == 0:
                    downloader.status_msg = "Completed."
                else:
                    downloader.status_msg = "Error slicing stream."
                downloader.is_running = False
                
        except Exception as e:
            downloader.status_msg = f"Error: {str(e)}"
            downloader.is_running = False
            
    else:
        # Continuous live stream download with auto-reconnect
        while downloader.is_running:
            downloader.status_msg = "Extracting stream URL..."
            try:
                # Fetch direct stream URL
                result = await asyncio.to_thread(
                    subprocess.run, 
                    ["yt-dlp", "-f", "best", "-g", downloader.url], 
                    capture_output=True, text=True
                )
                stream_url = result.stdout.strip()
                
                if not stream_url:
                    downloader.status_msg = "Stream offline. Retrying..."
                    for _ in range(10):
                        if not downloader.is_running: break
                        await asyncio.sleep(1)
                    continue

                temp_file = f"chunk_{int(time.time())}.ts"
                downloader.status_msg = "Downloading..."
                
                ffmpeg_cmd = ["ffmpeg", "-y", "-i", stream_url, "-c", "copy", temp_file]

                downloader.process = subprocess.Popen(
                    ffmpeg_cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                
                # Wait for process to finish or be stopped
                while downloader.process.poll() is None:
                    if not downloader.is_running:
                        downloader.process.terminate()
                        break
                    await asyncio.sleep(1)

                # Append chunk to main output file
                if os.path.exists(temp_file):
                    downloader.status_msg = "Appending chunk..."
                    if os.path.exists(downloader.output_file):
                        with open(downloader.output_file, "ab") as f_out:
                            with open(temp_file, "rb") as f_in:
                                f_out.write(f_in.read())
                        os.remove(temp_file)
                    else:
                        os.rename(temp_file, downloader.output_file)

                if not downloader.is_running:
                    downloader.status_msg = "Stopped."
                    break

                if downloader.process.returncode == 0:
                    downloader.status_msg = "Completed."
                    downloader.is_running = False
                    break
                else:
                    downloader.status_msg = "Interrupted. Reconnecting..."
                    for _ in range(5):
                        if not downloader.is_running: break
                        await asyncio.sleep(1)

            except Exception as e:
                downloader.status_msg = f"Error: {str(e)}"
                await asyncio.sleep(5)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("live_index.html", {"request": request})

@app.post("/api/start")
async def start_download(req: DownloadRequest):
    if downloader.is_running:
        raise HTTPException(status_code=400, detail="A download is already running.")
    
    if not req.url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    downloader.is_running = True
    downloader.url = req.url
    downloader.start_time = req.start_time
    downloader.end_time = req.end_time
    downloader.output_file = f"livestream_{time.strftime('%Y%m%d_%H%M%S')}.ts"
    downloader.status_msg = "Starting..."
    
    asyncio.create_task(download_loop())
    return JSONResponse(content={"message": "Download started", "file": downloader.output_file})

@app.post("/api/stop")
async def stop_download():
    if not downloader.is_running:
        return JSONResponse(content={"message": "No download is currently running."})
    
    downloader.is_running = False
    if downloader.process:
        downloader.process.terminate()
        downloader.status_msg = "Stopping..."
        
    return JSONResponse(content={"message": "Download stopped successfully."})

@app.get("/api/status")
async def get_status():
    file_size = 0
    if downloader.output_file and os.path.exists(downloader.output_file):
        file_size = os.path.getsize(downloader.output_file)
        
    return JSONResponse(content={
        "is_running": downloader.is_running,
        "status_msg": downloader.status_msg,
        "output_file": downloader.output_file,
        "file_size_bytes": file_size
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("live_api:app", host="127.0.0.1", port=8000, reload=True)
