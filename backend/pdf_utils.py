import io
import re
import httpx
from pypdf import PdfReader

def get_direct_url(file_url: str) -> str:
    """Resolve MediaFire or other indirect URLs to a direct download URL."""
    
    if "mediafire.com" in file_url:
        response = httpx.get(file_url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()
        
        # Extract direct download link from MediaFire page
        match = re.search(r'href="(https://download\d+\.mediafire\.com/[^"]+)"', response.text)
        if not match:
            raise ValueError(f"Could not find direct download link on MediaFire page: {file_url}")
        
        return match.group(1)
    
    return file_url


def extract_text_from_url(file_url: str) -> str:
    """Download a PDF from a URL and extract all its text."""
    
    # Resolve indirect URLs
    direct_url = get_direct_url(file_url)
    
    # Handle Google Drive large file virus scan page
    if "drive.usercontent.google.com" in direct_url or "drive.google.com" in direct_url:
        response = httpx.get(direct_url, timeout=60.0, follow_redirects=True)
        response.raise_for_status()
        
        # Check if we got a virus scan confirmation page
        if b"Google Drive - Virus scan warning" in response.content or b"confirm=" in str(response.url):
            confirm_match = re.search(r'confirm=([^&"]+)', str(response.url))
            if confirm_match:
                confirm_token = confirm_match.group(1)
                file_id_match = re.search(r'id=([^&]+)', direct_url)
                if file_id_match:
                    file_id = file_id_match.group(1)
                    direct_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm={confirm_token}&authuser=0"
                    response = httpx.get(direct_url, timeout=60.0, follow_redirects=True)
                    response.raise_for_status()
        
        pdf_bytes = response.content
    else:
        response = httpx.get(direct_url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()
        pdf_bytes = response.content
    
    # Read the PDF from memory
    pdf_stream = io.BytesIO(pdf_bytes)
    reader = PdfReader(pdf_stream)
    
    # Extract text from every page
    text_parts = []
    for page in reader.pages:
        text_parts.append(page.extract_text())
    
    return "\n\n".join(text_parts)