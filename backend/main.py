from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
import uuid
import traceback
import ffmpeg
from models import Project
from renderer import render_project

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = "media/uploads"
PREVIEW_DIR = "media/previews"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# Static mounts
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/previews", StaticFiles(directory=PREVIEW_DIR), name="previews")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Video Editor Backend Running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    extension = os.path.splitext(file.filename)[1]
    filename = f"{file_id}{extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Get Duration using ffprobe
    duration = 10.0 # Default fallback
    try:
        probe = ffmpeg.probe(file_path)
        # format.duration is usually the container duration
        duration = float(probe['format']['duration'])
    except Exception as e:
        print(f"Error probing file {filename}: {e}")
        # traceback.print_exc()

    return {
        "id": file_id,
        "filename": filename,
        "url": f"/uploads/{filename}",
        "type": "video" if extension.lower() in ['.mp4', '.mov', '.avi'] else "audio",
        "duration": duration
    }

@app.post("/preview")
async def generate_preview(project: Project):
    try:
        preview_filename = f"preview_{project.id}.mp4"
        preview_path = os.path.join(PREVIEW_DIR, preview_filename)
        
        has_clips = any(len(t.clips) > 0 for t in project.tracks)
        if not has_clips:
             return {"url": "", "status": "empty"}

        result = render_project(project, preview_path, preset='ultrafast', crf=28)
        if not result:
            return {"url": "", "status": "error"}
        
        return {"url": f"/previews/{preview_filename}?t={str(uuid.uuid4())}", "status": "ready"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export")
async def export_video(project: Project):
    try:
        export_filename = f"export_{project.id}.mp4"
        export_path = os.path.join(PREVIEW_DIR, export_filename)
        
        result = render_project(project, export_path, preset='medium', crf=23)
        if not result:
            raise HTTPException(status_code=500, detail="Render failed")
            
        return {"url": f"/previews/{export_filename}", "status": "ready"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
