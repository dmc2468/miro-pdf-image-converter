# Product Spec: Studio McLeod Miro PDF Image Converter

## Purpose

Create an online version of the existing Studio McLeod desktop PDF-to-JPEG converter.

The online version should preserve the current scaling behaviour so architectural PDF drawings can be converted into correctly scaled JPEG images for importing into Miro.

## Current desktop app

The current app is a Python desktop app.

Key source file:

MIRO Converter/PDFtoJPEGscaler.py

Current Python requirements:

- tkinterdnd2
- pdf2image
- pillow

The current app uses Poppler through pdf2image to render PDF pages.

## Current workflow

The user can:

1. Drag or select one or more PDF files.
2. Choose page size: A3 or A4.
3. Choose drawing scale: 1:100, 1:50, 1:25 or 1:20.
4. Choose orientation: Landscape or Portrait.
5. Press Process.
6. The app converts each PDF page into a JPEG.
7. JPEGs are saved to the Downloads folder.

## Required online MVP workflow

The web app should allow the user to:

1. Open a simple web page.
2. Drag or upload one or more PDF files.
3. Choose paper size.
4. Choose drawing scale.
5. Choose orientation.
6. Press Process.
7. Download the resulting JPEGs as a ZIP file.

The first web version does not need to upload directly to Miro.

## Scaling rules

The first online prototype must preserve this pixel-width mapping:

| Page Size | Orientation | Drawing Scale | Target Pixel Width |
|---|---|---:|---:|
| A3 | Landscape | 1:100 | 4180 |
| A3 | Landscape | 1:50 | 2090 |
| A3 | Landscape | 1:25 | 1045 |
| A3 | Landscape | 1:20 | 836 |
| A4 | Landscape | 1:100 | 2968 |
| A4 | Landscape | 1:50 | 1484 |
| A4 | Landscape | 1:25 | 742 |
| A4 | Landscape | 1:20 | 591 |
| A3 | Portrait | 1:100 | 4180 |
| A3 | Portrait | 1:50 | 1484 |
| A3 | Portrait | 1:25 | 742 |
| A3 | Portrait | 1:20 | 594 |
| A4 | Portrait | 1:100 | 2098 |
| A4 | Portrait | 1:50 | 1049 |
| A4 | Portrait | 1:25 | 525 |
| A4 | Portrait | 1:20 | 420 |

## Image processing behaviour

For each uploaded PDF:

1. Render each page from the PDF.
2. Get the selected target pixel width from the scale table.
3. Preserve the original page aspect ratio.
4. Resize the image to the target width.
5. Calculate height proportionally.
6. Save as JPEG.
7. Preserve page order in the filenames.
8. Return the generated JPEGs as a ZIP file.

## Error handling

The app should show a clear error if:

- no PDF is uploaded;
- the uploaded file is not a PDF;
- the selected size/orientation/scale combination has no scaling rule;
- PDF conversion fails;
- the output ZIP cannot be created.

## Privacy requirements

The app may handle confidential client/project drawings.

The online version should:

- store uploaded PDFs temporarily only;
- store generated JPEGs temporarily only;
- delete files after processing or after a short expiry period;
- avoid exposing uploaded files through public URLs.

## Suggested technical approach

A suitable MVP stack could be:

- Python backend using FastAPI or Flask.
- Simple HTML/CSS/JavaScript frontend.
- pdf2image and Poppler for PDF rendering.
- Pillow for resizing and JPEG output.
- Python zipfile module for ZIP downloads.
- Temporary folders for uploads and generated files.

## Later features

These should not block the first online prototype:

- Add 1:200 scale.
- Add A2, A1 or A0 paper sizes.
- Add PNG output.
- Add JPEG quality settings.
- Add direct Miro API upload.
- Add team login or team presets.

## Success criteria

The prototype is successful if a Studio McLeod team member can upload a PDF, choose the same scale/page/orientation options as the desktop app, download JPEGs, drag them into Miro, and get the same visual scaling result as the existing desktop app.