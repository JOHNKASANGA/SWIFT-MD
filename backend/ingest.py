import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)
course_data={
    "level_id":2,
    "code":"GET 206",
    "title":"Fluid Mechanics",
    "description":"Introduction to Fluid Mechanics "
}

course_result=supabase.table("courses").insert(course_data).execute()
course_id=course_result.data[0]["id"]
print(f"Created course: {course_data['code']}(id:{course_id})")

pdf_path="data/MEG 222 Week 11 Lecture All Lecturers.pdf"
file_name=os.path.basename(pdf_path)
storage_path=f"200/{course_data['code']}/{file_name}"

with open(pdf_path, "rb") as f:
    supabase.storage.from_("course-material").upload(
        storage_path,
        f,
        {"content-type":"application/pdf"}

    )

file_url=supabase.storage.from_("course-material").get_public_url(storage_path)
print (f"Uploaded:{file_url}")

material_data={
    "course_id":course_id,
    "title":"MEG 222 Week 11 Lecture All Lecturers",
    "file_url":file_url,
    "type":"notes"
}

supabase.table("materials").insert(material_data).execute()
print(f"Registered material :{material_data['title']}")
print("\n Done! Check supabase dashboard to verify")