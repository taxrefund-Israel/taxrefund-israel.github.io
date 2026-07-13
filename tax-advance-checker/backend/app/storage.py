"""File storage. Stores every uploaded file; never deletes.

Two backends: MinIO (production, on the office server) and local filesystem
(zero-dependency local preview), selected by settings.storage_backend.
"""
import io
import os
import uuid
from datetime import timedelta

from app.config import settings

_client = None


def _is_local() -> bool:
    return settings.storage_backend == "local"


def _local_path(key: str) -> str:
    return os.path.join(settings.local_storage_dir, key.replace("/", os.sep))


def client():
    from minio import Minio
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        if not _client.bucket_exists(settings.minio_bucket):
            _client.make_bucket(settings.minio_bucket)
    return _client


def upload(data: bytes, original_filename: str, prefix: str = "uploads") -> str:
    key = f"{prefix}/{uuid.uuid4()}/{original_filename}"
    if _is_local():
        path = _local_path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return key
    client().put_object(
        settings.minio_bucket, key, io.BytesIO(data), length=len(data),
        content_type="application/octet-stream",
    )
    return key


def download(key: str) -> bytes:
    if _is_local():
        with open(_local_path(key), "rb") as f:
            return f.read()
    resp = client().get_object(settings.minio_bucket, key)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def presigned_url(key: str, expires_minutes: int = 60) -> str:
    return client().presigned_get_object(
        settings.minio_bucket, key, expires=timedelta(minutes=expires_minutes)
    )
