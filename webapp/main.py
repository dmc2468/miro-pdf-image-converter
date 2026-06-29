from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from pdf2image import convert_from_path
from pathlib import Path
from PIL import Image
import os
import shutil
import tempfile
import zipfile
import uuid


os.environ["PATH"] += os.pathsep + "/opt/homebrew/bin"

app = FastAPI(title="Studio McLeod Miro PDF Image Converter")
templates = Jinja2Templates(directory="webapp/templates")
APP_PASSWORD = os.environ.get("APP_PASSWORD")


PIXEL_WIDTHS = {
    ("A3", "Landscape", "1:100"): 4180,
    ("A3", "Landscape", "1:50"): 2090,
    ("A3", "Landscape", "1:25"): 1045,
    ("A3", "Landscape", "1:20"): 836,
    ("A4", "Landscape", "1:100"): 2968,
    ("A4", "Landscape", "1:50"): 1484,
    ("A4", "Landscape", "1:25"): 742,
    ("A4", "Landscape", "1:20"): 591,
    ("A3", "Portrait", "1:100"): 4180,
    ("A3", "Portrait", "1:50"): 1484,
    ("A3", "Portrait", "1:25"): 742,
    ("A3", "Portrait", "1:20"): 594,
    ("A4", "Portrait", "1:100"): 2098,
    ("A4", "Portrait", "1:50"): 1049,
    ("A4", "Portrait", "1:25"): 525,
    ("A4", "Portrait", "1:20"): 420,
}


def safe_stem(filename: str) -> str:
    stem = Path(filename).stem
    clean = "".join(c for c in stem if c.isalnum() or c in (" ", "-", "_")).strip()
    return clean or "converted_pdf"


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request,
        "index.html",
        {"error": None},
    )


@app.post("/convert")
async def convert_pdf(
    request: Request,
    files: list[UploadFile] = File(...),
    page_size: str = Form(...),
    scale: str = Form(...),
    orientation: str = Form(...),
    password: str = Form(""),
):
    if APP_PASSWORD and password != APP_PASSWORD:
        return templates.TemplateResponse(
            request,
            "index.html",
            {"error": "Incorrect password."},
            status_code=403,
        )
    key = (page_size, orientation, scale)
    pixel_width = PIXEL_WIDTHS.get(key)

    if not pixel_width:
        return templates.TemplateResponse(
        request,
        "index.html",
         {
            "error": f"No scaling rule found for {page_size}, {orientation}, {scale}.",
         },
         status_code=400,
        )

    job_id = str(uuid.uuid4())
    temp_root = Path(tempfile.gettempdir()) / "studio_mcleod_miro_converter" / job_id
    upload_dir = temp_root / "uploads"
    output_dir = temp_root / "outputs"

    upload_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_files = []

    try:
        for uploaded_file in files:
            if not uploaded_file.filename.lower().endswith(".pdf"):
                raise ValueError(f"{uploaded_file.filename} is not a PDF file.")

            input_path = upload_dir / uploaded_file.filename

            with input_path.open("wb") as buffer:
                shutil.copyfileobj(uploaded_file.file, buffer)

            pages = convert_from_path(str(input_path), dpi=300)
            base_name = safe_stem(uploaded_file.filename)
            multi_page = len(pages) > 1

            for index, page in enumerate(pages):
                aspect_ratio = page.height / page.width
                new_height = int(pixel_width * aspect_ratio)

                resized = page.resize(
                    (pixel_width, new_height),
                    Image.Resampling.LANCZOS,
                )

                if multi_page:
                    output_name = f"{base_name}_page{index + 1}.jpg"
                else:
                    output_name = f"{base_name}.jpg"

                output_path = output_dir / output_name
                resized.save(output_path, "JPEG", quality=95)
                generated_files.append(output_path)

        if not generated_files:
            raise ValueError("No JPEG files were generated.")

        zip_path = temp_root / "miro_converted_jpegs.zip"

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for image_path in generated_files:
                zip_file.write(image_path, arcname=image_path.name)

        return FileResponse(
            path=zip_path,
            filename="miro_converted_jpegs.zip",
            media_type="application/zip",
        )

    except Exception as error:
        return templates.TemplateResponse(
            request,
            "index.html",
            {"error": str(error)},
            status_code=500,
        )