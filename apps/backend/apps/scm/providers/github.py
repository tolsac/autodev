import subprocess
import requests
from django.conf import settings
from github import GithubIntegration, Github


class GitHubProvider:
    def __init__(self):
        self.app_id = settings.GITHUB_APP_ID
        self.private_key = settings.GITHUB_APP_PRIVATE_KEY
        self.app_name = settings.GITHUB_APP_NAME

    def _get_integration(self):
        return GithubIntegration(
            integration_id=int(self.app_id),
            private_key=self.private_key,
        )

    def get_installation_url(self) -> str:
        return f"https://github.com/apps/{self.app_name}/installations/new"

    def get_installation_access_token(self, installation_id: int) -> str:
        integration = self._get_integration()
        token = integration.get_access_token(installation_id)
        return token.token

    def get_installation_details(self, installation_id: int) -> dict:
        integration = self._get_integration()
        jwt_token = integration.create_jwt()
        response = requests.get(
            f"https://api.github.com/app/installations/{installation_id}",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        return response.json()

    def list_accessible_repos(self, installation_id: int) -> list[dict]:
        access_token = self.get_installation_access_token(installation_id)
        repos = []
        page = 1
        while True:
            response = requests.get(
                "https://api.github.com/installation/repositories",
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/vnd.github+json",
                },
                params={"per_page": 100, "page": page},
            )
            response.raise_for_status()
            data = response.json()
            for repo in data.get("repositories", []):
                repos.append({
                    "external_id": str(repo["id"]),
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "clone_url": repo["clone_url"],
                    "html_url": repo["html_url"],
                    "default_branch": repo.get("default_branch", "main"),
                    "private": repo["private"],
                    "language": repo.get("language"),
                    "description": repo.get("description", ""),
                    "updated_at": repo.get("updated_at"),
                })
            if len(data.get("repositories", [])) < 100:
                break
            page += 1
        return repos

    def clone_repo(self, installation_id: int, clone_url: str, target_path: str) -> None:
        access_token = self.get_installation_access_token(installation_id)
        auth_url = clone_url.replace(
            "https://github.com/",
            f"https://x-access-token:{access_token}@github.com/",
        )
        subprocess.run(
            ["git", "clone", "--depth", "1", auth_url, target_path],
            check=True,
            capture_output=True,
        )
