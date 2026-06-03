import io
import os
import httpx
from pypdf import PdfReader


def extract_text_from_url(file_url: str) -> str:
    """Download a file from URL and extract text based on format."""
    
    response = httpx.get(file_url, timeout=60.0, follow_redirects=True)
    response.raise_for_status()
    
    # Detect file type from URL
    lower_url = file_url.lower()
    
    if lower_url.endswith(".docx"):
        return extract_docx(response.content)
    elif lower_url.endswith(".pptx"):
        return extract_pptx(response.content)
    else:
        return extract_pdf(response.content)


def extract_pdf(content: bytes) -> str:
    pdf_stream = io.BytesIO(content)
    reader = PdfReader(pdf_stream)
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n\n".join(text_parts)


def extract_docx(content: bytes) -> str:
    from docx import Document
    doc_stream = io.BytesIO(content)
    doc = Document(doc_stream)
    text_parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            text_parts.append(para.text)
    return "\n\n".join(text_parts)


def extract_pptx(content: bytes) -> str:
    from pptx import Presentation
    pptx_stream = io.BytesIO(content)
    prs = Presentation(pptx_stream)
    text_parts = []
    for slide in prs.slides:
        slide_text = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    if para.text.strip():
                        slide_text.append(para.text)
        if slide_text:
            text_parts.append("\n".join(slide_text))
    return "\n\n".join(text_parts)