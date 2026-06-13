import io
import re
import httpx
from pypdf import PdfReader

# Optional docx support
try:
    from docx import Document as DocxDocument
    DOCX_SUPPORTED = True
except ImportError:
    DOCX_SUPPORTED = False

# File extensions we can handle
SUPPORTED_EXTENSIONS = ['.pdf', '.docx']

# File extensions we skip entirely
SKIP_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
    '.mp4', '.mp3', '.wav', '.avi', '.mov',
    '.ppt', '.pptx',
    '.xlsx', '.xls',
    '.doc',
    '.zip', '.rar',
]


def is_skippable(url: str) -> bool:
    url_lower = url.lower().split('?')[0]
    return any(url_lower.endswith(ext) for ext in SKIP_EXTENSIONS)


def is_docx(url: str) -> bool:
    url_lower = url.lower().split('?')[0]
    return url_lower.endswith('.docx')


def get_direct_url(file_url: str) -> str:
    """Resolve MediaFire or other indirect URLs to a direct download URL."""
    if "mediafire.com" in file_url:
        response = httpx.get(file_url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()
        match = re.search(r'href="(https://download\d+\.mediafire\.com/[^"]+)"', response.text)
        if not match:
            raise ValueError(f"Could not find direct download link on MediaFire page: {file_url}")
        return match.group(1)
    return file_url


def extract_text_from_url(file_url: str) -> str:
    """Download a file from a URL and extract all its text."""

    # Skip unsupported file types immediately
    if is_skippable(file_url):
        return ""

    # Resolve indirect URLs (MediaFire etc)
    try:
        direct_url = get_direct_url(file_url)
    except Exception:
        return ""

    # Download the file
    try:
        if "drive.usercontent.google.com" in direct_url or "drive.google.com" in direct_url:
            response = httpx.get(direct_url, timeout=60.0, follow_redirects=True)
            response.raise_for_status()

            # Handle Google Drive virus scan confirmation page
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

            file_bytes = response.content
        else:
            response = httpx.get(direct_url, timeout=30.0, follow_redirects=True)
            response.raise_for_status()
            file_bytes = response.content

    except Exception:
        return ""

    # Extract text based on file type
    try:
        if is_docx(file_url) or is_docx(direct_url):
            return extract_text_from_docx(file_bytes)
        else:
            return extract_text_from_pdf(file_bytes)
    except Exception:
        return ""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes."""
    try:
        pdf_stream = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_stream)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text and page_text.strip():
                text_parts.append(page_text.strip())
        return "\n\n".join(text_parts)
    except Exception:
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from docx bytes."""
    if not DOCX_SUPPORTED:
        return ""
    try:
        docx_stream = io.BytesIO(file_bytes)
        doc = DocxDocument(docx_stream)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception:
        return ""


def chunk_text(text: str, chunk_size: int = 4000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks for better question coverage."""
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at a sentence boundary
        if end < len(text):
            boundary = text.rfind('.', start + chunk_size - 500, end)
            if boundary > start:
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap
        if start >= len(text):
            break

    return chunks