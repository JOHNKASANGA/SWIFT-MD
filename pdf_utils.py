import io
import httpx
from pypdf import PdfReader


def extract_text_from_url(file_url: str) -> str:
    """Download a PDF from a URL and extract all its text."""
    
    # Download the PDF bytes
    response = httpx.get(file_url, timeout=30.0)
    response.raise_for_status()
    
    # Read the PDF from memory (not from a file on disk)
    pdf_stream = io.BytesIO(response.content)
    reader = PdfReader(pdf_stream)
    
    # Extract text from every page
    text_parts = []
    for page in reader.pages:
        text_parts.append(page.extract_text())
    
    return "\n\n".join(text_parts)