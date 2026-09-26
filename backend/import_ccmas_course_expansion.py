"""Import Swift's approved CCMAS Engineering expansion and starter resources.

Run from backend after applying the matching Supabase migration:
    python import_ccmas_course_expansion.py

The script is deliberately idempotent. It finds a course by code before
creating it, and a starter material by its course code plus URL before creating
it. It never changes existing course materials.
"""

import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import create_client


load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)


RESOURCES = {
    "anatomy": {
        "title": "OpenStax Anatomy and Physiology 2e",
        "url": "https://openstax.org/details/books/anatomy-and-physiology-2e",
        "source": "OpenStax",
        "category": "textbooks",
        "kind": "website",
    },
    "biology": {
        "title": "OpenStax Biology 2e",
        "url": "https://openstax.org/details/books/biology-2e",
        "source": "OpenStax",
        "category": "textbooks",
        "kind": "website",
    },
    "civil_intro": {
        "title": "MIT OCW: Introduction to Civil Engineering",
        "url": "https://ocw.mit.edu/courses/res.ll-004-ll-educate-introduction-to-engineering-concepts-spring-2022/pages/civil-engineering/",
        "source": "MIT OpenCourseWare",
        "category": "references",
        "kind": "website",
    },
    "mechanics": {
        "title": "MIT OCW: Mechanics and Materials I",
        "url": "https://ocw.mit.edu/courses/2-001-mechanics-materials-i-fall-2006/",
        "source": "MIT OpenCourseWare",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "solid_mechanics": {
        "title": "MIT OCW: Engineering Mechanics I lecture notes",
        "url": "https://ocw.mit.edu/courses/1-050-engineering-mechanics-i-fall-2007/pages/lecture-notes/",
        "source": "MIT OpenCourseWare",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "fluid_mechanics": {
        "title": "NPTEL: Fluid Mechanics",
        "url": "https://nptel.ac.in/courses/105103192",
        "source": "NPTEL, IIT Guwahati",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "structural": {
        "title": "MIT OCW: Structural Mechanics",
        "url": "https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/",
        "source": "MIT OpenCourseWare",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "materials_mechanics": {
        "title": "MIT OCW: Mechanics of Materials",
        "url": "https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/",
        "source": "MIT OpenCourseWare",
        "category": "textbooks",
        "kind": "external_course",
    },
    "soil": {
        "title": "NPTEL: Soil Mechanics",
        "url": "https://nptel.ac.in/courses/105103097",
        "source": "NPTEL, IIT Guwahati",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "surveying": {
        "title": "NPTEL: Modern Surveying Techniques",
        "url": "https://nptel.ac.in/courses/105104100",
        "source": "NPTEL",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "geology": {
        "title": "Physical Geology by Steven Earle",
        "url": "https://opengeology.org/textbook/",
        "source": "OpenGeology",
        "category": "textbooks",
        "kind": "website",
    },
    "civil_materials": {
        "title": "NPTEL: Concrete Technology",
        "url": "https://onlinecourses-archive.nptel.ac.in/noc18_ce20/preview",
        "source": "NPTEL, IIT Delhi",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "nand": {
        "title": "Nand2Tetris: From Nand to Tetris",
        "url": "https://www.nand2tetris.org/course",
        "source": "Nand2Tetris",
        "category": "practice",
        "kind": "external_course",
    },
    "nand_architecture": {
        "title": "Nand2Tetris Project 5: Computer Architecture",
        "url": "https://www.nand2tetris.org/project05",
        "source": "Nand2Tetris",
        "category": "practice",
        "kind": "website",
    },
    "nand_assembly": {
        "title": "Nand2Tetris Project 4: Machine Language",
        "url": "https://www.nand2tetris.org/project04",
        "source": "Nand2Tetris",
        "category": "practice",
        "kind": "website",
    },
    "measurement": {
        "title": "NPTEL: Electrical Measurement and Electronic Instruments",
        "url": "https://nptel.ac.in/courses/108105153",
        "source": "NPTEL, IIT Kharagpur",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "circuits": {
        "title": "All About Circuits: Lessons in Electric Circuits",
        "url": "https://www.allaboutcircuits.com/textbook/",
        "source": "All About Circuits",
        "category": "textbooks",
        "kind": "website",
    },
    "electromagnetics": {
        "title": "NPTEL: Electromagnetic Theory",
        "url": "https://nptel.ac.in/courses/108104087",
        "source": "NPTEL, IIT Kanpur",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "phase_diagrams": {
        "title": "DoITPoMS: Phase Diagrams and Solidification",
        "url": "https://www.doitpoms.ac.uk/tlplib/phase-diagrams/printall.php",
        "source": "University of Cambridge DoITPoMS",
        "category": "references",
        "kind": "website",
    },
    "ellingham": {
        "title": "DoITPoMS: Ellingham Diagrams",
        "url": "https://www.doitpoms.ac.uk/tlplib/ellingham_diagrams/printall.php",
        "source": "University of Cambridge DoITPoMS",
        "category": "references",
        "kind": "website",
    },
    "petroleum": {
        "title": "NPTEL: Petroleum Technology",
        "url": "https://nptel.ac.in/courses/103105221",
        "source": "NPTEL, IIT Kharagpur",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "petroleum_geology": {
        "title": "MIT OCW: Sedimentary Geology",
        "url": "https://ocw.mit.edu/courses/12-110-sedimentary-geology-spring-2007/",
        "source": "MIT OpenCourseWare",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "drilling": {
        "title": "NPTEL: Drilling Oil and Gas Wells",
        "url": "https://archive.nptel.ac.in/content/storage2/courses/103105110/m3l16.pdf",
        "source": "NPTEL",
        "category": "lecture_notes",
        "kind": "document",
    },
    "reservoir": {
        "title": "NPTEL: Petroleum Reservoir Engineering",
        "url": "https://nptel.ac.in/courses/103103223",
        "source": "NPTEL, IIT Guwahati",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "production": {
        "title": "NPTEL: Artificial Lift",
        "url": "https://nptel.ac.in/courses/103106220",
        "source": "NPTEL",
        "category": "lecture_notes",
        "kind": "external_course",
    },
    "control": {
        "title": "Control Tutorials for MATLAB and Simulink",
        "url": "https://ctms.engin.umich.edu/",
        "source": "University of Michigan",
        "category": "practice",
        "kind": "website",
    },
    "continuum": {
        "title": "NPTEL: Foundations of Continuum Mechanics",
        "url": "https://nptel.ac.in/courses/112106912",
        "source": "NPTEL, IIT Mandi",
        "category": "lecture_notes",
        "kind": "external_course",
    },
}


COURSES = [
    ("BME 102", "Introduction to Biomedical Engineering", 100, "Biomedical Engineering", "anatomy", "A first look at the biological systems and measurements used in biomedical engineering."),
    ("CEE 101", "Introduction to Civil Engineering", 100, "Civil Engineering", "civil_intro", "An overview of civil engineering fields and the infrastructure they create."),
    ("CPE 112", "Introduction to Computer Engineering", 100, "Computer Engineering", "nand", "A practical introduction to the hardware and software layers of a computer."),
    ("MEE 101", "Introduction to Mechanical Engineering", 100, "Mechanical Engineering", "mechanics", "A foundation in forces, structures, and engineering problem solving."),
    ("MME 102", "Introduction to Materials and Metallurgical Engineering", 100, "Materials and Metallurgical Engineering", "materials_mechanics", "An introduction to how material structure controls engineering behaviour."),
    ("PGE 101", "Introduction to Petroleum and Gas Industry", 100, "Petroleum and Gas Engineering", "petroleum", "A broad introduction to petroleum and gas production, storage, and processing."),
    ("TEL 102", "Introduction to Electrical Engineering", 100, "Electrical Engineering", "circuits", "A starter resource for electrical quantities, circuits, and analysis."),
    ("GET 207", "Applied Mechanics", 200, "Shared Engineering", "mechanics", "Core statics, stress, strain, and mechanics methods for engineering applications."),
    ("BME 211", "Human Anatomy I", 200, "Biomedical Engineering", "anatomy", "Structured anatomy material with diagrams, terminology, and review questions."),
    ("BME 213", "Human Physiology I", 200, "Biomedical Engineering", "anatomy", "Physiology foundations presented alongside the relevant anatomical systems."),
    ("BME 214", "General Biochemistry I", 200, "Biomedical Engineering", "biology", "Molecular biology and biochemical foundations for life-science study."),
    ("BME 215", "Human Genetics I", 200, "Biomedical Engineering", "biology", "Genetics foundations including inheritance, DNA, and gene expression."),
    ("CET 202", "Basic Electronics", 200, "Computer Engineering", "circuits", "Electronic components and circuit fundamentals needed before computer hardware work."),
    ("EEE 208", "Electrical Engineering Materials", 200, "Electrical Engineering", "materials_mechanics", "Material structure, properties, and engineering selection principles."),
    ("TEL 202", "Applied Electricity II", 200, "Electrical Engineering", "circuits", "Circuit-analysis practice and electricity concepts for engineering applications."),
    ("MEE 207", "Applied Mechanics", 200, "Mechanical Engineering", "mechanics", "Mechanics foundations with lecture notes and worked engineering examples."),
    ("PGE 201", "Petroleum Geology", 200, "Petroleum and Gas Engineering", "petroleum_geology", "Sedimentary-basin, rock, fossil-fuel, and petroleum-geology foundations."),
    ("CEE 301", "Fluid Mechanics", 300, "Civil Engineering", "fluid_mechanics", "A full IIT course on fluid statics, fluid flow, governing equations, and applications."),
    ("CEE 302", "Strength of Structural Materials", 300, "Civil Engineering", "materials_mechanics", "Stress, strain, deformation, and mechanical response of engineering materials."),
    ("CEE 303", "Engineering Geology", 300, "Civil Engineering", "geology", "Open introductory geology text for rocks, earth processes, and engineering context."),
    ("CEE 304", "Civil Engineering Materials", 300, "Civil Engineering", "civil_materials", "Concrete technology and construction-material fundamentals from a Civil Engineering course."),
    ("CEE 305", "Soil Mechanics I", 300, "Civil Engineering", "soil", "A full IIT course on soil behaviour and engineering use."),
    ("CEE 306", "Design of Structures I", 300, "Civil Engineering", "structural", "Structural modelling, deformation, stability, and design principles."),
    ("CEE 307", "Structural Mechanics I", 300, "Civil Engineering", "structural", "Core structural mechanics covering beams, columns, buckling, and energy methods."),
    ("CEE 308", "Engineering Surveying and Photogrammetry I", 300, "Civil Engineering", "surveying", "Surveying techniques and measurements from an engineering course source."),
    ("CPE 301", "Computer Organisation and Architecture", 300, "Computer Engineering", "nand_architecture", "Build a computer architecture from logic gates through a working CPU."),
    ("CPE 302", "Measurement and Instrumentation", 300, "Computer Engineering", "measurement", "Core measurement systems and instrumentation principles from IIT material."),
    ("CPE 307", "Assembly Language Programming", 300, "Computer Engineering", "nand_assembly", "Hands-on machine-language and assembler exercises."),
    ("EEE 311", "Electric Circuit Theory I", 300, "Electrical Engineering", "circuits", "Free circuit theory lessons and exercises from basic laws through AC analysis."),
    ("EEE 321", "Analogue Electronic Circuits", 300, "Electrical Engineering", "circuits", "Analog component and circuit fundamentals as a structured free reference."),
    ("EEE 322", "Digital Electronic Circuits", 300, "Electrical Engineering", "nand", "Digital logic and computer-building projects with simulations and exercises."),
    ("EEE 324", "Electromagnetic Fields and Waves I", 300, "Electrical Engineering", "electromagnetics", "An IIT electromagnetic theory course covering fields and waves."),
    ("EEE 326", "Electric Circuit Theory II", 300, "Electrical Engineering", "circuits", "Further circuit analysis material for continued theory and practice."),
    ("MME 301", "Thermodynamics of Materials", 300, "Materials and Metallurgical Engineering", "phase_diagrams", "Thermodynamic ideas and phase diagrams applied to material systems."),
    ("MME 304", "Chemistry of Materials", 300, "Materials and Metallurgical Engineering", "ellingham", "Chemical thermodynamics and reaction behaviour in materials."),
    ("MME 305", "Engineering Materials: Structure and Properties", 300, "Materials and Metallurgical Engineering", "materials_mechanics", "Structure-property relationships and mechanical behaviour of materials."),
    ("MME 312", "Physical Metallurgy I", 300, "Materials and Metallurgical Engineering", "phase_diagrams", "Phase equilibria and solidification foundations for physical metallurgy."),
    ("PNG 308", "Drilling and Well Design I", 300, "Petroleum and Gas Engineering", "drilling", "An NPTEL drilling lecture that introduces the technical realities of well construction."),
    ("PNG 310", "Fundamentals of Reservoir Engineering", 300, "Petroleum and Gas Engineering", "reservoir", "A dedicated IIT reservoir-engineering course."),
    ("PNG 312", "Oil and Gas Production Engineering I", 300, "Petroleum and Gas Engineering", "production", "Production support and artificial-lift foundations from NPTEL."),
    ("SSG 321", "Continuum Mechanics I", 300, "Systems Engineering", "continuum", "An IIT course on stress, strain, conservation laws, and constitutive modelling."),
    ("SSG 322", "Control Theory I", 300, "Systems Engineering", "control", "Open control-system tutorials with MATLAB and Simulink examples."),
]


def existing_course(code: str):
    response = (
        supabase.table("courses")
        .select("id")
        .eq("code", code)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def material_exists(course_code: str, url: str) -> bool:
    response = (
        supabase.table("materials")
        .select("id")
        .eq("course_code", course_code)
        .eq("file_url", url)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def main():
    imported_courses = 0
    imported_materials = 0

    for code, title, level, department, resource_key, summary in COURSES:
        resource = RESOURCES[resource_key]
        course_payload = {
            "code": code,
            "title": title,
            "level": level,
            "description": f"CCMAS {department} course. Starter resource selected for the core subject area.",
            "department": department,
            "catalogue_source": "CCMAS Engineering and Technology 2023",
            "verification_status": "partially_verified",
        }

        course = existing_course(code)
        if course:
            supabase.table("courses").update(course_payload).eq("id", course["id"]).execute()
        else:
            supabase.table("courses").insert(course_payload).execute()
            imported_courses += 1

        if material_exists(code, resource["url"]):
            continue

        host = urlparse(resource["url"]).netloc
        supabase.table("materials").insert(
            {
                "course_code": code,
                "title": resource["title"],
                "file_url": resource["url"],
                "category": resource["category"],
                "category_confidence": 100,
                "category_source": "manual_review",
                "category_evidence": "Reviewed CCMAS starter resource.",
                "classification_status": "reviewed",
                "source_name": resource["source"] or host,
                "material_summary": summary,
                "resource_kind": resource["kind"],
            }
        ).execute()
        imported_materials += 1

    print(f"Courses created: {imported_courses}")
    print(f"Starter materials created: {imported_materials}")
    print(f"Approved CCMAS courses processed: {len(COURSES)}")


if __name__ == "__main__":
    main()
