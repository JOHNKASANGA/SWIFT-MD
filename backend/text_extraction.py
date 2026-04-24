import os
from dotenv import load_dotenv
from supabase import create_client
from pdf_utils import extract_text_from_url

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# Get the first material from the database
result = supabase.table("materials").select("*").limit(1).execute()
material = result.data[0]

print(f"Extracting text from: {material['title']}")
print(f"URL: {material['file_url']}\n")

text = extract_text_from_url(material['file_url'])

print(f"Extracted {len(text)} characters")
print("\n--- First 500 characters ---")
print(text[:500])