#!/usr/bin/env python3
"""
Screenshot Storage - Google Cloud Storage Integration
Stores email screenshots and generates public URLs
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from google.cloud import storage
from google.oauth2 import service_account
import hashlib

class ScreenshotStorage:
    def __init__(self, 
                 project_id: str,
                 bucket_name: str,
                 credentials_path: str = None,
                 bucket_region: str = "us-central1"):
        """Initialize GCS screenshot storage
        
        Args:
            project_id: GCP Project ID
            bucket_name: GCS bucket name for screenshots
            credentials_path: Path to service account JSON
            bucket_region: GCS bucket region
        """
        self.project_id = project_id
        self.bucket_name = bucket_name
        self.bucket_region = bucket_region
        
        # Initialize GCS client
        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(credentials_path)
            self.client = storage.Client(credentials=credentials, project=project_id)
        else:
            # Use default credentials
            self.client = storage.Client(project=project_id)
        
        self.bucket = None
        self.setup_bucket()
        print(f"✅ Screenshot storage initialized (bucket: {bucket_name})")
    
    def setup_bucket(self):
        """Connect to existing bucket or create if it doesn't exist"""
        try:
            # First try to get the existing bucket
            try:
                self.bucket = self.client.get_bucket(self.bucket_name)
                print(f"✅ Using existing bucket: {self.bucket_name}")
                return
            except Exception:
                # Bucket doesn't exist, try to create it
                pass
            
            # Try to create bucket if it doesn't exist
            print(f"🪣 Creating bucket: {self.bucket_name}")
            self.bucket = self.client.create_bucket(
                self.bucket_name,
                location=self.bucket_region
            )
            
            # Note: With uniform bucket-level access, public access is managed at bucket level
            # Individual objects inherit the bucket's access policy
            print(f"✅ Created bucket: {self.bucket_name}")
            print(f"💡 Note: Bucket uses uniform bucket-level access for security")
                
        except Exception as e:
            print(f"❌ Error setting up bucket: {e}")
            print("💡 Make sure you have proper GCS permissions and the bucket name is unique")
            raise
    
    def generate_filename(self, email_data: Dict[str, Any], file_extension: str = "png") -> str:
        """Generate unique filename for screenshot"""
        # Create hash from email data for consistency
        sender = email_data.get('sender_email', 'unknown')
        subject = email_data.get('subject', 'no-subject')
        received = email_data.get('received_date', str(datetime.now()))
        
        # Clean sender domain for folder structure
        domain = sender.split('@')[-1] if '@' in sender else 'unknown'
        domain = "".join(c for c in domain if c.isalnum() or c in ('-', '_')).lower()
        
        # Create hash for unique filename
        content_hash = hashlib.md5(f"{sender}:{subject}:{received}".encode()).hexdigest()[:12]
        
        # Date for organization
        date_str = datetime.now().strftime("%Y%m%d")
        
        # Final filename: brand/date/hash.png
        filename = f"email-screenshots/{domain}/{date_str}/{content_hash}.{file_extension}"
        return filename
    
    def upload_screenshot(self, 
                         local_file_path: str, 
                         email_data: Dict[str, Any],
                         make_public: bool = True) -> Optional[str]:
        """Upload screenshot to GCS and return public URL
        
        Args:
            local_file_path: Path to local screenshot file
            email_data: Email data for filename generation
            make_public: Whether to make the file publicly accessible (ignored with uniform bucket access)
            
        Returns:
            Public URL of uploaded screenshot or None if failed
        """
        if not os.path.exists(local_file_path):
            print(f"❌ Screenshot file not found: {local_file_path}")
            return None
        
        try:
            # Generate cloud filename
            cloud_filename = self.generate_filename(email_data)
            
            # Upload file
            blob = self.bucket.blob(cloud_filename)
            
            # Set content type
            blob.content_type = 'image/png'
            
            # Upload with metadata
            metadata = {
                'sender_email': email_data.get('sender_email', ''),
                'subject': email_data.get('subject', ''),
                'upload_date': datetime.now().isoformat(),
                'original_filename': os.path.basename(local_file_path)
            }
            blob.metadata = metadata
            
            print(f"📤 Uploading screenshot: {cloud_filename}")
            blob.upload_from_filename(local_file_path)
            
            # With uniform bucket-level access, files are automatically public if bucket is public
            # No need to call make_public() on individual objects
            
            # Generate public URL
            public_url = blob.public_url
            
            print(f"✅ Screenshot uploaded: {public_url}")
            return public_url
            
        except Exception as e:
            print(f"❌ Error uploading screenshot: {e}")
            return None
    
    def upload_from_bytes(self, 
                         image_bytes: bytes,
                         email_data: Dict[str, Any],
                         file_extension: str = "png",
                         make_public: bool = True) -> Optional[str]:
        """Upload screenshot from bytes data
        
        Args:
            image_bytes: Screenshot as bytes
            email_data: Email data for filename generation
            file_extension: File extension (png, jpg, etc.)
            make_public: Whether to make file publicly accessible (ignored with uniform bucket access)
            
        Returns:
            Public URL of uploaded screenshot or None if failed
        """
        try:
            # Generate cloud filename
            cloud_filename = self.generate_filename(email_data, file_extension)
            
            # Upload bytes
            blob = self.bucket.blob(cloud_filename)
            blob.content_type = f'image/{file_extension}'
            
            # Set metadata
            metadata = {
                'sender_email': email_data.get('sender_email', ''),
                'subject': email_data.get('subject', ''),
                'upload_date': datetime.now().isoformat(),
                'size_bytes': str(len(image_bytes))
            }
            blob.metadata = metadata
            
            print(f"📤 Uploading screenshot bytes: {cloud_filename}")
            blob.upload_from_string(image_bytes)
            
            # With uniform bucket-level access, files are automatically public if bucket is public
            # No need to call make_public() on individual objects
            
            # Generate public URL
            public_url = blob.public_url
            
            print(f"✅ Screenshot uploaded from bytes: {public_url}")
            return public_url
            
        except Exception as e:
            print(f"❌ Error uploading screenshot from bytes: {e}")
            return None
    
    def delete_screenshot(self, public_url: str) -> bool:
        """Delete screenshot from GCS using public URL
        
        Args:
            public_url: Public URL of the screenshot
            
        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            # Extract blob name from URL
            # Format: https://storage.googleapis.com/bucket-name/path/to/file.png
            url_parts = public_url.split(f"/{self.bucket_name}/")
            if len(url_parts) != 2:
                print(f"❌ Invalid URL format: {public_url}")
                return False
            
            blob_name = url_parts[1]
            blob = self.bucket.blob(blob_name)
            
            if blob.exists():
                blob.delete()
                print(f"🗑️ Deleted screenshot: {blob_name}")
                return True
            else:
                print(f"⚠️ Screenshot not found: {blob_name}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting screenshot: {e}")
            return False
    
    def list_screenshots(self, prefix: str = "email-screenshots/", limit: int = 100) -> list:
        """List screenshots in bucket
        
        Args:
            prefix: Folder prefix to filter by
            limit: Maximum number of results
            
        Returns:
            List of screenshot info dicts
        """
        try:
            blobs = self.client.list_blobs(
                self.bucket_name,
                prefix=prefix,
                max_results=limit
            )
            
            screenshots = []
            for blob in blobs:
                screenshots.append({
                    'name': blob.name,
                    'public_url': blob.public_url,
                    'size': blob.size,
                    'created': blob.time_created,
                    'metadata': blob.metadata or {}
                })
            
            return screenshots
            
        except Exception as e:
            print(f"❌ Error listing screenshots: {e}")
            return []
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            blobs = list(self.client.list_blobs(self.bucket_name, prefix="email-screenshots/"))
            
            total_size = sum(blob.size or 0 for blob in blobs)
            total_count = len(blobs)
            
            # Calculate size in MB
            size_mb = total_size / (1024 * 1024)
            
            return {
                'total_screenshots': total_count,
                'total_size_bytes': total_size,
                'total_size_mb': round(size_mb, 2),
                'bucket_name': self.bucket_name,
                'project_id': self.project_id
            }
            
        except Exception as e:
            print(f"❌ Error getting storage stats: {e}")
            return {}
    
    def cleanup_old_screenshots(self, days_old: int = 90) -> int:
        """Delete screenshots older than specified days
        
        Args:
            days_old: Delete screenshots older than this many days
            
        Returns:
            Number of screenshots deleted
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)
            blobs = self.client.list_blobs(self.bucket_name, prefix="email-screenshots/")
            
            deleted_count = 0
            for blob in blobs:
                if blob.time_created and blob.time_created.replace(tzinfo=None) < cutoff_date:
                    blob.delete()
                    deleted_count += 1
                    print(f"🗑️ Deleted old screenshot: {blob.name}")
            
            print(f"🧹 Cleanup completed: {deleted_count} old screenshots deleted")
            return deleted_count
            
        except Exception as e:
            print(f"❌ Error during cleanup: {e}")
            return 0
    
    def generate_signed_url(self, blob_name: str, expiration_hours: int = 24) -> Optional[str]:
        """Generate a signed URL for private bucket access
        
        Args:
            blob_name: Name of the blob in the bucket
            expiration_hours: How many hours the URL should be valid
            
        Returns:
            Signed URL that provides temporary access
        """
        try:
            blob = self.bucket.blob(blob_name)
            
            # Generate signed URL valid for specified hours
            signed_url = blob.generate_signed_url(
                expiration=datetime.now() + timedelta(hours=expiration_hours),
                method='GET'
            )
            
            return signed_url
            
        except Exception as e:
            print(f"❌ Error generating signed URL: {e}")
            return None
    
    def upload_screenshot_with_signed_url(self, 
                                        local_file_path: str, 
                                        email_data: Dict[str, Any],
                                        expiration_hours: int = 168) -> Optional[str]:  # 7 days default
        """Upload screenshot and return signed URL (works with private buckets)
        
        Args:
            local_file_path: Path to local screenshot file
            email_data: Email data for filename generation
            expiration_hours: How many hours the URL should be valid (default: 7 days)
            
        Returns:
            Signed URL of uploaded screenshot or None if failed
        """
        if not os.path.exists(local_file_path):
            print(f"❌ Screenshot file not found: {local_file_path}")
            return None
        
        try:
            # Generate cloud filename
            cloud_filename = self.generate_filename(email_data)
            
            # Upload file
            blob = self.bucket.blob(cloud_filename)
            
            # Set content type
            blob.content_type = 'image/png'
            
            # Upload with metadata
            metadata = {
                'sender_email': email_data.get('sender_email', ''),
                'subject': email_data.get('subject', ''),
                'upload_date': datetime.now().isoformat(),
                'original_filename': os.path.basename(local_file_path)
            }
            blob.metadata = metadata
            
            print(f"📤 Uploading screenshot: {cloud_filename}")
            blob.upload_from_filename(local_file_path)
            
            # Generate signed URL for access
            signed_url = blob.generate_signed_url(
                expiration=datetime.now() + timedelta(hours=expiration_hours),
                method='GET'
            )
            
            print(f"✅ Screenshot uploaded with signed URL (valid for {expiration_hours}h)")
            return signed_url
            
        except Exception as e:
            print(f"❌ Error uploading screenshot: {e}")
            return None

# Example usage and testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Screenshot Storage Manager")
    parser.add_argument('--project-id', required=True, help='GCP Project ID')
    parser.add_argument('--bucket-name', required=True, help='GCS Bucket name')
    parser.add_argument('--credentials', help='Path to service account JSON')
    parser.add_argument('--test', action='store_true', help='Run basic tests')
    parser.add_argument('--stats', action='store_true', help='Show storage statistics')
    parser.add_argument('--list', action='store_true', help='List screenshots')
    parser.add_argument('--cleanup', type=int, help='Cleanup screenshots older than N days')
    
    args = parser.parse_args()
    
    # Initialize storage
    storage = ScreenshotStorage(
        project_id=args.project_id,
        bucket_name=args.bucket_name,
        credentials_path=args.credentials
    )
    
    if args.test:
        print("🧪 Running basic tests...")
        
        # Test filename generation
        test_email = {
            'sender_email': 'test@example.com',
            'subject': 'Test Email',
            'received_date': '2024-01-01T12:00:00Z'
        }
        filename = storage.generate_filename(test_email)
        print(f"Generated filename: {filename}")
        
    elif args.stats:
        stats = storage.get_storage_stats()
        print("📊 Storage Statistics:")
        for key, value in stats.items():
            print(f"   {key}: {value}")
            
    elif args.list:
        screenshots = storage.list_screenshots(limit=10)
        print(f"📷 Recent Screenshots ({len(screenshots)}):")
        for shot in screenshots:
            print(f"   {shot['name']} - {shot['size']} bytes")
            
    elif args.cleanup:
        deleted = storage.cleanup_old_screenshots(args.cleanup)
        print(f"✅ Cleanup completed: {deleted} screenshots deleted")
        
    else:
        print("📷 Screenshot Storage Manager")
        print("Use --help for available commands") 