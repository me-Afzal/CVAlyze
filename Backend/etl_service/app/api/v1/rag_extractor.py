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
You are a precise resume extraction system. Extract data as JSON with keys: [name, profession, phone_number, email, location, github_link, linkedin_link, skills, education, experience, projects, certifications, achievements]

Rules:
1. **Invalid Resume Handling**: If the provided "Resume Text" does not appear to be a valid CV or resume, set all string fields to `null` and all list fields to `[]`. Do not attempt to extract partial information if the document is not a resume.

2. Personal Info: String or null. location = contact address only (ignore job/edu locations). Extract first github.com/linkedin.com/in/ URLs.

3. profession: Title Case format.
- Tech: "Role (Technology)" - Full Stack Developer (Python/MERN/MEAN/Java), Frontend Developer (React/Angular/Vue), Backend Developer (Node.js/Python/Java), Mobile Developer (Android/iOS/React Native/Flutter), Data Scientist (AI/ML), Data Analyst, Machine Learning Engineer, DevOps Engineer, Cloud Engineer (AWS/Azure/GCP), Software Engineer, QA Engineer, UI/UX Designer, Product Manager, Business Analyst
- Non-tech: Extract as-is in Title Case - Accountant, Hospital Administrator, Chef, Nurse, Teacher, Civil Engineer, Lawyer, Marketing Manager
- Remove Senior/Junior/Experienced. Null if unknown.

4. skills: List of strings or [].

5. education/experience/certifications/achievements: List of strings or [].
- education: Degree – Institution (Year)
- experience: Role – Organization
- certifications: Explicit certs only
- achievements: Max 10 words, core action/outcome

6. projects: List of {"name": "...", "links": [...]} or []. The "links" list MUST only contain project-specific URLs (GitHub/demo/live). Exclude all other links.** If no project-specific link is found, links = [] if none (never null)

Output: Pure JSON. [] for empty lists, null for missing values. No null in arrays.

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
