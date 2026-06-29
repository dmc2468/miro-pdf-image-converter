# Studio McLeod Miro PDF Image Converter

This project contains the current local prototype used by Studio McLeod to convert architectural PDF drawings into correctly scaled JPEG images for use in Miro.

The existing tool is a Python desktop app. It should be treated as the working prototype and behaviour reference for a future online version.

## Current desktop workflow

The current app allows the user to:

1. Drag or select one or more PDF files.
2. Choose page size:
   - A3
   - A4
3. Choose drawing scale:
   - 1:100
   - 1:50
   - 1:25
   - 1:20
4. Choose orientation:
   - Landscape
   - Portrait
5. Press Process.
6. Save correctly scaled JPEG files to the Downloads folder.

## Why this exists

Studio McLeod uses Miro for architectural design workshops, internal reviews, markups, and client presentations.

Miro is easier to work with when drawings are imported as images rather than PDFs.

This tool converts PDFs into JPEGs at specific pixel widths so the images appear at the intended visual scale inside Miro.

## Current scaling rules

The current app uses the following mapping:

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

These values should be preserved in the first online prototype.

## Desired online version

The first online version should reproduce the current Studio McLeod workflow as closely as possible.

The user should be able to:

1. Drag or upload one or more PDFs.
2. Choose drawing scale.
3. Choose paper size.
4. Choose paper orientation.
5. Press Process.
6. Download the resulting JPEG files, ideally as a ZIP file.
7. Import those images into Miro.

The first online version does not need to connect directly to Miro.

## MVP requirements

The online MVP should include:

- PDF upload or drag-and-drop.
- Support for A3 and A4.
- Support for Landscape and Portrait.
- Support for scales:
  - 1:100
  - 1:50
  - 1:25
  - 1:20
- Use the same pixel width mapping as the existing Python app.
- Convert each PDF page to a JPEG.
- Preserve page order.
- Return all generated JPEGs as a downloadable ZIP file.
- Delete uploaded and generated files after processing.

## Later improvements

Possible later improvements:

- Add 1:200 scale.
- Add A2, A1 or A0 if needed.
- Add PNG output.
- Add quality settings.
- Batch process multiple PDFs.
- Direct Miro API upload.
- Team login or shared team settings.

## Privacy requirements

The app may handle client drawings and confidential project information.

Uploaded files should not be stored permanently.

Recommended behaviour:

- Process files temporarily.
- Do not expose files publicly.
- Delete PDFs and generated images after download or after a short expiry period.
- Avoid logging file names, project names, or file contents where possible.
