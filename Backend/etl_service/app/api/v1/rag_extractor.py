"""Custom RAG extractor using Gemini API."""
import re
import json
import requests

class CvExtractor:
    """Custom CV extractor using Gemini API."""
    def __init__(self,api_key):
        self.api_key = api_key
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"

    # ---------- Post-process empty lists as None ----------
    def clean_empty_lists_as_none(self, data):
        """Convert empty lists or lists with only null/None to None.
        Also ensure projects[].links is always a list (never None) and contains NO null elements.
        """
        for key, value in data.items():
            if value is None:
                continue

            # Handle string "null" or empty string
            if isinstance(value, str):
                if value.strip().lower() == "null" or value.strip() == "":
                    data[key] = None

            # Handle lists
            elif isinstance(value, list):
                # Fix projects[].links inside the 'projects' field
                if key == "projects":
                    for project in value:
                        if isinstance(project, dict):
                            # Get links value
                            links = project.get("links")
                        
                            # Case 1: links is None, "null", "", or missing
                            if links in (None, "null", ""):
                                project["links"] = []
                        
                            # Case 2: links is a string - wrap it
                            elif isinstance(links, str):
                                clean_link = links.strip()
                                project["links"] = [clean_link] if clean_link and clean_link.lower() != "null" else []

                            # Case 3: links is a list - filter out null/None/empty elements
                            elif isinstance(links, list):
                                project["links"] = [
                                    link for link in links 
                                    if link is not None 
                                    and link != "null" 
                                    and (not isinstance(link, str) or link.strip())
                                ]
                        
                            # Case 4: anything else - set to empty list
                            else:
                                project["links"] = []

                # Check if list is empty or contains only null/None values
                if len(value) == 0:
                    data[key] = None
                elif all((v is None) or (
                    isinstance(v, str) and v.strip().lower() == "null") for v in value):
                    data[key] = None

        return data

    # ---------- Normalize GitHub and LinkedIn links ----------
    def normalize_links(self, data):
        """Ensure GitHub and LinkedIn links start with https."""
        github = data.get("github_link")
        if github and not github.startswith("http"):
            data["github_link"] = "https://" + github.strip()

        linkedin = data.get("linkedin_link")
        if linkedin and not linkedin.startswith("http"):
            data["linkedin_link"] = "https://" + linkedin.strip()

        return data

    # ---------- Main extraction ----------
    def extract(self, text):
        """Extract structured CV sections with Prompt Engineering."""

        combined_prompt = """
You are a resume extraction system. Extract JSON with keys: [name, profession, phone_number, email, location, github_link, linkedin_link, skills, education, experience, projects, certifications, achievements]

CRITICAL RULES:

1. **Invalid Resume Check**: If document lacks (name + contact) OR is not a CV/resume structure → Return ALL fields as null/[] with NO partial extraction.

2. **Personal Info**: String or null. location = contact address only. Extract first github.com/linkedin.com/in/ URL.

3. **profession**: Title Case.
   - Tech: "Role (Tech)" - Full Stack Developer (Python/MERN), Frontend Developer (React/Angular), Backend Developer (Node.js/Python), Mobile Developer (Android/iOS/Flutter), Data Scientist (AI/ML), DevOps Engineer, Cloud Engineer (AWS/Azure/GCP), Software Engineer, UI/UX Designer
   - Non-tech: Title Case as-is - Accountant, Nurse, Teacher, Lawyer, Marketing Manager
   - Remove Senior/Junior. Null if unknown.

4. **skills**: List of strings or []

5. **education/experience/certifications/achievements**: List of strings or []
   - education: "Degree – Institution (Year)"
   - experience: "Role – Organization"
   - certifications: Explicit only
   - achievements: Max 10 words

6. **projects**: [{"name": "...", "links": [...]}] or []
   - links = project-specific URLs (GitHub repo/demo/live site). Exclude all other links (LinkedIn, personal website, etc.)
   - links = [] if no project-specific URLs (never null)

Output: Pure JSON. [] for empty lists, null for missing strings. No null in arrays.

Resume Text:
"""
        combined_prompt += text

        headers = {"Content-Type": "application/json", "X-goog-api-key": self.api_key}
        payload = {"contents": [{"parts": [{"text": combined_prompt}]}]}

        # Call Gemini API
        try:
            response = requests.post(self.api_url,
                                     headers=headers,
                                     json=payload,
                                     timeout=180).json()
            raw_text = response["candidates"][0]["content"]["parts"][0]["text"]
            clean_json_text = re.sub(r"^```[a-zA-Z]*|```$", "", raw_text).strip()
            data = json.loads(clean_json_text)
            data = self.clean_empty_lists_as_none(data)
            data = self.normalize_links(data)
            return data
        except Exception as e:
            print(f"Error extracting sections: {e}")
            fallback_keys = ["name","profession","phone_number","email",
                             "location","github_link","linkedin_link",
                             "skills","education","experience","projects",
                             "certifications","achievements"]
            return {key: None for key in fallback_keys}
