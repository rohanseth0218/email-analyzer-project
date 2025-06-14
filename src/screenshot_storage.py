import os
from google.cloud import storage
from google.oauth2 import service_account
import datetime

class ScreenshotStorage:
    def __init__(self, project_id, bucket_name, credentials_path, bucket_region=None):
        self.project_id = project_id
        self.bucket_name = bucket_name
        self.bucket_region = bucket_region
        self.credentials_path = credentials_path
        self.client = self._setup_client()
        self.bucket = self.client.bucket(self.bucket_name)

    def _setup_client(self):
        if os.path.exists(self.credentials_path):
            credentials = service_account.Credentials.from_service_account_file(self.credentials_path)
            return storage.Client(project=self.project_id, credentials=credentials)
        else:
            return storage.Client(project=self.project_id)

    def upload_screenshot_with_signed_url(self, local_path, expires_minutes=60*24*7):
        """
        Uploads a screenshot to GCP and returns a signed URL valid for expires_minutes (default 7 days).
        """
        try:
            filename = os.path.basename(local_path)
            blob = self.bucket.blob(filename)
            blob.upload_from_filename(local_path)
            print(f"✅ Uploaded screenshot to GCP: gs://{self.bucket_name}/{filename}")
            url = blob.generate_signed_url(
                expiration=datetime.timedelta(minutes=expires_minutes),
                method="GET",
                version="v4"
            )
            print(f"🌐 Signed URL: {url}")
            return url
        except Exception as e:
            print(f"❌ Failed to upload screenshot to GCP: {e}")
            return None 